import React, { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Sparkles,
  Send,
  Trash2,
  AlertCircle,
  ExternalLink,
  RefreshCw,
  Database,
  Mic,
  Square,
  Volume2,
  Languages,
  ChevronDown,
  ChevronUp,
  Wrench,
  CheckCircle2,
  Cpu
} from 'lucide-react';
import { Drawer } from '../common/Drawer';
import {
  askFinvora,
  askFinvoraVoice,
  transcribeAudio,
  synthesizeSpeech,
  ToolTraceItem,
  AskFinvoraResponse,
  VoiceAskResponse,
} from '../../lib/api';

interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  sources?: string[];
  disclaimer?: string;
  language?: string;
  timestamp: string;
  tool_trace?: ToolTraceItem[];
  transcript?: string;
}

const SUGGESTED_CHIPS = [
  "Which alerts are critical?",
  "Why is cash flow flagged?",
  "Which department is over budget?",
  "What is our current cash balance?",
  "What if a payment is delayed 20 days?",
];

// Helper to render bold markdown (**bold**) cleanly
const renderFormattedText = (raw: string) => {
  const parts = raw.split(/(\*\*.*?\*\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**')) {
      return (
        <strong key={i} className="font-semibold text-[var(--text-primary)]">
          {part.slice(2, -2)}
        </strong>
      );
    }
    return part;
  });
};

