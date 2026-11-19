import React, { useEffect, useState } from 'react';
import {
  X,
  Scissors,
  Download,
  RefreshCw,
  Wand2,
  Maximize2,
  Loader2,
  AlertCircle,
  ExternalLink,
  Layers,
} from 'lucide-react';
import {
  previewBox,
  exportStudioHtmlToPngDataUrl,
  StudioSourceAttribution,
  StudioThinkingLogStep,
} from '../utils/studioClient';
import {
  CanvasDesignSpec,
  SerializedPreparedAsset,
  StudioSceneGraph,
} from '../utils/studioCanvasEngine';
import { enhancedBackgroundRemove } from '../utils/webgpuVision';

export interface StudioJobState {
  jobId: string;
  status: 'running' | 'done' | 'refused' | 'error';
  prompt: string;
  recipe?: string;
  percent: number;
  elapsedSec: number;
  stageLabel?: string;
  width: number;
  height: number;
  html?: string;
  imageDataUrl?: string;
  canvasSpec?: CanvasDesignSpec;
  serializedAssets?: SerializedPreparedAsset[];
  sceneGraph?: StudioSceneGraph;
  summary?: StudioThinkingLogStep[];
  sources?: StudioSourceAttribution[];
  warnings?: string[];
  styleName?: string;
  plan?: any;
  refusalReason?: string;
  errorMessage?: string;
}

