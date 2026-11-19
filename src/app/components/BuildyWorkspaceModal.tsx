import React, { useEffect, useRef, useState } from 'react';
import { ArrowLeft, Hammer, Loader2, RefreshCw } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';
import { getFirebaseIdToken } from '../firebase';
import { getWorkspaceSessionId } from '../utils/workspaceSession';

const EMBEDDED_BUILDY_URL = 'https://ailikebariy.lovable.app';

export interface BuildyWorkspaceModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialPrompt?: string;
  onOpenSettings?: () => void;
}

export const BuildyWorkspaceModal: React.FC<BuildyWorkspaceModalProps> = ({
  isOpen,
  onClose,
  initialPrompt,
}) => {
  const { theme } = useTheme();
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [reloadNonce, setReloadNonce] = useState(0);
  const [isFrameLoaded, setIsFrameLoaded] = useState(false);

  const postBridgeMessages = async () => {
    const win = iframeRef.current?.contentWindow;
    if (!win) return;
    try {
      win.postMessage({ type: 'set-theme', theme }, '*');
      win.postMessage({ type: 'set-workspace', workspaceSession: getWorkspaceSessionId() }, '*');
      const idToken = await getFirebaseIdToken().catch(() => null);
      if (idToken) {
        win.postMessage({ type: 'set-token', token: idToken }, '*');
      }
      if (initialPrompt && initialPrompt.trim()) {
        win.postMessage(
          { type: 'seed-prompt', prompt: initialPrompt.trim(), autoStart: false },
          '*'
        );
      }
    } catch {}
  };

  useEffect(() => {
    if (!isOpen) {
      setIsFrameLoaded(false);
      return;
    }
    const win = iframeRef.current?.contentWindow;
    if (win) {
      try {
        win.postMessage({ type: 'set-theme', theme }, '*');
        win.postMessage({ type: 'set-workspace', workspaceSession: getWorkspaceSessionId() }, '*');
      } catch {}
    }
  }, [theme, isOpen]);

  useEffect(() => {
    if (!isOpen || !initialPrompt?.trim()) return;
    const t = setTimeout(() => {
      postBridgeMessages();
    }, 350);
    return () => clearTimeout(t);
  }, [isOpen, initialPrompt]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[10050] flex flex-col bg-white dark:bg-zinc-950 text-zinc-900 dark:text-zinc-100 animate-in fade-in duration-200">
      {/* Integrated In-App Studio Header (matches app white UI with zero external URL/link chrome) */}
      <div className="h-12 sm:h-13 flex items-center justify-between px-3.5 sm:px-5 bg-white dark:bg-zinc-950 border-b border-zinc-200/85 dark:border-zinc-800 shrink-0 z-20">
        <div className="flex items-center gap-2.5 min-w-0">
          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-700 dark:text-zinc-200 flex items-center justify-center transition-colors cursor-pointer shrink-0"
            title="Back to App"
            aria-label="Back to App"
          >
            <ArrowLeft size={16} />
          </button>
          <div className="w-7 h-7 rounded-lg bg-[#00a6ff]/12 text-[#0077cc] flex items-center justify-center shrink-0">
            <Hammer size={14} strokeWidth={2.2} />
          </div>
          <span className="text-sm font-bold tracking-tight text-zinc-900 dark:text-zinc-100 truncate">
            Buildy
          </span>
        </div>

        <button
          type="button"
          onClick={() => {
            setIsFrameLoaded(false);
            setReloadNonce((n) => n + 1);
          }}
          className="w-8 h-8 rounded-full bg-zinc-100 hover:bg-zinc-200 dark:bg-zinc-900 dark:hover:bg-zinc-800 text-zinc-600 dark:text-zinc-300 flex items-center justify-center transition-colors cursor-pointer shrink-0"
          title="Reload Buildy"
          aria-label="Reload Buildy"
        >
          <RefreshCw size={14} className={!isFrameLoaded ? 'animate-spin' : ''} />
        </button>
      </div>

      {/* Seamless Full-Bleed Embedded App Surface */}
      <div className="relative flex-1 w-full h-full overflow-hidden bg-white dark:bg-zinc-950">
        {!isFrameLoaded && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2.5 bg-white dark:bg-zinc-950 pointer-events-none">
            <Loader2 size={24} className="animate-spin text-[#00a6ff]" />
            <span className="text-xs font-semibold text-zinc-500">Opening Buildy...</span>
          </div>
        )}
        <iframe
          key={reloadNonce}
          ref={iframeRef}
          src={EMBEDDED_BUILDY_URL}
          title="Buildy Studio"
          onLoad={() => {
            setIsFrameLoaded(true);
            postBridgeMessages();
          }}
          className={`w-full h-full border-0 bg-white transition-opacity duration-200 ${
            isFrameLoaded ? 'opacity-100' : 'opacity-0'
          }`}
          allow="microphone; camera; clipboard-read; clipboard-write; autoplay; fullscreen"
        />
      </div>
    </div>
  );
};
