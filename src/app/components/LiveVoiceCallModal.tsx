import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Mic,
  Square,
  Camera,
  ArrowUp,
  X,
  Volume2,
  VolumeX,
  RefreshCw,
  RotateCcw,
  Sparkles,
  ImagePlus,
  Check,
  Play,
  Loader2,
  MessageSquare,
  ArrowRight,
} from 'lucide-react';
import {
  GEMINI_TTS_VOICES,
  getStoredVoice,
  setStoredVoice,
  getVoiceInfo,
  speakWithGeminiTts,
  stopGeminiTts,
} from '../utils/geminiTts';
import { isSimpleMessage } from './FullScreenChatView';

export interface LiveVoiceCallModalProps {
  isOpen: boolean;
  onClose: () => void;
  activeModelName?: string;
  onSendUserPrompt?: (text: string) => void;
  onGoToChat?: (topicPrompt: string) => void;
  onVoiceChanged?: (voiceId: string) => void;
}

const LANGUAGE_OPTIONS = [
  { code: 'ur-PK', label: 'Urdu (Roman)' },
  { code: 'en-US', label: 'English (US)' },
  { code: 'en-GB', label: 'English (UK)' },
  { code: 'hi-IN', label: 'Hindi (Roman)' },
  { code: 'ar-SA', label: 'Arabic (Roman)' },
  { code: 'es-ES', label: 'Español' },
  { code: 'fr-FR', label: 'Français' },
  { code: 'tr-TR', label: 'Türkçe' },
];

type AssistantStatus = 'idle' | 'listening' | 'thinking' | 'speaking';

