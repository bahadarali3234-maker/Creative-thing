import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  CheckCircle2,
  Send,
  Sparkles,
  Edit3,
  Sliders,
  ChevronRight,
  Zap,
  Check,
} from 'lucide-react';
import { QuestionBlock } from '../types';
import {
  matchTemplateConcept,
  matchPaletteCard,
  detectCatalogKind,
  type TemplateConcept,
  type PaletteCard,
} from '../utils/designCatalog';

export interface InteractiveQuestionBoxProps {
  question: QuestionBlock;
  onAnswer: (answer: string) => void;
  disabled?: boolean;
}

/* ---------------- Template mini-mockup (CSS-rendered design preview) ---------------- */
const TemplateMockup: React.FC<{ concept: TemplateConcept }> = ({ concept }) => {
  const m = concept.mock;
  const soft = concept.glass ? 'rgba(255,255,255,0.10)' : m.surface;
  return (
    <div
      className="relative w-full rounded-xl overflow-hidden border border-black/10 shadow-sm"
      style={{ background: m.bg, aspectRatio: '16 / 10' }}
      aria-hidden="true"
    >
      {/* Nav bar */}
      <div className="flex items-center justify-between px-2.5 pt-2">
        <div className="flex items-center gap-1.5">
          <span className="w-2.5 h-2.5 rounded-full" style={{ background: m.accent }} />
          <span className="h-1.5 w-8 rounded-full" style={{ background: m.text, opacity: 0.85 }} />
        </div>
        <div className="flex items-center gap-1.5">
          <span className="h-1 w-5 rounded-full" style={{ background: m.muted }} />
          <span className="h-1 w-5 rounded-full" style={{ background: m.muted }} />
          <span className="h-3 w-7 rounded-full" style={{ background: m.accent }} />
        </div>
      </div>
      {/* Hero */}
      <div className="px-2.5 pt-3" style={{ textAlign: concept.serif ? 'left' : 'center' }}>
        <div
          className="h-2 rounded-full mb-1.5"
          style={{
            width: concept.serif ? '80%' : '60%',
            marginInline: concept.serif ? undefined : 'auto',
            background: `linear-gradient(90deg, ${m.text}, ${m.text}88)`,
          }}
        />
        <div
          className="h-2 rounded-full mb-2"
          style={{
            width: concept.serif ? '55%' : '40%',
            marginInline: concept.serif ? undefined : 'auto',
            background: m.accent,
          }}
        />
        <div className="flex gap-1.5" style={{ justifyContent: concept.serif ? 'flex-start' : 'center' }}>
          <span className="h-3.5 w-12 rounded-full" style={{ background: m.accent }} />
          <span className="h-3.5 w-12 rounded-full border" style={{ borderColor: m.muted }} />
        </div>
      </div>
      {/* Cards row */}
      <div className={`px-2.5 pt-3 grid gap-1.5 ${concept.serif ? 'grid-cols-2' : 'grid-cols-3'}`}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="rounded-lg p-1.5"
            style={{
              background: soft,
              border: concept.glass ? '1px solid rgba(255,255,255,0.18)' : '1px solid rgba(0,0,0,0.05)',
              boxShadow: concept.glow ? `0 0 8px ${m.accent}55` : undefined,
            }}
          >
            <span
              className="block w-3.5 h-3.5 rounded-md mb-1"
              style={{ background: m.accent, opacity: 0.9 }}
            />
            <span className="block h-1 w-full rounded-full mb-0.5" style={{ background: m.text, opacity: 0.7 }} />
            <span className="block h-1 w-2/3 rounded-full" style={{ background: m.muted }} />
          </div>
        ))}
      </div>
      {concept.glow && (
        <div
          className="absolute inset-x-0 bottom-0 h-6"
          style={{ background: `radial-gradient(60% 100% at 50% 100%, ${m.accent}33, transparent)` }}
        />
      )}
    </div>
  );
};

