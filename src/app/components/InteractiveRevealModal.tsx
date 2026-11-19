// @ts-nocheck
import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  Plus,
  ChevronDown,
  Mic,
  MicOff,
  ArrowUp,
  Code,
  Globe,
  MessageSquare,
  LayoutGrid,
  Folder,
  PhoneCall,
  Settings,
  ChevronRight,
  ArrowLeft,
  User as UserIcon,
  X,
  Paperclip,
  LogOut,
  Lock,
  Trash2,
  Hammer,
  Wand2,
  AudioLines,
  Sparkles,
  KeyRound,
  CalendarClock,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { HERO_AVATAR } from '../data/portfolioData';
import defaultVisibleImg from '../assets/images/back_reveal.png';
import revealedUnderneathImg from '../assets/images/front_overlay.jpg';
import { FullScreenChatView, SttSoundBar } from './FullScreenChatView';
import { AttachedFile, PromptChatMode } from '../types';
import { AttachmentGrid } from './AttachmentGrid';
import { LiveVoiceCallModal } from './LiveVoiceCallModal';
import { ExploreGptsModal, AiSkillItem } from './ExploreGptsModal';
import { AiApiSettingsModal } from './AiApiSettingsModal';
import { BuildyExpandableCard } from './BuildyExpandableCard';
import { BuildyWorkspaceModal } from './BuildyWorkspaceModal';
import { useTheme } from '../context/ThemeContext';
import { isWebsiteOrAppUiBuildRequest } from '../utils/buildyIntent';
import { getActiveAssistantPersona } from '../utils/geminiTts';
import { detectAndExtractCode, sniffCodeLanguage } from '../utils/codeAttachment';
import {
  subscribeToAuth,
  getCurrentUser,
  getFirebaseIdToken,
  logOut,
  subscribeToUserChatThreads,
  deleteChatThreadFromFirestore,
} from '../firebase';
import { buildWorkspaceAuthHeaders } from '../utils/workspaceSession';
import {
  mergeChatThreads,
  getUserStorageScope,
  loadChatThreadsFromStorage,
  saveChatThreadsToStorage,
  CHAT_THREADS_UPDATED_EVENT,
} from '../utils/chatThreads';

interface Message {
  id: string;
  sender: 'ai' | 'user';
  text: string;
  timestamp: string;
}

interface InteractiveRevealModalProps {
  isOpen: boolean;
  onClose: () => void;
  onOpenBooking?: () => void;
  onOpenLogin?: () => void;
  initialTopic?: string;
}

