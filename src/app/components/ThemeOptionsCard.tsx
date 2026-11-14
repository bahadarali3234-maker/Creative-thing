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
      className="mt-3 rounded-[24px] sm:rounded-[28px] bg-white border border-zinc-200/90 shadow-[0_4px_20px_rgba(0,0,0,0.06)] p-3.5 sm:p-4 text-zinc-900"
      role="group"
      aria-label="Theme options"
    >
      <div className="flex items-center gap-2 px-1 pb-3">
        <div className="w-2.5 h-2.5 rounded-full bg-[#00a6ff] shadow-[0_0_8px_#00a6ff] animate-pulse" />
        <span className="font-mono text-xs sm:text-sm font-bold text-zinc-900 tracking-wide uppercase">
          Theme Options — Pick one to continue
        </span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {options.map((option) => {
          const isChosen = chosen === option.index;
          const isDisabled = disabled || (chosen !== null && !isChosen);
          const paletteColors = option.colors && option.colors.length >= 2
            ? option.colors
            : [
                { label: 'Primary', hex: '#00a6ff' },
                { label: 'Secondary', hex: '#2563eb' },
                { label: 'Accent', hex: '#f59e0b' },
                { label: 'Background', hex: '#09090b' },
                { label: 'Text', hex: '#ffffff' },
              ];

          return (
            <button
              key={option.index}
              type="button"
              disabled={isDisabled}
              onClick={() => choose(option)}
              className={`text-left rounded-2xl border p-3.5 transition-all cursor-pointer bg-white ${
                isChosen
                  ? 'border-[#00a6ff] ring-2 ring-[#00a6ff]/40 shadow-[0_0_16px_rgba(0,166,255,0.2)] scale-[1.01]'
                  : 'border-zinc-200/90 hover:border-[#00a6ff]/60 hover:shadow-md'
              } ${isDisabled ? 'opacity-50 cursor-not-allowed' : 'active:scale-[0.98]'}`}
              aria-label={`Choose theme option ${option.index}: ${option.name}`}
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm sm:text-base font-extrabold text-zinc-900 tracking-tight truncate">
                  Option {option.index} — {option.name}
                </span>
                {isChosen && (
                  <span className="w-6 h-6 shrink-0 rounded-full bg-[#00a6ff] flex items-center justify-center text-white shadow-sm">
                    <Check size={14} strokeWidth={2.5} />
                  </span>
                )}
              </div>

              {option.mood && (
                <div className="text-xs text-zinc-600 font-medium mt-1 truncate">{option.mood}</div>
              )}

              {/* Color Swatches Grid with vibrant circles and inline styles */}
              <div className="flex items-center gap-2 mt-3 flex-wrap">
                {paletteColors.map((color, cIdx) => (
                  <div key={cIdx} className="flex items-center gap-1 group/swatch">
                    <span
                      data-swatch="true"
                      className="theme-color-swatch w-6 h-6 rounded-full border border-black/20 shadow-sm inline-block shrink-0 transition-transform group-hover/swatch:scale-110"
                      style={{ backgroundColor: color.hex }}
                      title={`${color.label}: ${color.hex}`}
                    />
                  </div>
                ))}
                <span className="font-mono text-[11px] font-semibold text-zinc-600 ml-1 truncate">
                  {paletteColors.map((c) => c.hex).join(' ')}
                </span>
              </div>

              {(option.style || option.typography) && (
                <div className="text-[11px] font-semibold text-zinc-700 mt-2.5 truncate">
                  {option.style ? `Style: ${option.style}` : ''}
                  {option.style && option.typography ? ' • ' : ''}
                  {option.typography || ''}
                </div>
              )}

              {option.whyItFits && (
                <div className="text-[11px] text-zinc-500 mt-1 line-clamp-2 leading-relaxed">
                  {option.whyItFits}
                </div>
              )}
            </button>
          );
        })}
      </div>

      <div className="text-[11px] text-zinc-500 font-medium px-1 pt-3 flex items-center justify-between">
        <span>Tap a theme to continue — or type your own custom colors in the prompt box.</span>
      </div>
    </div>
  );
};
