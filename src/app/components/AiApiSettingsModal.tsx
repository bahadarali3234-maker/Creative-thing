import React, { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Play,
  Square,
  Loader2,
  Sliders,
  ShieldCheck,
  Info,
  Menu,
  Moon,
  Volume2,
  Smartphone,
  Bell,
  Clock,
  Shield,
  Share2,
  LogOut,
  ChevronDown,
  Cpu,
  Mic,
  Camera,
  ClipboardCheck,
  Copy,
  Check,
  Type,
  Mail,
} from 'lucide-react';
import {
  GEMINI_TTS_VOICES,
  GeminiVoiceInfo,
  getStoredVoice,
  setStoredVoice,
  getAutoReadAloud,
  setAutoReadAloud,
  playVoicePreviewSample,
  stopGeminiTts,
} from '../utils/geminiTts';
import { getCurrentUser, logOut } from '../firebase';
import { useTheme, ThemeMode, FontStyle } from '../context/ThemeContext';
import {
  DEFAULT_IMAGE_OPTIONS,
  IMAGE_STYLE_OPTIONS,
  ImageGenerationOptions,
  ImageStyleOption,
} from './CompactMediaLightbox';

export interface AiApiSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'api-keys' | 'voices';
  onVoiceChanged?: (newVoice: string) => void;
  onOpenLogin?: () => void;
  imageOptions?: ImageGenerationOptions;
  onImageOptionsChange?: (next: ImageGenerationOptions) => void;
}