export const InteractiveRevealModal: React.FC<InteractiveRevealModalProps> = ({
  isOpen,
  onClose,
  onOpenBooking,
  onOpenLogin,
  initialTopic = '',
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const { theme } = useTheme();
  const isLight = theme === 'light';


  // Chat & Prompt States
  const [inputValue, setInputValue] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [isTyping, setIsTyping] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isPlusMenuOpen, setIsPlusMenuOpen] = useState(false);
  const [isModeMenuOpen, setIsModeMenuOpen] = useState(false);
  const [selectedMode, setSelectedMode] = useState<PromptChatMode>('Chat');
  const [isRecording, setIsRecording] = useState(false);
  const [activeRecentItem, setActiveRecentItem] = useState('Guest Session');
  const [showResponsePopup, setShowResponsePopup] = useState(false);
  const [isFullScreenChatOpen, setIsFullScreenChatOpen] = useState(false);
  const [isVoiceCallOpen, setIsVoiceCallOpen] = useState(false);
  const [isVoiceSettingsOpen, setIsVoiceSettingsOpen] = useState(false);
  const [isExploreGptsOpen, setIsExploreGptsOpen] = useState(false);
  const [isBuildyOpen, setIsBuildyOpen] = useState(false);
  const [buildyInitialPrompt, setBuildyInitialPrompt] = useState<string | undefined>(undefined);
  const [activeSkill, setActiveSkill] = useState<AiSkillItem | null>(null);
  const [activePersona, setActivePersona] = useState<'Zara' | 'Daro'>(() => getActiveAssistantPersona());
  const [buildyRedirectRequest, setBuildyRedirectRequest] = useState<string | null>(null);
  const [currentFullScreenPrompt, setCurrentFullScreenPrompt] = useState('');
  const [currentFullScreenAttachments, setCurrentFullScreenAttachments] = useState<AttachedFile[]>([]);
  const [currentUser, setCurrentUser] = useState<any>(() => getCurrentUser());
  const [userChatThreads, setUserChatThreads] = useState<Record<string, any>>(() =>
    loadChatThreadsFromStorage(getUserStorageScope(getCurrentUser()))
  );

  useEffect(() => {
    const onOpenBuildy = (e: Event) => {
      const detail = (e as CustomEvent)?.detail;
      setBuildyInitialPrompt(detail?.initialPrompt || undefined);
      setIsBuildyOpen(true);
    };
    window.addEventListener('open-buildy-workspace', onOpenBuildy as EventListener);
    return () => window.removeEventListener('open-buildy-workspace', onOpenBuildy as EventListener);
  }, []);

  useEffect(() => {
    const syncLocal = () => {
      const scope = getUserStorageScope(getCurrentUser());
      setUserChatThreads(loadChatThreadsFromStorage(scope));
    };
    window.addEventListener(CHAT_THREADS_UPDATED_EVENT, syncLocal);
    window.addEventListener('storage', syncLocal);
    return () => {
      window.removeEventListener(CHAT_THREADS_UPDATED_EVENT, syncLocal);
      window.removeEventListener('storage', syncLocal);
    };
  }, []);

  useEffect(() => {
    const unsub = subscribeToAuth((user) => {
      setCurrentUser(user);
      const scope = getUserStorageScope(user);
      setUserChatThreads(loadChatThreadsFromStorage(scope));
      if (user && !user.isAnonymous) {
        setActiveRecentItem('');
      } else {
        setActiveRecentItem('Guest Session');
      }
    });
    return () => unsub();
  }, []);

  // Listen to Firestore real-time chats if user is logged in & merge with browser storage
  useEffect(() => {
    const scope = getUserStorageScope(currentUser);
    if (!currentUser || currentUser.isAnonymous) {
      setUserChatThreads(loadChatThreadsFromStorage(scope));
      return;
    }
    const unsub = subscribeToUserChatThreads(currentUser.uid, (threads) => {
      setUserChatThreads((prev) => mergeChatThreads(threads, prev));
    });
    return () => unsub();
  }, [currentUser?.uid, currentUser?.isAnonymous]);

  // Working File Attachments (Matches exact screenshot styling, Max 10 files)
  const [attachments, setAttachments] = useState<AttachedFile[]>([]);
  const [fileLimitError, setFileLimitError] = useState<string | null>(null);
  const [isDraggingOver, setIsDraggingOver] = useState<boolean>(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Microphone and Speech-to-Text Support with Live Transcription
  const [micStatusMsg, setMicStatusMsg] = useState<string | null>(null);
  const [isTranscribing, setIsTranscribing] = useState<boolean>(false);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const audioChunksRef = useRef<Blob[]>([]);
  const speechRecognitionRef = useRef<any>(null);
  const micBaseInputRef = useRef<string>('');
  const liveTranscriptRef = useRef<string>('');
  const micSessionGenRef = useRef<number>(0);
  const micMimeTypeRef = useRef<string>('audio/webm');
  const recorderStopResolverRef = useRef<((blob: Blob | null) => void) | null>(null);
  const isRecordingRef = useRef<boolean>(false);
  const suppressSttFallbackRef = useRef<boolean>(false);

  const showMicToast = (msg: string) => {
    setMicStatusMsg(msg);
    setTimeout(() => setMicStatusMsg((curr) => (curr === msg ? null : curr)), 3000);
  };

  const processFiles = (files: FileList | File[]) => {
    const fileArray = Array.from(files);
    if (!fileArray.length) return;

    if (attachments.length >= 10) {
      setFileLimitError('Max 10 files can be attached.');
      setTimeout(() => setFileLimitError(null), 3500);
      return;
    }

    const availableSlots = 10 - attachments.length;
    const filesToAttach = fileArray.slice(0, availableSlots);

    if (fileArray.length > availableSlots) {
      setFileLimitError(`Max 10 files limit reached. Added ${availableSlots} file(s).`);
      setTimeout(() => setFileLimitError(null), 3500);
    }

    filesToAttach.forEach((file) => {
      const isImg = file.type.startsWith('image/');
      const isCodeOrText =
        file.type.includes('text') ||
        /\.(txt|md|json|js|jsx|ts|tsx|html|css|py|csv|xml|sql|yaml|yml)$/i.test(file.name);
      const reader = new FileReader();
      const attachmentId = `att-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      reader.onload = (ev) => {
        const content = (ev.target?.result as string) || '';
        const langInfo = isCodeOrText ? sniffCodeLanguage(content, file.name) : undefined;
        const newAttachment: AttachedFile = {
          id: attachmentId,
          name: file.name,
          size: file.size,
          type: file.type,
          isImage: isImg,
          preview: content,
          codeContent: isCodeOrText ? content : undefined,
          language: langInfo?.lang,
        };
        setAttachments((prev) => [...prev, newAttachment]);
      };

      if (isCodeOrText) {
        reader.readAsText(file);
      } else {
        reader.readAsDataURL(file);
      }
    });
  };

  const removeAttachment = (id: string) => {
    setAttachments((prev) => prev.filter((item) => item.id !== id));
  };

  // Spotlight Lerp Radius Calculation
  const getAdaptiveRadius = useCallback((): number => {
    if (typeof window === 'undefined') return 140;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const minDim = Math.min(w, h);

    if (w < 640) return Math.round(Math.max(75, Math.min(minDim * 0.22, 95)));
    if (w < 1024) return Math.round(Math.max(120, Math.min(minDim * 0.18, 150)));
    if (w < 1536) return Math.round(Math.max(170, Math.min(minDim * 0.2, 210)));
    return Math.round(Math.max(220, Math.min(minDim * 0.22, 280)));
  }, []);

  const revealedLayerRef = useRef<HTMLDivElement>(null);
  const revealRafRef = useRef<number>(0);
  const targetPos = useRef<{ x: number; y: number }>({ x: -500, y: -500 });
  const currentPos = useRef<{ x: number; y: number }>({ x: -500, y: -500 });
  const targetRadius = useRef<number>(0);
  const currentRadius = useRef<number>(0);
  const targetOpacity = useRef<number>(0);
  const currentOpacity = useRef<number>(0);

  const isOverlayActive =
    isFullScreenChatOpen ||
    isBuildyOpen ||
    isVoiceCallOpen ||
    isExploreGptsOpen ||
    isVoiceSettingsOpen ||
    isDrawerOpen;
  const isOverlayActiveRef = useRef<boolean>(false);
  isOverlayActiveRef.current = isOverlayActive;

  const applyRevealToDom = useCallback(() => {
    const el = revealedLayerRef.current;
    if (!el) return;
    const safeOpacity = currentOpacity.current < 0.005 ? 0 : currentOpacity.current;
    const safeRadius = currentRadius.current < 0.5 ? 0 : currentRadius.current;
    el.style.opacity = String(safeOpacity);
    if (safeRadius > 0 && safeOpacity > 0) {
      const maskVal = `radial-gradient(circle ${safeRadius.toFixed(1)}px at ${currentPos.current.x.toFixed(1)}px ${currentPos.current.y.toFixed(1)}px, black 65%, transparent 100%)`;
      el.style.maskImage = maskVal;
      (el.style as any).webkitMaskImage = maskVal;
    } else {
      el.style.maskImage = 'none';
      (el.style as any).webkitMaskImage = 'none';
    }
  }, []);

  const scheduleRevealLoop = useCallback(() => {
    if (!isOpen || isOverlayActiveRef.current) return;
    if (revealRafRef.current) return;

    const step = () => {
      revealRafRef.current = 0;
      if (!isOpen || isOverlayActiveRef.current) return;

      const dx = targetPos.current.x - currentPos.current.x;
      const dy = targetPos.current.y - currentPos.current.y;
      const dr = targetRadius.current - currentRadius.current;
      const do_ = targetOpacity.current - currentOpacity.current;

      currentPos.current.x += dx * 0.18;
      currentPos.current.y += dy * 0.18;
      currentRadius.current += dr * 0.18;
      currentOpacity.current += do_ * 0.18;

      const settled =
        Math.abs(dx) < 0.35 &&
        Math.abs(dy) < 0.35 &&
        Math.abs(dr) < 0.35 &&
        Math.abs(do_) < 0.005;

      if (settled) {
        currentPos.current = { ...targetPos.current };
        currentRadius.current = targetRadius.current;
        currentOpacity.current = targetOpacity.current;
        applyRevealToDom();
        return;
      }

      applyRevealToDom();
      revealRafRef.current = requestAnimationFrame(step);
    };

    revealRafRef.current = requestAnimationFrame(step);
  }, [isOpen, applyRevealToDom]);

  // Keyboard shortcut: Escape to close
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        if (isDrawerOpen) {
          setIsDrawerOpen(false);
        } else {
          onClose();
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, isDrawerOpen, onClose]);

  // Reset when opening or when initialTopic changes
  useEffect(() => {
    if (isOpen) {
      targetRadius.current = 0;
      currentRadius.current = 0;
      targetOpacity.current = 0;
      currentOpacity.current = 0;
      applyRevealToDom();
      if (initialTopic) {
        setInputValue(initialTopic);
        const targetTopic = currentUser && !currentUser.isAnonymous
          ? (initialTopic.length > 25 ? `${initialTopic.slice(0, 25)}...` : initialTopic)
          : 'Guest Session';
        setActiveRecentItem(targetTopic);
        setCurrentFullScreenPrompt(initialTopic);
        setIsFullScreenChatOpen(true);
      }
    }
  }, [isOpen, initialTopic, applyRevealToDom]);

  // Pause reveal loop whenever an overlay / chat view is active
  useEffect(() => {
    if (isOverlayActive || !isOpen) {
      if (revealRafRef.current) {
        cancelAnimationFrame(revealRafRef.current);
        revealRafRef.current = 0;
      }
      targetRadius.current = 0;
      currentRadius.current = 0;
      targetOpacity.current = 0;
      currentOpacity.current = 0;
      applyRevealToDom();
    }
    return () => {
      if (revealRafRef.current) {
        cancelAnimationFrame(revealRafRef.current);
        revealRafRef.current = 0;
      }
    };
  }, [isOverlayActive, isOpen, applyRevealToDom]);

  const handleMouseMove = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (isOverlayActiveRef.current) return;
      targetPos.current = { x: e.clientX, y: e.clientY };
      targetRadius.current = getAdaptiveRadius();
      targetOpacity.current = 1;
      scheduleRevealLoop();
    },
    [getAdaptiveRadius, scheduleRevealLoop]
  );

  const handleMouseEnter = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (isOverlayActiveRef.current) return;
      targetPos.current = { x: e.clientX, y: e.clientY };
      currentPos.current = { x: e.clientX, y: e.clientY };
      targetRadius.current = getAdaptiveRadius();
      targetOpacity.current = 1;
      scheduleRevealLoop();
    },
    [getAdaptiveRadius, scheduleRevealLoop]
  );

  const handleMouseLeave = useCallback(() => {
    targetRadius.current = 0;
    targetOpacity.current = 0;
    scheduleRevealLoop();
  }, [scheduleRevealLoop]);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (isOverlayActiveRef.current) return;
      const touch = e.touches[0];
      if (touch) {
        targetPos.current = { x: touch.clientX, y: touch.clientY };
        currentPos.current = { x: touch.clientX, y: touch.clientY };
        targetRadius.current = getAdaptiveRadius();
        targetOpacity.current = 1;
        scheduleRevealLoop();
      }
    },
    [getAdaptiveRadius, scheduleRevealLoop]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent<HTMLDivElement>) => {
      if (isOverlayActiveRef.current) return;
      const touch = e.touches[0];
      if (touch) {
        targetPos.current = { x: touch.clientX, y: touch.clientY };
        targetRadius.current = getAdaptiveRadius();
        targetOpacity.current = 1;
        scheduleRevealLoop();
      }
    },
    [getAdaptiveRadius, scheduleRevealLoop]
  );

  const handleTouchEnd = useCallback(() => {
    targetRadius.current = 0;
    targetOpacity.current = 0;
    scheduleRevealLoop();
  }, [scheduleRevealLoop]);

  const handleTouchCancel = useCallback(() => {
    targetRadius.current = 0;
    targetOpacity.current = 0;
    scheduleRevealLoop();
  }, [scheduleRevealLoop]);

  // Automatically extract pasted or typed code into attached file chips
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData('text');
    if (!text) return;
    const { hasCode, cleanedText, codeFiles } = detectAndExtractCode(text);
    if (hasCode && codeFiles.length > 0) {
      e.preventDefault();
      const updated = [...attachments];
      for (const cf of codeFiles) {
        if (updated.length < 10) updated.push(cf);
      }
      setAttachments(updated);
      if (cleanedText) {
        setInputValue((prev) => (prev ? `${prev} ${cleanedText}`.trim() : cleanedText));
      }
    }
  };

  // Send action - Redirects website/App UI builds to upward-expanding Buildy card, or opens full screen chat
  const handleSend = (textToSend?: string, bypassBuildyCheck = false) => {
    let text = (textToSend || inputValue).trim();
    let currentAtts = [...attachments];

    // If user provided code in prompt box, auto-attach it as a file chip
    const { hasCode, cleanedText, codeFiles } = detectAndExtractCode(text);
    if (hasCode && codeFiles.length > 0) {
      for (const cf of codeFiles) {
        if (currentAtts.length < 10) currentAtts.push(cf);
      }
      text = cleanedText;
    }

    if (!text && currentAtts.length === 0) return;

    const promptText = text || (currentAtts[0] ? `Analyze ${currentAtts[0].name}` : 'Code analysis request');

    if (selectedMode !== 'Plan' && !bypassBuildyCheck && isWebsiteOrAppUiBuildRequest(promptText, currentAtts)) {
      setBuildyRedirectRequest(null);
      setBuildyInitialPrompt(promptText);
      setIsBuildyOpen(true);
      setInputValue('');
      setAttachments([]);
      setIsPlusMenuOpen(false);
      setIsModeMenuOpen(false);
      setIsDrawerOpen(false);
      return;
    }

    setBuildyRedirectRequest(null);

    const userMsg: Message = {
      id: Date.now().toString(),
      sender: 'user',
      text: promptText,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, userMsg]);
    const targetTopic = currentUser && !currentUser.isAnonymous
      ? (promptText.length > 25 ? `${promptText.slice(0, 25)}...` : promptText)
      : 'Guest Session';

    setActiveRecentItem(targetTopic);
    setCurrentFullScreenPrompt(promptText);
    setCurrentFullScreenAttachments(currentAtts);
    setInputValue('');
    setAttachments([]); // Clean up already attached files
    setIsPlusMenuOpen(false);
    setIsModeMenuOpen(false);
    setIsDrawerOpen(false);
    setIsFullScreenChatOpen(true);
  };

  const stopMicHardwareAndCollectBlob = async (collectBlob: boolean): Promise<Blob | null> => {
    isRecordingRef.current = false;

    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.onresult = null;
        speechRecognitionRef.current.onend = null;
        speechRecognitionRef.current.onerror = null;
        speechRecognitionRef.current.stop();
      } catch {}
      speechRecognitionRef.current = null;
    }

    const recorder = mediaRecorderRef.current;
    if (!recorder || recorder.state === 'inactive') {
      mediaRecorderRef.current = null;
      if (!collectBlob) {
        audioChunksRef.current = [];
        return null;
      }
      if (audioChunksRef.current.length === 0) return null;
      return new Blob(audioChunksRef.current, { type: micMimeTypeRef.current || 'audio/webm' });
    }

    if (!collectBlob) {
      suppressSttFallbackRef.current = true;
      audioChunksRef.current = [];
      recorderStopResolverRef.current = null;
      try {
        recorder.stop();
      } catch {}
      mediaRecorderRef.current = null;
      return null;
    }

    suppressSttFallbackRef.current = false;
    return new Promise<Blob | null>((resolve) => {
      let settled = false;
      const finish = (blob: Blob | null) => {
        if (settled) return;
        settled = true;
        recorderStopResolverRef.current = null;
        resolve(blob);
      };

      const timeoutId = window.setTimeout(() => {
        const fallbackBlob =
          audioChunksRef.current.length > 0
            ? new Blob(audioChunksRef.current, { type: micMimeTypeRef.current || 'audio/webm' })
            : null;
        finish(fallbackBlob);
      }, 1500);

      recorderStopResolverRef.current = (blob) => {
        window.clearTimeout(timeoutId);
        finish(blob);
      };

      try {
        recorder.stop();
      } catch {
        window.clearTimeout(timeoutId);
        finish(
          audioChunksRef.current.length > 0
            ? new Blob(audioChunksRef.current, { type: micMimeTypeRef.current || 'audio/webm' })
            : null
        );
      }
    });
  };

  const transcribeBlobWithApi = async (audioBlob: Blob, sessionGen: number): Promise<string> => {
    if (!audioBlob || audioBlob.size < 120) return '';
    if (sessionGen !== micSessionGenRef.current) return '';

    const base64Audio = await new Promise<string>((resolve) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(String(reader.result || ''));
      reader.onerror = () => resolve('');
      reader.readAsDataURL(audioBlob);
    });

    if (!base64Audio || sessionGen !== micSessionGenRef.current) return '';

    try {
      const token = await getFirebaseIdToken().catch(() => null);
      if (sessionGen !== micSessionGenRef.current) return '';
      const sttRes = await fetch('/api/stt', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...buildWorkspaceAuthHeaders(token),
        },
        body: JSON.stringify({
          audio: base64Audio,
          mimeType: audioBlob.type || micMimeTypeRef.current || 'audio/webm',
        }),
      });
      const sttData = await sttRes.json().catch(() => ({}));
      if (sessionGen !== micSessionGenRef.current) return '';
      return typeof sttData?.text === 'string' ? sttData.text.trim() : '';
    } catch (sttErr) {
      console.warn('STT transcription error:', sttErr);
      return '';
    }
  };

  // Cross (X): Cuts everything spoken so ZERO spoken words stay in the prompt box
  const handleCancelMic = () => {
    micSessionGenRef.current += 1;
    suppressSttFallbackRef.current = true;
    liveTranscriptRef.current = '';
    audioChunksRef.current = [];
    void stopMicHardwareAndCollectBlob(false);
    setIsRecording(false);
    setIsTranscribing(false);
    setInputValue(micBaseInputRef.current);
    showMicToast('Recording cut & discarded');
  };

  // Pause (Square): Transcribes recorded speech and places it ONLY in the prompt box
  const handleStopMicKeepText = async () => {
    if (isTranscribing) return;
    const sessionGen = micSessionGenRef.current;
    const base = micBaseInputRef.current.trim();
    const audioBlob = await stopMicHardwareAndCollectBlob(true);
    if (sessionGen !== micSessionGenRef.current) return;

    const liveSpoken = liveTranscriptRef.current.trim();
    if (liveSpoken) {
      setIsRecording(false);
      setIsTranscribing(false);
      setInputValue([base, liveSpoken].filter(Boolean).join(' '));
      showMicToast('Text kept in prompt box');
      return;
    }

    if (audioBlob && audioBlob.size >= 120) {
      setIsRecording(false);
      setIsTranscribing(true);
      showMicToast('Converting speech to text...');
      const transcript = await transcribeBlobWithApi(audioBlob, sessionGen);
      if (sessionGen !== micSessionGenRef.current) return;
      setIsTranscribing(false);
      if (transcript) {
        setInputValue([base, transcript].filter(Boolean).join(' '));
        showMicToast('Text kept in prompt box');
      } else {
        setInputValue(micBaseInputRef.current);
        showMicToast('Could not recognize speech');
      }
      return;
    }

    setIsRecording(false);
    setIsTranscribing(false);
    showMicToast('Text kept in prompt box');
  };

  // Forward (Black ArrowUp): Stays solid black, transcribes audio if needed, then auto-forwards immediately
  const handleConfirmMic = async () => {
    if (isTranscribing) return;
    const sessionGen = micSessionGenRef.current;
    const base = micBaseInputRef.current.trim();
    const preLive = liveTranscriptRef.current.trim();
    const currentTyped = inputValue.trim();

    if (preLive || (currentTyped && currentTyped !== base)) {
      const immediateText = preLive ? [base, preLive].filter(Boolean).join(' ').trim() : currentTyped;
      void stopMicHardwareAndCollectBlob(false);
      setIsRecording(false);
      setIsTranscribing(false);
      if (immediateText) {
        handleSend(immediateText);
        return;
      }
    }

    setIsRecording(false);
    setIsTranscribing(true);
    showMicToast('Transcribing & forwarding...');

    const audioBlob = await stopMicHardwareAndCollectBlob(true);
    if (sessionGen !== micSessionGenRef.current) return;

    const lateLive = liveTranscriptRef.current.trim();
    const apiTranscript = lateLive ? '' : audioBlob ? await transcribeBlobWithApi(audioBlob, sessionGen) : '';
    if (sessionGen !== micSessionGenRef.current) return;

    setIsTranscribing(false);
    const spokenResult = (lateLive || apiTranscript).trim();
    const finalText = [base, spokenResult].filter(Boolean).join(' ').trim();

    if (finalText) {
      handleSend(finalText);
    } else {
      setInputValue(micBaseInputRef.current);
      showMicToast('Could not recognize speech — please speak clearly');
    }
  };

  const toggleRecording = async () => {
    if (isRecording) {
      await handleStopMicKeepText();
      return;
    }

    const sessionGen = ++micSessionGenRef.current;
    suppressSttFallbackRef.current = false;
    isRecordingRef.current = true;
    setIsRecording(true);
    setIsTranscribing(false);
    micBaseInputRef.current = inputValue;
    liveTranscriptRef.current = '';
    audioChunksRef.current = [];
    showMicToast('Listening... Speak now (Live transcription active)');

    const SpeechRec = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
    let startedSpeechRecognition = false;

    if (SpeechRec) {
      try {
        const recognition = new SpeechRec();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;
        recognition.lang = navigator.language || 'en-US';

        recognition.onresult = (event: any) => {
          if (!isRecordingRef.current || sessionGen !== micSessionGenRef.current) return;
          let interim = '';
          let finalChunk = '';
          for (let i = 0; i < event.results.length; ++i) {
            const res = event.results[i];
            if (res.isFinal) {
              finalChunk += (finalChunk ? ' ' : '') + res[0].transcript.trim();
            } else {
              interim += (interim ? ' ' : '') + res[0].transcript.trim();
            }
          }
          const combinedTranscript = [finalChunk, interim].filter(Boolean).join(' ').trim();
          if (combinedTranscript) {
            liveTranscriptRef.current = combinedTranscript;
          }
          const base = micBaseInputRef.current.trim();
          const liveCombined = [base, combinedTranscript].filter(Boolean).join(' ');
          setInputValue(liveCombined);
        };

        recognition.onerror = (e: any) => {
          console.warn('SpeechRecognition error:', e?.error);
          if (e?.error === 'not-allowed') {
            isRecordingRef.current = false;
            setIsRecording(false);
            showMicToast('Microphone access denied');
          }
        };

        recognition.onend = () => {
          if (isRecordingRef.current && sessionGen === micSessionGenRef.current) {
            try {
              recognition.start();
            } catch {}
          }
        };

        recognition.start();
        speechRecognitionRef.current = recognition;
        startedSpeechRecognition = true;
      } catch (recErr) {
        console.warn('SpeechRecognition failed, falling back to MediaRecorder:', recErr);
      }
    }

    try {
      if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (!isRecordingRef.current || sessionGen !== micSessionGenRef.current) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        const preferredMime =
          typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.('audio/webm;codecs=opus')
            ? 'audio/webm;codecs=opus'
            : typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported?.('audio/webm')
              ? 'audio/webm'
              : '';
        const mediaRecorder = preferredMime ? new MediaRecorder(stream, { mimeType: preferredMime }) : new MediaRecorder(stream);
        micMimeTypeRef.current = mediaRecorder.mimeType || preferredMime || 'audio/webm';
        audioChunksRef.current = [];

        mediaRecorder.ondataavailable = (event) => {
          if (event.data && event.data.size > 0 && sessionGen === micSessionGenRef.current) {
            audioChunksRef.current.push(event.data);
          }
        };

        mediaRecorder.onstop = () => {
          stream.getTracks().forEach((track) => track.stop());
          mediaRecorderRef.current = null;
          const resolver = recorderStopResolverRef.current;
          recorderStopResolverRef.current = null;

          if (suppressSttFallbackRef.current || sessionGen !== micSessionGenRef.current) {
            audioChunksRef.current = [];
            if (resolver) resolver(null);
            return;
          }

          const blob =
            audioChunksRef.current.length > 0
              ? new Blob(audioChunksRef.current, { type: micMimeTypeRef.current || 'audio/webm' })
              : null;
          if (resolver) {
            resolver(blob);
          }
        };

        mediaRecorder.start(250);
        mediaRecorderRef.current = mediaRecorder;
      }
    } catch (err: any) {
      if (!startedSpeechRecognition) {
        console.warn('Microphone permission error:', err);
        isRecordingRef.current = false;
        setIsRecording(false);
        showMicToast('Microphone permission denied or unavailable');
      }
    }
  };

  const handleNewChat = () => {
    setInputValue('');
    setShowResponsePopup(false);
    setIsDrawerOpen(false);
    setCurrentFullScreenPrompt('');
    setCurrentFullScreenAttachments([]);
    const newTopic = `Chat ${Object.keys(userChatThreads).length + 1}`;
    setActiveRecentItem(newTopic);
    setIsFullScreenChatOpen(true);
  };

  const handleSelectRecent = (title: string) => {
    setActiveRecentItem(title);
    setCurrentFullScreenPrompt('');
    setIsDrawerOpen(false);
    setIsFullScreenChatOpen(true);
  };

  if (!isOpen) return null;

  return (
      <div
        className={`reveal-welcome fixed inset-0 z-[9999] bg-background overflow-hidden ${
          isFullScreenChatOpen ? '' : 'select-none touch-none'
        }`}
      >
        {/* Interactive Dual-Layer Reveal Canvas (Active across the whole screen) */}
        <div
          ref={containerRef}
          onMouseMove={handleMouseMove}
          onMouseEnter={handleMouseEnter}
          onMouseLeave={handleMouseLeave}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
          onTouchCancel={handleTouchCancel}
          className="absolute inset-0 w-full h-full cursor-crosshair overflow-hidden bg-background z-0"
        >
          {/* Base Layer: Front Visible Image */}
          <div className="absolute inset-0 w-full h-full pointer-events-none">
            <img
              src={defaultVisibleImg}
              alt="Base layer"
              className="w-full h-full object-cover object-center"
              referrerPolicy="no-referrer"
            />
          </div>

          {/* Underneath Revealed Image (revealed through spotlight mask via direct DOM updates) */}
          <div
            ref={revealedLayerRef}
            className="absolute inset-0 w-full h-full pointer-events-none"
            style={{ opacity: 0 }}
          >
            <img
              src={revealedUnderneathImg}
              alt="Revealed underneath layer"
              className="w-full h-full object-cover object-center"
              referrerPolicy="no-referrer"
            />
          </div>

          {/* Vignette Gradients for optical balance and text contrast */}
          <div className="absolute top-0 left-0 right-0 h-44 bg-gradient-to-b from-black/80 via-black/35 to-transparent pointer-events-none" />
          <div className="absolute bottom-0 left-0 right-0 h-36 bg-gradient-to-t from-black/75 to-transparent pointer-events-none" />
        </div>

        {/* TOP CORNER: Three Lines Menu Button (No top-right X or API Keys buttons) */}
        <div className="absolute top-5 sm:top-6 left-5 sm:left-6 z-40 pointer-events-auto">
          <button
            id="reveal-three-lines-menu-btn"
            type="button"
            onClick={() => setIsDrawerOpen(true)}
            aria-label="Open Menu"
            title="Open Menu"
            className="w-11 h-11 rounded-2xl bg-black/65 hover:bg-black/85 text-white flex flex-col items-center justify-center gap-1.5 transition-all cursor-pointer border border-white/20 shadow-[0_4px_18px_rgba(0,0,0,0.45)] active:scale-95 group"
          >
            <span className="w-5 h-[2px] bg-white rounded-full transition-all group-hover:w-6" />
            <span className="w-5 h-[2px] bg-white rounded-full transition-all group-hover:w-4" />
            <span className="w-5 h-[2px] bg-white rounded-full transition-all group-hover:w-6" />
          </button>
        </div>

        {/* UPPER/MIDDLE SECTION: THINK CREATIVE directly above the Prompt Box */}
        <div className="absolute top-[23vh] xs:top-[25vh] sm:top-[11vh] md:top-[13vh] left-0 right-0 z-30 px-3 sm:px-4 flex flex-col items-center pointer-events-none transition-all duration-300">
          {/* Typography & Overlapping 3D Avatar: Directly above the prompt box */}
          <div className="relative flex flex-col items-center justify-center select-none text-center mb-2 sm:mb-3 pointer-events-auto">
            {/* First word: THINK (White uppercase) */}
            <motion.h1
              initial={{ opacity: 0, y: 15 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
              className="text-3xl xs:text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-black tracking-tight leading-[0.88] text-white uppercase drop-shadow-[0_10px_30px_rgba(0,0,0,0.9)]"
              style={{ fontFamily: "'Syne', sans-serif" }}
            >
              THINK
            </motion.h1>

            {/* Second row: CREATIVE with overlapping 3D Character Avatar */}
            <div className="relative w-full flex items-center justify-center -mt-1 xs:-mt-2 sm:-mt-3 md:-mt-4">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6, delay: 0.08, ease: [0.16, 1, 0.3, 1] }}
                className="text-3xl xs:text-4xl sm:text-6xl md:text-7xl lg:text-8xl font-black tracking-tight leading-[0.88] text-[#00a6ff] uppercase flex items-center justify-center w-full drop-shadow-[0_15px_35px_rgba(0, 166, 255,0.4)]"
                style={{ fontFamily: "'Syne', sans-serif" }}
              >
                CREATIVE
              </motion.div>

              {/* 3D Cutout Avatar - Floating right over the center of typography exactly like HeroSection */}
              <motion.div
                initial={{ opacity: 0, scale: 0.85, y: 10 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.15, ease: [0.16, 1, 0.3, 1] }}
                className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-[48%] z-20 pointer-events-auto"
              >
                <motion.div
                  animate={{ y: [0, -4, 0] }}
                  transition={{ repeat: Infinity, duration: 4.5, ease: "easeInOut" }}
                  className="relative group cursor-pointer select-none"
                >
                  <img
                    src={HERO_AVATAR}
                    alt="Irtza 3D Cutout Character Avatar"
                    className="w-14 xs:w-18 sm:w-32 md:w-40 lg:w-48 max-w-none h-auto object-contain drop-shadow-[0_20px_40px_rgba(0,0,0,0.95)] drop-shadow-[0_0_30px_rgba(0, 166, 255,0.4)] transform group-hover:scale-105 transition-transform duration-500 pointer-events-none"
                    referrerPolicy="no-referrer"
                  />
                </motion.div>
              </motion.div>
            </div>
          </div>

          {/* THE PROMPT BOX (Matches User's Provided Image Exactly, Placed directly under THINK CREATIVE) */}
          <div className="w-full max-w-[94vw] sm:max-w-[560px] pointer-events-auto">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSend();
              }}
              className="relative"
            >
              {/* Hidden File Input (Max 10 files) */}
              <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="*/*"
                onChange={(e) => {
                  if (e.target.files && e.target.files.length > 0) {
                    processFiles(e.target.files);
                    e.target.value = '';
                  }
                }}
                className="hidden"
              />

              {/* Dynamic Sound Bar Waveform, Upward-Expanding Buildy Card, or Prompt Box */}
              <AnimatePresence mode="wait">
                {buildyRedirectRequest !== null ? (
                  <BuildyExpandableCard
                    key="welcome-buildy-expand-card"
                    variant="welcome"
                    requestText={buildyRedirectRequest}
                    onClose={() => setBuildyRedirectRequest(null)}
                    onOpenBuildy={(reqText) => {
                      setBuildyRedirectRequest(null);
                      setBuildyInitialPrompt(reqText);
                      setIsBuildyOpen(true);
                    }}
                    onDraftPrompt={(reqText) => {
                      setBuildyRedirectRequest(null);
                      handleSend(
                        `Write a detailed Buildy UI & architecture prompt (sections, color palette, typography, and interactive controls) for: ${reqText}`,
                        true
                      );
                    }}
                  />
                ) : isRecording || isTranscribing ? (
                  <SttSoundBar
                    key="stt-sound-bar-modal"
                    isTranscribing={isTranscribing}
                    liveText={inputValue}
                    statusNotification={micStatusMsg || fileLimitError}
                    onCancel={handleCancelMic}
                    onStopKeepText={handleStopMicKeepText}
                    onConfirm={handleConfirmMic}
                    onAttach={() => fileInputRef.current?.click()}
                  />
                ) : (
                  <div
                    key="regular-prompt-box-modal"
                    onDragOver={(e) => {
                      e.preventDefault();
                      setIsDraggingOver(true);
                    }}
                    onDragLeave={() => setIsDraggingOver(false)}
                    onDrop={(e) => {
                      e.preventDefault();
                      setIsDraggingOver(false);
                      if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
                        processFiles(e.dataTransfer.files);
                      }
                    }}
                    className={`fixed-prompt-box relative rounded-[28px] sm:rounded-[32px] bg-white text-zinc-900 px-5 pt-4 pb-3 border transition-all ${
                      isDraggingOver
                        ? 'border-[var(--primary)] ring-2 ring-[var(--primary)]/30'
                        : activeSkill
                        ? 'border-[var(--primary)]/80 ring-2 ring-[var(--primary)]/25'
                        : 'border-zinc-200/90'
                    }`}
                  >
                    {/* Active Creative Skill Highlight Chip */}
                    {activeSkill && (
                      <div className="mb-2 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-[var(--primary)]/12 border border-[var(--primary)]/35 text-zinc-900 text-xs font-bold shadow-xs">
                        <Wand2 size={12} className="text-[var(--primary)]" />
                        <span>Skill Active: {activeSkill.name}</span>
                        <button
                          type="button"
                          onClick={() => setActiveSkill(null)}
                          className="ml-0.5 text-zinc-500 hover:text-zinc-900 cursor-pointer"
                          title="Clear skill"
                          aria-label="Clear skill"
                        >
                          <X size={12} />
                        </button>
                      </div>
                    )}

                    {/* Input Text Area */}
                    <input
                      type="text"
                      placeholder={isRecording ? "Bolna shuru kijiye..." : "Ask anything, generate images, write prompts, or code..."}
                      value={inputValue}
                      onChange={(e) => {
                        const val = e.target.value;
                        const { hasCode, cleanedText, codeFiles } = detectAndExtractCode(val);
                        if (hasCode && codeFiles.length > 0) {
                          setAttachments((prev) => {
                            const updated = [...prev];
                            for (const cf of codeFiles) {
                              if (updated.length < 10) updated.push(cf);
                            }
                            return updated;
                          });
                          setInputValue(cleanedText);
                        } else {
                          setInputValue(val);
                        }
                      }}
                      onPaste={handlePaste}
                      className="w-full bg-transparent text-zinc-900 text-sm sm:text-base font-normal placeholder:text-zinc-500 focus:outline-none pb-2.5 tracking-wide"
                    />

                    {/* Attached Files Strip (Matches User Requirement: only image shown for images, no name pill) */}
                    {attachments.length > 0 && (
                      <AttachmentGrid files={attachments} onRemove={removeAttachment} />
                    )}

                    {/* Error Banner when Max 10 Files Exceeded */}
                    <AnimatePresence>
                      {fileLimitError && (
                        <motion.div
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          className="text-xs text-[#00a6ff] font-medium px-1 py-1"
                        >
                          {fileLimitError}
                        </motion.div>
                      )}
                      {micStatusMsg && (
                        <motion.div
                          initial={{ opacity: 0, y: -4 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -4 }}
                          className="text-xs text-zinc-600 font-medium px-1 py-0.5 flex items-center gap-1.5"
                        >
                          <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
                          {micStatusMsg}
                        </motion.div>
                      )}
                    </AnimatePresence>

                    {/* Bottom Row: Attach on Left, Mode ˅ + Mic + Forward Arrow Inside Prompt Box */}
                    <div className="flex items-center justify-between pt-1">
                      {/* Left: Plus Icon (+) */}
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => fileInputRef.current?.click()}
                          className="w-8 h-8 rounded-full hover:bg-zinc-100 text-zinc-800 flex items-center justify-center transition-all cursor-pointer active:scale-95"
                          title="Attach files (Max 10)"
                          aria-label="Attach files (Max 10)"
                        >
                          <Plus size={22} strokeWidth={2} />
                        </button>
                      </div>

                      {/* Right side: Plan / Chat / Max selector AND Single Unified Arrow/Mic button */}
                      <div className="flex items-center gap-3 sm:gap-4">
                        {/* Mode Selector (Opens at Bottom of Prompt Box) */}
                        <div className="relative">
                          <button
                            type="button"
                            onClick={() => setIsModeMenuOpen(!isModeMenuOpen)}
                            className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-100 hover:bg-zinc-200/80 text-zinc-900 text-xs sm:text-sm font-semibold transition-all cursor-pointer active:scale-95"
                          >
                            <span>{selectedMode}</span>
                            <ChevronDown size={15} strokeWidth={2.2} className={`text-zinc-600 transition-transform ${isModeMenuOpen ? 'rotate-180' : ''}`} />
                          </button>

                          {/* Mode Popup (Opens Downward at Bottom of Prompt Box) */}
                          <AnimatePresence>
                            {isModeMenuOpen && (
                              <motion.div
                                initial={{ opacity: 0, y: -8, scale: 0.96 }}
                                animate={{ opacity: 1, y: 0, scale: 1 }}
                                exit={{ opacity: 0, y: -8, scale: 0.96 }}
                                className="absolute top-full mt-2 right-0 w-44 bg-white text-zinc-900 rounded-2xl shadow-2xl border border-zinc-200 p-1.5 z-50 space-y-1"
                              >
                                {(
                                  [
                                    { id: 'Plan', hint: 'Clarify & blueprint' },
                                    { id: 'Chat', hint: 'Fast conversation' },
                                    { id: 'Max', hint: 'Full deep effort' },
                                  ] as const
                                ).map((m) => (
                                  <button
                                    key={m.id}
                                    type="button"
                                    onClick={() => {
                                      setSelectedMode(m.id);
                                      setIsModeMenuOpen(false);
                                    }}
                                    className={`w-full text-left px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between transition-all cursor-pointer ${
                                      selectedMode === m.id
                                        ? 'bg-zinc-900 text-white'
                                        : 'text-zinc-800 hover:bg-zinc-100'
                                    }`}
                                  >
                                    <span>{m.id}</span>
                                    <span className={`text-[10px] font-normal ${selectedMode === m.id ? 'text-zinc-300' : 'text-zinc-500'}`}>
                                      {m.hint}
                                    </span>
                                  </button>
                                ))}
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>

                        {/* Mic Button + Single Forward Arrow Button inside Prompt Box */}
                        <div className="flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={toggleRecording}
                            aria-label={isRecording ? 'Listening...' : 'Voice Input'}
                            title={isRecording ? 'Listening...' : 'Voice Input'}
                            className={`w-8 h-8 rounded-full flex items-center justify-center transition-all cursor-pointer active:scale-90 ${
                              isRecording
                                ? 'bg-red-500 text-white animate-pulse'
                                : 'text-zinc-800 hover:bg-zinc-100'
                            }`}
                          >
                            {isRecording ? (
                              <MicOff size={19} strokeWidth={2.2} />
                            ) : (
                              <Mic size={20} strokeWidth={2.2} />
                            )}
                          </button>

                          {inputValue.trim().length > 0 || attachments.length > 0 ? (
                            <button
                              type="button"
                              onClick={() => handleSend()}
                              aria-label="Send Prompt"
                              title="Send Prompt"
                              className="w-9 h-9 rounded-full theme-button-primary flex items-center justify-center active:scale-90 transition-all cursor-pointer"
                            >
                              <ArrowUp size={18} strokeWidth={2.6} />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setIsVoiceCallOpen(true)}
                              aria-label={`Open ${activePersona} Voice Assistant`}
                              title={`Open ${activePersona} Voice & Camera Assistant`}
                              className="w-9 h-9 rounded-full bg-black hover:bg-zinc-900 text-white shadow-md flex items-center justify-center active:scale-90 transition-all cursor-pointer"
                            >
                              <AudioLines size={18} strokeWidth={2.4} />
                            </button>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </AnimatePresence>
            </form>
          </div>

          {/* Quick Floating Chat Response Bubble (If prompt was submitted) */}
          <AnimatePresence>
            {showResponsePopup && messages.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: 12, scale: 0.95 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: 12, scale: 0.95 }}
                className="w-full max-w-[560px] mt-3 pointer-events-auto"
              >
                <div className="rounded-2xl bg-[#0e1017] border border-red-500/30 p-4 shadow-[0_15px_40px_rgba(0,0,0,0.85)] text-white text-xs sm:text-sm space-y-2">
                  <div className="flex items-center justify-between text-[11px] text-zinc-400 font-mono pb-1 border-b border-white/10">
                    <span className="text-[#00a6ff] font-semibold">AI Intelligence Blueprint</span>
                    <button
                      onClick={() => setShowResponsePopup(false)}
                      className="hover:text-white p-0.5 rounded cursor-pointer"
                    >
                      <X size={14} />
                    </button>
                  </div>
                  {messages.slice(-2).map((m) => (
                    <div
                      key={m.id}
                      className={`p-2.5 rounded-xl ${
                        m.sender === 'user'
                          ? 'bg-[#00a6ff]/20 border border-[#00a6ff]/40 text-right text-white'
                          : 'bg-white/10 text-zinc-200'
                      }`}
                    >
                      {m.text}
                    </div>
                  ))}
                  {isTyping && (
                    <div className="flex items-center gap-1.5 py-1 text-xs text-zinc-400">
                      <span className="w-1.5 h-1.5 rounded-full bg-[#00a6ff] animate-ping" />
                      <span>Synthesizing specs...</span>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* SIDEBAR MENU BAR (Matches Image 2 Exactly: Authentic BMW ///M Red Glowing Neon Cockpit) */}
        <AnimatePresence>
          {isDrawerOpen && (
            <>
              {/* Dim backdrop to close on outside click */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsDrawerOpen(false)}
                className="absolute inset-0 bg-black/65 z-50 pointer-events-auto flex items-center justify-start p-2 sm:p-6"
              >
                {/* Obsidian Black Curved Menu Card */}
                <motion.div
                  initial={{ opacity: 0, scale: 0.95, x: -40 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.95, x: -40 }}
                  transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                  onClick={(e) => e.stopPropagation()}
                  className="relative w-full max-w-[345px] sm:max-w-[365px] h-[92vh] max-h-[820px] rounded-[34px] bg-[#0b0b10] border border-white/15 p-6 flex flex-col justify-between overflow-hidden select-none text-white"
                  style={{
                    boxShadow: '0 22px 52px rgba(0,0,0,0.48)',
                  }}
                >
                  {/* TOP FIXED SECTION: BMW ///M Logo + Styled Close Button */}
                  <div className="shrink-0 relative z-10">
                    <div className="flex items-center justify-between pt-1 pb-1">
                      <div className="flex items-center gap-2 select-none">
                        <div className="flex items-center gap-1.5 -skew-x-[18deg]">
                          <span className="w-2.5 h-7 sm:w-3 sm:h-8 bg-[#0082CA] rounded-[1px]" />
                          <span className="w-2.5 h-7 sm:w-3 sm:h-8 bg-[#17205a] rounded-[1px]" />
                          <span className="w-2.5 h-7 sm:w-3 sm:h-8 bg-[#E21B23] rounded-[1px]" />
                        </div>
                        <span className="text-3xl sm:text-4xl font-black italic tracking-tighter ml-1 text-white">
                          M
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => setIsDrawerOpen(false)}
                        className="w-9 h-9 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 text-white flex items-center justify-center transition-all cursor-pointer active:scale-95"
                        aria-label="Close menu"
                        title="Close menu"
                      >
                        <X size={16} />
                      </button>
                    </div>
                  </div>

                  {/* Navigation + Saved Chats (Browser Storage + Firestore) */}
                  <>
                    <div className="shrink-0 space-y-4 pt-3 relative z-10">
                      {/* + New Chat Pill Button */}
                      <button
                        type="button"
                        onClick={handleNewChat}
                        className="w-full py-3 px-4 rounded-[20px] bg-[#11131b] border-[1.5px] border-[#00a6ff] text-white font-medium text-[15px] flex items-center justify-between hover:bg-[#161a25] transition-all cursor-pointer active:scale-98 group"
                      >
                        <div className="flex items-center gap-3">
                          <Plus size={19} className="text-white group-hover:rotate-90 transition-transform" />
                          <span className="text-white tracking-wide">New Chat</span>
                        </div>
                        <ChevronRight size={18} className="text-[#00a6ff] font-bold group-hover:translate-x-0.5 transition-transform" />
                      </button>

                      {/* Navigation List Items: Daro & Zara, Explore Creative Skills, Buildy */}
                      <div className="space-y-1.5 pt-0.5 text-[15px] font-medium text-zinc-200">
                        <button
                          type="button"
                          onClick={() => {
                            setIsDrawerOpen(false);
                            setIsVoiceCallOpen(true);
                          }}
                          className="w-full px-3 py-2 rounded-xl hover:bg-white/10 text-left flex items-center justify-between text-white transition-all cursor-pointer group"
                        >
                          <div className="flex items-center gap-3.5">
                            <PhoneCall size={19} strokeWidth={1.8} className="text-[#38bdf8]" />
                            <span className="tracking-wide font-semibold">Daro &amp; Zara</span>
                          </div>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#0a7cf0]/20 text-[#38bdf8] font-bold uppercase tracking-wider">
                            {activePersona}
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsDrawerOpen(false);
                            setIsExploreGptsOpen(true);
                          }}
                          className={`w-full px-3 py-2 rounded-xl text-left flex items-center justify-between transition-all cursor-pointer ${
                            activeSkill
                              ? 'bg-[#0a7cf0]/20 text-white font-semibold'
                              : 'hover:bg-white/10 text-zinc-200'
                          }`}
                        >
                          <div className="flex items-center gap-3.5">
                            <LayoutGrid size={19} strokeWidth={1.8} className={activeSkill ? 'text-[#38bdf8]' : 'text-zinc-400'} />
                            <span className="tracking-wide">Explore Creative Skills</span>
                          </div>
                          {activeSkill && (
                            <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#0a7cf0] text-white font-bold">
                              Active
                            </span>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsDrawerOpen(false);
                            setBuildyInitialPrompt(undefined);
                            setIsBuildyOpen(true);
                          }}
                          className="w-full px-3 py-2 rounded-xl hover:bg-white/10 text-left flex items-center justify-between text-white transition-all cursor-pointer"
                        >
                          <div className="flex items-center gap-3.5">
                            <Hammer size={19} strokeWidth={1.8} className="text-[#38bdf8]" />
                            <span className="tracking-wide font-semibold">Buildy</span>
                          </div>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-[#0a7cf0]/20 text-[#38bdf8] font-bold">
                            UI Studio
                          </span>
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setIsDrawerOpen(false);
                            window.dispatchEvent(new CustomEvent('open-gmail-routine-modal', { detail: { tab: 'routine' } }));
                          }}
                          className="w-full px-3 py-2 rounded-xl hover:bg-white/10 text-left flex items-center justify-between text-white transition-all cursor-pointer"
                        >
                          <div className="flex items-center gap-3.5">
                            <CalendarClock size={19} strokeWidth={1.8} className="text-[#38bdf8]" />
                            <span className="tracking-wide font-semibold">Daily Routine Gmail</span>
                          </div>
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 font-bold">
                            Gmail
                          </span>
                        </button>
                      </div>
                    </div>

                    {/* ONLY RECENT SECTION SCROLLABLE */}
                    <div className="flex-1 min-h-0 flex flex-col pt-3 relative z-10">
                      <span className="text-[13px] font-semibold text-zinc-400 px-3 tracking-wide mb-2 shrink-0">
                        Recent
                      </span>

                      <div className="flex-1 overflow-y-auto pr-1 space-y-1.5 no-scrollbar">
                        {Object.keys(userChatThreads).length === 0 ? (
                          <div className="px-3 py-6 text-center text-xs text-zinc-500">
                            No saved chats yet. Start a new conversation!
                          </div>
                        ) : (
                          Object.values(userChatThreads).map((thread: any) => {
                            const topic = thread.title || thread.id;
                            return (
                              <div
                                key={thread.id || topic}
                                className={`w-full px-3 py-2.5 rounded-xl flex items-center justify-between transition-all cursor-pointer border group ${
                                  topic === activeRecentItem
                                    ? 'bg-[#0a7cf0]/20 text-white border-[#0a7cf0]/50 font-semibold'
                                    : 'hover:bg-white/10 text-zinc-300 border-transparent'
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() => handleSelectRecent(topic)}
                                  className="flex items-center gap-3 truncate text-left flex-1 min-w-0 cursor-pointer"
                                >
                                  <MessageSquare
                                    size={17}
                                    strokeWidth={1.8}
                                    className={topic === activeRecentItem ? 'text-[#38bdf8] shrink-0' : 'text-zinc-500 shrink-0'}
                                  />
                                  <span className="truncate text-[14px]">{topic}</span>
                                </button>
                                <button
                                  type="button"
                                  onClick={async (e) => {
                                    e.stopPropagation();
                                    if (currentUser?.uid && !currentUser.isAnonymous && thread.id) {
                                      await deleteChatThreadFromFirestore(thread.id, currentUser.uid).catch(() => {});
                                    }
                                    const scope = getUserStorageScope(currentUser);
                                    const nextThreads = { ...userChatThreads };
                                    delete nextThreads[topic];
                                    setUserChatThreads(nextThreads);
                                    saveChatThreadsToStorage(scope, nextThreads);
                                  }}
                                  className="opacity-0 group-hover:opacity-100 p-1 rounded-md text-zinc-400 hover:text-red-400 transition-opacity ml-1 shrink-0 cursor-pointer"
                                  title="Delete chat"
                                >
                                  <Trash2 size={13} />
                                </button>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  </>

                  {/* BOTTOM ACTIONS: Full-Width Blue Settings Button + Compact Account Row */}
                  <div className="shrink-0 space-y-3 pt-4 pb-1 relative z-10 border-t border-white/10">
                    <button
                      type="button"
                      onClick={() => {
                        setIsDrawerOpen(false);
                        setIsVoiceSettingsOpen(true);
                      }}
                      className="w-full py-2.5 px-4 rounded-[18px] text-white font-semibold text-[14px] flex items-center justify-center gap-2.5 transition-all cursor-pointer active:scale-98 bg-[#0a7cf0] hover:bg-[#096dd4]"
                    >
                      <Settings size={17} className="text-white" />
                      <span>Settings</span>
                    </button>

                    {currentUser && !currentUser.isAnonymous ? (
                      <div className="flex items-center justify-between gap-2.5 px-3 py-3 select-none rounded-2xl bg-[#14141d] border border-white/10">
                        <div className="flex items-center gap-2.5 min-w-0 flex-1 truncate">
                          <div className="w-9 h-9 rounded-full bg-[#1c1c28] border-[1.5px] border-[#0a7cf0] flex items-center justify-center text-[#38bdf8] shrink-0 overflow-hidden">
                            {currentUser?.photoURL ? (
                              <img src={currentUser.photoURL} alt="Profile" className="w-full h-full object-cover" />
                            ) : (
                              <UserIcon size={17} className="fill-[#0a7cf0] text-[#0a7cf0]" />
                            )}
                          </div>
                          <div className="flex flex-col min-w-0 truncate">
                            <span className="text-[13px] font-bold text-white leading-tight truncate">
                              {currentUser.displayName || currentUser.email?.split('@')[0]}
                            </span>
                            <span className="text-[11px] text-zinc-400 truncate">
                              {currentUser.email || 'Cloud Account'}
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={async (e) => {
                            e.stopPropagation();
                            await logOut();
                          }}
                          className="px-2.5 py-1.5 rounded-lg bg-red-500/15 hover:bg-red-500/25 text-red-400 border border-red-500/25 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer shrink-0"
                          title="Sign Out"
                        >
                          <LogOut size={13} />
                          <span>Sign Out</span>
                        </button>
                      </div>
                    ) : (
                      <div
                        onClick={onOpenLogin}
                        className="flex items-center justify-between gap-2.5 px-3 py-3 select-none cursor-pointer bg-[#14141d] border border-white/10 hover:border-white/20 rounded-2xl transition-colors"
                        title="Click to sign in"
                      >
                        <div className="flex items-center gap-2.5 min-w-0 flex-1 truncate">
                          <div className="w-9 h-9 rounded-full bg-[#1c1c28] border-[1.5px] border-white/20 flex items-center justify-center text-zinc-300 shrink-0">
                            <UserIcon size={16} />
                          </div>
                          <div className="flex flex-col min-w-0 truncate">
                            <span className="text-[13px] font-bold text-white leading-tight truncate">
                              Guest User
                            </span>
                            <span className="text-[11px] text-zinc-400 truncate">
                              Saved in Browser
                            </span>
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenLogin?.();
                          }}
                          className="px-3 py-1.5 rounded-lg bg-[#0a7cf0] hover:bg-[#096dd4] text-white text-xs font-bold transition-all cursor-pointer shrink-0"
                        >
                          Sign In
                        </button>
                      </div>
                    )}
                  </div>
                </motion.div>
              </motion.div>
            </>
          )}
        </AnimatePresence>

        {/* FULL SCREEN CHAT VIEW */}
        <FullScreenChatView
          isOpen={isFullScreenChatOpen}
          onClose={() => {
            setIsFullScreenChatOpen(false);
            setCurrentFullScreenPrompt('');
          }}
          initialPrompt={currentFullScreenPrompt}
          onClearInitialPrompt={() => { setCurrentFullScreenPrompt(''); setCurrentFullScreenAttachments([]); }}
          initialAttachments={currentFullScreenAttachments}
          selectedRecentTopic={activeRecentItem}
          onSelectRecentTopic={setActiveRecentItem}
          onOpenLogin={onOpenLogin}
          externalActiveSkill={activeSkill}
          onExternalActiveSkillChange={setActiveSkill}
          initialMode={selectedMode}
        />

        {/* Daro & Zara Live Voice & Camera Vision Modal */}
        <LiveVoiceCallModal
          isOpen={isVoiceCallOpen}
          onClose={() => setIsVoiceCallOpen(false)}
          activeModelName="Gemini 3.8 Flash"
          onVoiceChanged={() => setActivePersona(getActiveAssistantPersona())}
          onGoToChat={(topicPrompt) => {
            setIsVoiceCallOpen(false);
            setCurrentFullScreenAttachments([]);
            setCurrentFullScreenPrompt(topicPrompt);
            setIsFullScreenChatOpen(true);
          }}
        />

        {/* Buildy Embedded HTML Workspace Modal */}
        <BuildyWorkspaceModal
          isOpen={isBuildyOpen}
          onClose={() => {
            setIsBuildyOpen(false);
            setBuildyInitialPrompt(undefined);
          }}
          initialPrompt={buildyInitialPrompt}
          onOpenSettings={() => {
            setIsBuildyOpen(false);
            setIsVoiceSettingsOpen(true);
          }}
        />

        {/* Explore Creative Skills Modal */}
        <ExploreGptsModal
          isOpen={isExploreGptsOpen}
          onClose={() => setIsExploreGptsOpen(false)}
          activeSkillId={activeSkill?.id}
          onSelectSkill={(skill) => setActiveSkill(skill)}
        />

        {/* AI API Settings & Voices Modal */}
        <AiApiSettingsModal
          isOpen={isVoiceSettingsOpen}
          onClose={() => setIsVoiceSettingsOpen(false)}
          initialTab="api-keys"
          onVoiceChanged={() => setActivePersona(getActiveAssistantPersona())}
          onOpenLogin={onOpenLogin}
        />
      </div>
  );
};