export const LiveVoiceCallModal: React.FC<LiveVoiceCallModalProps> = ({
  isOpen,
  onClose,
  onSendUserPrompt,
  onGoToChat,
  onVoiceChanged,
}) => {
  const [selectedVoiceId, setSelectedVoiceId] = useState<string>(() => getStoredVoice());
  const voiceInfo = getVoiceInfo(selectedVoiceId);
  const personaName = voiceInfo.persona; // 'Zara' (Female) | 'Daro' (Male)

  const [status, setStatus] = useState<AssistantStatus>('idle');
  const [languageCode, setLanguageCode] = useState<string>('ur-PK');
  const [isSpeakerOn, setIsSpeakerOn] = useState<boolean>(true);
  const [textInput, setTextInput] = useState<string>('');
  const [userTranscript, setUserTranscript] = useState<string>('');
  const [aiSpeechText, setAiSpeechText] = useState<string>(
    `Assalam-o-Alaikum! Main ${personaName} hoon. Bol kar, likh kar ya camera se kuch bhi poochhein.`
  );
  const [goToChatTopic, setGoToChatTopic] = useState<string | null>(null);
  const [audioLevel, setAudioLevel] = useState<number>(0.08);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Quick Voices Drawer inside Daro & Zara
  const [isVoiceDrawerOpen, setIsVoiceDrawerOpen] = useState<boolean>(false);
  const [testingVoiceId, setTestingVoiceId] = useState<string | null>(null);

  // Camera Vision ("What is this?") State
  const [isCameraOpen, setIsCameraOpen] = useState<boolean>(false);
  const [cameraError, setCameraError] = useState<string | null>(null);
  const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
  const [capturedImageDataUrl, setCapturedImageDataUrl] = useState<string | null>(null);
  const [cameraPrompt, setCameraPrompt] = useState<string>('What is this?');
  const [attachedThumbUrl, setAttachedThumbUrl] = useState<string | null>(null);

  const orbVideoRef = useRef<HTMLVideoElement | null>(null);
  const cameraVideoRef = useRef<HTMLVideoElement | null>(null);
  const cameraCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const cameraFileInputRef = useRef<HTMLInputElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);

  const recognitionRef = useRef<any>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const abortControllerRef = useRef<AbortController | null>(null);
  const animFrameRef = useRef<number | null>(null);
  const generationRef = useRef<number>(0);
  const statusRef = useRef<AssistantStatus>('idle');
  const historyRef = useRef<Array<{ sender: 'user' | 'ai'; text: string }>>([]);

  useEffect(() => {
    statusRef.current = status;
    if (orbVideoRef.current) {
      orbVideoRef.current.playbackRate =
        status === 'thinking' ? 2.15 : status === 'idle' ? 1.0 : 1.35;
      orbVideoRef.current.play().catch(() => {});
    }
  }, [status]);

  const showToast = useCallback((msg: string) => {
    setToastMsg(msg);
    setTimeout(() => {
      setToastMsg((curr) => (curr === msg ? null : curr));
    }, 3200);
  }, []);

  // Refresh active voice when modal opens
  useEffect(() => {
    if (isOpen) {
      const currentStored = getStoredVoice();
      setSelectedVoiceId(currentStored);
      const info = getVoiceInfo(currentStored);
      setAiSpeechText(
        `Assalam-o-Alaikum! Main ${info.persona} hoon. Bol kar, likh kar ya camera se kuch bhi poochhein.`
      );
      setUserTranscript('');
      setAttachedThumbUrl(null);
      setGoToChatTopic(null);
      setStatus('idle');
    } else {
      stopAllActivity();
      stopCameraStream();
      setIsCameraOpen(false);
      setIsVoiceDrawerOpen(false);
      setGoToChatTopic(null);
    }
  }, [isOpen]);

  // Ambient & active orb audio-level pulse loop (matches Aura CSS --lvl dynamics)
  useEffect(() => {
    if (!isOpen) return;
    let rafId: number;
    const start = performance.now();

    const tick = (now: number) => {
      const t = now - start;
      const cur = statusRef.current;
      let target = 0.05 + 0.03 * Math.sin(t / 900);
      if (cur === 'speaking') {
        target = 0.34 + 0.22 * Math.sin(t / 110) * Math.cos(t / 290);
      } else if (cur === 'listening') {
        target = 0.28 + 0.16 * Math.sin(t / 150);
      } else if (cur === 'thinking') {
        target = 0.2 + 0.08 * Math.sin(t / 220);
      }
      setAudioLevel((prev) => prev + (target - prev) * 0.2);
      rafId = requestAnimationFrame(tick);
    };

    rafId = requestAnimationFrame(tick);
    animFrameRef.current = rafId;
    return () => cancelAnimationFrame(rafId);
  }, [isOpen]);

  const stopMicHardware = useCallback(() => {
    if (recognitionRef.current) {
      try {
        recognitionRef.current.onresult = null;
        recognitionRef.current.onend = null;
        recognitionRef.current.onerror = null;
        recognitionRef.current.stop();
      } catch {}
      recognitionRef.current = null;
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
      try {
        mediaRecorderRef.current.stop();
      } catch {}
      mediaRecorderRef.current = null;
    }
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((tr) => tr.stop());
      micStreamRef.current = null;
    }
  }, []);

  const stopAllActivity = useCallback(() => {
    generationRef.current += 1;
    if (abortControllerRef.current) {
      try {
        abortControllerRef.current.abort();
      } catch {}
      abortControllerRef.current = null;
    }
    stopGeminiTts();
    stopMicHardware();
    setStatus('idle');
  }, [stopMicHardware]);

  const stopCameraStream = useCallback(() => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }
    if (cameraVideoRef.current) {
      cameraVideoRef.current.srcObject = null;
    }
  }, []);

  // Start live camera preview when Camera sheet is opened and no image captured yet
  useEffect(() => {
    if (!isOpen || !isCameraOpen || capturedImageDataUrl) {
      stopCameraStream();
      return;
    }

    let cancelled = false;
    setCameraError(null);

    const startCam = async () => {
      try {
        if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
          setCameraError('Camera preview unavailable on this browser. Upload or take a photo below.');
          return;
        }
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: facingMode }, width: { ideal: 1280 }, height: { ideal: 720 } },
          audio: false,
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
          return;
        }
        cameraStreamRef.current = stream;
        if (cameraVideoRef.current) {
          cameraVideoRef.current.srcObject = stream;
          await cameraVideoRef.current.play().catch(() => {});
        }
      } catch (err: any) {
        if (!cancelled) {
          setCameraError(
            err?.name === 'NotAllowedError'
              ? 'Camera permission denied. You can still upload a photo below.'
              : 'Unable to access camera. You can upload a photo instead.'
          );
        }
      }
    };

    startCam();
    return () => {
      cancelled = true;
      stopCameraStream();
    };
  }, [isOpen, isCameraOpen, capturedImageDataUrl, facingMode, stopCameraStream]);

  // Speak using high-definition Gemini Studio TTS
  const speakResponse = useCallback(
    (text: string, genId: number) => {
      if (!isSpeakerOn || generationRef.current !== genId) {
        if (generationRef.current === genId) setStatus('idle');
        return;
      }
      setStatus('speaking');
      speakWithGeminiTts({
        text,
        voice: selectedVoiceId,
        onStart: () => {
          if (generationRef.current === genId) setStatus('speaking');
        },
        onEnd: () => {
          if (generationRef.current === genId) setStatus('idle');
        },
        onError: () => {
          if (generationRef.current === genId) setStatus('idle');
        },
      });
    },
    [isSpeakerOn, selectedVoiceId]
  );

  // Send query (text, voice transcript, or snapped camera image) to /api/chat and parse SSE
  const submitQuery = useCallback(
    async (rawQuery: string, imageDataUrl?: string) => {
      const cleanedPrompt = (rawQuery || '').trim() || (imageDataUrl ? 'What is this?' : '');
      if (!cleanedPrompt && !imageDataUrl) return;

      stopAllActivity();
      const myGen = ++generationRef.current;
      const controller = new AbortController();
      abortControllerRef.current = controller;

      setUserTranscript(cleanedPrompt);
      setAttachedThumbUrl(imageDataUrl || null);
      setGoToChatTopic(null);
      setStatus('thinking');

      const currentHistory = [...historyRef.current.slice(-10)];
      historyRef.current = [...historyRef.current, { sender: 'user', text: cleanedPrompt }];

      const attachmentsPayload = imageDataUrl
        ? [
            {
              id: `cam-${Date.now()}`,
              name: 'camera-snap.jpg',
              size: imageDataUrl.length,
              type: 'image/jpeg',
              isImage: true,
              preview: imageDataUrl,
            },
          ]
        : [];

      try {
        const res = await fetch('/api/chat', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          signal: controller.signal,
          body: JSON.stringify({
            prompt: cleanedPrompt,
            history: currentHistory,
            attachments: attachmentsPayload,
            isSimple: !imageDataUrl && isSimpleMessage(cleanedPrompt),
            isVoiceAssistant: true,
            voiceLanguage: languageCode,
            assistantPersona: personaName,
          }),
        });

        if (!res.ok) {
          throw new Error(`Request failed (${res.status})`);
        }

        const contentType = res.headers.get('content-type') || '';
        let fullText = '';
        let metaSuggestGoToChat = false;
        let metaDetailedQuery = '';

        if (contentType.includes('text/event-stream') && res.body) {
          const reader = res.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            if (generationRef.current !== myGen) return;

            buffer += decoder.decode(value, { stream: true });
            const lines = buffer.split('\n');
            buffer = lines.pop() || '';

            for (const rawLine of lines) {
              const line = rawLine.trim();
              if (!line.startsWith('data:')) continue;
              const payload = line.slice(5).trim();
              if (!payload || payload === '[DONE]') continue;
              try {
                const parsed = JSON.parse(payload);
                if (parsed?.meta?.suggestGoToChat) {
                  metaSuggestGoToChat = true;
                  metaDetailedQuery = String(parsed.meta.detailedTopicQuery || cleanedPrompt);
                }
                if (typeof parsed.text === 'string' && parsed.text) {
                  fullText += parsed.text;
                  const cleanDisplay = fullText
                    .replace(/\[GO_TO_CHAT\]/gi, '')
                    .replace(/```[\s\S]*?```/g, '')
                    .replace(/[*_`#>~|]/g, '')
                    .replace(/\s+/g, ' ')
                    .trim();
                  if (cleanDisplay) setAiSpeechText(cleanDisplay);
                }
              } catch {
                // Ignore partial JSON frames
              }
            }
          }
        } else {
          const fallbackJson = await res.json().catch(() => ({ text: '' }));
          fullText = fallbackJson?.text || fallbackJson?.reply || '';
        }

        if (generationRef.current !== myGen) return;

        const shouldOfferGoToChat = metaSuggestGoToChat || /\[GO_TO_CHAT\]/i.test(fullText);
        if (shouldOfferGoToChat) {
          setGoToChatTopic(metaDetailedQuery || cleanedPrompt);
        }

        const finalClean =
          fullText
            .replace(/\[GO_TO_CHAT\]/gi, '')
            .replace(/```[\s\S]*?```/g, '')
            .replace(/[*_`#>~|]/g, '')
            .replace(/\s+/g, ' ')
            .trim() || `Main ${personaName} hoon — aapka sawal samajh aa gaya hai.`;

        historyRef.current = [...historyRef.current, { sender: 'ai', text: finalClean }];
        setAiSpeechText(finalClean);
        speakResponse(finalClean, myGen);
      } catch (err: any) {
        if (err?.name === 'AbortError' || generationRef.current !== myGen) return;
        const fallback = 'Network ya server se rabta nahi ho saka. Dobara koshish karein.';
        setAiSpeechText(fallback);
        speakResponse(fallback, myGen);
      }
    },
    [languageCode, personaName, speakResponse, stopAllActivity]
  );

  // Start Listening via SpeechRecognition (+ Whisper /api/stt fallback)
  const startListening = useCallback(async () => {
    stopAllActivity();
    const myGen = generationRef.current;
    setStatus('listening');
    setUserTranscript('');

    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    let finalBuffer = '';
    let settled = false;

    if (SpeechRec) {
      try {
        const rec = new SpeechRec();
        rec.continuous = false;
        rec.interimResults = true;
        rec.maxAlternatives = 1;
        rec.lang = languageCode;

        rec.onresult = (event: any) => {
          if (generationRef.current !== myGen) return;
          let interim = '';
          let finals = '';
          for (let i = 0; i < event.results.length; i++) {
            const tr = event.results[i][0]?.transcript || '';
            if (event.results[i].isFinal) {
              finals += (finals ? ' ' : '') + tr.trim();
            } else {
              interim += (interim ? ' ' : '') + tr.trim();
            }
          }
          finalBuffer = [finals, interim].filter(Boolean).join(' ').trim();
          setUserTranscript(finalBuffer);

          if (finals && !settled) {
            settled = true;
            stopMicHardware();
            submitQuery(finals);
          }
        };

        rec.onerror = (e: any) => {
          if (e?.error === 'not-allowed') {
            showToast('Microphone access denied');
            stopMicHardware();
            setStatus('idle');
          }
        };

        rec.onend = () => {
          if (generationRef.current !== myGen || settled) return;
          if (finalBuffer.trim().length > 1) {
            settled = true;
            submitQuery(finalBuffer.trim());
          } else {
            setStatus('idle');
          }
        };

        rec.start();
        recognitionRef.current = rec;
        return;
      } catch {
        // Fall through to MediaRecorder + /api/stt
      }
    }

    // Fallback MediaRecorder + /api/stt when SpeechRecognition is unavailable
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (generationRef.current !== myGen) {
        stream.getTracks().forEach((t) => t.stop());
        return;
      }
      micStreamRef.current = stream;
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];

      recorder.ondataavailable = (ev) => {
        if (ev.data && ev.data.size > 0) audioChunksRef.current.push(ev.data);
      };

      recorder.onstop = () => {
        if (micStreamRef.current) {
          micStreamRef.current.getTracks().forEach((t) => t.stop());
          micStreamRef.current = null;
        }
        if (generationRef.current !== myGen) return;
        const blob = new Blob(audioChunksRef.current, { type: 'audio/webm' });
        if (blob.size < 300) {
          setStatus('idle');
          showToast('Awaz sahi sunai nahi di, dobara try karein');
          return;
        }
        setStatus('thinking');
        const reader = new FileReader();
        reader.readAsDataURL(blob);
        reader.onloadend = async () => {
          try {
            const sttRes = await fetch('/api/stt', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ audio: reader.result, mimeType: 'audio/webm' }),
            });
            const sttData = await sttRes.json();
            const text = (sttData?.text || '').trim();
            if (text.length >= 2) {
              submitQuery(text);
            } else {
              setStatus('idle');
              showToast('Speech samajh nahi aayi, dubara bolein');
            }
          } catch {
            setStatus('idle');
            showToast('Speech transcription error');
          }
        };
      };

      recorder.start(250);
      mediaRecorderRef.current = recorder;
    } catch {
      setStatus('idle');
      showToast('Please allow microphone access');
    }
  }, [languageCode, showToast, stopAllActivity, stopMicHardware, submitQuery]);

  const handleOrbOrMicTap = () => {
    if (orbVideoRef.current) {
      orbVideoRef.current.play().catch(() => {});
    }
    if (status === 'idle') {
      startListening();
    } else if (status === 'listening') {
      if (mediaRecorderRef.current && mediaRecorderRef.current.state !== 'inactive') {
        mediaRecorderRef.current.stop();
      } else if (userTranscript.trim().length > 1) {
        const text = userTranscript.trim();
        stopMicHardware();
        submitQuery(text);
      } else {
        stopAllActivity();
      }
    } else {
      stopAllActivity();
    }
  };

  const handleTextSubmit = (e?: React.FormEvent) => {
    e?.preventDefault();
    const t = textInput.trim();
    if (!t) return;
    setTextInput('');
    submitQuery(t);
  };

  const handleSnapPhoto = () => {
    const video = cameraVideoRef.current;
    const canvas = cameraCanvasRef.current;
    if (!video || !canvas || video.videoWidth === 0) {
      showToast('Camera still warming up...');
      return;
    }
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
    setCapturedImageDataUrl(dataUrl);
    stopCameraStream();
  };

  const handleUploadPhotoFallback = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      const result = ev.target?.result as string;
      if (result) {
        setCapturedImageDataUrl(result);
        stopCameraStream();
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleSendCameraSnap = () => {
    if (!capturedImageDataUrl) return;
    const snap = capturedImageDataUrl;
    const promptToAsk = cameraPrompt.trim() || 'What is this?';
    setIsCameraOpen(false);
    setCapturedImageDataUrl(null);
    setCameraPrompt('What is this?');
    submitQuery(promptToAsk, snap);
  };

  const handleCloseModal = () => {
    stopAllActivity();
    stopCameraStream();
    setIsCameraOpen(false);
    setIsVoiceDrawerOpen(false);
    onClose();
  };

  const statusLabel =
    status === 'listening'
      ? 'LISTENING...'
      : status === 'thinking'
      ? 'THINKING...'
      : status === 'speaking'
      ? 'SPEAKING...'
      : 'TAP TO TALK';

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.24 }}
        className="fixed inset-0 z-[10000] flex flex-col justify-between overflow-hidden select-none"
        style={{
          background: 'radial-gradient(110% 60% at 50% 0%, #dff3ff 0%, #ffffff 62%)',
          color: '#0b1f4a',
          paddingTop: 'env(safe-area-inset-top)',
          paddingBottom: 'env(safe-area-inset-bottom)',
        }}
      >
        {/* Top Header */}
        <header className="relative z-20 flex items-center justify-between px-4 sm:px-6 pt-3.5 pb-2 gap-2">
          {/* Left: Glowing Dot + Dynamic DARO / ZARA Persona Name */}
          <div className="flex items-center gap-2.5">
            <span
              className="w-3.5 h-3.5 rounded-full shrink-0"
              style={{
                background: 'radial-gradient(circle at 35% 30%, #ffffff, #4cc3ff 45%, #1450c8)',
                boxShadow: '0 0 14px #4cc3ff',
              }}
            />
            <div className="flex items-baseline gap-2">
              <span className="font-extrabold tracking-[0.16em] text-sm sm:text-base text-[#0a2a66] uppercase">
                {personaName}
              </span>
              <span className="hidden sm:inline-block text-[11px] font-semibold text-[#6179a0]">
                · {voiceInfo.name}
              </span>
            </div>
          </div>

          {/* Right Controls: Language Pill, Speaker, Quick Voices Switcher, Close */}
          <div className="flex items-center gap-2">
            <select
              value={languageCode}
              onChange={(e) => setLanguageCode(e.target.value)}
              aria-label="Assistant Language"
              className="appearance-none bg-white/75 backdrop-blur-md border border-[#4cc3ff]/40 hover:border-[#4cc3ff] rounded-full px-3 py-1.5 text-xs font-bold text-[#0a2a66] focus:outline-none cursor-pointer shadow-sm"
            >
              {LANGUAGE_OPTIONS.map((lang) => (
                <option key={lang.code} value={lang.code}>
                  {lang.label}
                </option>
              ))}
            </select>

            <button
              type="button"
              onClick={() => setIsVoiceDrawerOpen(true)}
              className="px-3 py-1.5 rounded-full bg-white/75 backdrop-blur-md border border-[#4cc3ff]/40 hover:border-[#4cc3ff] text-xs font-bold text-[#0a2a66] flex items-center gap-1.5 cursor-pointer shadow-sm transition-colors"
              title="Switch Zara / Daro Voice"
            >
              <Sparkles size={13} className="text-[#1450c8]" />
              <span>Voices</span>
            </button>

            <button
              type="button"
              onClick={() => {
                const next = !isSpeakerOn;
                setIsSpeakerOn(next);
                if (!next) stopGeminiTts();
              }}
              className="w-9 h-9 rounded-full bg-white/75 backdrop-blur-md border border-[#4cc3ff]/40 hover:border-[#4cc3ff] text-[#0a2a66] flex items-center justify-center cursor-pointer shadow-sm"
              title={isSpeakerOn ? 'Mute Assistant Audio' : 'Enable Assistant Audio'}
              aria-label="Toggle Speaker"
            >
              {isSpeakerOn ? <Volume2 size={16} /> : <VolumeX size={16} />}
            </button>

            <button
              type="button"
              onClick={handleCloseModal}
              className="w-9 h-9 rounded-full bg-white/75 backdrop-blur-md border border-[#4cc3ff]/40 hover:border-red-300 hover:text-red-600 text-[#0a2a66] flex items-center justify-center cursor-pointer shadow-sm transition-colors"
              title="Close"
              aria-label="Close"
            >
              <X size={17} />
            </button>
          </div>
        </header>

        {/* Main Center: Pulsing Video Orb + Status + Bold Romanized Text Directly at Bottom of Orb */}
        <main className="relative z-10 flex-1 min-h-0 flex flex-col items-center justify-center px-4 sm:px-6 text-center">
          {/* Interactive Energy Video Orb */}
          <div
            onClick={handleOrbOrMicTap}
            role="button"
            aria-label="Tap to talk"
            className="relative flex items-center justify-center cursor-pointer select-none"
            style={{
              width: 'min(52vmin, 340px)',
              height: 'min(52vmin, 340px)',
              transform: `scale(${(1 + audioLevel * 0.17).toFixed(3)})`,
              transition: 'transform 0.09s linear',
            }}
          >
            {/* Soft Sky Blue Radial Aura */}
            <div
              className="absolute -inset-[20%] rounded-full pointer-events-none blur-[14px]"
              style={{
                background: `radial-gradient(circle, rgba(76, 195, 255, ${(0.16 + audioLevel * 0.5).toFixed(
                  2
                )}) 0%, transparent 66%)`,
              }}
            />

            {/* Concentric Ripple Rings while Listening */}
            {status === 'listening' && (
              <>
                <span className="absolute inset-[12%] rounded-full border-2 border-[#4cc3ff] animate-ping opacity-60 pointer-events-none" />
                <span
                  className="absolute inset-[6%] rounded-full border-2 border-[#4cc3ff]/60 animate-ping opacity-40 pointer-events-none"
                  style={{ animationDelay: '0.45s' }}
                />
              </>
            )}

            {/* Video Asset Orb */}
            <video
              ref={orbVideoRef}
              src="/assets/daro_zara_orb.mp4"
              autoPlay
              loop
              muted
              playsInline
              className="relative w-full h-full object-cover block pointer-events-none"
              style={{
                mixBlendMode: 'multiply',
                WebkitMaskImage: 'radial-gradient(circle, #000 48%, transparent 70%)',
                maskImage: 'radial-gradient(circle, #000 48%, transparent 70%)',
              }}
            />
          </div>

          {/* Status Indicator Dot + Label */}
          <div className="flex items-center gap-2 text-[11px] sm:text-xs font-bold tracking-[0.2em] uppercase text-[#6179a0] mt-1">
            <span
              className={`w-2 h-2 rounded-full bg-[#4cc3ff] shadow-[0_0_10px_#4cc3ff] ${
                status === 'thinking' || status === 'listening' ? 'animate-pulse' : ''
              }`}
            />
            <span>{statusLabel}</span>
          </div>

          {/* Bold Text Always Shown Directly at Bottom of Orb */}
          <div className="w-full max-w-[680px] mt-3 px-2 space-y-1.5">
            {attachedThumbUrl && (
              <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-full bg-white/80 border border-[#4cc3ff]/40 shadow-sm mx-auto">
                <img
                  src={attachedThumbUrl}
                  alt="Captured preview"
                  className="w-6 h-6 rounded-full object-cover"
                  referrerPolicy="no-referrer"
                />
                <span className="text-xs font-bold text-[#0a2a66]">Camera Snapshot Analyzed</span>
              </div>
            )}

            {userTranscript && (
              <p
                dir="auto"
                className="text-sm sm:text-base font-bold text-[#4a6491] leading-snug line-clamp-2"
              >
                You: {userTranscript}
              </p>
            )}

            <div
              dir="auto"
              className="max-h-[22dvh] overflow-y-auto px-2 text-base sm:text-xl font-extrabold text-[#0a2a66] leading-relaxed select-text"
            >
              {aiSpeechText}
            </div>

            {goToChatTopic && (
              <div className="pt-2 flex justify-center">
                <button
                  type="button"
                  onClick={() => {
                    const topicToOpen = goToChatTopic;
                    handleCloseModal();
                    if (onGoToChat) {
                      onGoToChat(topicToOpen);
                    } else if (onSendUserPrompt) {
                      onSendUserPrompt(topicToOpen);
                    }
                  }}
                  className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#0a2a66] hover:bg-[#1450c8] text-white text-xs sm:text-sm font-extrabold inline-flex items-center gap-2 shadow-md cursor-pointer transition-all active:scale-95"
                >
                  <MessageSquare size={15} />
                  <span>Go to Chat for Full Explanation</span>
                  <ArrowRight size={15} />
                </button>
              </div>
            )}
          </div>
        </main>

        {/* Bottom Dock: Pill Input (Camera icon when empty -> ArrowUp when typed) + Blue Mic/Stop Button */}
        <footer className="relative z-20 w-full max-w-[680px] mx-auto px-4 pb-5 pt-2">
          <form onSubmit={handleTextSubmit} className="flex items-center gap-2.5 sm:gap-3">
            <div className="flex-1 flex items-center bg-white/80 backdrop-blur-md border border-[#4cc3ff]/45 focus-within:border-[#4cc3ff] rounded-full pl-5 pr-1.5 py-1.5 shadow-[0_10px_30px_rgba(20,80,200,0.1)] focus-within:shadow-[0_10px_34px_rgba(76,195,255,0.28)] transition-all">
              <input
                type="text"
                dir="auto"
                value={textInput}
                onChange={(e) => setTextInput(e.target.value)}
                placeholder={`Ask ${personaName} anything...`}
                className="flex-1 min-w-0 bg-transparent border-0 outline-none text-sm sm:text-base font-semibold text-[#0a2a66] placeholder:text-[#6179a0]/80 py-2 pr-2"
              />

              {textInput.trim().length > 0 ? (
                <button
                  type="submit"
                  className="w-10 h-10 rounded-full bg-[#0a2a66] hover:bg-[#1450c8] text-white flex items-center justify-center shrink-0 transition-transform active:scale-95 cursor-pointer shadow-md"
                  title="Send message"
                  aria-label="Send message"
                >
                  <ArrowUp size={18} strokeWidth={2.5} />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    stopAllActivity();
                    setCapturedImageDataUrl(null);
                    setCameraPrompt('What is this?');
                    setIsCameraOpen(true);
                  }}
                  className="w-10 h-10 rounded-full bg-[#0a2a66] hover:bg-[#1450c8] text-white flex items-center justify-center shrink-0 transition-transform active:scale-95 cursor-pointer shadow-md"
                  title="Open Camera Vision (What is this?)"
                  aria-label="Open Camera Vision"
                >
                  <Camera size={18} strokeWidth={2.2} />
                </button>
              )}
            </div>

            {/* Big Circular Blue Mic / Stop Button */}
            <button
              type="button"
              onClick={handleOrbOrMicTap}
              aria-label={status === 'idle' ? 'Tap to Talk' : 'Stop'}
              title={status === 'idle' ? 'Tap to Talk' : 'Stop'}
              className="w-14 h-14 sm:w-[60px] sm:h-[60px] rounded-full text-white flex items-center justify-center shrink-0 cursor-pointer transition-all active:scale-95"
              style={
                status === 'idle'
                  ? {
                      background: 'linear-gradient(145deg, #1450c8, #0a2a66)',
                      boxShadow:
                        '0 12px 30px rgba(10,42,102,0.38), inset 0 1px 0 rgba(255,255,255,0.3)',
                    }
                  : {
                      background: 'linear-gradient(145deg, #4cc3ff, #1e8fe0)',
                      boxShadow:
                        '0 0 0 8px rgba(76,195,255,0.22), 0 12px 30px rgba(30,143,224,0.5)',
                    }
              }
            >
              {status === 'idle' ? (
                <Mic size={24} strokeWidth={2.2} />
              ) : (
                <Square size={20} className="fill-current" />
              )}
            </button>
          </form>
        </footer>

        {/* Toast */}
        <AnimatePresence>
          {toastMsg && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 12 }}
              className="fixed left-1/2 -translate-x-1/2 bottom-24 z-40 px-4 py-2 rounded-full bg-[#0a2a66] text-white text-xs font-bold shadow-lg"
            >
              {toastMsg}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Live Camera Vision Modal ("What is this?") */}
        <AnimatePresence>
          {isCameraOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex flex-col items-center justify-center p-3 sm:p-6"
            >
              <div className="relative w-full max-w-md rounded-[28px] bg-white border border-[#4cc3ff]/40 overflow-hidden shadow-2xl flex flex-col">
                <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-100">
                  <div className="flex items-center gap-2">
                    <Camera size={17} className="text-[#1450c8]" />
                    <span className="font-extrabold text-sm text-[#0a2a66]">
                      {personaName} Camera Vision
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {!capturedImageDataUrl && (
                      <button
                        type="button"
                        onClick={() =>
                          setFacingMode((m) => (m === 'environment' ? 'user' : 'environment'))
                        }
                        className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 text-[#0a2a66] flex items-center justify-center cursor-pointer"
                        title="Flip Camera"
                      >
                        <RefreshCw size={15} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => {
                        stopCameraStream();
                        setIsCameraOpen(false);
                        setCapturedImageDataUrl(null);
                      }}
                      className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-700 flex items-center justify-center cursor-pointer"
                      aria-label="Close camera"
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>

                {/* Live Camera Preview or Captured Snapshot */}
                <div className="relative w-full aspect-[4/3] bg-zinc-950 flex items-center justify-center overflow-hidden">
                  {capturedImageDataUrl ? (
                    <img
                      src={capturedImageDataUrl}
                      alt="Captured object"
                      className="w-full h-full object-contain"
                      referrerPolicy="no-referrer"
                    />
                  ) : cameraError ? (
                    <div className="p-6 text-center space-y-3 text-white">
                      <p className="text-xs font-medium text-zinc-300 leading-relaxed">
                        {cameraError}
                      </p>
                      <button
                        type="button"
                        onClick={() => cameraFileInputRef.current?.click()}
                        className="px-4 py-2 rounded-xl bg-[#00a6ff] hover:bg-[#0094e6] text-white text-xs font-bold inline-flex items-center gap-1.5 cursor-pointer"
                      >
                        <ImagePlus size={14} />
                        <span>Take / Upload Photo</span>
                      </button>
                    </div>
                  ) : (
                    <video
                      ref={cameraVideoRef}
                      autoPlay
                      muted
                      playsInline
                      className="w-full h-full object-cover"
                    />
                  )}
                  <canvas ref={cameraCanvasRef} className="hidden" />
                  <input
                    ref={cameraFileInputRef}
                    type="file"
                    accept="image/*"
                    capture="environment"
                    onChange={handleUploadPhotoFallback}
                    className="hidden"
                  />
                </div>

                {/* Camera Actions */}
                <div className="p-4 space-y-3 bg-white">
                  {!capturedImageDataUrl ? (
                    <div className="flex items-center justify-between gap-3">
                      <button
                        type="button"
                        onClick={() => cameraFileInputRef.current?.click()}
                        className="px-3.5 py-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-[#0a2a66] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                      >
                        <ImagePlus size={14} />
                        <span>Upload</span>
                      </button>
                      <button
                        type="button"
                        onClick={handleSnapPhoto}
                        disabled={Boolean(cameraError)}
                        className="flex-1 py-2.5 px-4 rounded-xl bg-[#0a2a66] hover:bg-[#1450c8] disabled:opacity-40 text-white text-xs font-extrabold flex items-center justify-center gap-2 cursor-pointer shadow-md"
                      >
                        <Camera size={15} />
                        <span>Snap Photo</span>
                      </button>
                    </div>
                  ) : (
                    <>
                      <input
                        type="text"
                        value={cameraPrompt}
                        onChange={(e) => setCameraPrompt(e.target.value)}
                        placeholder="Ask about this image (e.g. What is this?)"
                        className="w-full px-3.5 py-2.5 rounded-xl border border-zinc-200 text-xs sm:text-sm font-semibold text-[#0a2a66] focus:border-[#4cc3ff] focus:outline-none"
                      />
                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => setCapturedImageDataUrl(null)}
                          className="px-3.5 py-2.5 rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                        >
                          <RotateCcw size={14} />
                          <span>Retake</span>
                        </button>
                        <button
                          type="button"
                          onClick={handleSendCameraSnap}
                          className="flex-1 py-2.5 px-4 rounded-xl bg-[#0a2a66] hover:bg-[#1450c8] text-white text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer shadow-md"
                        >
                          <ArrowUp size={15} />
                          <span>Ask {personaName}</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Quick Voices Switcher Sheet (Zara Female / Daro Male) */}
        <AnimatePresence>
          {isVoiceDrawerOpen && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                stopGeminiTts();
                setTestingVoiceId(null);
                setIsVoiceDrawerOpen(false);
              }}
              className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm flex items-center justify-center p-4"
            >
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                onClick={(e) => e.stopPropagation()}
                className="w-full max-w-lg max-h-[82vh] rounded-[26px] bg-white border border-zinc-200 shadow-2xl flex flex-col overflow-hidden"
              >
                <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-zinc-100">
                  <h3 className="text-base sm:text-lg font-extrabold text-zinc-900">
                    Voices · Zara & Daro
                  </h3>
                  <button
                    type="button"
                    onClick={() => {
                      stopGeminiTts();
                      setTestingVoiceId(null);
                      setIsVoiceDrawerOpen(false);
                    }}
                    className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-700 flex items-center justify-center cursor-pointer"
                    aria-label="Close voices"
                  >
                    <X size={16} />
                  </button>
                </div>

                <div className="flex-1 overflow-y-auto p-4 grid grid-cols-2 sm:grid-cols-3 gap-2 no-scrollbar">
                  {GEMINI_TTS_VOICES.map((v) => {
                    const active = selectedVoiceId === v.id;
                    const testing = testingVoiceId === v.id;
                    return (
                      <div
                        key={v.id}
                        onClick={() => {
                          setSelectedVoiceId(v.id);
                          setStoredVoice(v.id);
                          onVoiceChanged?.(v.id);
                        }}
                        className={`p-2.5 rounded-xl border cursor-pointer flex flex-col justify-between gap-2 transition-all ${
                          active
                            ? 'bg-sky-50/70 border-[#00a6ff] ring-1 ring-[#00a6ff]/60'
                            : 'bg-white border-zinc-200 hover:border-zinc-300'
                        }`}
                      >
                        <div className="flex items-start justify-between gap-1">
                          <div className="min-w-0">
                            <div className="font-bold text-xs text-zinc-900 truncate">{v.name}</div>
                            <div className="text-[10px] font-semibold text-zinc-500">
                              {v.persona} · {v.gender}
                            </div>
                          </div>
                          {active && <Check size={14} className="text-[#00a6ff] shrink-0" />}
                        </div>
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            if (testing) {
                              stopGeminiTts();
                              setTestingVoiceId(null);
                              return;
                            }
                            setTestingVoiceId(v.id);
                            speakWithGeminiTts(
                              v.previewSample,
                              v.id,
                              () => setTestingVoiceId(v.id),
                              () => setTestingVoiceId(null),
                              () => setTestingVoiceId(null)
                            );
                          }}
                          className="px-2 py-1 rounded-lg bg-zinc-100 hover:bg-zinc-200 text-zinc-800 text-[11px] font-semibold flex items-center justify-center gap-1 cursor-pointer"
                        >
                          {testing ? (
                            <>
                              <Loader2 size={10} className="animate-spin" />
                              <span>Playing</span>
                            </>
                          ) : (
                            <>
                              <Play size={10} className="fill-current" />
                              <span>Test</span>
                            </>
                          )}
                        </button>
                      </div>
                    );
                  })}
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
};