export const AiApiSettingsModal: React.FC<AiApiSettingsModalProps> = ({
  isOpen,
  onClose,
  initialTab = 'api-keys',
  onVoiceChanged,
  onOpenLogin,
  imageOptions = DEFAULT_IMAGE_OPTIONS,
  onImageOptionsChange,
}) => {
  const {
    theme,
    themeMode,
    setThemeMode,
    fontStyle,
    setFontStyle,
    hapticEnabled,
    setHapticEnabled,
    triggerHaptic,
  } = useTheme();
  const isDark = theme === 'dark';

  const [signedInUser, setSignedInUser] = useState<any>(() => getCurrentUser());
  const [expandedSection, setExpandedSection] = useState<string | null>(
    initialTab === 'voices' ? 'voice' : null
  );
  const [showInfoCard, setShowInfoCard] = useState(false);

  // Notifications & Time/Focus local preferences
  const [notificationsEnabled, setNotificationsEnabled] = useState<boolean>(() => {
    if (typeof window === 'undefined') return true;
    return localStorage.getItem('app_notifications_v1') !== 'false';
  });
  const [focusTimerMinutes, setFocusTimerMinutes] = useState<number>(() => {
    if (typeof window === 'undefined') return 2;
    const v = Number(localStorage.getItem('app_focus_minutes_v1'));
    return Number.isFinite(v) && v >= 1 ? v : 2;
  });
  const [shareCopied, setShareCopied] = useState(false);

  // Permissions check state
  const [micPermission, setMicPermission] = useState<string>('prompt');
  const [camPermission, setCamPermission] = useState<string>('prompt');
  const [clipPermission, setClipPermission] = useState<string>('ready');

  // Voices State
  const [selectedVoice, setSelectedVoice] = useState<string>('zara-classic');
  const [autoRead, setAutoRead] = useState<boolean>(false);
  const [loadingVoiceId, setLoadingVoiceId] = useState<string | null>(null);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [ttsError, setTtsError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setExpandedSection(initialTab === 'voices' ? 'voice' : null);
      setSignedInUser(getCurrentUser());
      setSelectedVoice(getStoredVoice());
      setAutoRead(getAutoReadAloud());
      setTtsError(null);
      refreshPermissionStates();
    } else {
      stopGeminiTts();
      setLoadingVoiceId(null);
      setPlayingVoiceId(null);
    }
  }, [isOpen, initialTab]);

  const refreshPermissionStates = async () => {
    try {
      if (navigator.permissions?.query) {
        const mic = await navigator.permissions.query({ name: 'microphone' as PermissionName }).catch(() => null);
        if (mic) setMicPermission(mic.state);
        const cam = await navigator.permissions.query({ name: 'camera' as PermissionName }).catch(() => null);
        if (cam) setCamPermission(cam.state);
      }
    } catch {}
  };

  const requestDevicePermission = async (kind: 'mic' | 'cam' | 'clip') => {
    triggerHaptic(12);
    try {
      if (kind === 'mic' && navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        stream.getTracks().forEach((t) => t.stop());
        setMicPermission('granted');
      } else if (kind === 'cam' && navigator.mediaDevices?.getUserMedia) {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        stream.getTracks().forEach((t) => t.stop());
        setCamPermission('granted');
      } else if (kind === 'clip' && navigator.clipboard) {
        await navigator.clipboard.writeText(window.location.href).catch(() => {});
        setClipPermission('granted');
      }
    } catch {
      if (kind === 'mic') setMicPermission('denied');
      if (kind === 'cam') setCamPermission('denied');
    }
  };

  const handleSelectVoice = (voiceId: string) => {
    triggerHaptic(10);
    setSelectedVoice(voiceId);
    setStoredVoice(voiceId);
    setTtsError(null);
    onVoiceChanged?.(voiceId);
  };

  const handlePlaySample = (voice: GeminiVoiceInfo) => {
    setTtsError(null);
    triggerHaptic(10);
    if (playingVoiceId === voice.id || loadingVoiceId === voice.id) {
      stopGeminiTts();
      setLoadingVoiceId(null);
      setPlayingVoiceId(null);
      return;
    }
    setLoadingVoiceId(voice.id);
    setPlayingVoiceId(null);
    playVoicePreviewSample(voice, {
      onLoadingStart: () => setLoadingVoiceId(voice.id),
      onStart: () => {
        setLoadingVoiceId(null);
        setPlayingVoiceId(voice.id);
      },
      onEnd: () => {
        setLoadingVoiceId(null);
        setPlayingVoiceId(null);
      },
      onError: (err) => {
        setLoadingVoiceId(null);
        setPlayingVoiceId(null);
        setTtsError(typeof err === 'string' ? err : 'Studio voice playback unavailable right now.');
      },
    });
  };

  const toggleSection = (id: string) => {
    triggerHaptic(8);
    setExpandedSection((prev) => (prev === id ? null : id));
  };

  const handleShareWorkspace = async () => {
    triggerHaptic(12);
    const shareUrl = window.location.origin;
    try {
      if (navigator.share) {
        await navigator.share({
          title: 'Think Creative Studio',
          text: 'Create AI designs, Buildy apps, and voice conversations in Think Creative Studio.',
          url: shareUrl,
        });
        return;
      }
    } catch {}
    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2200);
    } catch {}
  };

  if (!isOpen) return null;

  const isSignedIn = Boolean(signedInUser && !signedInUser.isAnonymous);

  const canvasBg = isDark ? 'bg-[#111215] text-[#f3f4f6]' : 'bg-[#f5f5f4] text-[#111827]';
  const cardBg = isDark
    ? 'bg-[#1b1d22] border border-white/10'
    : 'bg-white border border-black/[0.04] shadow-[0_1px_3px_rgba(0,0,0,0.04)]';
  const dividerClass = isDark ? 'border-white/[0.08]' : 'border-[#ececea]';
  const rowHover = isDark ? 'hover:bg-white/[0.04]' : 'hover:bg-[#fafaf9]';
  const mutedText = isDark ? 'text-zinc-400' : 'text-[#6b7280]';
  const inputBg = isDark
    ? 'bg-[#121318] border-white/15 text-white placeholder:text-zinc-500'
    : 'bg-[#f8f8f7] border-[#e2e2df] text-[#111827] placeholder:text-zinc-400';

  const fontLabel =
    fontStyle === 'editorial' ? 'Editorial' : fontStyle === 'mono' ? 'Mono' : 'Default';

  return (
    <AnimatePresence>
      <div
        onClick={() => {
          stopGeminiTts();
          onClose();
        }}
        className="fixed inset-0 z-[80] flex items-center justify-center p-0 sm:p-4 bg-black/60 animate-in fade-in duration-200"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: 12 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          onClick={(e) => e.stopPropagation()}
          className={`relative w-full h-full sm:h-auto sm:max-w-[490px] sm:max-h-[90vh] sm:rounded-[28px] flex flex-col overflow-hidden ${canvasBg} shadow-2xl`}
        >
          {/* Editorial Top Header */}
          <div className="flex items-center justify-between px-4 sm:px-5 pt-4 pb-3 shrink-0">
            <button
              type="button"
              onClick={() => {
                stopGeminiTts();
                onClose();
              }}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors cursor-pointer ${rowHover}`}
              title="Close Settings"
              aria-label="Close Settings"
            >
              <Menu size={21} strokeWidth={1.8} />
            </button>

            <h2
              className="text-[22px] font-bold tracking-tight select-none"
              style={{ fontFamily: "'Playfair Display', 'Georgia', serif" }}
            >
              Settings
            </h2>

            <button
              type="button"
              onClick={() => {
                triggerHaptic(8);
                setShowInfoCard((prev) => !prev);
              }}
              className={`w-11 h-11 rounded-full flex items-center justify-center transition-colors cursor-pointer ${
                showInfoCard ? 'bg-[#0a7cf0]/15 text-[#0a7cf0]' : rowHover
              }`}
              title="Studio & Workspace Info"
              aria-label="Workspace Info"
            >
              <Info size={20} strokeWidth={1.8} />
            </button>
          </div>

          {/* Scrollable Settings Body */}
          <div className="flex-1 overflow-y-auto px-3.5 sm:px-4 pb-6 space-y-3">
            {/* Optional Info Callout */}
            {showInfoCard && (
              <div className={`rounded-[18px] p-3.5 text-xs leading-relaxed ${cardBg}`}>
                <div className="flex items-center gap-2 font-bold mb-1 text-[#0a7cf0]">
                  <ShieldCheck size={15} />
                  <span>Workspace Preferences &amp; Browser Storage</span>
                </div>
                <p className={mutedText}>
                  Chats, appearance, voice settings, and Studio preferences are saved directly in your browser storage and synced automatically across Main Chat, Buildy UI Designer, and Voice Assistant.
                </p>
              </div>
            )}

            {/* GROUP 1: Permissions & Image Studio */}
            <div className={`rounded-[20px] overflow-hidden ${cardBg}`}>
              {/* Permissions Row */}
              <button
                type="button"
                onClick={() => toggleSection('permissions')}
                className={`w-full min-h-[54px] px-4 py-3 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer ${rowHover}`}
              >
                <div className="flex items-center gap-3.5">
                  <Cpu size={20} strokeWidth={1.75} className="shrink-0 opacity-85" />
                  <span className="text-[15px] font-semibold">Permissions</span>
                </div>
                <ChevronDown
                  size={17}
                  className={`shrink-0 opacity-50 transition-transform ${
                    expandedSection === 'permissions' ? 'rotate-180' : ''
                  }`}
                />
              </button>

              {expandedSection === 'permissions' && (
                <div className={`px-4 pb-4 pt-2 border-t ${dividerClass} space-y-2`}>
                  {[
                    {
                      id: 'mic' as const,
                      icon: Mic,
                      label: 'Microphone (Voice & Dictation)',
                      status: micPermission,
                    },
                    {
                      id: 'cam' as const,
                      icon: Camera,
                      label: 'Camera (Live Vision Assistant)',
                      status: camPermission,
                    },
                    {
                      id: 'clip' as const,
                      icon: ClipboardCheck,
                      label: 'Clipboard (Buildy Code Export)',
                      status: clipPermission,
                    },
                  ].map((item) => {
                    const Icon = item.icon;
                    const isGranted = item.status === 'granted';
                    return (
                      <div
                        key={item.id}
                        className={`flex items-center justify-between gap-3 px-3 py-2 rounded-xl border ${dividerClass}`}
                      >
                        <div className="flex items-center gap-2.5 text-xs font-medium min-w-0">
                          <Icon size={15} className="opacity-75 shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </div>
                        <button
                          type="button"
                          onClick={() => requestDevicePermission(item.id)}
                          className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold cursor-pointer whitespace-nowrap ${
                            isGranted
                              ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'
                              : 'bg-[#0a7cf0]/12 text-[#0a7cf0]'
                          }`}
                        >
                          {isGranted ? 'Allowed' : item.status === 'denied' ? 'Blocked' : 'Allow'}
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Image Studio Preferences Row */}
              {onImageOptionsChange && (
                <div className={`border-t ${dividerClass}`}>
                  <button
                    type="button"
                    onClick={() => toggleSection('studio')}
                    className={`w-full min-h-[54px] px-4 py-3 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer ${rowHover}`}
                  >
                    <div className="flex items-center gap-3.5">
                      <Sliders size={20} strokeWidth={1.75} className="shrink-0 opacity-85" />
                      <div>
                        <div className="text-[15px] font-semibold leading-tight">Studio Preferences</div>
                        <div className={`text-xs mt-0.5 ${mutedText}`}>
                          {imageOptions.style} · {imageOptions.quality}
                        </div>
                      </div>
                    </div>
                    <ChevronDown
                      size={17}
                      className={`shrink-0 opacity-50 transition-transform ${
                        expandedSection === 'studio' ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {expandedSection === 'studio' && (
                    <div className={`px-4 pb-4 pt-2 border-t ${dividerClass} space-y-2`}>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <div>
                          <label className={`block text-[10px] font-semibold uppercase mb-1 ${mutedText}`}>Style</label>
                          <select
                            value={imageOptions.style}
                            onChange={(e) =>
                              onImageOptionsChange({ ...imageOptions, style: e.target.value as ImageStyleOption })
                            }
                            className={`w-full px-2 py-1.5 rounded-lg border text-xs font-semibold ${inputBg}`}
                          >
                            {IMAGE_STYLE_OPTIONS.map((st) => (
                              <option key={st} value={st}>
                                {st}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className={`block text-[10px] font-semibold uppercase mb-1 ${mutedText}`}>Aspect</label>
                          <select
                            value={imageOptions.size}
                            onChange={(e) =>
                              onImageOptionsChange({
                                ...imageOptions,
                                size: e.target.value as ImageGenerationOptions['size'],
                              })
                            }
                            className={`w-full px-2 py-1.5 rounded-lg border text-xs font-semibold ${inputBg}`}
                          >
                            <option value="auto">Auto</option>
                            <option value="1024x1024">1:1</option>
                            <option value="1536x1024">3:2</option>
                            <option value="1024x1536">2:3</option>
                          </select>
                        </div>
                        <div>
                          <label className={`block text-[10px] font-semibold uppercase mb-1 ${mutedText}`}>Quality</label>
                          <select
                            value={imageOptions.quality}
                            onChange={(e) =>
                              onImageOptionsChange({
                                ...imageOptions,
                                quality: e.target.value as ImageGenerationOptions['quality'],
                              })
                            }
                            className={`w-full px-2 py-1.5 rounded-lg border text-xs font-semibold ${inputBg}`}
                          >
                            <option value="auto">Auto</option>
                            <option value="high">High</option>
                            <option value="medium">Medium</option>
                            <option value="low">Low</option>
                          </select>
                        </div>
                        <div>
                          <label className={`block text-[10px] font-semibold uppercase mb-1 ${mutedText}`}>Format</label>
                          <select
                            value={imageOptions.outputFormat}
                            onChange={(e) =>
                              onImageOptionsChange({
                                ...imageOptions,
                                outputFormat: e.target.value as ImageGenerationOptions['outputFormat'],
                              })
                            }
                            className={`w-full px-2 py-1.5 rounded-lg border text-xs font-semibold ${inputBg}`}
                          >
                            <option value="png">PNG</option>
                            <option value="jpeg">JPEG</option>
                            <option value="webp">WEBP</option>
                          </select>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Welcome & Daily Routine Gmail Row */}
              <div className={`border-t ${dividerClass}`}>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic(10);
                    stopGeminiTts();
                    onClose();
                    window.dispatchEvent(new CustomEvent('open-gmail-routine-modal', { detail: { tab: 'routine' } }));
                  }}
                  className={`w-full min-h-[54px] px-4 py-3 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer ${rowHover}`}
                >
                  <div className="flex items-center gap-3.5">
                    <Mail size={20} strokeWidth={1.75} className="shrink-0 opacity-85 text-[#0a7cf0]" />
                    <div>
                      <div className="text-[15px] font-semibold leading-tight">Welcome &amp; Daily Routine Gmail</div>
                      <div className={`text-xs mt-0.5 ${mutedText}`}>
                        Configure &amp; send your Think Creative inbox emails
                      </div>
                    </div>
                  </div>
                  <span className="text-[11px] font-semibold px-2.5 py-1 rounded-lg bg-[#0a7cf0]/12 text-[#0a7cf0] shrink-0">
                    Open
                  </span>
                </button>
              </div>
            </div>

            {/* GROUP 2: Color mode + Font style + Voice and dictation */}
            <div className={`rounded-[20px] overflow-hidden ${cardBg}`}>
              {/* Color mode visual selector matching screenshot */}
              <div className="px-4 pt-3.5 pb-4">
                <div className="flex items-center gap-3.5 mb-3">
                  <Moon size={20} strokeWidth={1.75} className="shrink-0 opacity-85" />
                  <span className="text-[15px] font-semibold">Color mode</span>
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  {(
                    [
                      { id: 'light', label: 'Light' },
                      { id: 'dark', label: 'Dark' },
                      { id: 'system', label: 'System' },
                    ] as const
                  ).map((mode) => {
                    const isActive = themeMode === mode.id;
                    return (
                      <button
                        key={mode.id}
                        type="button"
                        onClick={() => {
                          triggerHaptic(10);
                          setThemeMode(mode.id as ThemeMode);
                        }}
                        className="flex flex-col items-center gap-1.5 cursor-pointer group focus:outline-none"
                      >
                        <div
                          className={`w-full aspect-[1.38/1] rounded-[16px] p-[3px] transition-all ${
                            isActive
                              ? 'ring-2 ring-[#0a7cf0]'
                              : isDark
                              ? 'ring-1 ring-white/15 hover:ring-white/30'
                              : 'ring-1 ring-black/10 hover:ring-black/25'
                          }`}
                        >
                          {mode.id === 'light' && (
                            <div className="w-full h-full rounded-[13px] bg-white border border-black/10 relative p-2.5 flex flex-col justify-between overflow-hidden">
                              <div className="space-y-1.5">
                                <div className="w-9 h-1 rounded-full bg-zinc-400/70" />
                                <div className="w-6 h-1 rounded-full bg-zinc-300" />
                              </div>
                              <div className="self-end w-3.5 h-3.5 rounded-full bg-[#d36743]" />
                            </div>
                          )}
                          {mode.id === 'dark' && (
                            <div className="w-full h-full rounded-[13px] bg-[#16171a] border border-white/10 relative p-2.5 flex flex-col justify-between overflow-hidden">
                              <div className="space-y-1.5">
                                <div className="w-9 h-1 rounded-full bg-zinc-400/70" />
                                <div className="w-6 h-1 rounded-full bg-zinc-600" />
                              </div>
                              <div className="self-end w-3.5 h-3.5 rounded-full bg-[#d36743]" />
                            </div>
                          )}
                          {mode.id === 'system' && (
                            <div className="w-full h-full rounded-[13px] relative p-2.5 flex flex-col justify-between overflow-hidden border border-black/10 bg-[linear-gradient(142deg,#ffffff_50%,#16171a_50.4%)]">
                              <div className="space-y-1.5 relative z-10">
                                <div className="w-9 h-1 rounded-full bg-zinc-400/80" />
                                <div className="w-6 h-1 rounded-full bg-zinc-300/90" />
                              </div>
                              <div className="self-end w-3.5 h-3.5 rounded-full bg-[#d36743] relative z-10" />
                            </div>
                          )}
                        </div>
                        <span
                          className={`text-xs font-semibold transition-colors ${
                            isActive ? 'text-[#0a7cf0]' : mutedText
                          }`}
                        >
                          {mode.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Font style Row */}
              <div className={`border-t ${dividerClass}`}>
                <button
                  type="button"
                  onClick={() => toggleSection('font')}
                  className={`w-full min-h-[58px] px-4 py-3 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer ${rowHover}`}
                >
                  <div className="flex items-center gap-3.5">
                    <Type size={20} strokeWidth={1.75} className="shrink-0 opacity-85" />
                    <div>
                      <div className="text-[15px] font-semibold leading-tight">Font style</div>
                      <div className={`text-xs mt-0.5 ${mutedText}`}>{fontLabel}</div>
                    </div>
                  </div>
                  <ChevronDown
                    size={17}
                    className={`shrink-0 opacity-50 transition-transform ${
                      expandedSection === 'font' ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {expandedSection === 'font' && (
                  <div className={`px-4 pb-3.5 pt-2 border-t ${dividerClass} grid grid-cols-3 gap-2`}>
                    {(
                      [
                        { id: 'default', label: 'Default', sample: 'Clean Sans' },
                        { id: 'editorial', label: 'Editorial', sample: 'Serif Craft' },
                        { id: 'mono', label: 'Mono', sample: 'Code Style' },
                      ] as const
                    ).map((f) => {
                      const active = fontStyle === f.id;
                      return (
                        <button
                          key={f.id}
                          type="button"
                          onClick={() => {
                            triggerHaptic(8);
                            setFontStyle(f.id as FontStyle);
                          }}
                          className={`px-2.5 py-2 rounded-xl border text-left transition-all cursor-pointer ${
                            active
                              ? 'border-[#0a7cf0] bg-[#0a7cf0]/10 text-[#0a7cf0]'
                              : `${dividerClass} ${rowHover}`
                          }`}
                        >
                          <div className="text-xs font-bold">{f.label}</div>
                          <div className={`text-[10px] mt-0.5 ${mutedText}`}>{f.sample}</div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* Voice and dictation Row */}
              <div className={`border-t ${dividerClass}`}>
                <button
                  type="button"
                  onClick={() => toggleSection('voice')}
                  className={`w-full min-h-[54px] px-4 py-3 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer ${rowHover}`}
                >
                  <div className="flex items-center gap-3.5">
                    <Volume2 size={20} strokeWidth={1.75} className="shrink-0 opacity-85" />
                    <div className="min-w-0">
                      <div className="text-[15px] font-semibold leading-tight">Voice and dictation</div>
                      <div className={`text-xs mt-0.5 truncate ${mutedText}`}>
                        Active: {GEMINI_TTS_VOICES.find((v) => v.id === selectedVoice)?.name || 'Zara Classic'}
                      </div>
                    </div>
                  </div>
                  <ChevronDown
                    size={17}
                    className={`shrink-0 opacity-50 transition-transform ${
                      expandedSection === 'voice' ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {expandedSection === 'voice' && (
                  <div className={`px-4 pb-4 pt-2.5 border-t ${dividerClass} space-y-3`}>
                    {ttsError && (
                      <div className="px-3 py-2 rounded-xl bg-red-500/12 border border-red-500/30 text-red-600 dark:text-red-400 text-xs font-medium">
                        {ttsError}
                      </div>
                    )}

                    <div className="grid grid-cols-2 gap-2 max-h-[240px] overflow-y-auto pr-0.5">
                      {GEMINI_TTS_VOICES.map((voice) => {
                        const isSelected = selectedVoice === voice.id;
                        const isLoading = loadingVoiceId === voice.id;
                        const isPlaying = playingVoiceId === voice.id;
                        return (
                          <div
                            key={voice.id}
                            onClick={() => handleSelectVoice(voice.id)}
                            className={`p-2.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between gap-2 ${
                              isSelected
                                ? 'border-[#0a7cf0] bg-[#0a7cf0]/8 ring-1 ring-[#0a7cf0]/40'
                                : `${dividerClass} ${rowHover}`
                            }`}
                          >
                            <div className="flex items-start justify-between gap-1.5">
                              <div className="min-w-0">
                                <div className="font-bold text-xs truncate">{voice.name}</div>
                                <div className={`text-[10px] mt-0.5 ${mutedText}`}>
                                  {voice.persona} · {voice.gender}
                                </div>
                              </div>
                              <div
                                className={`w-3.5 h-3.5 rounded-full border shrink-0 mt-0.5 flex items-center justify-center ${
                                  isSelected ? 'border-[#0a7cf0] bg-[#0a7cf0]' : 'border-zinc-400/60'
                                }`}
                              >
                                {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                              </div>
                            </div>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePlaySample(voice);
                              }}
                              className={`self-start px-2 py-1 rounded-lg text-[10px] font-semibold flex items-center gap-1 cursor-pointer ${
                                isPlaying
                                  ? 'bg-amber-500 text-white'
                                  : isLoading
                                  ? 'bg-[#0a7cf0] text-white'
                                  : isDark
                                  ? 'bg-white/10 hover:bg-[#0a7cf0] hover:text-white'
                                  : 'bg-zinc-100 hover:bg-[#0a7cf0] hover:text-white'
                              }`}
                            >
                              {isLoading ? (
                                <>
                                  <Loader2 size={10} className="animate-spin" />
                                  <span>Loading</span>
                                </>
                              ) : isPlaying ? (
                                <>
                                  <Square size={10} className="fill-current" />
                                  <span>Stop</span>
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

                    <div className={`flex items-center justify-between gap-3 pt-2 border-t ${dividerClass}`}>
                      <div>
                        <div className="text-xs font-bold">Auto-Read Responses Aloud</div>
                        <div className={`text-[11px] ${mutedText}`}>
                          Speak AI answers after studio TTS loads
                        </div>
                      </div>
                      <button
                        type="button"
                        onClick={() => {
                          triggerHaptic(10);
                          const nextVal = !autoRead;
                          setAutoRead(nextVal);
                          setAutoReadAloud(nextVal);
                        }}
                        className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                          autoRead ? 'bg-[#0a7cf0]' : isDark ? 'bg-zinc-700' : 'bg-zinc-300'
                        }`}
                        role="switch"
                        aria-checked={autoRead}
                      >
                        <span
                          className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow transition duration-200 ${
                            autoRead ? 'translate-x-5' : 'translate-x-0'
                          }`}
                        />
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>

            {/* GROUP 3: Haptic feedback, Notifications, Time and focus, Privacy, Sharing */}
            <div className={`rounded-[20px] overflow-hidden ${cardBg}`}>
              {/* Haptic feedback */}
              <div className="min-h-[54px] px-4 py-3 flex items-center justify-between gap-3">
                <div className="flex items-center gap-3.5">
                  <Smartphone size={20} strokeWidth={1.75} className="shrink-0 opacity-85" />
                  <span className="text-[15px] font-semibold">Haptic feedback</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    const next = !hapticEnabled;
                    setHapticEnabled(next);
                    if (next && navigator.vibrate) {
                      navigator.vibrate(14);
                    }
                  }}
                  className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                    hapticEnabled ? 'bg-[#0a7cf0]' : isDark ? 'bg-zinc-700' : 'bg-zinc-300'
                  }`}
                  role="switch"
                  aria-checked={hapticEnabled}
                  aria-label="Haptic feedback"
                >
                  <span
                    className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition duration-200 ${
                      hapticEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Notifications */}
              <div className={`border-t ${dividerClass} min-h-[54px] px-4 py-3 flex items-center justify-between gap-3`}>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic(10);
                    const next = !notificationsEnabled;
                    setNotificationsEnabled(next);
                    try {
                      localStorage.setItem('app_notifications_v1', next ? 'true' : 'false');
                    } catch {}
                  }}
                  className="flex items-center gap-3.5 flex-1 text-left cursor-pointer"
                >
                  <Bell size={20} strokeWidth={1.75} className="shrink-0 opacity-85" />
                  <div className="min-w-0">
                    <span className="text-[15px] font-semibold block">Notifications</span>
                    <span className={`text-[11px] block ${mutedText}`}>
                      {notificationsEnabled ? 'Studio render alerts enabled' : 'Muted'}
                    </span>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic(10);
                    const next = !notificationsEnabled;
                    setNotificationsEnabled(next);
                    try {
                      localStorage.setItem('app_notifications_v1', next ? 'true' : 'false');
                    } catch {}
                  }}
                  className={`relative inline-flex h-7 w-12 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ${
                    notificationsEnabled ? 'bg-[#0a7cf0]' : isDark ? 'bg-zinc-700' : 'bg-zinc-300'
                  }`}
                  role="switch"
                  aria-checked={notificationsEnabled}
                  aria-label="Notifications"
                >
                  <span
                    className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md transition duration-200 ${
                      notificationsEnabled ? 'translate-x-5' : 'translate-x-0'
                    }`}
                  />
                </button>
              </div>

              {/* Time and focus */}
              <div className={`border-t ${dividerClass}`}>
                <button
                  type="button"
                  onClick={() => toggleSection('focus')}
                  className={`w-full min-h-[54px] px-4 py-3 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer ${rowHover}`}
                >
                  <div className="flex items-center gap-3.5">
                    <Clock size={20} strokeWidth={1.75} className="shrink-0 opacity-85" />
                    <span className="text-[15px] font-semibold">Time and focus</span>
                  </div>
                  <ChevronDown
                    size={17}
                    className={`shrink-0 opacity-50 transition-transform ${
                      expandedSection === 'focus' ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {expandedSection === 'focus' && (
                  <div className={`px-4 pb-3.5 pt-2 border-t ${dividerClass} space-y-2`}>
                    <div className={`text-xs ${mutedText}`}>
                      Default voice session focus window ({focusTimerMinutes} min):
                    </div>
                    <div className="flex items-center gap-2">
                      {[2, 5, 10].map((mins) => (
                        <button
                          key={mins}
                          type="button"
                          onClick={() => {
                            triggerHaptic(8);
                            setFocusTimerMinutes(mins);
                            try {
                              localStorage.setItem('app_focus_minutes_v1', String(mins));
                            } catch {}
                          }}
                          className={`px-3 py-1.5 rounded-xl text-xs font-semibold border cursor-pointer ${
                            focusTimerMinutes === mins
                              ? 'border-[#0a7cf0] bg-[#0a7cf0]/10 text-[#0a7cf0]'
                              : `${dividerClass} ${rowHover}`
                          }`}
                        >
                          {mins} min
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Privacy */}
              <div className={`border-t ${dividerClass}`}>
                <button
                  type="button"
                  onClick={() => toggleSection('privacy')}
                  className={`w-full min-h-[54px] px-4 py-3 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer ${rowHover}`}
                >
                  <div className="flex items-center gap-3.5">
                    <Shield size={20} strokeWidth={1.75} className="shrink-0 opacity-85" />
                    <span className="text-[15px] font-semibold">Privacy</span>
                  </div>
                  <ChevronDown
                    size={17}
                    className={`shrink-0 opacity-50 transition-transform ${
                      expandedSection === 'privacy' ? 'rotate-180' : ''
                    }`}
                  />
                </button>

                {expandedSection === 'privacy' && (
                  <div className={`px-4 pb-3.5 pt-2 border-t ${dividerClass} text-xs space-y-1.5 ${mutedText}`}>
                    <p>• API keys are AES-256-GCM encrypted in the server vault and never exposed to client code.</p>
                    <p>• WebGPU Face Swap runs safety policy inspection first and processes pixel buffers locally on your device GPU.</p>
                  </div>
                )}
              </div>

              {/* Sharing */}
              <div className={`border-t ${dividerClass}`}>
                <button
                  type="button"
                  onClick={handleShareWorkspace}
                  className={`w-full min-h-[54px] px-4 py-3 flex items-center justify-between gap-3 text-left transition-colors cursor-pointer ${rowHover}`}
                >
                  <div className="flex items-center gap-3.5">
                    <Share2 size={20} strokeWidth={1.75} className="shrink-0 opacity-85" />
                    <span className="text-[15px] font-semibold">Sharing</span>
                  </div>
                  <span className={`text-xs font-semibold flex items-center gap-1 ${shareCopied ? 'text-emerald-600' : mutedText}`}>
                    {shareCopied ? (
                      <>
                        <Check size={13} />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy size={13} />
                        <span>Share App</span>
                      </>
                    )}
                  </span>
                </button>
              </div>
            </div>

            {/* GROUP 4: Standalone Red Log out Card */}
            <div className={`rounded-[20px] overflow-hidden ${cardBg}`}>
              {isSignedIn ? (
                <button
                  type="button"
                  onClick={async () => {
                    triggerHaptic(15);
                    await logOut().catch(() => {});
                    onClose();
                  }}
                  className={`w-full min-h-[54px] px-4 py-3 flex items-center gap-3.5 text-left text-[#b91c1c] dark:text-red-400 font-semibold text-[15px] transition-colors cursor-pointer ${rowHover}`}
                >
                  <LogOut size={20} strokeWidth={1.85} className="shrink-0" />
                  <span>Log out</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => {
                    triggerHaptic(12);
                    onClose();
                    onOpenLogin?.();
                  }}
                  className={`w-full min-h-[54px] px-4 py-3 flex items-center gap-3.5 text-left text-[#b91c1c] dark:text-red-400 font-semibold text-[15px] transition-colors cursor-pointer ${rowHover}`}
                >
                  <LogOut size={20} strokeWidth={1.85} className="shrink-0" />
                  <span>Sign in / Log out</span>
                </button>
              )}
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
