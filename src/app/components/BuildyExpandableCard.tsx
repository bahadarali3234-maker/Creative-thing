import React from 'react';
import { motion } from 'motion/react';
import { ExternalLink, Hammer, Sparkles, X } from 'lucide-react';

export const BUILDY_URL = 'https://fluorescent-code-vault-flow.base44.app';

export interface BuildyExpandableCardProps {
  requestText?: string;
  onClose: () => void;
  onDraftPrompt?: (promptText: string) => void;
  variant?: 'chat' | 'welcome';
}

export const BuildyExpandableCard: React.FC<BuildyExpandableCardProps> = ({
  requestText,
  onClose,
  onDraftPrompt,
  variant = 'chat',
}) => {
  const handleOpenBuildy = () => {
    window.open(BUILDY_URL, '_blank', 'noopener,noreferrer');
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 16, scale: 0.98 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1] }}
      className={
        variant === 'welcome'
          ? 'fixed-prompt-box w-full rounded-[28px] sm:rounded-[32px] bg-[#f8f9fc]/95 backdrop-blur-xl text-zinc-900 px-5 sm:px-6 py-4 sm:py-5 shadow-[0_20px_60px_rgba(0,0,0,0.85),0_0_40px_rgba(0,166,255,0.18)] border border-white/90 flex flex-col gap-3.5'
          : 'fixed-prompt-box w-full bg-surface text-foreground rounded-[28px] sm:rounded-[32px] px-5 sm:px-6 py-4 sm:py-5 shadow-[var(--shadow-neumorphic-soft)] border border-border/90 flex flex-col gap-3.5'
      }
    >
      {/* Header matching CompactThinkingPanel upward dock geometry */}
      <div className="flex items-start justify-between gap-3 pb-3 border-b border-border/80">
        <div className="flex items-start gap-3 min-w-0">
          <div className="w-9 h-9 rounded-2xl bg-[var(--primary)]/12 text-[var(--primary)] border border-[var(--primary)]/25 flex items-center justify-center shrink-0 mt-0.5">
            <Hammer size={18} strokeWidth={2.2} />
          </div>
          <div className="min-w-0">
            <span className="text-[11px] font-mono font-bold uppercase tracking-wider text-[var(--primary)] block mb-0.5">
              Buildy App & Web Builder
            </span>
            <h3 className="text-sm sm:text-base font-bold text-foreground leading-snug tracking-tight">
              Go to Buildy to create App or Web UI
            </h3>
          </div>
        </div>

        <button
          type="button"
          onClick={onClose}
          className="w-7 h-7 rounded-full hover:bg-zinc-200/70 text-foreground flex items-center justify-center transition-colors cursor-pointer shrink-0"
          title="Close Buildy card"
          aria-label="Close Buildy card"
        >
          <X size={15} />
        </button>
      </div>

      {/* Clear guidance message */}
      <div className="space-y-2 text-xs sm:text-sm text-zinc-600 leading-relaxed">
        <p className="text-foreground/90 font-medium">
          Website and App UI generation is handled exclusively in Buildy. Open Buildy to create, customize, and export your complete website or app interface.
        </p>
        <p className="text-xs text-zinc-500">
          Need help planning first? This workspace can still give you detailed architecture answers, Buildy-ready specification prompts, and code in Python, TypeScript, JavaScript, C++, or SQL.
        </p>
        {requestText && (
          <div className="px-3 py-2 rounded-xl bg-zinc-100/90 border border-zinc-200/80 text-xs text-zinc-700 truncate">
            Request: <span className="font-semibold text-zinc-900">{requestText}</span>
          </div>
        )}
      </div>

      {/* Action Footer */}
      <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleOpenBuildy}
            className="px-4 py-2 rounded-full bg-[var(--primary)] hover:bg-[var(--primary-dark)] text-white text-xs sm:text-sm font-semibold flex items-center gap-2 shadow-sm transition-all cursor-pointer active:scale-95"
          >
            <Hammer size={15} />
            <span>Open Buildy</span>
            <ExternalLink size={13} className="opacity-85" />
          </button>

          {onDraftPrompt && requestText && (
            <button
              type="button"
              onClick={() => onDraftPrompt(requestText)}
              className="px-3.5 py-2 rounded-full bg-zinc-100 hover:bg-zinc-200/90 text-zinc-800 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95"
            >
              <Sparkles size={13} className="text-[var(--primary)]" />
              <span>Write Detailed Buildy Prompt</span>
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={onClose}
          className="text-xs font-medium text-zinc-500 hover:text-zinc-900 px-2 py-1 cursor-pointer transition-colors"
        >
          Back to prompt
        </button>
      </div>
    </motion.div>
  );
};
