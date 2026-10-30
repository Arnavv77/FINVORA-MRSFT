import os
import json
import logging
import asyncio
from typing import List, Dict, Any, Optional, Union
import httpx

logger = logging.getLogger("finvora.sarvam")

SARVAM_CHAT_URL = "https://api.sarvam.ai/v1/chat/completions"
SARVAM_STT_URL = "https://api.sarvam.ai/speech-to-text"
SARVAM_TTS_URL = "https://api.sarvam.ai/text-to-speech"

DEFAULT_PRIMARY_MODEL = "sarvam-105b"
FALLBACK_MODEL = "sarvam-30b"
DEFAULT_STT_MODEL = "saaras:v4"
FALLBACK_STT_MODEL = "saaras:v3"
DEFAULT_TTS_MODEL = "bulbul:v3"
DEFAULT_TTS_SPEAKER = "shubh"


def get_sarvam_api_key() -> str:
    """Retrieve SARVAM_API_KEY from os.environ safely without logging values."""
    return os.environ.get("SARVAM_API_KEY", "").strip()


def get_sarvam_config() -> tuple[str, str]:
    """Retrieve SARVAM_API_KEY and SARVAM_MODEL from os.environ safely."""
    key = get_sarvam_api_key()
    model = os.environ.get("SARVAM_MODEL", "").strip() or DEFAULT_PRIMARY_MODEL
    return key, model


def get_stt_config() -> tuple[str, str]:
    """Retrieve STT model configuration."""
    model = os.environ.get("SARVAM_STT_MODEL", "").strip() or DEFAULT_STT_MODEL
    return get_sarvam_api_key(), model


def get_tts_config() -> tuple[str, str, str]:
    """Retrieve TTS model and speaker configuration."""
    model = os.environ.get("SARVAM_TTS_MODEL", "").strip() or DEFAULT_TTS_MODEL
    speaker = os.environ.get("SARVAM_TTS_SPEAKER", "").strip() or DEFAULT_TTS_SPEAKER
    return get_sarvam_api_key(), model, speaker


async def call_sarvam_chat_raw(
    messages: List[Dict[str, Any]],
    tools: Optional[List[Dict[str, Any]]] = None,
    tool_choice: Optional[Union[str, Dict[str, Any]]] = "auto",
    temperature: float = 0.2,
    max_tokens: int = 800,
) -> Dict[str, Any]:
    """
    Calls Sarvam AI /v1/chat/completions endpoint with full tool-calling support.
    Returns raw JSON response dictionary containing choices, finish_reason, and tool_calls.
    """
    api_key, configured_model = get_sarvam_config()
    if not api_key:
        raise ValueError("SARVAM_API_KEY is not configured in environment.")

    headers = {
        "api-subscription-key": api_key,
        "Content-Type": "application/json",
    }

    active_model = configured_model
    timeout = httpx.Timeout(25.0, connect=10.0)

    async with httpx.AsyncClient(timeout=timeout) as client:
        for attempt in range(2):
            payload: Dict[str, Any] = {
                "model": active_model,
                "messages": messages,
                "temperature": temperature,
                "max_tokens": max_tokens,
            }
            if tools:
                payload["tools"] = tools
                if tool_choice is not None:
                    payload["tool_choice"] = tool_choice

            try:
                response = await client.post(
                    SARVAM_CHAT_URL,
                    json=payload,
                    headers=headers,
                )

                # Check if model rejection occurred
                if response.status_code in (400, 404, 422) and active_model != FALLBACK_MODEL:
                    resp_text = response.text.lower()
                    if "model" in resp_text or "not found" in resp_text or "invalid" in resp_text:
                        logger.warning(
                            "Model '%s' rejected by Sarvam API (%d). Retrying with fallback '%s'.",
                            active_model,
                            response.status_code,
                            FALLBACK_MODEL,
                        )
                        active_model = FALLBACK_MODEL
                        payload["model"] = active_model
                        fb_response = await client.post(
                            SARVAM_CHAT_URL,
                            json=payload,
                            headers=headers,
                        )
                        if fb_response.is_success:
                            return fb_response.json()
                        else:
                            fb_response.raise_for_status()

                # Handle 429 or 5xx retry
                if response.status_code in (429, 500, 502, 503, 504) and attempt == 0:
                    logger.warning("Sarvam API returned HTTP %d, retrying once...", response.status_code)
                    await asyncio.sleep(1.0)
                    continue

                response.raise_for_status()
                return response.json()

            except (httpx.RequestError, httpx.HTTPStatusError) as exc:
                if attempt == 0 and not isinstance(exc, httpx.HTTPStatusError):
                    logger.warning("Sarvam connection error (%s), retrying once...", type(exc).__name__)
                    await asyncio.sleep(1.0)
                    continue
                if active_model != FALLBACK_MODEL:
                    logger.warning("Attempting fallback model '%s' after error: %s", FALLBACK_MODEL, str(exc))
                    active_model = FALLBACK_MODEL
                    payload["model"] = active_model
                    try:
                        fb_response = await client.post(SARVAM_CHAT_URL, json=payload, headers=headers)
                        if fb_response.is_success:
                            return fb_response.json()
                    except Exception as fallback_exc:
                        logger.error("Fallback to %s also failed: %s", FALLBACK_MODEL, str(fallback_exc))
                raise


