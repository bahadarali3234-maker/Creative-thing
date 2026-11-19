import React, { useEffect, useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  FileDown,
  X,
  CheckCircle2,
  Code2,
  Sparkles,
  Loader2,
  BookOpenCheck,
  Palette,
  FileText,
} from 'lucide-react';
import {
  CATEGORY_LABELS,
  classifyExportContent,
  generateSmartPdfBlob,
  type McqAnswerMode,
  type PdfContentCategory,
  type PdfPageSize,
  type PdfTheme,
} from '../utils/pdfExportEngine';

export interface PdfExportModalProps {
  isOpen: boolean;
  initialTitle: string;
  rawMarkdown: string;
  structuredContent?: any;
  authorName?: string;
  onClose: () => void;
  onExported?: (filename: string, pageCount: number, categoryLabel: string) => void;
}

const MCQ_MODES: { value: McqAnswerMode; label: string; hint: string }[] = [
  { value: 'with_answers', label: 'Questions + Answers', hint: 'Highlights correct options cleanly inline' },
  { value: 'questions_only', label: 'Questions Only', hint: 'Clean student test / worksheet sheet' },
  { value: 'with_explanations', label: 'Answers + Explanations', hint: 'Includes step-by-step rationales inline' },
  { value: 'separate_answer_key', label: 'Separate Answer Key', hint: 'Adds a dedicated Answer Key page at the end' },
];

const THEME_OPTIONS: { value: PdfTheme; label: string; hint: string }[] = [
  { value: 'light', label: 'Think Creative Light', hint: 'Crisp white + candy blue accents' },
  { value: 'dark', label: 'Think Creative Dark', hint: 'Obsidian study dark theme' },
  { value: 'printer', label: 'Printer Friendly', hint: 'Ink-saving pure black & white' },
];

