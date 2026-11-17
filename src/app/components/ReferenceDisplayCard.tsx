import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Maximize2, X, ExternalLink, Image as ImageIcon } from 'lucide-react';
import { ReferenceItem } from '../utils/referenceGallery';

export interface ReferenceDisplayCardProps {
  messageText?: string;
  items: ReferenceItem[];
}

export const ReferenceDisplayCard: React.FC<ReferenceDisplayCardProps> = ({
  messageText = 'It have this some refance',
  items = [],
}) => {
  const [selectedImage, setSelectedImage] = useState<ReferenceItem | null>(null);

  if (!items || items.length === 0) return null;

  return (
    <div className="my-3 space-y-3">
      {/* Unique Style Header Message */}
      <div className="font-semibold text-zinc-900 dark:text-zinc-100 text-base sm:text-lg tracking-tight">
        {messageText}
      </div>

      {/* Reference Diagram Gallery Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {items.map((item, idx) => (
          <div
            key={item.id || idx}
            onClick={() => setSelectedImage(item)}
            className="group relative rounded-2xl overflow-hidden border border-zinc-200/90 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-900/60 shadow-sm hover:shadow-md transition-all cursor-pointer"
          >
            <div className="aspect-[16/10] w-full overflow-hidden bg-zinc-100 dark:bg-zinc-800/80 relative">
              <img
                src={item.url}
                alt={item.title}
                className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                onError={(e) => {
                  (e.target as HTMLElement).style.display = 'none';
                }}
              />
              <div className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition-colors flex items-center justify-center opacity-0 group-hover:opacity-100">
                <span className="w-9 h-9 rounded-full bg-white/90 text-zinc-900 flex items-center justify-center shadow-lg">
                  <Maximize2 size={16} />
                </span>
              </div>
            </div>

            <div className="p-3">
              <h4 className="font-bold text-xs sm:text-sm text-zinc-900 dark:text-zinc-100 truncate">
                {item.title}
              </h4>
              {item.caption && (
                <p className="text-[11px] text-zinc-500 dark:text-zinc-400 truncate mt-0.5">
                  {item.caption}
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Lightbox / Fullscreen Modal */}
      <AnimatePresence>
        {selectedImage && (
          <div
            onClick={() => setSelectedImage(null)}
            className="fixed inset-0 z-[10002] flex items-center justify-center p-4 bg-black/80"
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              onClick={(e) => e.stopPropagation()}
              className="relative max-w-4xl max-h-[85vh] bg-[#121319] rounded-2xl overflow-hidden shadow-2xl border border-zinc-800 flex flex-col"
            >
              <div className="px-4 py-3 bg-[#181922] border-b border-zinc-800 flex items-center justify-between text-white">
                <span className="font-bold text-sm truncate">{selectedImage.title}</span>
                <button
                  type="button"
                  onClick={() => setSelectedImage(null)}
                  className="w-7 h-7 rounded-lg hover:bg-white/10 flex items-center justify-center text-zinc-400 hover:text-white"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex-1 overflow-auto p-2 flex items-center justify-center bg-black/40">
                <img
                  src={selectedImage.url}
                  alt={selectedImage.title}
                  className="max-w-full max-h-[70vh] object-contain rounded-lg"
                />
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};
