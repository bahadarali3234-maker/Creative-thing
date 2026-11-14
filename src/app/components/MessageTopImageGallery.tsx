// @ts-nocheck
import React, { useState } from 'react';
import { Download, X } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export interface GalleryImage {
  id: string;
  url: string;
  thumbnail?: string;
  alt: string;
  title?: string;
  sourceUrl?: string;
  sourceTitle?: string;
  sourceDomain?: string;
  width?: number;
  height?: number;
  score?: number;
}

export interface SubjectGalleryGroup {
  label: string;
  intent?: string;
  shortReplyText?: string;
  images: GalleryImage[];
  backupPool?: GalleryImage[];
  googleSearchUrl?: string;
}

export interface MessageTopImageGalleryProps {
  promptOrTopic?: string;
  subjects?: SubjectGalleryGroup[];
  customImages?: GalleryImage[];
  mode?: 'NONE' | 'AUTO_REFERENCE' | 'USER_REQUESTED';
  shortReplyText?: string;
  googleSearchUrl?: string;
}

export const MessageTopImageGallery: React.FC<MessageTopImageGalleryProps> = ({
  subjects,
  customImages,
  mode = 'AUTO_REFERENCE',
  shortReplyText,
}) => {
  const [lightboxImage, setLightboxImage] = useState<GalleryImage | null>(null);

  // Flatten and limit to strictly 3 or 4 images max
  let allImages: GalleryImage[] = [];
  if (customImages && customImages.length > 0) {
    allImages = [...customImages];
  } else if (subjects && subjects.length > 0) {
    for (const group of subjects) {
      if (group.images && group.images.length > 0) {
        allImages.push(...group.images);
      }
    }
  }

  // Strictly 3 to 4 images
  const imagesToShow = allImages.slice(0, 4);

  if (imagesToShow.length === 0) {
    return null;
  }

  // Handle Download
  const handleDownload = (e: React.MouseEvent, img: GalleryImage) => {
    e.stopPropagation();
    const link = document.createElement('a');
    link.href = `/api/image-proxy?url=${encodeURIComponent(img.url)}`;
    link.target = '_blank';
    link.download = `${img.id || 'reference-image'}.jpg`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="reference-gallery w-full my-3 select-none">
      {/* Optional Short intro text if present */}
      {shortReplyText && (
        <div className="text-foreground text-xs sm:text-sm font-medium leading-relaxed px-0.5 mb-2.5">
          {shortReplyText}
        </div>
      )}

      {/* Clean, elegant 3 to 4 Image Grid (No extra text or outer cards) */}
      <div
        className={`grid gap-2 sm:gap-3 ${
          imagesToShow.length === 2
            ? 'grid-cols-2'
            : imagesToShow.length === 3
            ? 'grid-cols-2 sm:grid-cols-3'
            : 'grid-cols-2 sm:grid-cols-4'
        }`}
      >
        {imagesToShow.map((img, idx) => (
          <motion.div
            key={img.id || idx}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.22, delay: idx * 0.04 }}
            onClick={() => setLightboxImage(img)}
            className="group relative aspect-[4/3] rounded-2xl overflow-hidden bg-zinc-900 border border-border shadow-sm hover:shadow-md cursor-pointer transition-all active:scale-[0.98]"
            title={img.title || img.alt || 'Click to preview'}
          >
            <img
              src={img.thumbnail || img.url}
              alt={img.alt || 'Reference photo'}
              loading="lazy"
              onError={(e) => {
                const target = e.currentTarget;
                const proxyUrl = `/api/image-proxy?url=${encodeURIComponent(img.url)}`;
                if (target.src !== proxyUrl && !target.src.includes('/api/image-proxy')) {
                  target.src = proxyUrl;
                }
              }}
              className="w-full h-full object-cover object-center group-hover:scale-105 transition-transform duration-500 ease-out"
            />
            {/* Subtle hover gradient */}
            <div className="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors pointer-events-none" />
          </motion.div>
        ))}
      </div>

      {/* Tight Lightbox Overlay — Cross icon directly on top of the image */}
      <AnimatePresence>
        {lightboxImage && (
          <div
            className="fixed inset-0 z-[12500] bg-black/85 backdrop-blur-md flex items-center justify-center p-3 sm:p-6"
            onClick={() => setLightboxImage(null)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.94 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.94 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="relative max-w-[92vw] max-h-[85vh] rounded-2xl overflow-hidden shadow-2xl bg-black border border-white/15 flex items-center justify-center"
              onClick={(e) => e.stopPropagation()}
            >
              <img
                src={lightboxImage.url}
                alt={lightboxImage.alt || 'Full preview'}
                onError={(e) => {
                  const target = e.currentTarget;
                  const proxyUrl = `/api/image-proxy?url=${encodeURIComponent(lightboxImage.url)}`;
                  if (target.src !== proxyUrl && !target.src.includes('/api/image-proxy')) {
                    target.src = proxyUrl;
                  }
                }}
                className="max-w-[92vw] max-h-[85vh] w-auto h-auto object-contain block rounded-2xl"
              />

              {/* Floating controls directly on image top-right */}
              <div className="absolute top-3 right-3 z-30 flex items-center gap-2 pointer-events-auto">
                <button
                  type="button"
                  onClick={(e) => handleDownload(e, lightboxImage)}
                  className="w-9 h-9 rounded-full bg-black/70 hover:bg-black/90 text-white flex items-center justify-center backdrop-blur-md border border-white/20 transition-all shadow-lg active:scale-95 cursor-pointer"
                  title="Download Image"
                  aria-label="Download Image"
                >
                  <Download size={16} />
                </button>
                <button
                  type="button"
                  onClick={() => setLightboxImage(null)}
                  className="w-9 h-9 rounded-full bg-black/70 hover:bg-black/90 text-white flex items-center justify-center backdrop-blur-md border border-white/20 transition-all shadow-lg active:scale-95 cursor-pointer"
                  title="Close (Esc)"
                  aria-label="Close"
                >
                  <X size={18} strokeWidth={2.5} />
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
