import React, { useState } from 'react';
import { FileText, FileArchive, Film, FileCode, Play, Image as ImageIcon, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { AttachedFile } from '../types';
import { AttachmentPreviewModal } from './AttachmentPreviewModal';

export interface AttachmentGridProps {
  files: AttachedFile[];
  onRemove?: (id: string) => void;
  onFileClick?: (file: AttachedFile) => void;
  disabled?: boolean;
}

export function AttachmentGrid({
  files,
  onRemove,
  onFileClick,
  disabled = false,
}: AttachmentGridProps) {
  const [selectedFileForPreview, setSelectedFileForPreview] = useState<AttachedFile | null>(null);

  if (!files || files.length === 0) return null;

  const handleTileClick = (file: AttachedFile) => {
    if (onFileClick) {
      onFileClick(file);
    } else {
      setSelectedFileForPreview(file);
    }
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return '';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  return (
    <>
      <div className="attachment-grid flex items-center gap-2.5 py-1.5 overflow-x-auto overflow-y-hidden max-w-full select-none">
        {files.map((file) => {
          const isImg = file.isImage || file.type?.startsWith('image/');
          const isVideo = file.type?.startsWith('video/') || /\.(mp4|webm|mov|ogg)$/i.test(file.name);
          const isAudio = file.type?.startsWith('audio/') || /\.(mp3|wav|ogg|m4a)$/i.test(file.name);
          const isCode =
            Boolean(file.codeContent) ||
            /\.(tsx|ts|jsx|js|html|htm|css|scss|py|json|sql|cpp|c|rs|go|php|sh|java)$/i.test(file.name);
          const ext = file.name.split('.').pop()?.toUpperCase() || (isCode ? 'CODE' : isImg ? 'IMG' : 'FILE');

          return (
            <div
              key={file.id}
              onClick={() => handleTileClick(file)}
              className={`attachment-tile relative flex items-center gap-2.5 p-2 rounded-2xl border transition-all cursor-pointer group shrink-0 shadow-sm hover:shadow-md active:scale-[0.98] ${
                isCode
                  ? 'border-[#00a6ff]/40 bg-white hover:border-[#00a6ff]'
                  : 'border-zinc-200/90 bg-white hover:border-[#00a6ff]/60'
              }`}
              style={{ width: '200px', height: '64px' }}
              title={`Tap to preview ${file.name} (${formatSize(file.size)})`}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') {
                  e.preventDefault();
                  handleTileClick(file);
                }
              }}
            >
              {/* Left Side: Thumbnail or Icon Box (Consistent 46x46 box across all files) */}
              <div className="w-[46px] h-[46px] rounded-xl overflow-hidden shrink-0 bg-zinc-100 border border-zinc-200/80 flex items-center justify-center relative">
                {isImg && file.preview ? (
                  <img
                    src={file.preview}
                    alt={file.name}
                    className="w-full h-full object-cover"
                  />
                ) : isVideo && file.preview ? (
                  <div className="relative w-full h-full bg-zinc-900 flex items-center justify-center">
                    <video src={file.preview} className="w-full h-full object-cover opacity-80" />
                    <div className="absolute inset-0 flex items-center justify-center bg-black/30">
                      <Play size={14} className="text-white fill-white" />
                    </div>
                  </div>
                ) : isCode ? (
                  <div className="w-full h-full bg-[#00a6ff]/10 text-[#00a6ff] flex items-center justify-center">
                    <FileCode size={22} strokeWidth={2.2} />
                  </div>
                ) : isVideo ? (
                  <div className="w-full h-full bg-amber-500/10 text-amber-500 flex items-center justify-center">
                    <Film size={22} strokeWidth={2.2} />
                  </div>
                ) : isAudio ? (
                  <div className="w-full h-full bg-purple-500/10 text-purple-500 flex items-center justify-center">
                    <Film size={22} strokeWidth={2.2} />
                  </div>
                ) : /\.zip$/i.test(file.name) ? (
                  <div className="w-full h-full bg-orange-500/10 text-orange-500 flex items-center justify-center">
                    <FileArchive size={22} strokeWidth={2.2} />
                  </div>
                ) : (
                  <div className="w-full h-full bg-zinc-100 text-zinc-600 flex items-center justify-center">
                    <FileText size={22} strokeWidth={2.2} />
                  </div>
                )}
              </div>

              {/* Right Side: Name & Metadata */}
              <div className="flex-1 min-w-0 pr-5">
                <p className="text-xs font-bold text-zinc-900 truncate leading-snug group-hover:text-[#00a6ff] transition-colors">
                  {file.name}
                </p>
                <div className="flex items-center gap-1.5 mt-0.5">
                  <span
                    className={`text-[9px] font-mono font-bold uppercase px-1.5 py-0.2 rounded-md ${
                      isCode
                        ? 'bg-[#00a6ff]/15 text-[#00a6ff]'
                        : isImg
                        ? 'bg-emerald-500/15 text-emerald-600'
                        : isVideo
                        ? 'bg-amber-500/15 text-amber-600'
                        : 'bg-zinc-100 text-zinc-600'
                    }`}
                  >
                    {ext}
                  </span>
                  {file.size ? (
                    <span className="text-[10px] text-zinc-400 font-mono">
                      {formatSize(file.size)}
                    </span>
                  ) : (
                    <span className="text-[10px] text-zinc-400 font-mono">Tap to view</span>
                  )}
                </div>
              </div>

              {/* Remove (X) Button */}
              {onRemove && (
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="absolute right-1 top-1 w-6 h-6 rounded-full bg-zinc-100 hover:bg-zinc-200 text-zinc-500 hover:text-zinc-900 z-10 transition-colors"
                  disabled={disabled}
                  onClick={(e) => {
                    e.stopPropagation();
                    onRemove(file.id);
                  }}
                  title={`Remove ${file.name}`}
                  aria-label={`Remove ${file.name}`}
                >
                  <X size={12} strokeWidth={2.5} />
                </Button>
              )}
            </div>
          );
        })}
      </div>

      {/* Embedded Rich Preview Modal */}
      <AttachmentPreviewModal
        isOpen={Boolean(selectedFileForPreview)}
        file={selectedFileForPreview}
        onClose={() => setSelectedFileForPreview(null)}
        onRemove={onRemove}
      />
    </>
  );
}