/* ---------------- Palette card (Figma reference style) ---------------- */
const PaletteCardView: React.FC<{ palette: PaletteCard }> = ({ palette }) => (
  <div className="w-full rounded-xl border border-black/10 bg-white p-3 shadow-sm">
    <div className="flex items-baseline justify-between mb-2">
      <span className="text-sm font-black text-foreground tracking-tight">{palette.name}</span>
      <span
        className="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border"
        style={
          palette.mode === 'dark'
            ? { background: '#10111B', color: '#EDE9FE', borderColor: '#10111B' }
            : { background: '#F0F7FF', color: '#172554', borderColor: '#BFDBFE' }
        }
      >
        {palette.mode} mode
      </span>
    </div>
    <p className="text-[11px] text-muted-foreground leading-relaxed mb-2">{palette.tagline}</p>
    <div className="flex flex-wrap gap-1 mb-2">
      {palette.tags.map((t) => (
        <span key={t} className="text-[9px] font-semibold text-muted-foreground px-2 py-0.5 rounded-full bg-surface border border-border">
          {t}
        </span>
      ))}
    </div>
    {/* Colour breakdown */}
    <div className="grid grid-cols-5 gap-1.5 mb-1.5">
      {palette.swatches.map((s, i) => (
        <div key={i} className="space-y-1">
          <div
            className="w-full rounded-lg border border-black/10 flex items-end justify-start p-1"
            style={{ background: s.hex, aspectRatio: '1 / 1', boxShadow: 'inset 0 1px 2px rgba(255,255,255,0.25)' }}
          >
            <span
              className="w-3.5 h-3.5 rounded-full bg-white/90 text-[8px] font-bold flex items-center justify-center"
              style={{ color: '#111' }}
            >
              {i + 1}
            </span>
          </div>
          <span className="block text-[9px] font-mono font-semibold text-foreground leading-none">{s.hex}</span>
          <span className="block text-[8px] text-muted-foreground leading-none">{s.role}</span>
        </div>
      ))}
    </div>
  </div>
);

