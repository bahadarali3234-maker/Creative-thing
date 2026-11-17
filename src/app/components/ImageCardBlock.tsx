import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Image as ImageIcon, Loader2, X } from 'lucide-react';

export type ImageCardLayout = 'fan' | 'polaroid' | 'mosaic' | 'strip' | 'spotlight';

export interface ImageCardSpec {
  query: string;
  title: string;
  description: string;
  tags?: string[];
  layout?: ImageCardLayout;
  accent?: string;
  count?: number;
  offset?: number;
  mode?: 'explicit' | 'auto';
}

export interface ScrapedImageItem {
  id: string;
  title: string;
  url: string;
  thumbnail: string;
  sourceUrl: string;
  sourceDomain: string;
  width?: number;
  height?: number;
}

export interface ScrapeImagesResponse {
  detail?: {
    title?: string;
    description?: string;
    sourceUrl?: string;
  };
  images: ScrapedImageItem[];
  hasMore?: boolean;
  nextOffset?: number;
  suggestions?: string[];
  blocked?: boolean;
  error?: string;
}

const clientImageCache = new Map<string, ScrapeImagesResponse>();

export function parseImageCardSpec(raw: string): ImageCardSpec | null {
  if (!raw || !raw.trim()) return null;
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/,\s*([}\]])/g, '$1');
  try {
    const parsed = JSON.parse(cleaned);
    if (!parsed || typeof parsed !== 'object' || !parsed.query) {
      return null;
    }
    const validLayouts: ImageCardLayout[] = ['fan', 'polaroid', 'mosaic', 'strip', 'spotlight'];
    const layout = validLayouts.includes(parsed.layout) ? parsed.layout : 'fan';
    const rawCount = Number(parsed.count);
    const count = Number.isFinite(rawCount) ? Math.max(2, Math.min(10, rawCount)) : 6;
    const rawOffset = Number(parsed.offset);
    const offset = Number.isFinite(rawOffset) && rawOffset >= 0 ? rawOffset : 0;

    return {
      query: String(parsed.query).trim(),
      title: String(parsed.title || parsed.query).trim(),
      description: String(parsed.description || '').trim(),
      tags: Array.isArray(parsed.tags) ? parsed.tags.map((t: any) => String(t).trim()).filter(Boolean).slice(0, 4) : [],
      layout,
      accent: /^#[0-9A-Fa-f]{3,8}$/.test(String(parsed.accent || '')) ? String(parsed.accent) : '#2563EB',
      count,
      offset,
      mode: parsed.mode === 'auto' ? 'auto' : 'explicit',
    };
  } catch {
    return null;
  }
}

interface ResilientPhotoProps {
  src: string;
  fallbackSrc?: string;
  alt: string;
  className?: string;
  fitMode?: 'contain' | 'cover';
  onClick?: () => void;
  onAllFailed?: () => void;
}

const ResilientPhoto: React.FC<ResilientPhotoProps> = ({
  src,
  fallbackSrc,
  alt,
  className = '',
  fitMode = 'contain',
  onClick,
  onAllFailed,
}) => {
  const [stage, setStage] = useState<'direct' | 'proxy' | 'fallback_direct' | 'fallback_proxy' | 'broken'>('direct');

  useEffect(() => {
    setStage('direct');
  }, [src, fallbackSrc]);

  const activeUrl =
    stage === 'direct'
      ? src
      : stage === 'proxy'
      ? `/api/image-proxy?url=${encodeURIComponent(src)}`
      : stage === 'fallback_direct' && fallbackSrc
      ? fallbackSrc
      : stage === 'fallback_proxy' && fallbackSrc
      ? `/api/image-proxy?url=${encodeURIComponent(fallbackSrc)}`
      : '';

  const handleError = () => {
    if (stage === 'direct') {
      setStage('proxy');
    } else if (stage === 'proxy' && fallbackSrc && fallbackSrc !== src) {
      setStage('fallback_direct');
    } else if (stage === 'fallback_direct' && fallbackSrc) {
      setStage('fallback_proxy');
    } else {
      setStage('broken');
      onAllFailed?.();
    }
  };

  if (stage === 'broken' || !activeUrl) {
    return (
      <div
        onClick={onClick}
        className={`flex flex-col items-center justify-center bg-zinc-100 dark:bg-zinc-800/80 text-zinc-400 p-4 text-center select-none min-h-[180px] ${className}`}
      >
        <ImageIcon size={22} className="opacity-50" />
      </div>
    );
  }

  return (
    <img
      src={activeUrl}
      alt={alt}
      loading="eager"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={handleError}
      onClick={onClick}
      className={`${fitMode === 'cover' ? 'w-full h-full object-cover' : 'block w-full h-auto max-h-[72vh] object-contain mx-auto'} ${className}`}
    />
  );
};

