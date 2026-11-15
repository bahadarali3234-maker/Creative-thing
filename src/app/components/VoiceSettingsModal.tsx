import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, Play, Square, Loader2 } from 'lucide-react';
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

export interface VoiceSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVoiceChanged?: (newVoice: string) => void;
}

export const VoiceSettingsModal: React.FC<VoiceSettingsModalProps> = ({
  isOpen,
  onClose,
  onVoiceChanged,
}) => {
  const [selectedVoice, setSelectedVoice] = useState<string>('zara-classic');
  const [autoRead, setAutoRead] = useState<boolean>(false);
  const [loadingVoiceId, setLoadingVoiceId] = useState<string | null>(null);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [ttsError, setTtsError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setSelectedVoice(getStoredVoice());
      setAutoRead(getAutoReadAloud());
      setTtsError(null);
      setLoadingVoiceId(null);
      setPlayingVoiceId(null);
    } else {
      stopGeminiTts();
      setLoadingVoiceId(null);
      setPlayingVoiceId(null);
      setTtsError(null);
    }
  }, [isOpen]);

  const handleSelectVoice = (voiceId: string) => {
    setSelectedVoice(voiceId);
    setStoredVoice(voiceId);
    setTtsError(null);
    onVoiceChanged?.(voiceId);
  };

  const handleToggleAutoRead = () => {
    const nextVal = !autoRead;
    setAutoRead(nextVal);
    setAutoReadAloud(nextVal);
  };

  const handlePlaySample = (voice: GeminiVoiceInfo) => {
    setTtsError(null);
    if (playingVoiceId === voice.id || loadingVoiceId === voice.id) {
      stopGeminiTts();
      setLoadingVoiceId(null);
      setPlayingVoiceId(null);
      return;
    }

    setLoadingVoiceId(voice.id);
    setPlayingVoiceId(null);

    playVoicePreviewSample(voice, {
      onLoadingStart: () => {
        setLoadingVoiceId(voice.id);
      },
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

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div
        onClick={() => {
          stopGeminiTts();
          onClose();
        }}
        className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/70 backdrop-blur-md animate-in fade-in duration-200"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 12 }}
          transition={{ duration: 0.22, ease: 'easeOut' }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-xl max-h-[88vh] rounded-[26px] bg-white text-zinc-900 border border-zinc-200/90 shadow-[0_24px_60px_rgba(0,0,0,0.32)] flex flex-col overflow-hidden"
        >
          {/* Minimal Header: Only Voices heading + Corner Close X */}
          <div className="flex items-center justify-between px-5 pt-4 pb-3 border-b border-zinc-100">
            <h3 className="text-lg font-extrabold tracking-tight text-zinc-900">
              Voices
            </h3>
            <button
              type="button"
              onClick={() => {
                stopGeminiTts();
                onClose();
              }}
              className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-700 flex items-center justify-center transition-colors cursor-pointer"
              title="Close"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>

          {/* Compact Multi-Column Voices Grid */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-5 space-y-3 no-scrollbar">
            {ttsError && (
              <div className="px-3 py-2 rounded-xl bg-red-50 border border-red-200 text-red-700 text-xs font-medium">
                {ttsError}
              </div>
            )}

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
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
                        ? 'bg-sky-50/70 border-[#00a6ff] ring-1 ring-[#00a6ff]/60 shadow-sm'
                        : 'bg-white border-zinc-200/90 hover:border-zinc-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-1.5">
                      <div className="min-w-0">
                        <div className="font-bold text-xs text-zinc-900 truncate leading-tight">
                          {voice.name}
                        </div>
                        <div className="text-[10px] font-semibold text-zinc-500 mt-0.5">
                          {voice.persona} · {voice.gender}
                        </div>
                        <div className="text-[10px] text-zinc-400 truncate mt-0.5">
                          {voice.tone}
                        </div>
                      </div>

                      <div
                        className={`w-4 h-4 rounded-full border flex items-center justify-center shrink-0 mt-0.5 transition-colors ${
                          isSelected ? 'border-[#00a6ff] bg-[#00a6ff]' : 'border-zinc-300 bg-white'
                        }`}
                      >
                        {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1.5 border-t border-zinc-100">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handlePlaySample(voice);
                        }}
                        className={`px-2 py-1 rounded-lg text-[11px] font-semibold flex items-center gap-1 transition-all cursor-pointer ${
                          isPlaying
                            ? 'bg-amber-500 text-white'
                            : isLoading
                            ? 'bg-[#00a6ff] text-white'
                            : 'bg-zinc-100 hover:bg-zinc-200 text-zinc-800'
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

                      {isSelected && (
                        <span className="text-[10px] font-bold text-[#00a6ff]">Active</span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Bottom: Auto-Read Responses Aloud Toggle Only */}
          <div className="px-4 sm:px-5 py-3.5 bg-zinc-50 border-t border-zinc-100 flex items-center justify-between gap-4">
            <div className="min-w-0">
              <span className="font-bold text-xs sm:text-sm text-zinc-900 block">
                Auto-Read Responses Aloud
              </span>
              <span className="text-[11px] text-zinc-500 block leading-snug">
                Automatically speak AI answers in the active voice
              </span>
            </div>

            <button
              type="button"
              onClick={handleToggleAutoRead}
              className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                autoRead ? 'bg-[#00a6ff]' : 'bg-zinc-300'
              }`}
              role="switch"
              aria-checked={autoRead}
            >
              <span
                className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow-lg ring-0 transition duration-200 ease-in-out ${
                  autoRead ? 'translate-x-5' : 'translate-x-0'
                }`}
              />
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
