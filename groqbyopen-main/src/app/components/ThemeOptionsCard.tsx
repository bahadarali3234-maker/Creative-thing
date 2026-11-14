import React from 'react';
import { Check } from 'lucide-react';
import type { ThemeOption } from '../utils/themeOptions';

/**
 * Interactive theme-option cards for the v2 website designer flow.
 * Renders the 4 palettes the AI proposed with real color swatches; clicking
 * one sends "I choose Option N" back into the conversation.
 */
export const ThemeOptionsCard: React.FC<{
  options: ThemeOption[];
  disabled?: boolean;
  onChoose?: (choice: string) => void;
}> = ({ options, disabled = false, onChoose }) => {
  const [chosen, setChosen] = React.useState<number | null>(null);

  const choose = (option: ThemeOption) => {
    if (disabled || chosen !== null) return;
    setChosen(option.index);
    onChoose?.(`I choose Option ${option.index} - ${option.name}`);
  };

  return (
    <div
      className="snippet-box mt-3 rounded-[24px] sm:rounded-[28px] bg-surface border border-border shadow-[var(--shadow-neumorphic-soft)] p-3 sm:p-4"
      role="group"
      aria-label="Theme options"
    >
      <div className="flex items-center gap-2 px-1 pb-2.5">
        <div className="w-2.5 h-2.5 rounded-full bg-[var(--primary)] shadow-[var(--shadow-neumorphic-soft)]" />
        <span className="font-mono text-xs sm:text-sm font-bold text-foreground tracking-wide">
          Theme Options — pick one to continue
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        {options.map((option) => {
          const isChosen = chosen === option.index;
          const isDisabled = disabled || (chosen !== null && !isChosen);
          return (
            <button
              key={option.index}
              type="button"
              disabled={isDisabled}
              onClick={() => choose(option)}
              className={`text-left rounded-2xl border p-3 transition-all cursor-pointer bg-surface ${
                isChosen
                  ? 'border-[var(--primary)] ring-2 ring-[var(--primary)]/40'
                  : 'border-border hover:border-[var(--primary)]/60 hover:shadow-[var(--shadow-neumorphic-soft)]'
              } ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'active:scale-[0.98]'}`}
              aria-label={`Choose theme option ${option.index}: ${option.name}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm sm:text-base font-extrabold text-foreground tracking-wide truncate">
                  Option {option.index} — {option.name}
                </span>
                {isChosen && (
                  <span className="w-6 h-6 shrink-0 rounded-full bg-[var(--primary)] flex items-center justify-center">
                    <Check size={14} className="text-foreground" />
                  </span>
                )}
              </div>

              {option.mood && (
                <div className="text-xs text-foreground mt-0.5 truncate">{option.mood}</div>
              )}

              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                {option.colors.map((color) => (
                  <span key={color.hex + color.label} className="inline-flex items-center gap-1">
                    <span
                      className="w-5 h-5 rounded-full border border-border shadow-sm inline-block"
                      style={{ backgroundColor: color.hex }}
                      title={`${color.label} ${color.hex}`}
                    />
                  </span>
                ))}
                <span className="font-mono text-[10px] text-foreground ml-0.5 truncate max-w-[120px]">
                  {option.colors.map((c) => c.hex).join(' ')}
                </span>
              </div>

              {(option.style || option.typography) && (
                <div className="text-[11px] font-semibold text-foreground mt-2 truncate">
                  {option.style ? `Style: ${option.style}` : ''}
                  {option.style && option.typography ? ' • ' : ''}
                  {option.typography || ''}
                </div>
              )}

              {option.whyItFits && (
                <div className="text-[11px] text-foreground mt-1 line-clamp-2">{option.whyItFits}</div>
              )}
            </button>
          );
        })}
      </div>

      <div className="text-[11px] text-foreground px-1 pt-2.5">
        Tap a theme to continue — or type your own colors in the prompt box.
      </div>
    </div>
  );
};