async def call_sarvam_chat(
    messages: List[Dict[str, Any]],
    temperature: float = 0.2,
    max_tokens: int = 600,
) -> str:
    """Convenience wrapper returning text content directly."""
    data = await call_sarvam_chat_raw(
        messages=messages,
        temperature=temperature,
        max_tokens=max_tokens,
    )
    content = data.get("choices", [{}])[0].get("message", {}).get("content", "")
    return (content or "").strip()


async def call_sarvam_stt(
    audio_bytes: bytes,
    filename: str = "audio.wav",
    mime_type: str = "audio/wav",
    language_hint: Optional[str] = "auto",
) -> Dict[str, Any]:
    """
    Submits audio to Sarvam AI Speech-to-Text (Saaras).
    Uses mode='codemix' to naturally capture code-mixed (Hinglish/Indian English) speech.
    Returns {'transcript': str, 'language_code': str}.
    """
    api_key, model = get_stt_config()
    if not api_key:
        raise ValueError("SARVAM_API_KEY is not configured in environment.")

    headers = {
        "api-subscription-key": api_key,
    }

    form_data = {
        "model": model,
        "mode": "codemix",  # Code-mixed output handles Hinglish, English, and Hindi seamlessly
    }

    if language_hint and language_hint != "auto":
        form_data["language_code"] = language_hint

    files = {
        "file": (filename, audio_bytes, mime_type),
    }

    timeout = httpx.Timeout(20.0, connect=10.0)

    async with httpx.AsyncClient(timeout=timeout) as client:
        active_stt_model = model
        for attempt in range(2):
            try:
                form_data["model"] = active_stt_model
                response = await client.post(
                    SARVAM_STT_URL,
                    data=form_data,
                    files=files,
                    headers=headers,
                )

                if response.status_code in (400, 404) and active_stt_model != FALLBACK_STT_MODEL:
                    # Model not available on current plan, retry with fallback saaras:v3
                    logger.warning("STT model '%s' failed (%d), retrying with '%s'", active_stt_model, response.status_code, FALLBACK_STT_MODEL)
                    active_stt_model = FALLBACK_STT_MODEL
                    continue

                if response.status_code in (429, 500, 502, 503, 504) and attempt == 0:
                    logger.warning("Sarvam STT returned %d, retrying once...", response.status_code)
                    await asyncio.sleep(1.0)
                    continue

                response.raise_for_status()
                data = response.json()
                logger.info("Sarvam STT succeeded: request_id=%s, lang=%s", data.get("request_id"), data.get("language_code"))
                return {
                    "transcript": data.get("transcript", "").strip(),
                    "language_code": data.get("language_code", "en-IN"),
                }
            except (httpx.RequestError, httpx.HTTPStatusError) as exc:
                if attempt == 0:
                    logger.warning("Sarvam STT error (%s), retrying once...", str(exc))
                    await asyncio.sleep(1.0)
                    continue
                raise


async def call_sarvam_tts(
    text: str,
    language_code: str = "en-IN",
) -> Dict[str, Any]:
    """
    Synthesizes speech using Sarvam AI Text-to-Speech (Bulbul v3).
    Returns {'audio_base64': str, 'mime': 'audio/wav'}.
    """
    api_key, model, speaker = get_tts_config()
    if not api_key:
        raise ValueError("SARVAM_API_KEY is not configured in environment.")

    # Validate language code: standard Indian BCP-47 codes supported by Bulbul
    valid_lang = language_code if language_code in ("hi-IN", "en-IN", "bn-IN", "kn-IN", "ml-IN", "mr-IN", "od-IN", "pa-IN", "ta-IN", "te-IN", "gu-IN") else "en-IN"

    payload = {
        "text": text,
        "model": model,
        "speaker": speaker,
        "language_code": valid_lang,
    }

    headers = {
        "api-subscription-key": api_key,
        "Content-Type": "application/json",
    }

    timeout = httpx.Timeout(20.0, connect=10.0)

    async with httpx.AsyncClient(timeout=timeout) as client:
        for attempt in range(2):
            try:
                response = await client.post(
                    SARVAM_TTS_URL,
                    json=payload,
                    headers=headers,
                )

                if response.status_code in (429, 500, 502, 503, 504) and attempt == 0:
                    logger.warning("Sarvam TTS returned %d, retrying once...", response.status_code)
                    await asyncio.sleep(1.0)
                    continue

                response.raise_for_status()
                data = response.json()
                audios = data.get("audios", [])
                if not audios:
                    raise ValueError("No audio returned in Sarvam TTS response.")

                logger.info("Sarvam TTS succeeded: request_id=%s, length=%d chars", data.get("request_id"), len(text))
                return {
                    "audio_base64": audios[0],
                    "mime": "audio/wav",
                }
            except (httpx.RequestError, httpx.HTTPStatusError) as exc:
                if attempt == 0:
                    logger.warning("Sarvam TTS error (%s), retrying once...", str(exc))
                    await asyncio.sleep(1.0)
                    continue
                raise
