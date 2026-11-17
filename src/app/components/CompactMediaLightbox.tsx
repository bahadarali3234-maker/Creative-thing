import React, { useEffect, useState } from 'react';
import {
  X,
  Scissors,
  Download,
  RefreshCw,
  Wand2,
  Sparkles,
  Loader2,
  Maximize2,
  Check,
  AlertCircle,
} from 'lucide-react';
import { removeBackground } from '../utils/mythoriaLib';

export type ImageStyleOption =
  | 'Auto'
  | 'Photorealistic'
  | 'Cinematic'
  | 'Anime'
  | '3D Rendering'
  | 'Pixar-like Stylized 3D'
  | 'Digital Painting'
  | 'Watercolor'
  | 'Oil Painting'
  | 'Cartoon'
  | 'Fantasy'
  | 'Cyberpunk'
  | 'Minimalist Illustration'
  | 'Product Photography'
  | 'Architectural Visualization'
  | 'Logo & Icon Design'
  | 'Game Assets'
  | 'Social Media Graphics'
  | 'Wallpapers'
  | 'Character Design'
  | 'Concept Art';

export const IMAGE_STYLE_OPTIONS: ImageStyleOption[] = [
  'Auto',
  'Photorealistic',
  'Cinematic',
  'Anime',
  '3D Rendering',
  'Pixar-like Stylized 3D',
  'Digital Painting',
  'Watercolor',
  'Oil Painting',
  'Cartoon',
  'Fantasy',
  'Cyberpunk',
  'Minimalist Illustration',
  'Product Photography',
  'Architectural Visualization',
  'Logo & Icon Design',
  'Game Assets',
  'Social Media Graphics',
  'Wallpapers',
  'Character Design',
  'Concept Art',
];

export interface ImageGenerationOptions {
  style: ImageStyleOption;
  size: '1024x1024' | '1536x1024' | '1024x1536' | 'auto';
  quality: 'low' | 'medium' | 'high' | 'auto';
  outputFormat: 'png' | 'jpeg' | 'webp';
  model: string;
}

export const DEFAULT_IMAGE_OPTIONS: ImageGenerationOptions = {
  style: 'Auto',
  size: 'auto',
  quality: 'auto',
  outputFormat: 'png',
  model: 'gpt-image-1',
};

export interface GeneratedImageData {
  id: string;
  url: string;
  fileName: string;
  mimeType: string;
  provider: 'openai';
  model: string;
  originalPrompt: string;
  optimizedPrompt: string;
  style: string;
  size: string;
  quality: string;
  outputFormat: string;
  parentImageId?: string;
  createdAt: string;
}

export type LightboxMediaItem = {
  kind: 'image';
  src: string;
  title?: string;
  fileName?: string;
  mimeType?: string;
};