export const StudioFullscreenModal: React.FC<{
  studioJob: StudioJobState | null;
  onClose: () => void;
  onRegenerate: (job: StudioJobState) => void;
  onEditInstruction: (job: StudioJobState, instruction: string) => void;
  onEditLayers?: (job: StudioJobState) => void;
}> = ({ studioJob, onClose, onRegenerate, onEditInstruction, onEditLayers }) => {
  const [pngUrl, setPngUrl] = useState<string | null>(null);
  const [cutoutUrl, setCutoutUrl] = useState<string | null>(null);
  const [showingCutout, setShowingCutout] = useState(false);
  const [busyAction, setBusyAction] = useState<'cut' | 'download' | null>(null);
  const [actionError, setActionError] = useState('');
  const [tweakText, setTweakText] = useState('');

  useEffect(() => {
    setPngUrl(studioJob?.imageDataUrl || null);
    setCutoutUrl(null);
    setShowingCutout(false);
    setBusyAction(null);
    setActionError('');
    setTweakText('');
  }, [studioJob?.jobId, studioJob?.html, studioJob?.imageDataUrl]);

  useEffect(() => {
    if (!studioJob) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [studioJob, onClose]);

  if (!studioJob || (!studioJob.imageDataUrl && !studioJob.html)) return null;

  const ensurePng = async () => {
    if (studioJob.imageDataUrl) return studioJob.imageDataUrl;
    if (pngUrl) return pngUrl;
    const rendered = await exportStudioHtmlToPngDataUrl(
      studioJob.html!,
      studioJob.width || 1280,
      studioJob.height || 720
    );
    setPngUrl(rendered);
    return rendered;
  };

  const handleCut = async () => {
    if (cutoutUrl) {
      setShowingCutout((v) => !v);
      return;
    }
    setBusyAction('cut');
    setActionError('');
    try {
      const base = await ensurePng();
      const res = await enhancedBackgroundRemove(base);
      setCutoutUrl(res.cutoutDataUrl);
      setShowingCutout(true);
    } catch (e: any) {
      setActionError(e?.message || 'Cutout failed on this design.');
    } finally {
      setBusyAction(null);
    }
  };

  const handleDownload = async () => {
    setBusyAction('download');
    setActionError('');
    try {
      const href = showingCutout && cutoutUrl ? cutoutUrl : await ensurePng();
      const slug = (studioJob.recipe || 'studio-design').replace(/[^a-z0-9-_]+/gi, '-').toLowerCase();
      const a = document.createElement('a');
      a.href = href;
      a.download = showingCutout ? `studio-${slug}-cutout.png` : `studio-${slug}-${studioJob.width}x${studioJob.height}.png`;
      a.click();
    } catch (e: any) {
      setActionError(e?.message || 'Could not export PNG.');
    } finally {
      setBusyAction(null);
    }
  };

  const viewerBox = previewBox(
    studioJob.width || 1280,
    studioJob.height || 720,
    Math.min(860, typeof window !== 'undefined' ? window.innerWidth - 48 : 860),
    Math.min(560, typeof window !== 'undefined' ? window.innerHeight - 230 : 560)
  );

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[10025] bg-black/88 backdrop-blur-md flex flex-col items-center justify-center p-4 sm:p-6 animate-in fade-in duration-150"
    >
      {/* Top Bar: Metadata Left + Exact Corner Controls (Cut, Download, Cross) Right */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-5xl flex items-center justify-between gap-3 mb-3"
      >
        <div className="min-w-0">
          <h3 className="text-white text-sm sm:text-base font-bold truncate">
            {studioJob.styleName || studioJob.recipe || 'Creative Studio Design'}
          </h3>
          <p className="text-xs text-white/65 tabular-nums truncate">
            {studioJob.width}×{studioJob.height} · {studioJob.elapsedSec || 1}s
            {showingCutout ? ' · Cutout Active' : ''}
          </p>
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleCut}
            disabled={busyAction !== null}
            className={`h-9 px-3 rounded-xl border text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap shrink-0 ${
              showingCutout
                ? 'bg-[var(--primary)] border-[var(--primary)] text-white'
                : 'bg-white/10 hover:bg-white/20 border-white/20 text-white'
            }`}
            title="Cut / Remove background"
            aria-label="Cut"
          >
            {busyAction === 'cut' ? <Loader2 size={14} className="animate-spin" /> : <Scissors size={14} />}
            <span>{showingCutout ? 'Original' : 'Cut'}</span>
          </button>

          <button
            type="button"
            onClick={handleDownload}
            disabled={busyAction !== null}
            className="h-9 px-3 rounded-xl theme-button-primary border border-white/20 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors whitespace-nowrap shrink-0"
            title="Download PNG"
            aria-label="Download"
          >
            {busyAction === 'download' ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
            <span>Download PNG</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-red-600/80 border border-white/20 text-white flex items-center justify-center cursor-pointer transition-colors shrink-0"
            title="Close"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {actionError && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="mb-2 px-3 py-1.5 rounded-lg bg-red-500/20 border border-red-400/40 text-red-200 text-xs font-semibold"
        >
          {actionError}
        </div>
      )}

      {/* Stage Area */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex-1 w-full max-w-5xl flex flex-col items-center justify-center min-h-0 gap-3"
      >
        <div
          className="relative rounded-2xl overflow-hidden border border-white/15 shadow-2xl bg-black/40"
          style={{
            width: `${viewerBox.w}px`,
            height: `${viewerBox.h}px`,
            ...(showingCutout
              ? {
                  backgroundImage:
                    'linear-gradient(45deg, #27272a 25%, transparent 25%), linear-gradient(-45deg, #27272a 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #27272a 75%), linear-gradient(-45deg, transparent 75%, #27272a 75%)',
                  backgroundSize: '20px 20px',
                  backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
                }
              : {}),
          }}
        >
          {showingCutout && cutoutUrl ? (
            <img
              src={cutoutUrl}
              alt="Cutout design preview"
              className="w-full h-full object-contain"
            />
          ) : studioJob.imageDataUrl ? (
            <img
              src={studioJob.imageDataUrl}
              alt={studioJob.canvasSpec?.title || studioJob.prompt || 'Creative Studio Design'}
              className="w-full h-full object-contain"
            />
          ) : (
            <iframe
              sandbox="allow-same-origin"
              title="Studio Design Fullscreen Preview"
              srcDoc={studioJob.html}
              style={{
                width: `${studioJob.width}px`,
                height: `${studioJob.height}px`,
                transform: `scale(${viewerBox.scale})`,
                transformOrigin: 'top left',
                border: 0,
                pointerEvents: 'none',
                background: 'transparent',
              }}
            />
          )}
        </div>

        {/* Bottom quick tweak / Edit Layers / Regenerate strip */}
        <div className="w-full max-w-xl flex flex-col sm:flex-row items-stretch sm:items-center gap-2">
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!tweakText.trim()) return;
              onEditInstruction(studioJob, tweakText.trim());
              onClose();
            }}
            className="flex-1 flex items-center gap-2"
          >
            <input
              type="text"
              value={tweakText}
              onChange={(e) => setTweakText(e.target.value)}
              placeholder="Edit headline, make darker, change colors..."
              className="flex-1 h-9 px-3.5 rounded-xl bg-white/10 border border-white/20 text-xs text-white placeholder:text-white/50 focus:outline-none focus:border-white/45"
            />
            <button
              type="submit"
              disabled={!tweakText.trim()}
              className="h-9 px-3.5 rounded-xl theme-button-primary disabled:opacity-40 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Wand2 size={13} />
              <span>Edit</span>
            </button>
          </form>

          <div className="flex items-center gap-2 shrink-0">
            {onEditLayers && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onEditLayers(studioJob);
                }}
                className="h-9 px-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
              >
                <Layers size={13} />
                <span>Edit Layers</span>
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                onRegenerate(studioJob);
                onClose();
              }}
              className="h-9 px-3 rounded-xl bg-white/10 hover:bg-white/20 border border-white/20 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              <RefreshCw size={13} />
              <span>Regenerate</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export const StudioCompositionBox: React.FC<{
  studioJob: StudioJobState;
  onOpenFullscreen: (job: StudioJobState) => void;
  onEditLayers?: (job: StudioJobState) => void;
  onRegenerate?: (job: StudioJobState) => void;
}> = ({ studioJob, onOpenFullscreen, onEditLayers, onRegenerate }) => {
  const box = previewBox(studioJob.width || 1280, studioJob.height || 720, 320, 380);
  const hasPreview = Boolean(studioJob.imageDataUrl || studioJob.html);

  if (studioJob.status === 'refused') {
    return (
      <div className="my-2 p-3.5 rounded-2xl neu-glass border border-border/20 text-xs text-foreground/85 max-w-[340px]">
        {studioJob.refusalReason ||
          'Please adjust this prompt to a safe creative concept and try again.'}
      </div>
    );
  }

  if (studioJob.status === 'error') {
    return (
      <div className="my-2 p-3.5 rounded-2xl bg-red-500/10 border border-red-500/30 text-xs text-foreground flex items-start gap-2 max-w-[340px]">
        <AlertCircle size={15} className="text-red-400 shrink-0 mt-0.5" />
        <span>{studioJob.errorMessage || 'Creative Studio could not complete this image.'}</span>
      </div>
    );
  }

  const isRunning = studioJob.status === 'running';

  const handleDownloadInline = () => {
    if (!studioJob.imageDataUrl) return;
    const slug = (studioJob.recipe || 'image').replace(/[^a-z0-9-_]+/gi, '-').toLowerCase();
    const a = document.createElement('a');
    a.href = studioJob.imageDataUrl;
    a.download = `studio-${slug}-${studioJob.width}x${studioJob.height}.png`;
    a.click();
  };

  return (
    <div className="my-2 space-y-2 max-w-full">
      <div
        role={hasPreview ? 'button' : undefined}
        tabIndex={hasPreview ? 0 : undefined}
        onClick={() => hasPreview && onOpenFullscreen(studioJob)}
        onKeyDown={(e) => {
          if ((e.key === 'Enter' || e.key === ' ') && hasPreview) {
            e.preventDefault();
            onOpenFullscreen(studioJob);
          }
        }}
        style={{
          width: `${box.w}px`,
          height: `${box.h}px`,
        }}
        className={`relative rounded-2xl overflow-hidden neu-raise border border-border/20 ${
          hasPreview ? 'cursor-pointer group' : ''
        }`}
      >
        {isRunning || !hasPreview ? (
          <div className="w-full h-full flex flex-col items-center justify-center p-4 bg-gradient-to-br from-surface/70 via-background/80 to-surface/70 relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-r from-transparent via-foreground/[0.04] to-transparent animate-pulse" />
            {/* Corner progress badge: percent · elapsed */}
            <div className="absolute top-2.5 right-2.5 px-2 py-1 rounded-lg bg-black/70 text-white text-[11px] font-semibold tabular-nums backdrop-blur-sm">
              {studioJob.percent}% · {fmtSec(studioJob.elapsedSec)}
            </div>
            <Loader2 size={22} className="text-[var(--primary)] animate-spin mb-2 relative z-10" />
            <span className="text-xs font-semibold text-foreground/80 text-center relative z-10">
              {studioJob.stageLabel || 'Designing canvas...'}
            </span>
          </div>
        ) : studioJob.imageDataUrl ? (
          <>
            <img
              src={studioJob.imageDataUrl}
              alt={studioJob.canvasSpec?.title || studioJob.prompt || 'Creative Studio Image'}
              className="w-full h-full object-contain block bg-black/5"
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors flex items-center justify-center">
              <span className="opacity-0 group-hover:opacity-100 transition-opacity px-3 py-1.5 rounded-xl bg-black/75 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg">
                <Maximize2 size={13} />
                <span>Open Viewer</span>
              </span>
            </div>
          </>
        ) : (
          <>
            <iframe
              sandbox="allow-same-origin"
              title="Studio Output Preview"
              srcDoc={studioJob.html}
              style={{
                width: `${studioJob.width}px`,
                height: `${studioJob.height}px`,
                transform: `scale(${box.scale})`,
                transformOrigin: 'top left',
                border: 0,
                pointerEvents: 'none',
                background: 'transparent',
              }}
            />
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors flex items-center justify-center">
              <span className="opacity-0 group-hover:opacity-100 transition-opacity px-3 py-1.5 rounded-xl bg-black/75 text-white text-xs font-semibold flex items-center gap-1.5 shadow-lg">
                <Maximize2 size={13} />
                <span>Open Viewer</span>
              </span>
            </div>
          </>
        )}
      </div>

      {/* Focused Inline Action Bar: strictly Download PNG, Edit Layers, and Regenerate */}
      {studioJob.status === 'done' && studioJob.imageDataUrl && (
        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={handleDownloadInline}
            className="h-8 px-3 rounded-xl theme-button-primary text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 whitespace-nowrap shrink-0"
          >
            <Download size={13} />
            <span>Download PNG</span>
          </button>

          {onEditLayers && (
            <button
              type="button"
              onClick={() => onEditLayers(studioJob)}
              className="h-8 px-3 rounded-xl neu-raise border border-border/20 text-xs font-semibold text-foreground/85 hover:text-foreground flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 whitespace-nowrap shrink-0"
            >
              <Layers size={13} />
              <span>Edit Layers</span>
            </button>
          )}

          {onRegenerate && (
            <button
              type="button"
              onClick={() => onRegenerate(studioJob)}
              className="h-8 px-3 rounded-xl neu-raise border border-border/20 text-xs font-semibold text-foreground/85 hover:text-foreground flex items-center gap-1.5 cursor-pointer transition-all active:scale-95 whitespace-nowrap shrink-0"
            >
              <RefreshCw size={13} />
              <span>Regenerate</span>
            </button>
          )}
        </div>
      )}

      {/* Unboxed quiet source attribution metadata when web photos are used */}
      {studioJob.status === 'done' && studioJob.sources && studioJob.sources.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-foreground/60">
          <span>photos:</span>
          {studioJob.sources.slice(0, 3).map((s, idx) => (
            <React.Fragment key={`${s.domain || 'src'}-${idx}`}>
              {idx > 0 && <span aria-hidden="true">·</span>}
              {s.url ? (
                <a
                  href={s.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-0.5 hover:text-foreground underline decoration-border/40"
                >
                  <span>{s.domain || 'source'}</span>
                  <ExternalLink size={10} />
                </a>
              ) : (
                <span>{s.domain || 'web'}</span>
              )}
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
};

function fmtSec(seconds: number) {
  const s = Math.max(0, Math.floor(seconds || 0));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}