// Collapsible "How I answered" Tool Trace component
const ToolTraceViewer: React.FC<{ trace?: ToolTraceItem[] }> = ({ trace }) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!trace || trace.length === 0) return null;

  return (
    <div className="mt-2.5 pt-2 border-t border-[var(--divider)]">
      <button
        type="button"
        onClick={() => setIsExpanded(!isExpanded)}
        className="flex items-center justify-between w-full text-[11px] font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)] transition-colors py-1 px-2 rounded-lg hover:bg-[var(--surface-muted)]"
      >
        <span className="flex items-center gap-1.5 text-amber-600 dark:text-amber-400">
          <Wrench className="w-3 h-3" />
          <span>How I answered ({trace.length} MCP {trace.length === 1 ? 'call' : 'calls'})</span>
        </span>
        {isExpanded ? (
          <ChevronUp className="w-3.5 h-3.5 text-[var(--text-muted)]" />
        ) : (
          <ChevronDown className="w-3.5 h-3.5 text-[var(--text-muted)]" />
        )}
      </button>

      {isExpanded && (
        <div className="mt-2 space-y-1.5 text-[10px] bg-[var(--surface-subtle)] p-2.5 rounded-xl border border-[var(--divider)]">
          <div className="text-[10px] text-[var(--text-muted)] font-mono uppercase tracking-wider mb-1 flex items-center gap-1">
            <Cpu className="w-2.5 h-2.5 text-amber-500" />
            <span>FINVORA FastMCP Server Execution Trace:</span>
          </div>
          {trace.map((item, idx) => (
            <div
              key={idx}
              className="p-2 rounded-lg bg-[var(--card-bg)] border border-[var(--divider)] flex flex-col gap-1 font-mono"
            >
              <div className="flex items-center justify-between">
                <span className="font-bold text-amber-600 dark:text-amber-400">
                  {item.tool}
                </span>
                <div className="flex items-center gap-1.5 text-[9px]">
                  <span className="text-[var(--text-muted)]">{item.ms}ms</span>
                  {item.ok ? (
                    <span className="px-1.5 py-0.5 rounded bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 font-sans font-bold">
                      OK
                    </span>
                  ) : (
                    <span className="px-1.5 py-0.5 rounded bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20 font-sans font-bold">
                      ERROR
                    </span>
                  )}
                </div>
              </div>
              {item.arguments && Object.keys(item.arguments).length > 0 && (
                <div className="text-[9px] text-[var(--text-secondary)] bg-[var(--surface-muted)] p-1.5 rounded truncate">
                  args: {JSON.stringify(item.arguments)}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export const AskFinvoraDrawer: React.FC = () => {
  const navigate = useNavigate();

  // Panel open state & conversation state
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: 'init-1',
      role: 'assistant',
      content:
        "Hello! I am **Ask FINVORA**, an autonomous financial agent powered by **Sarvam AI** and the **FINVORA MCP Server**.\n\n" +
        "You can ask me questions using text or bilingual voice in English, Hindi, or Hinglish. I answer strictly from live financial records through read-only MCP tools.",
      sources: ["FINVORA FastMCP Server (Read-only)"],
      disclaimer: "Answers are grounded in FINVORA data and should be verified before taking critical financial actions.",
      language: "en-IN",
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Language selection: 'auto' | 'en-IN' | 'hi-IN'
  const [languageMode, setLanguageMode] = useState<'auto' | 'en-IN' | 'hi-IN'>('auto');

  // Voice recording state
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [micPermissionDenied, setMicPermissionDenied] = useState(false);
  const [autoSendVoice, setAutoSendVoice] = useState(false);

  // Text-To-Speech (TTS) playback state
  const [playingMessageId, setPlayingMessageId] = useState<string | null>(null);
  const [loadingAudioId, setLoadingAudioId] = useState<string | null>(null);
  const [autoPlayReplies, setAutoPlayReplies] = useState(false);

  // Audio cache for spoken messages: messageId -> base64 audio
  const audioCacheRef = useRef<Map<string, string>>(new Map());
  const currentAudioElementRef = useRef<HTMLAudioElement | null>(null);

  // MediaRecorder refs
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const timerIntervalRef = useRef<any>(null);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Listen to custom window event to allow opening from TopBar or other components
  useEffect(() => {
    const handleOpen = () => setIsOpen(true);
    window.addEventListener('open-ask-finvora', handleOpen);
    return () => window.removeEventListener('open-ask-finvora', handleOpen);
  }, []);

  // Auto-scroll to bottom of messages
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isLoading, isOpen, isTranscribing]);

  // Focus textarea when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => textareaRef.current?.focus(), 150);
    }
  }, [isOpen]);

  // Clean up audio playback & recorder on unmount / close
  useEffect(() => {
    return () => {
      stopAudioPlayback();
      cleanupRecording();
    };
  }, []);

  const stopAudioPlayback = () => {
    if (currentAudioElementRef.current) {
      currentAudioElementRef.current.pause();
      currentAudioElementRef.current.currentTime = 0;
      currentAudioElementRef.current = null;
    }
    setPlayingMessageId(null);
  };

  const cleanupRecording = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
        mediaRecorderRef.current.stream?.getTracks().forEach(t => t.stop());
      } catch (e) {
        // Ignore
      }
    }
    mediaRecorderRef.current = null;
    setIsRecording(false);
    setRecordingSeconds(0);
  };

  // Start microphone recording with getUserMedia
  const startRecording = async () => {
    setError(null);
    setMicPermissionDenied(false);
    stopAudioPlayback();

    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setError("Audio recording is not supported in this browser. Please use text input.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          channelCount: 1,
          sampleRate: 16000,
          echoCancellation: true,
          noiseSuppression: true,
        },
      });

      audioChunksRef.current = [];
      const mimeType = MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
        ? 'audio/webm;codecs=opus'
        : (MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/ogg');

      const recorder = new MediaRecorder(stream, { mimeType });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event: BlobEvent) => {
        if (event.data && event.data.size > 0) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType });
        stream.getTracks().forEach(track => track.stop());

        if (audioBlob.size > 0) {
          await processRecordedAudio(audioBlob, mimeType);
        }
      };

      recorder.start(250); // collect chunks every 250ms
      setIsRecording(true);
      setRecordingSeconds(0);

      // Start duration timer with auto-stop at 28 seconds
      timerIntervalRef.current = setInterval(() => {
        setRecordingSeconds(prev => {
          if (prev >= 27) {
            stopRecording();
            return 28;
          }
          return prev + 1;
        });
      }, 1000);
    } catch (err: any) {
      console.warn("Microphone access error:", err);
      if (err.name === 'NotAllowedError' || err.name === 'PermissionDeniedError') {
        setMicPermissionDenied(true);
        setError("Microphone permission was denied. Please allow microphone access in your browser or type your question below.");
      } else {
        setError(`Could not access microphone: ${err.message || 'Unknown device error'}`);
      }
      cleanupRecording();
    }
  };

  // Stop recording normally
  const stopRecording = () => {
    if (timerIntervalRef.current) {
      clearInterval(timerIntervalRef.current);
      timerIntervalRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      try {
        mediaRecorderRef.current.stop();
      } catch (e) {
        // Ignore
      }
    }
    setIsRecording(false);
  };

  // Cancel recording and discard audio
  const cancelRecording = () => {
    cleanupRecording();
    audioChunksRef.current = [];
  };

  // Process recorded audio
  const processRecordedAudio = async (audioBlob: Blob, mimeType: string) => {
    setError(null);
    const ext = mimeType.includes('webm') ? 'recording.webm' : 'recording.wav';

    // If autoSendVoice is on, run full bilingual voice agent flow (/api/ask/voice)
    if (autoSendVoice) {
      setIsLoading(true);
      try {
        const res: VoiceAskResponse = await askFinvoraVoice(audioBlob, languageMode, ext);

        if (res.error) {
          setError(res.error);
          setIsLoading(false);
          return;
        }

        const userMsg: Message = {
          id: `usr-${Date.now()}`,
          role: 'user',
          content: res.transcript || "(Voice query)",
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        };

        const assistantMsg: Message = {
          id: `asst-${Date.now()}`,
          role: 'assistant',
          content: res.answer,
          sources: res.sources,
          disclaimer: res.disclaimer,
          language: res.language || (languageMode === 'hi-IN' ? 'hi-IN' : 'en-IN'),
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
          tool_trace: res.tool_trace,
        };

        setMessages(prev => [...prev, userMsg, assistantMsg]);

        if (res.audio_base64) {
          audioCacheRef.current.set(assistantMsg.id, res.audio_base64);
          if (autoPlayReplies) {
            setTimeout(() => playAudioBytes(assistantMsg.id, res.audio_base64!), 250);
          }
        }
      } catch (err: any) {
        console.error("Voice ask error:", err);
        setError(err?.message || "Voice processing failed. Please try again or type your question.");
      } finally {
        setIsLoading(false);
        setRecordingSeconds(0);
      }
      return;
    }

    // Otherwise, transcribe and display transcript for user review before sending
    setIsTranscribing(true);
    try {
      const res = await transcribeAudio(audioBlob, languageMode, ext);
      if (res.error) {
        setError(res.error);
        return;
      }

      const transcribedText = res.transcript.trim();
      if (!transcribedText) {
        setError("No clear speech detected. Please speak clearly into your microphone.");
        return;
      }

      setInput(transcribedText);
    } catch (err: any) {
      console.error("Transcription error:", err);
      setError(err?.message || "Speech transcription failed. Please try again or type your question.");
    } finally {
      setIsTranscribing(false);
      setRecordingSeconds(0);
    }
  };

  const playAudioBytes = async (msgId: string, base64: string) => {
    stopAudioPlayback();
    try {
      const audioUrl = `data:audio/wav;base64,${base64}`;
      const audio = new Audio(audioUrl);
      currentAudioElementRef.current = audio;
      setPlayingMessageId(msgId);

      audio.onended = () => {
        setPlayingMessageId(null);
        currentAudioElementRef.current = null;
      };

      audio.onerror = () => {
        setPlayingMessageId(null);
        currentAudioElementRef.current = null;
      };

      await audio.play();
    } catch (e: any) {
      console.warn("Audio playback error:", e);
      setPlayingMessageId(null);
    }
  };

  // Play audio for a specific assistant message
  const handlePlayAudio = async (msg: Message) => {
    if (playingMessageId === msg.id) {
      stopAudioPlayback();
      return;
    }

    stopAudioPlayback();

    let audioBase64 = audioCacheRef.current.get(msg.id);

    if (!audioBase64) {
      setLoadingAudioId(msg.id);
      try {
        const langToUse = msg.language === 'hi-IN' ? 'hi-IN' : 'en-IN';
        const res = await synthesizeSpeech(msg.content, langToUse);

        if (res.error || !res.audio_base64) {
          setError(res.error || "Speech synthesis is currently unavailable.");
          setLoadingAudioId(null);
          return;
        }

        audioBase64 = res.audio_base64;
        audioCacheRef.current.set(msg.id, audioBase64);
      } catch (err: any) {
        console.error("TTS fetch error:", err);
        setError("Failed to synthesize voice reply. Please try again.");
        setLoadingAudioId(null);
        return;
      } finally {
        setLoadingAudioId(null);
      }
    }

    if (audioBase64) {
      await playAudioBytes(msg.id, audioBase64);
    }
  };

  const handleSend = async (textToSend?: string) => {
    const query = (textToSend ?? input).trim();
    if (!query || isLoading) return;

    if (query.length > 500) {
      setError("Question exceeds 500 characters limit.");
      return;
    }

    setError(null);
    setInput('');
    stopAudioPlayback();

    const userMsg: Message = {
      id: `usr-${Date.now()}`,
      role: 'user',
      content: query,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    const newHistory = [...messages, userMsg];
    setMessages(newHistory);
    setIsLoading(true);

    try {
      const historyPayload = newHistory.slice(-6).map(m => ({
        role: m.role,
        content: m.content,
      }));

      const res: AskFinvoraResponse = await askFinvora(query, historyPayload, languageMode);

      const assistantMsg: Message = {
        id: `asst-${Date.now()}`,
        role: 'assistant',
        content: res.answer,
        sources: res.sources,
        disclaimer: res.disclaimer,
        language: res.language || (languageMode === 'hi-IN' ? 'hi-IN' : 'en-IN'),
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        tool_trace: res.tool_trace,
      };

      setMessages(prev => [...prev, assistantMsg]);

      if (autoPlayReplies) {
        setTimeout(() => handlePlayAudio(assistantMsg), 300);
      }
    } catch (err: any) {
      console.error('Ask FINVORA API error:', err);
      setError(err?.message || 'Failed to reach Ask FINVORA service. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearChat = () => {
    stopAudioPlayback();
    cleanupRecording();
    audioCacheRef.current.clear();
    setMessages([
      {
        id: `init-${Date.now()}`,
        role: 'assistant',
        content: "Chat cleared. What financial metric, risk, or budget would you like to explore next?",
        sources: ["FINVORA FastMCP Server (Read-only)"],
        disclaimer: "Answers are grounded in FINVORA data and should be verified before taking critical financial actions.",
        language: "en-IN",
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      },
    ]);
    setError(null);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Floating Action Trigger Button */}
      <div className="fixed bottom-24 right-5 sm:bottom-7 sm:right-7 z-40 select-none">
        <button
          onClick={() => setIsOpen(true)}
          className="group relative flex items-center gap-2 px-4 py-2.5 rounded-2xl bg-gradient-to-r from-amber-400 via-amber-300 to-amber-500 text-stone-950 font-bold text-xs shadow-[0_4px_24px_rgba(245,158,11,0.5)] hover:shadow-[0_6px_28px_rgba(245,158,11,0.7)] hover:scale-105 active:scale-95 transition-all duration-200 border border-amber-200/90 dark:border-amber-300/60"
          aria-label="Open Ask FINVORA"
          title="Open Ask FINVORA MCP Voice Assistant"
        >
          <div className="ai-shine-sheen" aria-hidden="true" />
          <Sparkles className="w-4 h-4 text-stone-950 animate-ai-star shrink-0" />
          <span className="font-extrabold tracking-tight">Ask FINVORA</span>
          <span className="hidden sm:inline-flex items-center gap-1 text-[10px] font-mono px-1.5 py-0.5 rounded-md bg-stone-950/15 text-stone-950 font-bold">
            <Mic className="w-2.5 h-2.5" />
            MCP Agent
          </span>
        </button>
      </div>

      {/* Main Drawer Panel */}
      <Drawer
        isOpen={isOpen}
        onClose={() => {
          stopAudioPlayback();
          cleanupRecording();
          setIsOpen(false);
        }}
        title="Ask FINVORA"
        subtitle="Bilingual voice & text financial assistant powered by Sarvam AI & FINVORA FastMCP (read-only)"
        maxWidth="max-w-xl"
        badge={
          <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-amber-500/10 border border-amber-500/20 text-amber-600 dark:text-amber-400 text-[10px] font-bold">
            <Wrench className="w-3 h-3" />
            <span>FastMCP Tools + Sarvam AI</span>
          </div>
        }
        footer={
          <div className="flex items-center justify-between w-full text-[11px] text-[var(--text-muted)]">
            <div className="flex items-center gap-1.5">
              <Database className="w-3.5 h-3.5 text-amber-500" />
              <span>Grounded in enterprise DB • Voice processed by Sarvam and not stored</span>
            </div>
            <button
              onClick={handleClearChat}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg hover:bg-[var(--surface-muted)] text-[var(--text-secondary)] hover:text-rose-500 transition-colors"
              title="Clear current conversation"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Clear chat</span>
            </button>
          </div>
        }
      >
        <div className="flex flex-col h-[calc(100vh-14rem)] justify-between space-y-4">
          {/* Top Controls: Language Switcher & Toggles */}
          <div className="space-y-2.5">
            {/* Language Selector + Voice Options Bar */}
            <div className="flex flex-wrap items-center justify-between gap-2 p-2 rounded-xl bg-[var(--surface-subtle)] border border-[var(--divider)]">
              {/* Language Pills */}
              <div className="flex items-center gap-1">
                <span className="text-[10px] font-bold text-[var(--text-muted)] flex items-center gap-1 mr-1">
                  <Languages className="w-3 h-3" />
                  Lang:
                </span>
                {(['auto', 'en-IN', 'hi-IN'] as const).map(lang => (
                  <button
                    key={lang}
                    onClick={() => setLanguageMode(lang)}
                    className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${languageMode === lang
                        ? 'bg-amber-500 text-stone-950 shadow-xs'
                        : 'text-[var(--text-secondary)] hover:text-[var(--text-primary)] hover:bg-[var(--surface-muted)]'
                      }`}
                  >
                    {lang === 'auto' ? 'Auto' : lang === 'en-IN' ? 'English' : 'हिंदी'}
                  </button>
                ))}
              </div>

              {/* Voice Options (Auto-send voice, Auto-play replies) */}
              <div className="flex items-center gap-3 text-[10px] text-[var(--text-secondary)]">
                <label className="flex items-center gap-1.5 cursor-pointer hover:text-[var(--text-primary)] select-none" title="Send speech directly to agent loop">
                  <input
                    type="checkbox"
                    checked={autoSendVoice}
                    onChange={e => setAutoSendVoice(e.target.checked)}
                    className="rounded border-[var(--divider)] text-amber-500 focus:ring-amber-500/20"
                  />
                  <span>Send speech automatically</span>
                </label>
                <label className="flex items-center gap-1.5 cursor-pointer hover:text-[var(--text-primary)] select-none" title="Automatically speak answers using Sarvam Bulbul">
                  <input
                    type="checkbox"
                    checked={autoPlayReplies}
                    onChange={e => setAutoPlayReplies(e.target.checked)}
                    className="rounded border-[var(--divider)] text-amber-500 focus:ring-amber-500/20"
                  />
                  <span>Auto-play replies</span>
                </label>
              </div>
            </div>

            {/* Verification & What-If Warning Banner */}
            <div className="p-2.5 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200/80 dark:border-amber-900/40 text-[11px] text-[var(--text-secondary)] flex items-start gap-2">
              <AlertCircle className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5" />
              <div>
                <span>
                  Assistant is strictly read-only and answers from verified MCP database tools. Voice is processed by Sarvam and not stored.
                </span>
                <span className="block mt-0.5 text-amber-700 dark:text-amber-300 font-medium">
                  Need to model hypothetical scenarios? Visit the{' '}
                  <button
                    onClick={() => {
                      stopAudioPlayback();
                      cleanupRecording();
                      setIsOpen(false);
                      navigate('/what-if');
                    }}
                    className="underline hover:text-amber-900 dark:hover:text-amber-100 font-bold inline-flex items-center gap-0.5"
                  >
                    What-If Simulator <ExternalLink className="w-3 h-3" />
                  </button>
                </span>
              </div>
            </div>

            {/* Suggested Question Chips */}
            <div className="pt-0.5">
              <span className="text-[10px] font-semibold text-[var(--text-muted)] uppercase tracking-wider block mb-1">
                Suggested Prompts
              </span>
              <div className="flex flex-wrap gap-1.5">
                {SUGGESTED_CHIPS.map((chip, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleSend(chip)}
                    disabled={isLoading || isRecording}
                    className="text-[11px] px-2.5 py-1 rounded-lg bg-[var(--surface-muted)] hover:bg-[var(--surface-subtle)] text-[var(--text-secondary)] hover:text-[var(--text-primary)] border border-[var(--divider)] hover:border-amber-400/40 transition-all text-left disabled:opacity-50"
                  >
                    {chip}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Messages Scroll Area */}
          <div className="flex-1 overflow-y-auto space-y-3.5 pr-1 text-xs">
            {messages.map(m => (
              <div
                key={m.id}
                className={`flex flex-col ${m.role === 'user' ? 'items-end' : 'items-start'}`}
              >
                <div
                  className={`max-w-[88%] rounded-2xl p-3.5 shadow-xs leading-relaxed ${m.role === 'user'
                      ? 'bg-amber-500 text-stone-950 font-medium rounded-br-xs'
                      : 'bg-[var(--card-bg)] text-[var(--text-primary)] border border-[var(--divider)] rounded-bl-xs'
                    }`}
                >
                  {/* Sender identity & Listen Voice Button for Assistant */}
                  {m.role === 'assistant' && (
                    <div className="flex items-center justify-between gap-2 mb-1.5">
                      <div className="flex items-center gap-1.5 text-[10px] font-bold text-amber-600 dark:text-amber-400">
                        <Sparkles className="w-3 h-3" />
                        <span>FINVORA Intelligence (MCP)</span>
                      </div>

                      {/* Listen Spoken Reply Button */}
                      <button
                        onClick={() => handlePlayAudio(m)}
                        disabled={loadingAudioId === m.id}
                        className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-semibold transition-all border ${playingMessageId === m.id
                            ? 'bg-rose-500/15 border-rose-500/30 text-rose-600 dark:text-rose-400'
                            : 'bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20'
                          }`}
                        title="Listen to this reply spoken by Sarvam Bulbul"
                      >
                        {loadingAudioId === m.id ? (
                          <>
                            <RefreshCw className="w-2.5 h-2.5 animate-spin" />
                            <span>Synthesizing...</span>
                          </>
                        ) : playingMessageId === m.id ? (
                          <>
                            <Square className="w-2.5 h-2.5 fill-current" />
                            <span>Stop</span>
                          </>
                        ) : (
                          <>
                            <Volume2 className="w-2.5 h-2.5" />
                            <span>Listen</span>
                          </>
                        )}
                      </button>
                    </div>
                  )}

                  {/* Message body */}
                  <div className="whitespace-pre-wrap space-y-1">
                    {renderFormattedText(m.content)}
                  </div>

                  {/* Collapsible Tool Trace ("How I answered") */}
                  {m.role === 'assistant' && m.tool_trace && m.tool_trace.length > 0 && (
                    <ToolTraceViewer trace={m.tool_trace} />
                  )}

                  {/* Sources chips */}
                  {m.sources && m.sources.length > 0 && (
                    <div className="mt-2 pt-1.5 border-t border-[var(--divider)] flex flex-wrap items-center gap-1 text-[10px]">
                      <span className="text-[var(--text-muted)] font-medium">Grounded in:</span>
                      {m.sources.map((src, i) => (
                        <span
                          key={i}
                          className="px-1.5 py-0.5 rounded-md bg-[var(--surface-subtle)] text-[var(--text-secondary)] font-mono border border-[var(--divider)]"
                        >
                          {src}
                        </span>
                      ))}
                    </div>
                  )}

                  {/* Timestamp */}
                  <div
                    className={`mt-1.5 text-[9px] text-right ${m.role === 'user' ? 'text-stone-800/70' : 'text-[var(--text-muted)]'
                      }`}
                  >
                    {m.timestamp}
                  </div>
                </div>
              </div>
            ))}

            {/* Loading Indicator */}
            {isLoading && (
              <div className="flex items-center gap-2 p-3 rounded-2xl bg-[var(--card-bg)] border border-[var(--divider)] max-w-[70%]">
                <RefreshCw className="w-3.5 h-3.5 text-amber-500 animate-spin" />
                <span className="text-xs text-[var(--text-secondary)] animate-pulse">
                  Reasoning through FINVORA MCP tools via Sarvam AI...
                </span>
              </div>
            )}

            {/* Speech Transcription Loading */}
            {isTranscribing && (
              <div className="flex items-center gap-2 p-3 rounded-2xl bg-[var(--card-bg)] border border-amber-500/30 max-w-[70%]">
                <RefreshCw className="w-3.5 h-3.5 text-amber-500 animate-spin" />
                <span className="text-xs text-amber-600 dark:text-amber-400 animate-pulse font-medium">
                  Transcribing voice with Sarvam Saaras in codemix mode...
                </span>
              </div>
            )}

            {/* Error Message */}
            {error && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-rose-600 dark:text-rose-400 text-xs flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
                <button
                  onClick={() => setError(null)}
                  className="text-rose-500 hover:text-rose-700 text-xs font-bold"
                >
                  Dismiss
                </button>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {/* Voice Recording Active Banner */}
          {isRecording && (
            <div className="p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 flex items-center justify-between gap-3 animate-in fade-in">
              <div className="flex items-center gap-2.5">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-rose-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-rose-500"></span>
                </span>
                <span className="text-xs font-bold text-rose-600 dark:text-rose-400">
                  Recording audio ({recordingSeconds}s / 28s)
                </span>
                <span className="text-[10px] text-[var(--text-muted)] hidden sm:inline">
                  (Auto-stops at 28s)
                </span>
              </div>
              <div className="flex items-center gap-1.5">
                <button
                  onClick={cancelRecording}
                  className="px-2.5 py-1 rounded-lg text-xs font-semibold text-[var(--text-secondary)] hover:bg-[var(--surface-muted)]"
                >
                  Cancel
                </button>
                <button
                  onClick={stopRecording}
                  className="px-3 py-1 rounded-lg text-xs font-bold bg-rose-600 text-white hover:bg-rose-700 flex items-center gap-1 shadow-xs"
                >
                  <Square className="w-3 h-3 fill-current" />
                  <span>Done</span>
                </button>
              </div>
            </div>
          )}

          {/* Input Box Area with Voice Mic Trigger */}
          <div className="pt-2 border-t border-[var(--divider)]">
            <div className="relative rounded-xl bg-[var(--surface-subtle)] border border-[var(--divider)] focus-within:border-amber-500/60 focus-within:ring-1 focus-within:ring-amber-500/30 transition-all">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={e => setInput(e.target.value.slice(0, 500))}
                onKeyDown={handleKeyDown}
                rows={2}
                placeholder="Ask about risks, forecasts, budgets... or click mic to speak"
                className="w-full px-3.5 py-2.5 bg-transparent text-xs text-[var(--text-primary)] placeholder:text-[var(--text-muted)] resize-none outline-hidden"
                disabled={isLoading || isRecording || isTranscribing}
              />
              <div className="px-3 pb-2 flex items-center justify-between">
                <div className="flex items-center gap-2 text-[10px] text-[var(--text-muted)] font-mono">
                  <span>{input.length}/500 chars</span>
                  {languageMode !== 'auto' && (
                    <span className="px-1.5 py-0.5 rounded bg-[var(--surface-muted)] text-[var(--text-secondary)] font-sans">
                      {languageMode === 'hi-IN' ? 'Hindi Mode' : 'English Mode'}
                    </span>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  {/* Microphone Record Button */}
                  <button
                    type="button"
                    onClick={isRecording ? stopRecording : startRecording}
                    disabled={isLoading || isTranscribing}
                    className={`p-2 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${isRecording
                        ? 'bg-rose-500 text-white shadow-[0_0_12px_rgba(244,63,94,0.5)] animate-pulse'
                        : 'bg-[var(--surface-muted)] hover:bg-amber-500/20 text-[var(--text-secondary)] hover:text-amber-600 dark:hover:text-amber-400 border border-[var(--divider)]'
                      }`}
                    title={isRecording ? "Stop recording" : "Record voice query (English / Hindi / Hinglish)"}
                    aria-label="Voice input microphone"
                  >
                    <Mic className="w-3.5 h-3.5" />
                    <span className="hidden sm:inline text-[11px]">
                      {isRecording ? "Stop" : "Speak"}
                    </span>
                  </button>

                  {/* Send Button */}
                  <button
                    onClick={() => handleSend()}
                    disabled={!input.trim() || isLoading || isRecording || isTranscribing}
                    className="px-3.5 py-1.5 rounded-xl bg-amber-500 text-stone-950 font-bold text-xs hover:bg-amber-400 active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed transition-all flex items-center gap-1.5 shadow-xs"
                  >
                    <span>Send</span>
                    <Send className="w-3 h-3" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </Drawer>
    </>
  );
};
