import { Download, X } from 'lucide-react';
import { Button } from '@/components/ui/button';

export interface WebsitePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  htmlContent: string;
  fileName?: string;
  onDownload?: () => void;
}

export function WebsitePreviewModal({ isOpen, onClose, htmlContent, fileName = 'preview.html', onDownload }: WebsitePreviewModalProps) {
  if (!isOpen) return null;
  const download = () => {
    if (onDownload) return onDownload();
    const url = URL.createObjectURL(new Blob([htmlContent], { type: 'text/html;charset=utf-8' }));
    const a = document.createElement('a');
    a.href = url;
    a.download = fileName.endsWith('.html') ? fileName : `${fileName}.html`;
    a.click();
    URL.revokeObjectURL(url);
  };
  return (
    <div role="dialog" aria-label="Website preview" aria-modal="true" className="preview-shell fixed inset-0 z-[11000] flex flex-col overflow-hidden">
      <div className="preview-toolbar flex h-14 shrink-0 items-center justify-end gap-2 px-3">
        <Button variant="ghost" size="icon" onClick={download} title="Download" aria-label="Download"><Download size={18} /></Button>
        <Button variant="ghost" size="icon" onClick={onClose} title="Close preview" aria-label="Close preview"><X size={20} /></Button>
      </div>
      <iframe srcDoc={htmlContent} title="Website Live Preview" sandbox="allow-scripts allow-forms allow-modals" className="preview-frame min-h-0 w-full flex-1 border-0" />
    </div>
  );
}