export const InteractiveQuestionBox: React.FC<InteractiveQuestionBoxProps> = ({
  question,
  onAnswer,
  disabled = false,
}) => {
  const [selected, setSelected] = useState<string>(question.selectedOption || '');
  const [isCustomMode, setIsCustomMode] = useState<boolean>(false);
  const [customText, setCustomText] = useState<string>(question.customAnswer || '');
  const [hasSubmitted, setHasSubmitted] = useState<boolean>(Boolean(question.isAnswered));

  const optionsList = question.options && question.options.length > 0
    ? question.options
    : ['Template 01 — Modern Minimal', 'Template 02 — Premium Glassmorphism', 'Template 03 — Editorial Creative', 'Template 04 — Futuristic Advanced'];

  const catalogKind = detectCatalogKind(optionsList);

  const handleSelectOption = (opt: string) => {
    if (disabled || hasSubmitted) return;
    setSelected(opt);
    setIsCustomMode(false);
  };

  const handleConfirmOption = (optToConfirm?: string) => {
    const choice = optToConfirm || selected;
    if (!choice.trim() || disabled) return;
    setSelected(choice);
    setHasSubmitted(true);
    onAnswer(choice.trim());
  };

  const handleCustomSubmit = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!customText.trim() || disabled) return;
    const choice = `Custom: ${customText.trim()}`;
    setSelected(choice);
    setHasSubmitted(true);
    onAnswer(choice);
  };

  const handleSmartDefault = () => {
    if (disabled) return;
    const defaultChoice = 'You Decide (Use Intelligent Defaults)';
    setSelected(defaultChoice);
    setHasSubmitted(true);
    onAnswer(defaultChoice);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 14, scale: 0.99 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
      className="my-4 rounded-[26px] sm:rounded-[30px] bg-surface border border-border shadow-[var(--shadow-neumorphic)] p-5 sm:p-6 relative overflow-hidden text-foreground select-none group"
    >
      {/* Accent top line */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent opacity-70" />

      {/* Top Header Badge */}
      <div className="flex items-center justify-between gap-3 mb-3.5">
        <div className="flex items-center gap-2 px-3 py-1 rounded-full bg-surface-soft border border-border text-primary text-xs font-semibold tracking-wider uppercase">
          <Sparkles size={12} />
          <span>Design Direction</span>
        </div>

        {hasSubmitted ? (
          <div className="flex items-center gap-1.5 text-xs text-emerald-600 font-medium px-2.5 py-0.5 rounded-full bg-emerald-500/10 border border-emerald-500/30">
            <CheckCircle2 size={13} />
            <span>Answered</span>
          </div>
        ) : (
          <span className="text-[11px] text-muted-foreground font-mono">Decision required</span>
        )}
      </div>

      {/* Question Title */}
      <div className="space-y-1 mb-4">
        <h3 className="text-lg sm:text-xl font-black text-foreground tracking-tight leading-snug">
          {question.title}
        </h3>
        {question.description && (
          <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">{question.description}</p>
        )}
      </div>

      {/* Answered State Summary View */}
      {hasSubmitted ? (
        <div className="rounded-2xl bg-surface-soft border border-border p-3.5 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="w-7 h-7 rounded-full bg-primary/15 border border-primary/40 text-primary flex items-center justify-center shrink-0">
              <CheckCircle2 size={15} />
            </div>
            <div className="min-w-0">
              <span className="text-xs text-muted-foreground block font-mono">Selected</span>
              <span className="text-sm font-semibold text-foreground tracking-wide truncate">{selected}</span>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setHasSubmitted(false)}
            className="text-xs text-muted-foreground hover:text-foreground px-2.5 py-1.5 rounded-lg bg-white hover:bg-surface-soft border border-border transition-colors flex items-center gap-1.5 cursor-pointer shrink-0"
          >
            <Edit3 size={12} />
            <span>Change</span>
          </button>
        </div>
      ) : (
        /* Interactive Question Form */
        <div className="space-y-3.5">
          {/* Visual catalog grids */}
          {catalogKind === 'template' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {optionsList.map((opt) => {
                const concept = matchTemplateConcept(opt);
                if (!concept) return null;
                const isSelected = selected === opt && !isCustomMode;
                return (
                  <button
                    key={opt}
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      handleSelectOption(opt);
                      handleConfirmOption(opt);
                    }}
                    className={`w-full text-left rounded-2xl border p-3 transition-all duration-200 cursor-pointer active:scale-[0.98] ${
                      isSelected
                        ? 'border-primary bg-surface-soft shadow-[0_0_0_2px_var(--primary)]'
                        : 'border-border bg-white hover:border-primary/50'
                    }`}
                  >
                    <TemplateMockup concept={concept} />
                    <div className="mt-2.5 flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-foreground tracking-tight">{concept.name}</p>
                        <p className="text-[11px] text-muted-foreground leading-snug mt-0.5">{concept.description}</p>
                      </div>
                      <span
                        className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                          isSelected ? 'border-primary bg-primary text-white' : 'border-black/25 bg-transparent'
                        }`}
                      >
                        {isSelected && <span className="w-2 h-2 rounded-full bg-white" />}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {catalogKind === 'palette' && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {optionsList.map((opt) => {
                const palette = matchPaletteCard(opt);
                if (!palette) return null;
                const isSelected = selected === opt && !isCustomMode;
                return (
                  <button
                    key={opt}
                    type="button"
                    disabled={disabled}
                    onClick={() => {
                      handleSelectOption(opt);
                      handleConfirmOption(opt);
                    }}
                    className={`w-full text-left rounded-2xl border p-1.5 transition-all duration-200 cursor-pointer active:scale-[0.98] ${
                      isSelected
                        ? 'border-primary shadow-[0_0_0_2px_var(--primary)]'
                        : 'border-border hover:border-primary/50'
                    }`}
                  >
                    <PaletteCardView palette={palette} />
                    <div className="flex items-center justify-between gap-2 px-2 pt-1.5 pb-1">
                      <span className="text-[11px] text-muted-foreground">{opt}</span>
                      <span
                        className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                          isSelected ? 'border-primary bg-primary text-white' : 'border-black/25 bg-transparent'
                        }`}
                      >
                        {isSelected && <Check size={11} className="text-white" />}
                      </span>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          {/* Plain text options (non-catalog questions) */}
          {catalogKind === null && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {optionsList.map((opt, idx) => {
                const isSelected = selected === opt && !isCustomMode;
                return (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => {
                      handleSelectOption(opt);
                      handleConfirmOption(opt);
                    }}
                    className={`w-full text-left p-3.5 rounded-2xl border transition-all duration-200 flex items-center justify-between gap-3 cursor-pointer group/opt active:scale-[0.98] ${
                      isSelected
                        ? 'bg-surface-soft border-primary text-foreground font-semibold'
                        : 'bg-white hover:bg-surface-soft/60 border-border hover:border-primary/40 text-foreground'
                    }`}
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <span
                        className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 transition-colors ${
                          isSelected ? 'border-primary bg-primary text-white' : 'border-black/25 bg-transparent'
                        }`}
                      >
                        {isSelected && <span className="w-2 h-2 rounded-full bg-white" />}
                      </span>
                      <span className="text-sm tracking-wide leading-tight">{opt}</span>
                    </div>
                    <ChevronRight
                      size={15}
                      className={`shrink-0 transition-transform ${isSelected ? 'text-primary translate-x-0.5' : 'text-muted-foreground'}`}
                    />
                  </button>
                );
              })}
            </div>
          )}

          {/* Custom Option Button */}
          <button
            type="button"
            onClick={() => {
              setIsCustomMode(true);
              setSelected('Custom');
            }}
            className={`w-full text-left p-3.5 rounded-2xl border transition-all duration-200 flex items-center justify-between gap-3 cursor-pointer active:scale-[0.98] ${
              isCustomMode
                ? 'bg-surface-soft border-primary text-foreground font-semibold'
                : 'bg-white hover:bg-surface-soft/60 border-border hover:border-primary/40 text-foreground'
            }`}
          >
            <div className="flex items-center gap-3">
              <span
                className={`w-5 h-5 rounded-full border flex items-center justify-center shrink-0 ${
                  isCustomMode ? 'border-primary bg-primary text-white' : 'border-black/25 bg-transparent'
                }`}
              >
                {isCustomMode ? <span className="w-2 h-2 rounded-full bg-white" /> : <Sliders size={11} className="text-muted-foreground" />}
              </span>
              <span className="text-sm tracking-wide leading-tight">Custom…</span>
            </div>
            <Edit3 size={14} className={isCustomMode ? 'text-primary' : 'text-muted-foreground'} />
          </button>

          {/* Custom Input Field Drawer */}
          <AnimatePresence>
            {isCustomMode && (
              <motion.form
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                onSubmit={handleCustomSubmit}
                className="overflow-hidden pt-1"
              >
                <div className="p-3 rounded-2xl bg-white border border-border flex items-center gap-2">
                  <input
                    type="text"
                    autoFocus
                    placeholder="Enter your custom design requirement or style…"
                    value={customText}
                    onChange={(e) => setCustomText(e.target.value)}
                    className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none px-2 tracking-wide"
                  />
                  <button
                    type="submit"
                    disabled={!customText.trim()}
                    className="px-4 py-2 rounded-xl bg-primary disabled:opacity-40 text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer active:scale-95 shrink-0"
                  >
                    <span>Submit</span>
                    <Send size={12} />
                  </button>
                </div>
              </motion.form>
            )}
          </AnimatePresence>

          {/* Bottom Fast Action: "You Decide (Use Intelligent Defaults)" */}
          <div className="flex items-center justify-between pt-1 text-xs">
            <span className="text-[11px] text-muted-foreground">Not sure yet?</span>
            <button
              type="button"
              onClick={handleSmartDefault}
              className="flex items-center gap-1.5 text-foreground hover:text-primary px-3 py-1.5 rounded-full bg-white hover:bg-surface-soft border border-border transition-colors cursor-pointer active:scale-95"
            >
              <Zap size={12} className="text-amber-500" />
              <span>You Decide (Use Intelligent Defaults)</span>
            </button>
          </div>
        </div>
      )}
    </motion.div>
  );
};