export const FullscreenMediaLightbox: React.FC<{
  media: LightboxMediaItem | null;
  onClose: () => void;
}> = ({ media, onClose }) => {
  const [cutoutUrl, setCutoutUrl] = useState<string | null>(null);
  const [showingCutout, setShowingCutout] = useState<boolean>(false);
  const [cutting, setCutting] = useState<boolean>(false);
  const [cutError, setCutError] = useState<string>('');

  useEffect(() => {
    setCutoutUrl(null);
    setShowingCutout(false);
    setCutting(false);
    setCutError('');
  }, [media]);

  useEffect(() => {
    if (!media) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [media, onClose]);

  if (!media) return null;

  const handleCutAction = async () => {
    if (cutoutUrl) {
      setShowingCutout((s) => !s);
      return;
    }

    setCutting(true);
    setCutError('');
    try {
      const res = await removeBackground(media.src, { edge_feather: 2, tolerance: 52 });
      setCutoutUrl(res.dataURL);
      setShowingCutout(true);
    } catch (err: any) {
      setCutError(err?.message || 'Cutout failed on this image.');
    } finally {
      setCutting(false);
    }
  };

  const handleDownloadAction = async () => {
    const href = showingCutout && cutoutUrl ? cutoutUrl : media.src;
    const baseName = (media.fileName || 'generated-image.png').replace(/\.(png|jpg|jpeg|webp)$/i, '');
    const dlName = showingCutout ? `${baseName}_cutout.png` : media.fileName || 'generated-image.png';

    try {
      const res = await fetch(href);
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = dlName;
      a.click();
      setTimeout(() => URL.revokeObjectURL(objUrl), 2500);
    } catch {
      const a = document.createElement('a');
      a.href = href;
      a.download = dlName;
      a.click();
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[10020] bg-black/88 backdrop-blur-md flex flex-col items-center justify-center p-4 sm:p-6 animate-in fade-in duration-150"
    >
      {/* Top Bar: Title Left + Corner Actions (Cut, Download, Cross) Right */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-5xl flex items-center justify-between gap-3 mb-3"
      >
        <div className="min-w-0">
          <h3 className="text-white text-sm sm:text-base font-bold truncate">
            {media.title || 'Generated Image Preview'}
          </h3>
          {showingCutout && (
            <span className="text-[11px] font-semibold text-sky-300">Background Cutout Active</span>
          )}
        </div>

        {/* Exact Corner Action Buttons: Cut, Download, Cross */}
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleCutAction}
            disabled={cutting}
            className={`h-9 px-3 rounded-xl border text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors ${
              showingCutout
                ? 'bg-[var(--primary)] border-[var(--primary)] text-white'
                : 'bg-white/10 hover:bg-white/20 border-white/20 text-white'
            }`}
            title="Cut / Remove background"
            aria-label="Cut"
          >
            {cutting ? <Loader2 size={14} className="animate-spin" /> : <Scissors size={14} />}
            <span>{showingCutout ? 'Original' : 'Cut'}</span>
          </button>

          <button
            type="button"
            onClick={handleDownloadAction}
            className="h-9 px-3 rounded-xl theme-button-primary border border-white/20 text-white text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-colors"
            title="Download"
            aria-label="Download"
          >
            <Download size={14} />
            <span>Download</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 rounded-xl bg-white/10 hover:bg-red-600/80 border border-white/20 text-white flex items-center justify-center cursor-pointer transition-colors"
            title="Close"
            aria-label="Close"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {cutError && (
        <div
          onClick={(e) => e.stopPropagation()}
          className="mb-2 px-3 py-1.5 rounded-lg bg-red-500/20 border border-red-400/40 text-red-200 text-xs font-semibold"
        >
          {cutError}
        </div>
      )}

      {/* Stage Area */}
      <div
        onClick={(e) => e.stopPropagation()}
        className="relative flex-1 w-full max-w-5xl flex flex-col items-center justify-center min-h-0"
      >
        <div
          className="relative max-h-[80vh] max-w-full rounded-2xl overflow-hidden border border-white/15 shadow-2xl flex items-center justify-center"
          style={
            showingCutout
              ? {
                  backgroundImage:
                    'linear-gradient(45deg, #1f2937 25%, transparent 25%), linear-gradient(-45deg, #1f2937 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #1f2937 75%), linear-gradient(-45deg, transparent 75%, #1f2937 75%)',
                  backgroundSize: '20px 20px',
                  backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
                  backgroundColor: '#111827',
                }
              : { backgroundColor: '#09090b' }
          }
        >
          <img
            src={showingCutout && cutoutUrl ? cutoutUrl : media.src}
            alt={media.title || 'Generated Image'}
            className="max-h-[80vh] max-w-full object-contain block"
          />
        </div>
      </div>
    </div>
  );
};

export interface CompactGeneratedImageCardProps {
  image: GeneratedImageData;
  isBusy?: boolean;
  onRegenerate: (image: GeneratedImageData) => void;
  onEditSubmit: (image: GeneratedImageData, instruction: string) => void;
  onVariation: (image: GeneratedImageData) => void;
}

export const CompactGeneratedImageCard: React.FC<CompactGeneratedImageCardProps> = ({
  image,
  isBusy = false,
  onRegenerate,
  onEditSubmit,
  onVariation,
}) => {
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const [editDrawerOpen, setEditDrawerOpen] = useState(false);
  const [editInstruction, setEditInstruction] = useState('');

  const handleDownload = async () => {
    try {
      const res = await fetch(image.url);
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = objUrl;
      a.download = image.fileName || `ai-image-${image.id}.${image.outputFormat || 'png'}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(objUrl), 2500);
    } catch {
      const a = document.createElement('a');
      a.href = image.url;
      a.download = image.fileName || `ai-image-${image.id}.png`;
      a.click();
    }
  };

  return (
    <div className="my-2 inline-block max-w-[300px] sm:max-w-[340px] w-full rounded-2xl neu-raise overflow-hidden">
      {/* Compact Clean Image Box Only — NO canvas, NO drag-and-drop, NO photo overlay */}
      <button
        type="button"
        onClick={() => setLightboxOpen(true)}
        className="group relative block w-full bg-black/80 overflow-hidden cursor-pointer focus:outline-none"
        title="Tap to open fullscreen preview with Cut, Download & Close"
      >
        <img
          src={image.url}
          alt={image.originalPrompt || 'Generated AI Image'}
          className="w-full max-h-[260px] object-cover block transition-transform duration-300 group-hover:scale-[1.02]"
        />
        <span className="absolute top-2.5 right-2.5 w-7 h-7 rounded-lg bg-black/65 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
          <Maximize2 size={13} />
        </span>
      </button>

      {/* Compact Spec Line + Action Bar Under Image */}
      <div className="p-2.5 space-y-2 bg-surface/90">
        <div className="flex items-center justify-between text-[11px] font-semibold text-muted-foreground">
          <span className="truncate">{image.style} · {image.size}</span>
          <span className="font-mono text-[10px] text-[var(--primary-light)] font-bold shrink-0">{image.model}</span>
        </div>

        <div className="grid grid-cols-4 gap-1.5">
          <button
            type="button"
            onClick={handleDownload}
            className="h-8 px-2 rounded-lg border border-border hover:border-[var(--primary)] bg-surface-soft/70 text-foreground text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
            title="Download image"
          >
            <Download size={12} className="text-[var(--primary-light)]" />
            <span className="hidden sm:inline">Save</span>
          </button>

          <button
            type="button"
            disabled={isBusy}
            onClick={() => onRegenerate(image)}
            className="h-8 px-2 rounded-lg border border-border hover:border-[var(--primary)] bg-surface-soft/70 disabled:opacity-45 text-foreground text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
            title="Regenerate image"
          >
            <RefreshCw size={12} className="text-[var(--primary-light)]" />
            <span className="hidden sm:inline">Retry</span>
          </button>

          <button
            type="button"
            disabled={isBusy}
            onClick={() => setEditDrawerOpen((o) => !o)}
            className={`h-8 px-2 rounded-lg border text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors disabled:opacity-45 ${
              editDrawerOpen
                ? 'theme-button-primary border-[var(--primary)]'
                : 'border-border hover:border-[var(--primary)] bg-surface-soft/70 text-foreground'
            }`}
            title="Edit this image"
          >
            <Wand2 size={12} />
            <span className="hidden sm:inline">Edit</span>
          </button>

          <button
            type="button"
            disabled={isBusy}
            onClick={() => onVariation(image)}
            className="h-8 px-2 rounded-lg border border-border hover:border-[var(--primary)] bg-surface-soft/70 disabled:opacity-45 text-foreground text-[11px] font-bold flex items-center justify-center gap-1 cursor-pointer transition-colors"
            title="Create creative variation"
          >
            <Sparkles size={12} className="text-[var(--primary-light)]" />
            <span className="hidden sm:inline">Vary</span>
          </button>
        </div>

        {editDrawerOpen && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!editInstruction.trim() || isBusy) return;
              const instr = editInstruction.trim();
              setEditInstruction('');
              setEditDrawerOpen(false);
              onEditSubmit(image, instr);
            }}
            className="pt-1.5 border-t border-border/70 flex items-center gap-1.5"
          >
            <input
              type="text"
              value={editInstruction}
              onChange={(e) => setEditInstruction(e.target.value)}
              placeholder="Describe change (e.g. sunset sky)..."
              className="flex-1 min-w-0 px-2.5 py-1.5 rounded-lg border border-border bg-surface text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-[var(--primary)]"
            />
            <button
              type="submit"
              disabled={!editInstruction.trim() || isBusy}
              className="h-7 px-2.5 rounded-lg theme-button-primary text-xs font-bold disabled:opacity-45 cursor-pointer shrink-0 flex items-center gap-1"
            >
              <Check size={11} />
              <span>Apply</span>
            </button>
          </form>
        )}
      </div>

      {lightboxOpen && (
        <FullscreenMediaLightbox
          media={{
            kind: 'image',
            src: image.url,
            title: image.originalPrompt,
            fileName: image.fileName,
            mimeType: image.mimeType,
          }}
          onClose={() => setLightboxOpen(false)}
        />
      )}
    </div>
  );
};

export const ImageErrorNoticeCard: React.FC<{
  errorText: string;
  code?: string;
  onOpenSettings: () => void;
}> = ({ errorText, code, onOpenSettings }) => {
  const needsKey = code === 'MISSING_OPENAI_KEY' || code === 'INVALID_OPENAI_KEY' || code === 'INSUFFICIENT_CREDITS';
  return (
    <div className="my-2 p-3.5 rounded-2xl border border-rose-500/35 bg-rose-500/10 text-foreground space-y-2.5 max-w-md">
      <div className="flex items-start gap-2.5">
        <AlertCircle size={16} className="text-rose-400 shrink-0 mt-0.5" />
        <p className="text-xs font-bold leading-relaxed">{errorText}</p>
      </div>
      {needsKey && (
        <button
          type="button"
          onClick={onOpenSettings}
          className="px-3 py-1.5 rounded-lg theme-button-primary text-xs font-bold cursor-pointer transition-colors"
        >
          Open AI API Settings
        </button>
      )}
    </div>
  );
};

