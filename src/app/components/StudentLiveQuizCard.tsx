import React, { useState } from 'react';
import {
  CheckCircle2,
  XCircle,
  HelpCircle,
  Download,
  FileText,
  RotateCcw,
  ChevronRight,
  Sparkles,
  Award,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { Button } from '@/components/ui/button';
import {
  StudentStudyPackage,
  checkSpellingAgainstExpected,
  generatePdfDocumentHtml,
  SpellCheckToken,
} from '../utils/studentQuizParser';

export interface StudentLiveQuizCardProps {
  studyPackage: StudentStudyPackage;
  onFinish?: (score: number, total: number) => void;
}

export const StudentLiveQuizCard: React.FC<StudentLiveQuizCardProps> = ({
  studyPackage,
  onFinish,
}) => {
  const [activeTab, setActiveTab] = useState<'mcq' | 'quiz'>('mcq');
  const [currentMcqIndex, setCurrentMcqIndex] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState<Record<number, number>>({});
  const [showExplanations, setShowExplanations] = useState<Record<number, boolean>>({});

  // Quiz / Fill in blank state
  const [currentQuizIndex, setCurrentQuizIndex] = useState(0);
  const [typedAnswers, setTypedAnswers] = useState<Record<number, string>>({});
  const [quizResults, setQuizResults] = useState<
    Record<number, { tokens: SpellCheckToken[]; hasSpellingError: boolean; accuracyScore: number; verified: boolean }>
  >({});

  const hasMcqs = studyPackage.mcqs && studyPackage.mcqs.length > 0;
  const hasQuizzes = studyPackage.quizzes && studyPackage.quizzes.length > 0;

  const currentMcq = hasMcqs ? studyPackage.mcqs[currentMcqIndex] : null;
  const currentQuiz = hasQuizzes ? studyPackage.quizzes[currentQuizIndex] : null;

  // Handle MCQ Selection
  const handleSelectOption = (optIdx: number) => {
    if (!currentMcq) return;
    if (selectedOptions[currentMcqIndex] !== undefined) return; // already answered

    setSelectedOptions((prev) => ({ ...prev, [currentMcqIndex]: optIdx }));
    setShowExplanations((prev) => ({ ...prev, [currentMcqIndex]: true }));

    // Haptic vibration feedback
    if (typeof window !== 'undefined' && 'vibrate' in navigator) {
      if (optIdx === currentMcq.correctIndex) {
        navigator.vibrate?.([40, 30, 40]);
      } else {
        navigator.vibrate?.([90]);
      }
    }
  };

  // Handle Quiz Input Submit
  const handleVerifyQuiz = () => {
    if (!currentQuiz) return;
    const userText = typedAnswers[currentQuizIndex] || '';
    if (!userText.trim()) return;

    const check = checkSpellingAgainstExpected(userText, currentQuiz.expectedAnswer);
    const verified = check.accuracyScore >= 50 && !check.hasSpellingError;

    setQuizResults((prev) => ({
      ...prev,
      [currentQuizIndex]: {
        tokens: check.tokens,
        hasSpellingError: check.hasSpellingError,
        accuracyScore: check.accuracyScore,
        verified,
      },
    }));
  };

  // PDF Download Trigger
  const handleDownloadPdf = (isSolved: boolean) => {
    const html = generatePdfDocumentHtml(studyPackage, isSolved);
    const win = window.open('', '_blank');
    if (win) {
      win.document.write(html);
      win.document.close();
      // Auto-trigger print to save as PDF
      setTimeout(() => {
        try {
          win.print();
        } catch {}
      }, 500);
    }
  };

  // Score calculation
  const totalAnsweredMcqs = Object.keys(selectedOptions).length;
  const correctMcqs = Object.entries(selectedOptions).filter(
    ([idx, optIdx]) => studyPackage.mcqs[parseInt(idx, 10)]?.correctIndex === optIdx
  ).length;

  return (
    <div className="my-4 rounded-3xl border border-[#00a6ff]/35 bg-gradient-to-br from-white via-slate-50 to-blue-50/20 dark:from-[#0d101d] dark:via-[#090b14] dark:to-[#0f172a] shadow-xl overflow-hidden select-none">
      {/* Header Bar */}
      <div className="flex items-center justify-between px-5 sm:px-6 py-4 border-b border-border bg-surface/80 backdrop-blur-md">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#00a6ff] to-blue-600 text-white flex items-center justify-center shadow-md">
            <Sparkles size={18} />
          </div>
          <div>
            <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-[#00a6ff]">
              Student Exam &amp; Quiz Suite
            </span>
            <h3 className="text-sm sm:text-base font-bold text-foreground">
              {studyPackage.title}
            </h3>
          </div>
        </div>

        {/* Download PDF Buttons */}
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => handleDownloadPdf(false)}
            className="rounded-xl text-xs font-semibold flex items-center gap-1.5 border-border hover:border-primary cursor-pointer active:scale-95"
            title="Download blank test question paper"
          >
            <Download size={13} />
            <span className="hidden sm:inline">Unsolved PDF</span>
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={() => handleDownloadPdf(true)}
            className="rounded-xl text-xs font-semibold bg-[#00a6ff] hover:bg-[#0092e0] text-white flex items-center gap-1.5 shadow-sm cursor-pointer active:scale-95"
            title="Download test with full answer key & solutions"
          >
            <FileText size={13} />
            <span className="hidden sm:inline">Solved PDF</span>
          </Button>
        </div>
      </div>

      {/* Mode Tabs */}
      <div className="flex items-center gap-2 px-5 sm:px-6 pt-3 pb-1 border-b border-border/60">
        {hasMcqs && (
          <button
            type="button"
            onClick={() => setActiveTab('mcq')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'mcq'
                ? 'bg-[#00a6ff] text-white shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Live MCQs ({studyPackage.mcqs.length})
          </button>
        )}

        {hasQuizzes && (
          <button
            type="button"
            onClick={() => setActiveTab('quiz')}
            className={`px-4 py-2 rounded-xl text-xs font-bold transition-all cursor-pointer ${
              activeTab === 'quiz'
                ? 'bg-[#00a6ff] text-white shadow-sm'
                : 'text-muted-foreground hover:text-foreground'
            }`}
          >
            Short Questions &amp; Quiz ({studyPackage.quizzes.length})
          </button>
        )}
      </div>

      {/* Main Interactive Solving Body */}
      <div className="p-5 sm:p-7">
        {/* ============================================================== */}
        {/* 1. LIVE MCQ SOLVING TAB                                        */}
        {/* ============================================================== */}
        {activeTab === 'mcq' && currentMcq && (
          <div className="space-y-5">
            {/* Question Header & Score Pill */}
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-[#00a6ff] font-mono">
                QUESTION {currentMcqIndex + 1} OF {studyPackage.mcqs.length}
              </span>
              <div className="flex items-center gap-1.5 px-3 py-1 rounded-full bg-surface border border-border text-xs font-semibold text-foreground">
                <Award size={13} className="text-amber-500" />
                <span>
                  Score: {correctMcqs} / {studyPackage.mcqs.length}
                </span>
              </div>
            </div>

            {/* Question Text */}
            <h4 className="text-base sm:text-lg font-bold text-foreground leading-snug">
              {currentMcq.question}
            </h4>

            {/* Options Grid (A, B, C, D) - Immediate Red/Green Feedback */}
            <div className="grid grid-cols-1 gap-2.5">
              {currentMcq.options.map((opt, optIdx) => {
                const isSelected = selectedOptions[currentMcqIndex] === optIdx;
                const isAnswered = selectedOptions[currentMcqIndex] !== undefined;
                const isCorrect = optIdx === currentMcq.correctIndex;

                let stateClasses = 'bg-surface hover:border-[#00a6ff]/60 border-border text-foreground';

                if (isAnswered) {
                  if (isSelected && isCorrect) {
                    // Correct click -> Green
                    stateClasses = 'bg-emerald-500/15 border-emerald-500 text-emerald-600 dark:text-emerald-400 font-bold ring-2 ring-emerald-500/30';
                  } else if (isSelected && !isCorrect) {
                    // Wrong click -> Red
                    stateClasses = 'bg-red-500/15 border-red-500 text-red-600 dark:text-red-400 font-bold ring-2 ring-red-500/30';
                  } else if (isCorrect) {
                    // Reveal true correct -> Green
                    stateClasses = 'bg-emerald-500/10 border-emerald-500/70 text-emerald-600 dark:text-emerald-400 font-semibold';
                  } else {
                    stateClasses = 'opacity-40 border-border text-muted-foreground';
                  }
                }

                return (
                  <button
                    key={optIdx}
                    type="button"
                    disabled={isAnswered}
                    onClick={() => handleSelectOption(optIdx)}
                    className={`p-3.5 sm:p-4 rounded-2xl border text-left flex items-center justify-between transition-all cursor-pointer active:scale-[0.99] ${stateClasses}`}
                  >
                    <div className="flex items-center gap-3">
                      <span className="w-7 h-7 rounded-lg bg-black/5 dark:bg-white/10 flex items-center justify-center text-xs font-mono font-bold shrink-0">
                        {String.fromCharCode(65 + optIdx)}
                      </span>
                      <span className="text-xs sm:text-sm leading-relaxed">{opt}</span>
                    </div>

                    {isAnswered && (
                      <div className="shrink-0 pl-2">
                        {isCorrect ? (
                          <CheckCircle2 size={18} className="text-emerald-500" />
                        ) : isSelected ? (
                          <XCircle size={18} className="text-red-500" />
                        ) : null}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>

            {/* Explanation / Progression */}
            <AnimatePresence>
              {showExplanations[currentMcqIndex] && (
                <motion.div
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="p-4 rounded-2xl bg-surface border border-border text-xs leading-relaxed space-y-2"
                >
                  <div className="flex items-center gap-1.5 font-bold text-foreground">
                    <HelpCircle size={14} className="text-[#00a6ff]" />
                    <span>Explanation &amp; Solution:</span>
                  </div>
                  <p className="text-muted-foreground">
                    {currentMcq.explanation ||
                      `Option (${String.fromCharCode(65 + currentMcq.correctIndex)}) is correct for "${currentMcq.question}".`}
                  </p>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Footer Navigation */}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                disabled={currentMcqIndex === 0}
                onClick={() => setCurrentMcqIndex((prev) => Math.max(0, prev - 1))}
                className="text-xs font-semibold text-muted-foreground hover:text-foreground disabled:opacity-30 cursor-pointer"
              >
                ← Previous
              </button>

              {currentMcqIndex < studyPackage.mcqs.length - 1 ? (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setCurrentMcqIndex((prev) => prev + 1)}
                  className="rounded-xl text-xs font-bold bg-[#00a6ff] hover:bg-[#0092e0] text-white flex items-center gap-1 cursor-pointer"
                >
                  <span>Next Question</span>
                  <ChevronRight size={14} />
                </Button>
              ) : (
                <div className="text-xs font-bold text-emerald-600 dark:text-emerald-400">
                  ✓ All {studyPackage.mcqs.length} MCQs Completed!
                </div>
              )}
            </div>
          </div>
        )}

        {/* ============================================================== */}
        {/* 2. SHORT QUESTION & SPELLCHECK QUIZ TAB                         */}
        {/* ============================================================== */}
        {activeTab === 'quiz' && currentQuiz && (
          <div className="space-y-5">
            <span className="text-xs font-bold text-[#00a6ff] font-mono">
              QUESTION {currentQuizIndex + 1} OF {studyPackage.quizzes.length}
            </span>

            <h4 className="text-base sm:text-lg font-bold text-foreground leading-snug">
              {currentQuiz.question}
            </h4>

            {/* User Typing Blank Input */}
            <div className="space-y-2">
              <label className="text-xs font-semibold text-muted-foreground">
                Write your answer (we will check your spelling and accuracy in real-time):
              </label>
              <textarea
                rows={3}
                placeholder="Type your answer here..."
                value={typedAnswers[currentQuizIndex] || ''}
                onChange={(e) =>
                  setTypedAnswers((prev) => ({ ...prev, [currentQuizIndex]: e.target.value }))
                }
                className="w-full p-3.5 rounded-2xl bg-surface border border-border text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-[#00a6ff]/40 resize-none"
              />
            </div>

            {/* Verify Button */}
            <div className="flex items-center gap-3">
              <Button
                type="button"
                onClick={handleVerifyQuiz}
                disabled={!(typedAnswers[currentQuizIndex] || '').trim()}
                className="rounded-xl px-4 py-2 bg-[#00a6ff] hover:bg-[#0092e0] text-white text-xs font-bold cursor-pointer active:scale-95"
              >
                Verify &amp; Check Spelling
              </Button>
            </div>

            {/* Spellcheck & Accuracy Analysis Result */}
            {quizResults[currentQuizIndex] && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className="p-4 rounded-2xl bg-surface border border-border space-y-3"
              >
                {/* Token analysis with red wavy underlines on misspelled words */}
                <div>
                  <span className="text-xs font-bold text-foreground block mb-1">
                    Your Response Analysis:
                  </span>
                  <div className="text-sm leading-relaxed p-3 rounded-xl bg-black/5 dark:bg-white/5 border border-border">
                    {quizResults[currentQuizIndex].tokens.map((t, tIdx) => {
                      if (t.isMisspelled) {
                        return (
                          <span
                            key={tIdx}
                            className="text-red-500 underline decoration-wavy decoration-red-500 font-bold mx-0.5 cursor-help"
                            title={`Spelling suggestion: "${t.suggestedCorrection}"`}
                          >
                            {t.word} ({t.suggestedCorrection})
                          </span>
                        );
                      }
                      return <span key={tIdx} className="mx-0.5">{t.word}</span>;
                    })}
                  </div>
                </div>

                {/* Validation Status */}
                {quizResults[currentQuizIndex].verified ? (
                  <div className="flex items-center gap-2 text-emerald-600 dark:text-emerald-400 text-xs font-bold">
                    <CheckCircle2 size={16} />
                    <span>Verified! Your explanation matches the target concept.</span>
                  </div>
                ) : (
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 text-amber-500 text-xs font-bold">
                      <HelpCircle size={16} />
                      <span>
                        Accuracy: {quizResults[currentQuizIndex].accuracyScore}%.
                        {quizResults[currentQuizIndex].hasSpellingError &&
                          ' Please note spelling corrections highlighted above.'}
                      </span>
                    </div>
                    <div className="text-xs text-muted-foreground pt-1">
                      <strong>Expected Answer:</strong> {currentQuiz.expectedAnswer}
                    </div>
                  </div>
                )}
              </motion.div>
            )}

            {/* Navigation */}
            <div className="flex items-center justify-between pt-2">
              <button
                type="button"
                disabled={currentQuizIndex === 0}
                onClick={() => setCurrentQuizIndex((prev) => Math.max(0, prev - 1))}
                className="text-xs font-semibold text-muted-foreground hover:text-foreground disabled:opacity-30 cursor-pointer"
              >
                ← Previous
              </button>

              {currentQuizIndex < studyPackage.quizzes.length - 1 && (
                <Button
                  type="button"
                  size="sm"
                  onClick={() => setCurrentQuizIndex((prev) => prev + 1)}
                  className="rounded-xl text-xs font-bold bg-[#00a6ff] hover:bg-[#0092e0] text-white flex items-center gap-1 cursor-pointer"
                >
                  <span>Next Question</span>
                  <ChevronRight size={14} />
                </Button>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
