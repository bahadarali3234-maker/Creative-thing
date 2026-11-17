import React from 'react';
import { motion } from 'motion/react';
import { Hammer, Sparkles, X } from 'lucide-react';

export interface BuildyExpandableCardProps {
  requestText?: string;
  onClose: () => void;
  onOpenBuildy?: (requestText?: string) => void;
  onDraftPrompt?: (promptText: string) => void;
  variant?: 'chat' | 'welcome';
}

export const BuildyExpandableCard: React.FC<BuildyExpandableCardProps> = ({
  requestText,
  onClose,
  onOpenBuildy,
  onDraftPrompt,
}) => {
  const handleOpenBuildy = () => {
    if (onOpenBuildy) {
      onOpenBuildy(requestText);
    } else {
      window.dispatchEvent(
        new CustomEvent('open-buildy-workspace', { detail: { initialPrompt: requestText } })
      );
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 16, scale: 0.98 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className="fixed-prompt-box neu-glass w-full rounded-[28px] sm:rounded-[32px] px-5 sm:px-6 py-4 sm:py-5 border border-[var(--gb)] flex flex-col gap-3.5 text-foreground"
    >
      {/* Header matching CompactThinkingPanel upward dock geometry */}
      <div className="flex items-start justify-between gap-3 pb-3 border-b border-border/80">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-9 h-9 rounded-2xl bg-[var(--primary)]/14 text-[var(--primary-light)] border border-[var(--primary)]/30 flex items-center justify-center shrink-0 mt-0.5">
            <Hammer size={18} strokeWidth={2.2} />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[var(--primary-light)] block mb-0.5">
              Buildy App & Web Builder
            </span>
            <h3 className="text-sm sm:text-base font-bold text-foreground leading-snug tracking-tight">
              Open Buildy Studio right inside the app
            </h3>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-7 h-7 rounded-full neu-raise text-muted-foreground hover:text-foreground flex items-center justify-center transition-colors cursor-pointer shrink-0"
          title="Close Buildy card"
          aria-label="Close Buildy card"
        >
          <X size={15} />
        </button>
      </div>

      {/* Clear guidance message */}
      <div className="space-y-2 text-xs sm:text-sm text-muted-foreground leading-relaxed">
        <p className="text-foreground/90 font-medium">
          Build complete interactive websites, landing pages, and mobile app screens right inside the integrated Buildy UI builder with live device preview, visual editing, and Design Library components.
        </p>
        <p className="text-xs text-muted-foreground">
          Uses your already configured AI backend automatically — no separate key setup required.
        </p>
        {requestText && (
          <div className="px-3 py-2 rounded-xl neu-sink text-xs text-muted-foreground truncate">
            Request: <span className="font-semibold text-foreground">{requestText}</span>
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleOpenBuildy}
            className="px-4 py-2 rounded-full theme-button-primary text-xs sm:text-sm font-semibold flex items-center gap-2 transition-all cursor-pointer active:scale-95"
          >
            <Hammer size={15} />
            <span>Open Buildy Studio</span>
          </button>

          {onDraftPrompt && requestText && (
            <button
              type="button"
              onClick={() => onDraftPrompt(requestText)}
              className="px-3.5 py-2 rounded-full neu-raise text-foreground text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
            >
              <Sparkles size={13} className="text-[var(--primary-light)]" />
              <span>Write Detailed Prompt</span>
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="text-xs font-medium text-muted-foreground hover:text-foreground px-2 py-1 cursor-pointer transition-colors"
        >
          Back to prompt
        </button>
      </div>
    </motion.div>
  );
};

