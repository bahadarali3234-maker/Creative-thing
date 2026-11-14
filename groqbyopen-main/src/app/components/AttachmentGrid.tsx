import { FileText, FileArchive, Film, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { AttachedFile } from '../types';

export function AttachmentGrid({ files, onRemove, disabled = false }: {
  files: AttachedFile[];
  onRemove?: (id: string) => void;
  disabled?: boolean;
}) {
  return (
    <div className="attachment-grid">
      {files.map((file) => (
        <div key={file.id} className={`attachment-tile ${file.isImage ? 'attachment-image' : 'attachment-file'}`} title={file.name}>
          {file.isImage && file.preview ? (
            <img src={file.preview} alt={file.name} />
          ) : (
            <div className="attachment-document">
              <div className="attachment-file-icon">{file.type?.startsWith('video/') ? <Film size={23} /> : /\.zip$/i.test(file.name) ? <FileArchive size={23} /> : <FileText size={23} />}</div>
              <div className="attachment-file-label"><span>{file.name}</span><small>{file.name.split('.').pop()?.toUpperCase() || 'FILE'}</small></div>
            </div>
          )}
          {onRemove && (
            <Button type="button" variant="ghost" size="icon" className="attachment-remove"
              disabled={disabled} onClick={() => onRemove(file.id)}
              title={`Remove ${file.name}`} aria-label={`Remove ${file.name}`}>
              <X size={16} />
            </Button>
          )}
        </div>
      ))}
    </div>
  );
}