import React, { useEffect, useState } from 'react';
import { X, Wand2, ArrowRight, Sparkles, Check, Loader2 } from 'lucide-react';
import { StudioPopupSpec, StudioQuestion } from '../utils/studioClient';

interface StudioConfirmDialogProps {
  isOpen: boolean;
  popup: StudioPopupSpec;
  promptPreview: string;
  recipe?: string | null;
  isLoadingQuestions?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export const StudioConfirmDialog: React.FC<StudioConfirmDialogProps> = ({
  isOpen,
  popup,
  promptPreview,
  recipe,
  isLoadingQuestions = false,
  onConfirm,
  onCancel,
}) => {
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isLoadingQuestions) onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, isLoadingQuestions, onCancel]);

  if (!isOpen) return null;

  return (
    <div
      onClick={() => !isLoadingQuestions && onCancel()}
      className="fixed inset-0 z-[10010] bg-black/60 flex items-center justify-center p-4 animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        className="w-full max-w-md neu-glass rounded-3xl p-6 text-foreground shadow-2xl border border-border/20"
      >
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl neu-raise flex items-center justify-center text-[var(--primary)] shrink-0">
              <Wand2 size={18} />
            </div>
            <div className="min-w-0">
              <h3 className="text-base font-bold text-foreground truncate">
                {popup.title || 'Generate an image?'}
              </h3>
              <p className="text-xs text-foreground/60 truncate">
                {recipe ? `Creative Studio · ${recipe}` : 'Creative Studio'}
              </p>
            </div>
          </div>

          <button
            type="button"
            disabled={isLoadingQuestions}
            onClick={onCancel}
            className="w-8 h-8 rounded-full neu-raise flex items-center justify-center text-foreground/70 hover:text-foreground transition-colors shrink-0 cursor-pointer"
            aria-label="Close"
          >
            <X size={15} />
          </button>
        </div>

        <p className="text-sm text-foreground/85 leading-relaxed mb-3">
          {popup.body || 'Do you agree to generate this image?'}
        </p>

        {promptPreview && (
          <div className="p-3 rounded-2xl neu-sink text-xs text-foreground/75 line-clamp-2 mb-5">
            {promptPreview}
          </div>
        )}

        <div className="flex items-center justify-end gap-2.5">
          <button
            type="button"
            disabled={isLoadingQuestions}
            onClick={onCancel}
            className="h-10 px-4 rounded-xl neu-raise text-xs font-semibold text-foreground/80 hover:text-foreground transition-colors whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-50"
          >
            {popup.no || 'Cancel'}
          </button>
          <button
            type="button"
            disabled={isLoadingQuestions}
            onClick={onConfirm}
            className="h-10 px-5 rounded-xl theme-button-primary text-xs font-bold text-white flex items-center gap-2 transition-all whitespace-nowrap shrink-0 cursor-pointer disabled:opacity-60"
          >
            {isLoadingQuestions ? (
              <>
                <Loader2 size={14} className="animate-spin" />
                <span>Preparing...</span>
              </>
            ) : (
              <>
                <Sparkles size={14} />
                <span>{popup.yes || 'Generate'}</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};

interface StudioQuestionsDialogProps {
  isOpen: boolean;
  questions: StudioQuestion[];
  recipe?: string | null;
  onSubmit: (answers: Record<string, string>) => void;
  onGenerateNow: (answers: Record<string, string>) => void;
  onCancel: () => void;
}

export const StudioQuestionsDialog: React.FC<StudioQuestionsDialogProps> = ({
  isOpen,
  questions,
  recipe,
  onSubmit,
  onGenerateNow,
  onCancel,
}) => {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [customTexts, setCustomTexts] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!isOpen) return;
    const defaults: Record<string, string> = {};
    for (const q of questions) {
      if (q.default) defaults[q.id] = q.default;
      else if (q.options?.[0]?.id) defaults[q.id] = q.options[0].id;
    }
    setAnswers(defaults);
    setCustomTexts({});
  }, [isOpen, questions]);

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onCancel();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, onCancel]);

  if (!isOpen) return null;

  const buildFinalAnswers = () => {
    const out: Record<string, string> = { ...answers };
    for (const q of questions) {
      const customVal = (customTexts[q.id] || '').trim();
      if (q.id === 'size' && out.size === 'custom' && customVal) {
        out.sizeCustom = customVal;
      } else if (q.id === 'text' && customVal) {
        out.text = customVal;
      } else if (q.allowCustomText && customVal && !out[q.id]) {
        out[q.id] = customVal;
      }
    }
    return out;
  };

  return (
    <div
      onClick={onCancel}
      className="fixed inset-0 z-[10010] bg-black/60 flex items-center justify-center p-4 animate-in fade-in duration-150"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        className="w-full max-w-lg max-h-[86vh] flex flex-col neu-glass rounded-3xl p-6 text-foreground shadow-2xl border border-border/20"
      >
        <div className="flex items-center justify-between gap-3 mb-4 shrink-0">
          <div className="min-w-0">
            <h3 className="text-base font-bold text-foreground truncate">
              Customize Design Details
            </h3>
            <p className="text-xs text-foreground/60 truncate">
              {recipe ? `Studio setup · ${recipe}` : 'Optional quick setup'}
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            className="w-8 h-8 rounded-full neu-raise flex items-center justify-center text-foreground/70 hover:text-foreground transition-colors shrink-0 cursor-pointer"
            aria-label="Cancel"
          >
            <X size={15} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto space-y-5 pr-1">
          {questions.map((q) => {
            const selected = answers[q.id];
            const needsSizeCustom = q.id === 'size' && selected === 'custom';
            const showCustomInput = Boolean(q.allowCustomText) || needsSizeCustom;

            return (
              <div key={q.id} className="space-y-2.5">
                <div className="text-xs font-semibold text-foreground/90">{q.question}</div>

                {q.options && q.options.length > 0 && (
                  <div className="flex flex-wrap gap-2">
                    {q.options.map((opt) => {
                      const isActive = selected === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => {
                            setAnswers((prev) => ({ ...prev, [q.id]: opt.id }));
                          }}
                          className={`h-9 px-3 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all whitespace-nowrap shrink-0 cursor-pointer ${
                            isActive
                              ? 'theme-button-primary text-white shadow-sm'
                              : 'neu-raise text-foreground/80 hover:text-foreground'
                          }`}
                        >
                          {isActive && <Check size={12} />}
                          <span>{opt.label}</span>
                        </button>
                      );
                    })}
                  </div>
                )}

                {showCustomInput && (
                  <input
                    type="text"
                    value={customTexts[q.id] || ''}
                    onChange={(e) => {
                      const v = e.target.value;
                      setCustomTexts((prev) => ({ ...prev, [q.id]: v }));
                      if (q.id === 'text' && v.trim()) {
                        setAnswers((prev) => ({ ...prev, text: v.trim() }));
                      }
                    }}
                    placeholder={
                      q.id === 'size'
                        ? 'Custom size e.g. 1200x628'
                        : 'Type custom text or leave smart default...'
                    }
                    className="w-full h-10 px-3.5 rounded-xl neu-sink bg-transparent text-xs text-foreground placeholder:text-foreground/45 focus:outline-none focus:ring-1 focus:ring-[var(--primary)]"
                  />
                )}
              </div>
            );
          })}
        </div>

        <div className="flex items-center justify-between gap-2 pt-5 mt-4 border-t border-border/15 shrink-0">
          <button
            type="button"
            onClick={() => onGenerateNow(buildFinalAnswers())}
            className="h-10 px-4 rounded-xl neu-raise text-xs font-semibold text-foreground/85 hover:text-foreground transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            Generate now
          </button>

          <button
            type="button"
            onClick={() => onSubmit(buildFinalAnswers())}
            className="h-10 px-5 rounded-xl theme-button-primary text-xs font-bold text-white flex items-center gap-1.5 transition-all whitespace-nowrap shrink-0 cursor-pointer"
          >
            <span>Generate</span>
            <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </div>
  );
};
