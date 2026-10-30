import io
import re
import time
import wave
import json
import base64
import logging
from collections import defaultdict, OrderedDict
from typing import List, Optional, Dict, Any
from fastapi import APIRouter, HTTPException, Request, UploadFile, File, Form
from pydantic import BaseModel, Field

from ..services.ask_agent import (
    run_agent_loop,
    mcp_manager,
    detect_is_hindi_or_hinglish,
    get_live_dashboard_summary_fallback,
)
from ..services.ask_context import format_inr

logger = logging.getLogger("finvora.ask")

router = APIRouter(prefix="/api/ask", tags=["ask"])

# ── In-Memory IP Rate Limiter (20 requests per minute) ────────────────────────
_ip_request_history = defaultdict(list)
RATE_LIMIT_WINDOW_SECONDS = 60
MAX_REQUESTS_PER_WINDOW = 20


def check_rate_limit(client_ip: str) -> bool:
    """Enforces max 20 requests per minute per IP address."""
    now = time.time()
    timestamps = _ip_request_history[client_ip]
    valid_timestamps = [t for t in timestamps if now - t < RATE_LIMIT_WINDOW_SECONDS]
    _ip_request_history[client_ip] = valid_timestamps

    if len(valid_timestamps) >= MAX_REQUESTS_PER_WINDOW:
        return False

    valid_timestamps.append(now)
    return True


# ── In-Memory LRU Cache for TTS (Max 128 items) ──────────────────────────────
_tts_cache = OrderedDict()
MAX_TTS_CACHE_SIZE = 128


def get_cached_tts(text: str, language: str) -> Optional[dict]:
    key = (text, language)
    if key in _tts_cache:
        _tts_cache.move_to_end(key)
        return _tts_cache[key]
    return None


def set_cached_tts(text: str, language: str, result: dict):
    key = (text, language)
    _tts_cache[key] = result
    if len(_tts_cache) > MAX_TTS_CACHE_SIZE:
        _tts_cache.popitem(last=False)


# ── Helper for WAV Header Duration ───────────────────────────────────────────
def check_audio_duration_seconds(audio_bytes: bytes, filename: str) -> Optional[float]:
    """Inspects WAV header to estimate duration in seconds."""
    if (filename and filename.lower().endswith(".wav")) or audio_bytes.startswith(b"RIFF"):
        try:
            with wave.open(io.BytesIO(audio_bytes), "rb") as wf:
                frames = wf.getnframes()
                rate = wf.getframerate()
                if rate > 0:
                    return frames / float(rate)
        except Exception:
            pass
    return None


# ── Schemas ───────────────────────────────────────────────────────────────────
class ChatHistoryItem(BaseModel):
    role: str = Field(..., description="'user' or 'assistant'")
    content: str = Field(..., max_length=1500)


class ToolTraceItem(BaseModel):
    tool: str
    arguments: Dict[str, Any] = {}
    ok: bool = True
    ms: float = 0.0


class AskRequest(BaseModel):
    message: str = Field(..., min_length=1, max_length=500, description="User question (max 500 chars)")
    history: Optional[List[ChatHistoryItem]] = Field(default=[], description="Recent conversation turns (last 6)")
    language: Optional[str] = Field(default="auto", description="'auto' | 'en-IN' | 'hi-IN'")


class AskResponse(BaseModel):
    answer: str
    sources: List[str]
    disclaimer: str
    language: Optional[str] = "en-IN"
    tool_trace: List[ToolTraceItem] = []


class VoiceAskResponse(BaseModel):
    transcript: str
    answer: str
    audio_base64: str = ""
    mime: str = "audio/wav"
    language: str = "en-IN"
    tool_trace: List[ToolTraceItem] = []
    sources: List[str] = []
    disclaimer: str = ""
    error: Optional[str] = None


class TranscribeResponse(BaseModel):
    transcript: str
    language_code: str
    error: Optional[str] = None


class SpeakRequest(BaseModel):
    text: str = Field(..., min_length=1, max_length=3000)
    language: Optional[str] = Field(default="en-IN", description="'en-IN' | 'hi-IN'")


class SpeakResponse(BaseModel):
    audio_base64: str
    mime: str = "audio/wav"
    error: Optional[str] = None


DEFAULT_DISCLAIMER = "Responses are grounded in FINVORA financial records via MCP tools. Verify all high-impact actions in Risk Radar or Decisions before execution."