export const ImageCardBlock: React.FC<{
  rawSpec: string;
  isStreaming?: boolean;
}> = ({ rawSpec, isStreaming = false }) => {
  const spec = React.useMemo(() => parseImageCardSpec(rawSpec), [rawSpec]);

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ScrapeImagesResponse | null>(null);
  const [activeIdx, setActiveIdx] = useState<number>(0);
  const [lightboxOpen, setLightboxOpen] = useState<boolean>(false);
  const [brokenIds, setBrokenIds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    if (!spec || isStreaming) return;
    setActiveIdx(0);
    setBrokenIds({});
    const cacheKey = `${spec.query.toLowerCase()}::${spec.offset || 0}`;
    const cached = clientImageCache.get(cacheKey);
    if (cached) {
      setResult(cached);
      return;
    }

    let cancelled = false;
    setLoading(true);
    fetch('/api/google-scrape-images', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        query: spec.query,
        offset: spec.offset || 0,
      }),
    })
      .then((r) => r.json())
      .then((data: ScrapeImagesResponse) => {
        if (cancelled) return;
        const normalized: ScrapeImagesResponse = {
          detail: data?.detail,
          images: Array.isArray(data?.images) ? data.images : [],
          hasMore: Boolean(data?.hasMore),
          nextOffset: Number(data?.nextOffset) || 0,
          suggestions: Array.isArray(data?.suggestions) ? data.suggestions : [],
          blocked: Boolean(data?.blocked),
          error: data?.error,
        };
        if (normalized.images.length > 0) {
          clientImageCache.set(cacheKey, normalized);
        }
        setResult(normalized);
      })
      .catch(() => {
        if (!cancelled) {
          setResult({ images: [], error: 'Network error loading images' });
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [spec, isStreaming]);

  const maxPhotos = spec?.count || 6;
  const usableImages = (result?.images || []).filter((img) => !brokenIds[img.id]).slice(0, maxPhotos);
  const safeIdx = usableImages.length > 0 ? Math.min(activeIdx, usableImages.length - 1) : 0;
  const currentImg = usableImages[safeIdx] || null;

  useEffect(() => {
    if (!lightboxOpen || usableImages.length === 0) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxOpen(false);
      if (e.key === 'ArrowRight') {
        setActiveIdx((i) => (i + 1) % usableImages.length);
      }
      if (e.key === 'ArrowLeft') {
        setActiveIdx((i) => (i - 1 + usableImages.length) % usableImages.length);
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [lightboxOpen, usableImages.length]);

  if (!spec) {
    if (isStreaming) {
      return (
        <div className="my-2 flex items-center gap-2 text-xs font-medium text-zinc-500">
          <Loader2 size={15} className="animate-spin text-zinc-500" />
        </div>
      );
    }
    return null;
  }

  if (loading || (isStreaming && usableImages.length === 0)) {
    return (
      <div className="my-2 w-full max-w-2xl space-y-3">
        <div className="w-full h-64 sm:h-80 rounded-2xl bg-zinc-100 dark:bg-zinc-800/70 animate-pulse" />
        <div className="flex items-center justify-center gap-2.5">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="w-20 h-14 sm:w-24 sm:h-16 rounded-xl bg-zinc-100 dark:bg-zinc-800/70 animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  if (usableImages.length === 0 || !currentImg) {
    return (
      <div className="my-2 w-full max-w-2xl rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 px-4 py-6 text-center text-xs font-medium text-zinc-500">
        {result?.blocked ? 'Filtered under SafeSearch.' : 'No images found — try another search.'}
      </div>
    );
  }

  const handlePrev = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setActiveIdx((i) => (i - 1 + usableImages.length) % usableImages.length);
  };

  const handleNext = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    setActiveIdx((i) => (i + 1) % usableImages.length);
  };

  return (
    <>
      {/* Standalone Full-Size Image Carousel + Thumbnail Strip (No Card Chrome, No Links, No Extra Text) */}
      <div className="my-2 w-full max-w-2xl select-none">
        {/* Main Full-Size Image Stage */}
        <div className="relative w-full rounded-2xl overflow-hidden bg-zinc-100/80 dark:bg-zinc-900/60 flex items-center justify-center">
          <ResilientPhoto
            key={currentImg.id}
            src={currentImg.url || currentImg.thumbnail}
            fallbackSrc={currentImg.thumbnail}
            alt={currentImg.title || spec.query}
            fitMode="contain"
            onClick={() => setLightboxOpen(true)}
            onAllFailed={() => setBrokenIds((prev) => ({ ...prev, [currentImg.id]: true }))}
            className="cursor-pointer rounded-2xl"
          />

          {/* Top-right Image Counter (1 / N) */}
          {usableImages.length > 1 && (
            <div className="absolute top-3 right-3 px-2.5 py-1 rounded-full bg-black/75 backdrop-blur-sm text-white text-xs font-bold tabular-nums pointer-events-none z-10">
              {safeIdx + 1} / {usableImages.length}
            </div>
          )}

          {/* Left / Right Circular Navigation Arrows */}
          {usableImages.length > 1 && (
            <>
              <button
                type="button"
                onClick={handlePrev}
                className="absolute left-3 top-1/2 -translate-y-1/2 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/95 hover:bg-white text-blue-600 shadow-md flex items-center justify-center transition-transform active:scale-95 cursor-pointer z-10"
                aria-label="Previous image"
              >
                <ChevronLeft size={20} strokeWidth={2.5} />
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="absolute right-3 top-1/2 -translate-y-1/2 w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-white/95 hover:bg-white text-blue-600 shadow-md flex items-center justify-center transition-transform active:scale-95 cursor-pointer z-10"
                aria-label="Next image"
              >
                <ChevronRight size={20} strokeWidth={2.5} />
              </button>
            </>
          )}
        </div>

        {/* Centered Thumbnail Strip */}
        {usableImages.length > 1 && (
          <div className="mt-3 flex items-center justify-center gap-2 sm:gap-2.5 flex-wrap px-1">
            {usableImages.map((img, idx) => {
              const isSelected = idx === safeIdx;
              return (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => setActiveIdx(idx)}
                  aria-label={`View image ${idx + 1}`}
                  className={`relative w-20 h-14 sm:w-24 sm:h-16 rounded-xl overflow-hidden bg-zinc-100 dark:bg-zinc-800 cursor-pointer transition-all shrink-0 ${
                    isSelected
                      ? 'ring-2 ring-blue-500 ring-offset-2 ring-offset-background shadow-sm opacity-100'
                      : 'border border-zinc-200/80 dark:border-zinc-700/70 opacity-80 hover:opacity-100'
                  }`}
                >
                  <ResilientPhoto
                    src={img.thumbnail || img.url}
                    fallbackSrc={img.url}
                    alt={img.title || spec.query}
                    fitMode="cover"
                    className="object-top"
                  />
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Pure Fullscreen Image Viewer (No Text, No Links) */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-[120] bg-black/92 flex items-center justify-center p-4 sm:p-6"
          onClick={() => setLightboxOpen(false)}
          role="dialog"
          aria-modal="true"
          aria-label={spec.query}
        >
          <button
            type="button"
            onClick={() => setLightboxOpen(false)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/15 hover:bg-white/25 text-white flex items-center justify-center transition-colors cursor-pointer z-20"
            aria-label="Close image viewer"
          >
            <X size={20} />
          </button>

          {usableImages.length > 1 && (
            <>
              <button
                type="button"
                onClick={handlePrev}
                className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/95 hover:bg-white text-blue-600 shadow-md flex items-center justify-center transition-transform active:scale-95 cursor-pointer z-20"
                aria-label="Previous image"
              >
                <ChevronLeft size={22} strokeWidth={2.5} />
              </button>
              <button
                type="button"
                onClick={handleNext}
                className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/95 hover:bg-white text-blue-600 shadow-md flex items-center justify-center transition-transform active:scale-95 cursor-pointer z-20"
                aria-label="Next image"
              >
                <ChevronRight size={22} strokeWidth={2.5} />
              </button>
            </>
          )}

          <div
            className="max-w-[92vw] max-h-[88vh] flex items-center justify-center"
            onClick={(e) => e.stopPropagation()}
          >
            <ResilientPhoto
              key={`lb-${currentImg.id}`}
              src={currentImg.url || currentImg.thumbnail}
              fallbackSrc={currentImg.thumbnail}
              alt={currentImg.title || spec.query}
              fitMode="contain"
              className="max-h-[88vh] max-w-[92vw] w-auto h-auto rounded-xl"
            />
          </div>
        </div>
      )}
    </>
  );
};
