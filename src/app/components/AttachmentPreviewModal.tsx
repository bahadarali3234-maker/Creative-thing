import React, { useState, useEffect } from 'react';
import {
  X,
  Download,
  Copy,
  Check,
  Eye,
  Code,
  ExternalLink,
  RotateCcw,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import type { AttachedFile } from '../types';

export interface AttachmentPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  file: AttachedFile | null;
  onRemove?: (id: string) => void;
}

export const AttachmentPreviewModal: React.FC<AttachmentPreviewModalProps> = ({
  isOpen,
  onClose,
  file,
}) => {
  const [copied, setCopied] = useState(false);
  const [viewMode, setViewMode] = useState<'preview' | 'code'>('preview');
  const [iframeKey, setIframeKey] = useState(0);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  // Reset viewMode when file changes
  useEffect(() => {
    if (file) {
      const isHtml =
        file.name.toLowerCase().endsWith('.html') ||
        file.name.toLowerCase().endsWith('.htm') ||
        file.type === 'text/html' ||
        Boolean(file.codeContent && (file.codeContent.includes('<!doctype') || file.codeContent.includes('<html')));

      setViewMode(isHtml ? 'preview' : 'code');
      setIframeKey((k) => k + 1);
    }
  }, [file]);

  if (!isOpen || !file) return null;

  const isImg = file.isImage || file.type?.startsWith('image/');
  const isVideo = file.type?.startsWith('video/') || /\.(mp4|webm|mov|ogg)$/i.test(file.name);
  const isAudio = file.type?.startsWith('audio/') || /\.(mp3|wav|ogg|m4a|aac)$/i.test(file.name);
  const isCode =
    Boolean(file.codeContent) ||
    /\.(html|htm|tsx|ts|jsx|js|css|scss|py|json|sql|cpp|c|sh|rs|go|php|md|txt)$/i.test(file.name);

  const rawContent =
    file.codeContent ||
    (typeof file.preview === 'string' && !file.preview.startsWith('data:') ? file.preview : '');
  const isHtml =
    file.name.toLowerCase().endsWith('.html') ||
    file.name.toLowerCase().endsWith('.htm') ||
    file.type === 'text/html' ||
    Boolean(
      rawContent &&
        (rawContent.includes('<!doctype') || rawContent.includes('<html') || rawContent.includes('<section'))
    );

  const handleCopy = (e: React.MouseEvent) => {
    e.stopPropagation();
    const textToCopy = rawContent || file.preview || file.name;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = (e: React.MouseEvent) => {
    e.stopPropagation();
    const a = document.createElement('a');
    if (rawContent) {
      const mime = file.type || 'text/plain';
      const blob = new Blob([rawContent], { type: mime });
      const url = URL.createObjectURL(blob);
      a.href = url;
      a.download = file.name;
      a.click();
      URL.revokeObjectURL(url);
    } else if (file.preview) {
      a.href = file.preview;
      a.download = file.name;
      a.click();
    }
  };

  const lines = rawContent ? rawContent.split('\n') : [];

  return (
    <AnimatePresence>
      <div
        className="fixed inset-0 z-[12000] flex items-center justify-center p-3 sm:p-6 bg-black/88 select-none"
        role="dialog"
        aria-modal="true"
        aria-label={`Preview ${file.name}`}
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.94 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.94 }}
          transition={{ duration: 0.2, ease: 'easeOut' }}
          className="relative inline-flex items-center justify-center max-w-[94vw] max-h-[90vh]"
          onClick={(e) => e.stopPropagation()}
        >
          {/* ============================================================== */}
          {/* 1. VIDEO PREVIEW — Tight natural aspect ratio with overlay X */}
          {/* ============================================================== */}
          {isVideo && file.preview && (
            <div className="relative max-w-[92vw] max-h-[85vh] rounded-2xl overflow-hidden shadow-2xl bg-black border border-white/10 flex items-center justify-center">
              <video
                controls
                autoPlay
                playsInline
                src={file.preview}
                className="max-w-[92vw] max-h-[85vh] w-auto h-auto object-contain block rounded-2xl"
              >
                Your browser does not support the video tag.
              </video>

              {/* Top Overlay Controls directly inside media interface */}
              <div className="absolute top-3 right-3 z-30 flex items-center gap-2 pointer-events-auto">
                <button
                  type="button"
                  onClick={handleDownload}
                  className="w-9 h-9 rounded-full bg-black/75 hover:bg-black/90 text-white flex items-center justify-center border border-white/20 transition-all shadow-lg active:scale-95 cursor-pointer"
                  title="Download Video"
                  aria-label="Download Video"
                >
                  <Download size={16} />
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-9 h-9 rounded-full bg-black/75 hover:bg-black/90 text-white flex items-center justify-center border border-white/20 transition-all shadow-lg active:scale-95 cursor-pointer"
                  title="Close (Esc)"
                  aria-label="Close"
                >
                  <X size={18} strokeWidth={2.5} />
                </button>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* 2. IMAGE PREVIEW — Tight natural image size with overlay X   */}
          {/* ============================================================== */}
          {isImg && file.preview && (
            <div className="relative max-w-[92vw] max-h-[85vh] rounded-2xl overflow-hidden shadow-2xl bg-black/40 border border-white/15 flex items-center justify-center">
              <img
                src={file.preview}
                alt={file.name}
                className="max-w-[92vw] max-h-[85vh] w-auto h-auto object-contain block rounded-2xl"
              />

              {/* Floating controls directly on image top-right */}
              <div className="absolute top-3 right-3 z-30 flex items-center gap-2 pointer-events-auto">
                <button
                  type="button"
                  onClick={handleDownload}
                  className="w-9 h-9 rounded-full bg-black/75 hover:bg-black/90 text-white flex items-center justify-center border border-white/20 transition-all shadow-lg active:scale-95 cursor-pointer"
                  title="Download Image"
                  aria-label="Download Image"
                >
                  <Download size={16} />
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  className="w-9 h-9 rounded-full bg-black/75 hover:bg-black/90 text-white flex items-center justify-center border border-white/20 transition-all shadow-lg active:scale-95 cursor-pointer"
                  title="Close (Esc)"
                  aria-label="Close"
                >
                  <X size={18} strokeWidth={2.5} />
                </button>
              </div>
            </div>
          )}

          {/* ============================================================== */}
          {/* 3. AUDIO PREVIEW — Tight player card                          */}
          {/* ============================================================== */}
          {isAudio && file.preview && (
            <div className="relative w-[340px] max-w-[90vw] p-6 rounded-2xl bg-[#10121a] border border-white/15 shadow-2xl flex flex-col items-center gap-4 text-white">
              <div className="absolute top-3 right-3 z-30">
                <button
                  type="button"
                  onClick={onClose}
                  className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-all cursor-pointer"
                  title="Close"
                >
                  <X size={16} strokeWidth={2.5} />
                </button>
              </div>
              <h4 className="text-sm font-bold text-center truncate max-w-[240px] mt-2">{file.name}</h4>
              <audio controls autoPlay src={file.preview} className="w-full" />
            </div>
          )}

          {/* ============================================================== */}
          {/* 4. HTML LIVE PREVIEW OR CODE VIEWER                          */}
          {/* ============================================================== */}
          {!isVideo && !isImg && !isAudio && (
            <div className="relative w-[90vw] max-w-4xl h-[82vh] max-h-[800px] rounded-2xl overflow-hidden bg-[#0c0e17] border border-zinc-800 shadow-2xl flex flex-col">
              {/* Overlay Top Bar inside the interface */}
              <div className="flex items-center justify-between px-4 py-3 bg-[#131622] border-b border-zinc-800 shrink-0">
                <div className="flex items-center gap-2 min-w-0 pr-4">
                  <span className="text-xs font-mono font-bold text-[#00a6ff] uppercase px-2 py-0.5 rounded bg-[#00a6ff]/15">
                    {file.name.split('.').pop() || 'CODE'}
                  </span>
                  <span className="text-xs font-bold text-white truncate max-w-[220px] sm:max-w-md">
                    {file.name}
                  </span>
                </div>

                <div className="flex items-center gap-2">
                  {isHtml && (
                    <div className="flex items-center gap-1 bg-zinc-900 border border-zinc-700/80 rounded-lg p-0.5">
                      <button
                        type="button"
                        onClick={() => setViewMode('preview')}
                        className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors ${
                          viewMode === 'preview' ? 'bg-[#00a6ff] text-white' : 'text-zinc-400 hover:text-white'
                        }`}
                      >
                        <Eye size={12} />
                        <span className="hidden sm:inline">Preview</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setViewMode('code')}
                        className={`px-2.5 py-1 rounded text-xs font-semibold flex items-center gap-1 cursor-pointer transition-colors ${
                          viewMode === 'code' ? 'bg-[#00a6ff] text-white' : 'text-zinc-400 hover:text-white'
                        }`}
                      >
                        <Code size={12} />
                        <span className="hidden sm:inline">Source</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setIframeKey((k) => k + 1)}
                        className="p-1 text-zinc-400 hover:text-white cursor-pointer"
                        title="Reload"
                      >
                        <RotateCcw size={12} />
                      </button>
                    </div>
                  )}

                  {rawContent && (
                    <button
                      type="button"
                      onClick={handleCopy}
                      className="px-2.5 py-1 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer border border-zinc-700 active:scale-95"
                      title="Copy content"
                    >
                      {copied ? <Check size={12} className="text-emerald-400" /> : <Copy size={12} />}
                      <span className="hidden sm:inline">{copied ? 'Copied' : 'Copy'}</span>
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={handleDownload}
                    className="p-1.5 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-200 transition-all cursor-pointer border border-zinc-700 active:scale-95"
                    title="Download"
                  >
                    <Download size={14} />
                  </button>

                  <button
                    type="button"
                    onClick={onClose}
                    className="w-7 h-7 rounded-lg bg-zinc-800 hover:bg-zinc-700 text-zinc-300 hover:text-white flex items-center justify-center transition-all cursor-pointer border border-zinc-700 active:scale-95 ml-1"
                    title="Close"
                  >
                    <X size={15} strokeWidth={2.5} />
                  </button>
                </div>
              </div>

              {/* Main Content Area */}
              <div className="flex-1 min-h-0 bg-[#090b12] overflow-hidden flex items-center justify-center p-2">
                {isHtml && viewMode === 'preview' && rawContent ? (
                  <iframe
                    key={iframeKey}
                    srcDoc={rawContent}
                    title={file.name}
                    sandbox="allow-scripts allow-forms allow-modals"
                    className="w-full h-full bg-white rounded-xl border border-zinc-800"
                  />
                ) : (
                  <div className="w-full h-full flex rounded-xl bg-[#0e1017] border border-zinc-800/80 overflow-hidden font-mono text-xs sm:text-sm">
                    <div className="select-none py-3 px-3 text-right bg-[#0a0b10] border-r border-zinc-800/60 text-zinc-600 font-mono text-xs shrink-0">
                      {lines.map((_, i) => (
                        <div key={i} className="leading-6">
                          {i + 1}
                        </div>
                      ))}
                    </div>
                    <pre className="flex-1 p-3 overflow-auto font-mono text-xs sm:text-sm leading-6 text-zinc-100 whitespace-pre">
                      <code>{rawContent || file.preview || 'No text content available'}</code>
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