# ── Chat Endpoint ─────────────────────────────────────────────────────────────
@router.post("", response_model=AskResponse)
async def ask_finvora(
    body: AskRequest,
    request: Request,
):
    # 1. IP Rate Limiting
    client_ip = request.client.host if request.client else "127.0.0.1"
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        client_ip = forwarded.split(",")[0].strip()

    if not check_rate_limit(client_ip):
        raise HTTPException(
            status_code=429,
            detail="Rate limit exceeded. Maximum 20 requests per minute allowed.",
        )

    # 2. Extract and sanitize message (max 500 chars)
    user_message = body.message.strip()
    if len(user_message) > 500:
        user_message = user_message[:500]

    # Convert history
    history_dicts = [{"role": h.role, "content": h.content} for h in (body.history or [])]

    # 3. Run MCP Agent Loop
    try:
        agent_res = await run_agent_loop(
            user_message=user_message,
            history=history_dicts,
            language=body.language or "auto",
        )

        trace_items = [
            ToolTraceItem(
                tool=t.get("tool", ""),
                arguments=t.get("arguments", {}),
                ok=t.get("ok", True),
                ms=t.get("ms", 0.0),
            )
            for t in agent_res.get("tool_trace", [])
        ]

        return AskResponse(
            answer=agent_res.get("answer", ""),
            sources=agent_res.get("sources", ["FINVORA MCP Server"]),
            disclaimer=DEFAULT_DISCLAIMER,
            language=agent_res.get("language", "en-IN"),
            tool_trace=trace_items,
        )

    except Exception as exc:
        logger.error("Agent loop failed: %s", exc)
        fallback_answer = get_live_dashboard_summary_fallback()
        return AskResponse(
            answer=fallback_answer,
            sources=["Enterprise Database (Emergency Fallback)"],
            disclaimer=DEFAULT_DISCLAIMER,
            language="en-IN",
            tool_trace=[],
        )


# ── Full Bilingual Voice Flow Endpoint ────────────────────────────────────────
@router.post("/voice", response_model=VoiceAskResponse)
async def ask_finvora_voice(
    request: Request,
    file: UploadFile = File(...),
    language: Optional[str] = Form("auto"),
):
    """
    Complete bilingual voice interaction loop:
    1. Transcribe speech using transcribe_speech tool on FINVORA MCP server.
    2. Execute MCP agent loop with user question.
    3. Synthesize spoken response using synthesize_speech tool on FINVORA MCP server.
    Returns {transcript, answer, audio_base64, tool_trace, language}.
    """
    client_ip = request.client.host if request.client else "127.0.0.1"
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        client_ip = forwarded.split(",")[0].strip()

    if not check_rate_limit(client_ip):
        return VoiceAskResponse(
            transcript="",
            answer="Rate limit exceeded. Maximum 20 requests per minute allowed.",
            error="Rate limit exceeded.",
        )

    # 1. Read audio bytes
    audio_bytes = await file.read()
    if not audio_bytes:
        return VoiceAskResponse(
            transcript="",
            answer="Received empty audio recording.",
            error="Empty audio file.",
        )

    if len(audio_bytes) > 10 * 1024 * 1024:
        return VoiceAskResponse(
            transcript="",
            answer="Audio file size exceeds 10MB limit.",
            error="Audio size exceeds 10MB.",
        )

    fname = file.filename or "recording.webm"
    duration = check_audio_duration_seconds(audio_bytes, fname)
    if duration is not None and duration > 30.5:
        return VoiceAskResponse(
            transcript="",
            answer="Audio duration exceeds 30-second limit. Please record a shorter question.",
            error=f"Recording duration ({duration:.1f}s) exceeds 30-second limit.",
        )

    # 2. Transcribe via MCP transcribe_speech tool
    audio_b64 = base64.b64encode(audio_bytes).decode("ascii")
    mime = file.content_type or ("audio/webm" if fname.endswith(".webm") else "audio/wav")

    stt_out, stt_ok, stt_ms = await mcp_manager.execute_tool(
        "transcribe_speech",
        {"audio_base64": audio_b64, "mime": mime, "language_hint": language or "auto"},
    )

    try:
        stt_data = json.loads(stt_out) if isinstance(stt_out, str) else stt_out
    except Exception as exc:
        logger.error("STT JSON decode failed: %s | stt_out was: %r", exc, stt_out)
        stt_data = {"error": stt_out}

    if not stt_ok or "error" in stt_data or not stt_data.get("transcript"):
        err_msg = stt_data.get("error", "No speech detected in recording.")
        return VoiceAskResponse(
            transcript="",
            answer="Could not detect clear speech in your recording. Please try speaking again or use text input.",
            error=err_msg,
        )

    transcript = stt_data.get("transcript", "").strip()
    detected_lang = stt_data.get("language_code", "en-IN")

    # 3. Run Agent Loop with transcript
    agent_res = await run_agent_loop(
        user_message=transcript,
        history=[],
        language=language if language != "auto" else detected_lang,
    )

    answer = agent_res.get("answer", "")
    out_lang = agent_res.get("language", detected_lang)

    trace_items = [
        ToolTraceItem(
            tool="transcribe_speech",
            arguments={"mime": mime, "language_hint": language},
            ok=stt_ok,
            ms=stt_ms,
        )
    ]
    for t in agent_res.get("tool_trace", []):
        trace_items.append(
            ToolTraceItem(
                tool=t.get("tool", ""),
                arguments=t.get("arguments", {}),
                ok=t.get("ok", True),
                ms=t.get("ms", 0.0),
            )
        )

    # 4. Synthesize Spoken Answer via MCP synthesize_speech tool
    audio_base64 = ""
    tts_mime = "audio/wav"
    try:
        tts_out, tts_ok, tts_ms = await mcp_manager.execute_tool(
            "synthesize_speech",
            {"text": answer, "language": out_lang},
        )
        if tts_ok:
            tts_data = json.loads(tts_out) if isinstance(tts_out, str) else tts_out
            audio_base64 = tts_data.get("audio_base64", "")
            tts_mime = tts_data.get("mime", "audio/wav")
            trace_items.append(
                ToolTraceItem(
                    tool="synthesize_speech",
                    arguments={"language": out_lang},
                    ok=True,
                    ms=tts_ms,
                )
            )
    except Exception as exc:
        logger.warning("TTS synthesis failed in voice loop: %s", exc)

    return VoiceAskResponse(
        transcript=transcript,
        answer=answer,
        audio_base64=audio_base64,
        mime=tts_mime,
        language=out_lang,
        tool_trace=trace_items,
        sources=agent_res.get("sources", ["FINVORA MCP Server"]),
        disclaimer=DEFAULT_DISCLAIMER,
        error=None,
    )


