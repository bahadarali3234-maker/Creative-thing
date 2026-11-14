import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, ExternalLink, Image as ImageIcon, Loader2, X } from 'lucide-react';

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
  // Remove potential trailing commas before closing braces/brackets
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
  objectPositionClass?: string;
  onClick?: () => void;
}

const ResilientPhoto: React.FC<ResilientPhotoProps> = ({
  src,
  fallbackSrc,
  alt,
  className = '',
  objectPositionClass = 'object-center',
  onClick,
}) => {
  const [stage, setStage] = useState<'direct' | 'proxy' | 'fallback_direct' | 'broken'>('direct');

  useEffect(() => {
    setStage('direct');
  }, [src, fallbackSrc]);

  const activeUrl =
    stage === 'direct'
      ? src
      : stage === 'proxy'
      ? `/api/image-proxy?url=${encodeURIComponent(src)}`
      : stage === 'fallback_direct' && fallbackSrc
      ? `/api/image-proxy?url=${encodeURIComponent(fallbackSrc)}`
      : '';

  const handleError = () => {
    if (stage === 'direct') {
      setStage('proxy');
    } else if (stage === 'proxy' && fallbackSrc && fallbackSrc !== src) {
      setStage('fallback_direct');
    } else {
      setStage('broken');
    }
  };

  if (stage === 'broken' || !activeUrl) {
    return (
      <div
        onClick={onClick}
        className={`flex flex-col items-center justify-center bg-zinc-100 dark:bg-zinc-800/80 text-zinc-500 p-3 text-center select-none ${className}`}
      >
        <ImageIcon size={20} className="mb-1.5 opacity-60" />
        <span className="text-[11px] font-medium line-clamp-2 max-w-[140px]">{alt}</span>
      </div>
    );
  }

  return (
    <img
      src={activeUrl}
      alt={alt}
      loading="lazy"
      decoding="async"
      referrerPolicy="no-referrer"
      onError={handleError}
      onClick={onClick}
      className={`w-full h-full object-cover ${objectPositionClass} transition-transform duration-300 ${className}`}
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
  const [lightboxIdx, setLightboxIdx] = useState<number | null>(null);

  useEffect(() => {
    if (!spec || isStreaming) return;
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

  useEffect(() => {
    if (lightboxIdx === null) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setLightboxIdx(null);
      if (!result?.images?.length) return;
      if (e.key === 'ArrowRight') {
        setLightboxIdx((i) => (i === null ? 0 : (i + 1) % result.images.length));
      }
      if (e.key === 'ArrowLeft') {
        setLightboxIdx((i) => (i === null ? 0 : (i - 1 + result.images.length) % result.images.length));
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [lightboxIdx, result?.images?.length]);

  if (!spec) {
    if (isStreaming) {
      return (
        <div className="my-4 p-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 flex items-center gap-3 text-xs font-semibold text-zinc-600 dark:text-zinc-300">
          <Loader2 size={15} className="animate-spin text-zinc-500" />
          <span>Finding photographs...</span>
        </div>
      );
    }
    return null;
  }

  const maxPhotos = spec.count || (spec.layout === 'spotlight' ? 3 : spec.layout === 'strip' ? 4 : spec.layout === 'mosaic' ? 8 : 6);
  const visibleImages = (result?.images || []).slice(0, maxPhotos);
  const displayDescription = spec.description || result?.detail?.description || '';
  const accentColor = spec.accent || '#2563EB';
  const tagsLine = (spec.tags || []).join(' · ');

  // Unique domains attribution (deduplicated cleanly)
  const uniqueSources: Array<{ domain: string; url: string }> = [];
  const seenDomains = new Set<string>();
  for (const img of visibleImages) {
    const dom = img.sourceDomain || '';
    if (dom && !seenDomains.has(dom)) {
      seenDomains.add(dom);
      uniqueSources.push({ domain: dom, url: img.sourceUrl || img.url });
      if (uniqueSources.length >= 4) break;
    }
  }

  const renderGallery = () => {
    if (loading || (isStreaming && visibleImages.length === 0)) {
      return (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
          {[0, 1, 2].map((i) => (
            <div
              key={i}
              className="aspect-[4/3] rounded-xl bg-zinc-100 dark:bg-zinc-800/70 animate-pulse border border-zinc-200/70 dark:border-zinc-700/60"
            />
          ))}
        </div>
      );
    }

    if (visibleImages.length === 0) {
      return (
        <div className="rounded-xl border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 px-4 py-6 text-center text-xs font-medium text-zinc-500">
          {result?.blocked
            ? 'Filtered under SafeSearch guidelines.'
            : 'No photographs found for this query — try a simpler or broader phrasing.'}
        </div>
      );
    }

    const layout = spec.layout || 'fan';

    // 1. SPOTLIGHT: 1 hero + 2 side frames
    if (layout === 'spotlight') {
      const hero = visibleImages[0];
      const side = visibleImages.slice(1, 3);
      return (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <button
            type="button"
            onClick={() => setLightboxIdx(0)}
            className="sm:col-span-2 aspect-[16/10] sm:aspect-auto sm:h-64 rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 group cursor-pointer focus-visible:outline-2"
          >
            <ResilientPhoto
              src={hero.thumbnail || hero.url}
              fallbackSrc={hero.url}
              alt={hero.title || spec.title}
              className="group-hover:scale-[1.03]"
            />
          </button>
          {side.length > 0 && (
            <div className="grid grid-cols-2 sm:grid-cols-1 gap-2.5 sm:h-64">
              {side.map((img, i) => (
                <button
                  key={img.id}
                  type="button"
                  onClick={() => setLightboxIdx(i + 1)}
                  className="aspect-[4/3] sm:aspect-auto sm:h-full rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 group cursor-pointer"
                >
                  <ResilientPhoto
                    src={img.thumbnail || img.url}
                    fallbackSrc={img.url}
                    alt={img.title || spec.title}
                    className="group-hover:scale-[1.04]"
                  />
                </button>
              ))}
            </div>
          )}
        </div>
      );
    }

    // 2. STRIP: wide 16:9 horizontal filmstrip
    if (layout === 'strip') {
      return (
        <div className="flex gap-2.5 overflow-x-auto pb-1.5 snap-x snap-mandatory scrollbar-thin">
          {visibleImages.map((img, idx) => (
            <button
              key={img.id}
              type="button"
              onClick={() => setLightboxIdx(idx)}
              className="snap-start shrink-0 w-64 sm:w-72 aspect-[16/9] rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 group cursor-pointer"
            >
              <ResilientPhoto
                src={img.thumbnail || img.url}
                fallbackSrc={img.url}
                alt={img.title || spec.title}
                className="group-hover:scale-[1.03]"
              />
            </button>
          ))}
        </div>
      );
    }

    // 3. POLAROID: soft portrait print frames (headroom-friendly object-top)
    if (layout === 'polaroid') {
      const tilts = ['-rotate-1', 'rotate-1', '-rotate-[0.6deg]', 'rotate-[0.8deg]', '-rotate-1', 'rotate-1'];
      return (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 py-1">
          {visibleImages.map((img, idx) => (
            <button
              key={img.id}
              type="button"
              onClick={() => setLightboxIdx(idx)}
              className={`bg-white dark:bg-zinc-900 p-2 pb-3 rounded-xl border border-zinc-200/90 dark:border-zinc-800 shadow-sm hover:shadow-md hover:rotate-0 transition-transform duration-200 cursor-pointer text-left ${tilts[idx % tilts.length]}`}
            >
              <div className="aspect-[4/5] w-full rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-800">
                <ResilientPhoto
                  src={img.thumbnail || img.url}
                  fallbackSrc={img.url}
                  alt={img.title || spec.title}
                  objectPositionClass="object-top"
                  className="hover:scale-[1.03]"
                />
              </div>
            </button>
          ))}
        </div>
      );
    }

    // 4. MOSAIC: dense multi-tile bento grid
    if (layout === 'mosaic') {
      return (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {visibleImages.map((img, idx) => (
            <button
              key={img.id}
              type="button"
              onClick={() => setLightboxIdx(idx)}
              className={`${
                idx === 0 ? 'col-span-2 row-span-2 aspect-[4/3] sm:aspect-auto sm:h-full' : 'aspect-square'
              } rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 group cursor-pointer`}
            >
              <ResilientPhoto
                src={img.thumbnail || img.url}
                fallbackSrc={img.url}
                alt={img.title || spec.title}
                className="group-hover:scale-[1.04]"
              />
            </button>
          ))}
        </div>
      );
    }

    // 5. FAN (default): overlapping showcase deck on desktop, 2-col crisp grid on mobile
    const fanAngles = ['-rotate-2', '-rotate-[0.7deg]', 'rotate-[0.7deg]', 'rotate-2', '-rotate-1', 'rotate-1'];
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 sm:gap-3">
        {visibleImages.map((img, idx) => (
          <button
            key={img.id}
            type="button"
            onClick={() => setLightboxIdx(idx)}
            className={`aspect-[4/3] rounded-xl overflow-hidden border border-zinc-200 dark:border-zinc-800 bg-zinc-100 dark:bg-zinc-900 shadow-sm hover:shadow-md hover:rotate-0 hover:z-10 transition-transform duration-200 group cursor-pointer ${fanAngles[idx % fanAngles.length]}`}
          >
            <ResilientPhoto
              src={img.thumbnail || img.url}
              fallbackSrc={img.url}
              alt={img.title || spec.title}
              className="group-hover:scale-[1.04]"
            />
          </button>
        ))}
      </div>
    );
  };

  const activeLightboxImg = lightboxIdx !== null ? visibleImages[lightboxIdx] : null;

  return (
    <>
      <div
        className="my-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-950 p-4 sm:p-5 shadow-sm max-w-3xl"
        style={{ borderTopWidth: '3px', borderTopColor: accentColor }}
      >
        {/* Top editorial title + unboxed subtle metadata */}
        <div className="flex flex-wrap items-baseline justify-between gap-2 mb-3">
          <h4 className="text-base sm:text-lg font-bold tracking-tight text-zinc-900 dark:text-zinc-100 truncate">
            {spec.title}
          </h4>
          {tagsLine && (
            <span className="text-xs font-medium text-zinc-500 dark:text-zinc-400">
              {tagsLine}
            </span>
          )}
        </div>

        {/* Curated image gallery */}
        {renderGallery()}

        {/* Museum-label description */}
        {displayDescription && (
          <p className="mt-3.5 text-sm sm:text-[15px] leading-relaxed font-medium text-zinc-700 dark:text-zinc-300">
            {displayDescription}
          </p>
        )}

        {/* Quiet inline web source credits */}
        {uniqueSources.length > 0 && (
          <div className="mt-2.5 pt-2.5 border-t border-zinc-100 dark:border-zinc-900 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] font-medium text-zinc-400 dark:text-zinc-500">
            <span>Web sources:</span>
            {uniqueSources.map((srcItem, i) => (
              <React.Fragment key={srcItem.domain}>
                {i > 0 && <span aria-hidden="true">·</span>}
                <a
                  href={srcItem.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-zinc-700 dark:hover:text-zinc-300 inline-flex items-center gap-0.5 transition-colors"
                >
                  <span>{srcItem.domain}</span>
                  <ExternalLink size={10} />
                </a>
              </React.Fragment>
            ))}
          </div>
        )}
      </div>

      {/* Minimal Image + Description Lightbox */}
      {activeLightboxImg && (
        <div
          className="fixed inset-0 z-[120] bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 sm:p-6"
          onClick={() => setLightboxIdx(null)}
          role="dialog"
          aria-modal="true"
          aria-label={spec.title}
        >
          <button
            type="button"
            onClick={() => setLightboxIdx(null)}
            className="absolute top-4 right-4 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
            aria-label="Close image viewer"
          >
            <X size={20} />
          </button>

          {visibleImages.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIdx((i) => (i === null ? 0 : (i - 1 + visibleImages.length) % visibleImages.length));
                }}
                className="absolute left-3 sm:left-6 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
                aria-label="Previous image"
              >
                <ChevronLeft size={22} />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setLightboxIdx((i) => (i === null ? 0 : (i + 1) % visibleImages.length));
                }}
                className="absolute right-3 sm:right-6 w-10 h-10 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors cursor-pointer"
                aria-label="Next image"
              >
                <ChevronRight size={22} />
              </button>
            </>
          )}

          <div
            className="max-w-4xl w-full flex flex-col items-center gap-3.5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative w-full max-h-[72vh] flex items-center justify-center rounded-xl overflow-hidden bg-zinc-950/60">
              <ResilientPhoto
                src={activeLightboxImg.url || activeLightboxImg.thumbnail}
                fallbackSrc={activeLightboxImg.thumbnail}
                alt={activeLightboxImg.title || spec.title}
                className="max-h-[72vh] w-auto object-contain"
              />
            </div>

            <div className="w-full max-w-2xl text-center space-y-1.5">
              <h5 className="text-sm sm:text-base font-bold text-white">{spec.title}</h5>
              {displayDescription && (
                <p className="text-xs sm:text-sm text-zinc-300 leading-relaxed">{displayDescription}</p>
              )}
              {activeLightboxImg.sourceDomain && (
                <a
                  href={activeLightboxImg.sourceUrl || activeLightboxImg.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-zinc-400 hover:text-white transition-colors pt-0.5"
                >
                  <span>Source: {activeLightboxImg.sourceDomain}</span>
                  <ExternalLink size={11} />
                </a>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  );
};