export const PdfExportModal: React.FC<PdfExportModalProps> = ({
  isOpen,
  initialTitle,
  rawMarkdown,
  structuredContent,
  authorName,
  onClose,
  onExported,
}) => {
  const classified = useMemo(
    () => classifyExportContent(rawMarkdown, structuredContent, initialTitle),
    [rawMarkdown, structuredContent, initialTitle]
  );

  const [title, setTitle] = useState(classified.title);
  const [categoryOverride, setCategoryOverride] = useState<PdfContentCategory | 'auto'>('auto');
  const [mcqAnswerMode, setMcqAnswerMode] = useState<McqAnswerMode>('with_answers');
  const [includeCode, setIncludeCode] = useState(false); // Strictly OFF by default per spec
  const [theme, setTheme] = useState<PdfTheme>('light');
  const [pageSize, setPageSize] = useState<PdfPageSize>('a4');
  const [exporting, setExporting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setTitle(classified.title || initialTitle || 'Think Creative Document');
    setCategoryOverride('auto');
    setMcqAnswerMode(classified.mcqs.some((m) => m.explanation) ? 'with_explanations' : 'with_answers');
    setIncludeCode(false);
    setErrorMsg(null);
  }, [isOpen, classified.title, initialTitle]);

  if (!isOpen) return null;

  const activeCategory: PdfContentCategory =
    categoryOverride === 'auto' ? classified.detectedCategory : categoryOverride;
  const showMcqControls =
    classified.mcqs.length > 0 || activeCategory === 'mcq' || activeCategory === 'mixed_educational';

  const handleDownload = async () => {
    setExporting(true);
    setErrorMsg(null);
    try {
      const result = generateSmartPdfBlob(classified, {
        title: title.trim() || classified.title,
        categoryOverride,
        mcqAnswerMode,
        includeCode,
        theme,
        pageSize,
        authorName,
      });

      const url = URL.createObjectURL(result.blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = result.filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 4000);

      onExported?.(result.filename, result.pageCount, CATEGORY_LABELS[result.resolvedCategory]);
      onClose();
    } catch (err: any) {
      setErrorMsg(err?.message || 'PDF generation failed.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <AnimatePresence>
      <div
        onClick={onClose}
        className="fixed inset-0 z-[20060] flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-md overflow-y-auto"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: 10 }}
          transition={{ duration: 0.2 }}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-[560px] max-h-[92vh] rounded-[24px] bg-[#0c1018] border border-[#00a6ff]/35 text-white shadow-[0_24px_80px_rgba(0,0,0,0.9)] flex flex-col overflow-hidden"
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-white/10 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-[#00a6ff]/15 border border-[#00a6ff]/40 flex items-center justify-center text-[#38bdf8]">
                <FileText size={20} />
              </div>
              <div>
                <h3 className="text-base font-bold tracking-tight">Smart PDF Export</h3>
                <p className="text-[11px] text-zinc-400">
                  Detected: <span className="text-[#38bdf8] font-semibold">{classified.categoryLabel}</span>
                  {classified.hasUnicodeScript ? ' · Unicode/RTL ready' : ''}
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-10 h-10 rounded-xl bg-white/5 hover:bg-white/15 border border-white/10 flex items-center justify-center text-zinc-300 hover:text-white cursor-pointer"
              aria-label="Close"
            >
              <X size={16} />
            </button>
          </div>

          {/* Body */}
          <div className="flex-1 overflow-y-auto p-5 space-y-4">
            {errorMsg && (
              <div className="p-3 rounded-xl bg-red-500/15 border border-red-500/35 text-xs text-red-200">
                {errorMsg}
              </div>
            )}

            {/* Live Content Stats (Plain typography, tabular-nums, zero pills) */}
            <div className="grid grid-cols-4 gap-2 p-3 rounded-xl bg-white/[0.03] border border-white/10 text-center">
              <div>
                <div className="text-sm font-bold text-white tabular-nums">{classified.stats.mcqCount}</div>
                <div className="text-[10px] text-zinc-400">MCQs</div>
              </div>
              <div>
                <div className="text-sm font-bold text-white tabular-nums">
                  {classified.stats.shortQaCount + classified.stats.longQaCount}
                </div>
                <div className="text-[10px] text-zinc-400">Q&amp;As</div>
              </div>
              <div>
                <div className="text-sm font-bold text-white tabular-nums">{classified.stats.wordCount}</div>
                <div className="text-[10px] text-zinc-400">Words</div>
              </div>
              <div>
                <div className="text-sm font-bold text-white tabular-nums">{classified.stats.codeBlockCount}</div>
                <div className="text-[10px] text-zinc-400">Code Blocks</div>
              </div>
            </div>

            {/* Title & Layout Classification */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                  Document Title
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="w-full h-10 px-3 rounded-xl bg-black/40 border border-white/15 text-xs text-white focus:outline-none focus:border-[#00a6ff]"
                />
              </div>

              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wider text-zinc-400 mb-1">
                  Document Layout
                </label>
                <select
                  value={categoryOverride}
                  onChange={(e) => setCategoryOverride(e.target.value as any)}
                  className="w-full h-10 px-3 rounded-xl bg-[#090d14] border border-white/15 text-xs text-white focus:outline-none focus:border-[#00a6ff]"
                >
                  <option value="auto">Auto ({classified.categoryLabel})</option>
                  {Object.entries(CATEGORY_LABELS).map(([k, label]) => (
                    <option key={k} value={k}>
                      {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* MCQ Answer Mode */}
            {showMcqControls && (
              <div className="space-y-2 p-3.5 rounded-xl bg-white/[0.03] border border-white/10">
                <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-[#38bdf8]">
                  <BookOpenCheck size={13} />
                  <span>MCQ Answer Mode</span>
                </div>
                <div className="grid grid-cols-2 gap-2">
                  {MCQ_MODES.map((m) => (
                    <button
                      key={m.value}
                      type="button"
                      onClick={() => setMcqAnswerMode(m.value)}
                      className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                        mcqAnswerMode === m.value
                          ? 'bg-[#00a6ff]/15 border-[#00a6ff] text-white'
                          : 'bg-black/30 border-white/10 text-zinc-300 hover:border-white/25'
                      }`}
                    >
                      <div className="text-xs font-bold">{m.label}</div>
                      <div className="text-[10px] text-zinc-400 mt-0.5 leading-snug">{m.hint}</div>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Theme & Page Size */}
            <div className="space-y-2.5 p-3.5 rounded-xl bg-white/[0.03] border border-white/10">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                <Palette size={13} />
                <span>Theme &amp; Paper Format</span>
              </div>
              <div className="grid grid-cols-3 gap-2">
                {THEME_OPTIONS.map((t) => (
                  <button
                    key={t.value}
                    type="button"
                    onClick={() => setTheme(t.value)}
                    className={`p-2.5 rounded-xl border text-left transition-all cursor-pointer ${
                      theme === t.value
                        ? 'bg-[#00a6ff]/15 border-[#00a6ff] text-white'
                        : 'bg-black/30 border-white/10 text-zinc-300 hover:border-white/25'
                    }`}
                  >
                    <div className="text-[11px] font-bold">{t.label}</div>
                    <div className="text-[10px] text-zinc-400 mt-0.5 leading-snug">{t.hint}</div>
                  </button>
                ))}
              </div>

              <div className="grid grid-cols-2 gap-2 pt-1">
                {(['a4', 'letter'] as PdfPageSize[]).map((sz) => (
                  <button
                    key={sz}
                    type="button"
                    onClick={() => setPageSize(sz)}
                    className={`h-10 rounded-xl border text-xs font-bold uppercase cursor-pointer transition-all ${
                      pageSize === sz
                        ? 'bg-[#00a6ff]/15 border-[#00a6ff] text-[#38bdf8]'
                        : 'bg-black/30 border-white/10 text-zinc-400 hover:text-white'
                    }`}
                  >
                    {sz === 'a4' ? 'A4 (210 × 297 mm)' : 'US Letter (8.5 × 11 in)'}
                  </button>
                ))}
              </div>
            </div>

            {/* Code Filtering Toggle (OFF by default) */}
            <div className="flex items-center justify-between gap-3 p-3.5 rounded-xl bg-white/[0.03] border border-white/10">
              <div className="flex items-start gap-2.5">
                <Code2 size={16} className="text-[#38bdf8] shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold text-white">Include Code Blocks</div>
                  <div className="text-[11px] text-zinc-400">
                    {classified.rawCodeBlockCount > 0
                      ? `Off by default — ${classified.rawCodeBlockCount} raw code block(s) will be omitted for cleaner reading`
                      : 'No raw code dumps detected in this response'}
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIncludeCode((v) => !v)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                  includeCode ? 'bg-[#00a6ff]' : 'bg-zinc-700'
                }`}
                role="switch"
                aria-checked={includeCode}
              >
                <span
                  className={`inline-block h-5 w-5 rounded-full bg-white transition-transform ${
                    includeCode ? 'translate-x-5' : 'translate-x-0'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Footer Actions */}
          <div className="px-5 py-4 border-t border-white/10 bg-black/40 flex items-center justify-between gap-2.5 shrink-0">
            <button
              type="button"
              onClick={onClose}
              className="h-10 px-4 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-zinc-300 cursor-pointer whitespace-nowrap"
            >
              Cancel
            </button>

            <button
              type="button"
              disabled={exporting}
              onClick={handleDownload}
              className="h-10 px-5 rounded-xl bg-[#00a6ff] hover:bg-[#0094e6] disabled:opacity-45 text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer shadow-[0_0_24px_rgba(0,166,255,0.4)] whitespace-nowrap"
            >
              {exporting ? (
                <>
                  <Loader2 size={14} className="animate-spin" />
                  <span>Building PDF...</span>
                </>
              ) : (
                <>
                  <FileDown size={14} />
                  <span>Download Smart PDF</span>
                </>
              )}
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