# ── Standalone Speech-To-Text Endpoint (for backwards compatibility) ─────────
@router.post("/transcribe", response_model=TranscribeResponse)
async def transcribe_speech_endpoint(
    file: UploadFile = File(...),
    language_hint: Optional[str] = Form("auto"),
):
    """Transcribes user audio using transcribe_speech tool on FINVORA MCP server."""
    try:
        audio_bytes = await file.read()
        if not audio_bytes:
            return TranscribeResponse(transcript="", language_code="en-IN", error="Empty audio recording.")

        if len(audio_bytes) > 10 * 1024 * 1024:
            return TranscribeResponse(transcript="", language_code="en-IN", error="Audio file size exceeds 10MB limit.")

        fname = file.filename or "recording.wav"
        dur = check_audio_duration_seconds(audio_bytes, fname)
        if dur is not None and dur > 30.5:
            return TranscribeResponse(transcript="", language_code="en-IN", error=f"Recording duration ({dur:.1f}s) exceeds the 30-second limit.")

        audio_b64 = base64.b64encode(audio_bytes).decode("ascii")
        mime = file.content_type or ("audio/webm" if fname.endswith(".webm") else "audio/wav")

        out, ok, _ = await mcp_manager.execute_tool(
            "transcribe_speech",
            {"audio_base64": audio_b64, "mime": mime, "language_hint": language_hint or "auto"},
        )
        data = json.loads(out) if isinstance(out, str) else out
        if not ok or "error" in data:
            return TranscribeResponse(transcript="", language_code="en-IN", error=data.get("error", "Transcription error"))

        return TranscribeResponse(
            transcript=data.get("transcript", ""),
            language_code=data.get("language_code", "en-IN"),
            error=None,
        )
    except Exception as exc:
        return TranscribeResponse(transcript="", language_code="en-IN", error=str(exc))


# ── Text-To-Speech Endpoint (for the Listen Button) ───────────────────────────
@router.post("/speak", response_model=SpeakResponse)
async def speak_text_endpoint(
    body: SpeakRequest,
    request: Request,
):
    """Synthesizes speech using synthesize_speech tool on FINVORA MCP server with LRU cache."""
    client_ip = request.client.host if request.client else "127.0.0.1"
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        client_ip = forwarded.split(",")[0].strip()

    if not check_rate_limit(client_ip):
        return SpeakResponse(
            audio_base64="",
            mime="audio/wav",
            error="Rate limit exceeded. Maximum 20 voice requests per minute allowed.",
        )

    try:
        target_lang = body.language or "en-IN"
        if detect_is_hindi_or_hinglish(body.text) and target_lang == "en-IN":
            target_lang = "hi-IN"

        # Check LRU cache
        cached = get_cached_tts(body.text, target_lang)
        if cached:
            return SpeakResponse(
                audio_base64=cached["audio_base64"],
                mime=cached.get("mime", "audio/wav"),
                error=None,
            )

        # Call synthesize_speech tool via MCP server
        out, ok, _ = await mcp_manager.execute_tool(
            "synthesize_speech",
            {"text": body.text, "language": target_lang},
        )
        data = json.loads(out) if isinstance(out, str) else out

        if not ok or "error" in data or not data.get("audio_base64"):
            return SpeakResponse(
                audio_base64="",
                mime="audio/wav",
                error=data.get("error", "Speech synthesis unavailable."),
            )

        set_cached_tts(body.text, target_lang, data)
        return SpeakResponse(
            audio_base64=data["audio_base64"],
            mime=data.get("mime", "audio/wav"),
            error=None,
        )

    except Exception as exc:
        logger.warning("Synthesize speech endpoint error: %s", exc)
        return SpeakResponse(
            audio_base64="",
            mime="audio/wav",
            error=f"Speech synthesis unavailable: {str(exc)}",
        )
