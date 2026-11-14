import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Image as ImageIcon,
  Plus,
  Trash2,
  Check,
  Upload,
  ExternalLink,
  Eye,
  Sliders,
  Sparkles,
  Info,
} from 'lucide-react';
import {
  ReferenceConfig,
  ReferenceItem,
  getReferenceConfig,
  saveReferenceConfig,
  DEFAULT_REFERENCE_CONFIG,
} from '../utils/referenceGallery';

export interface ReferenceGalleryModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPreviewInChat?: (messageText: string, items: ReferenceItem[]) => void;
}

export const ReferenceGalleryModal: React.FC<ReferenceGalleryModalProps> = ({
  isOpen,
  onClose,
  onPreviewInChat,
}) => {
  const [config, setConfig] = useState<ReferenceConfig>(DEFAULT_REFERENCE_CONFIG);
  const [newTitle, setNewTitle] = useState('');
  const [newUrl, setNewUrl] = useState('');
  const [newKeywords, setNewKeywords] = useState('');
  const [showSavedToast, setShowSavedToast] = useState(false);
  const fileUploadRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      const stored = getReferenceConfig();
      setConfig(stored);
      setNewKeywords(stored.triggerKeywords.join(', '));
    }
  }, [isOpen]);

  const handleSave = () => {
    const updatedKeywords = newKeywords
      .split(',')
      .map((k) => k.trim())
      .filter(Boolean);
    const updated: ReferenceConfig = {
      ...config,
      triggerKeywords: updatedKeywords.length > 0 ? updatedKeywords : DEFAULT_REFERENCE_CONFIG.triggerKeywords,
    };
    setConfig(updated);
    saveReferenceConfig(updated);
    setShowSavedToast(true);
    setTimeout(() => setShowSavedToast(false), 2200);
  };

  const handleAddImageUrl = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newUrl.trim()) return;

    const newItem: ReferenceItem = {
      id: `ref-${Date.now()}`,
      title: newTitle.trim() || `Reference Asset ${config.items.length + 1}`,
      url: newUrl.trim(),
    };

    const updated = {
      ...config,
      items: [...config.items, newItem],
    };
    setConfig(updated);
    saveReferenceConfig(updated);
    setNewTitle('');
    setNewUrl('');
  };

  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      if (!dataUrl) return;

      const newItem: ReferenceItem = {
        id: `ref-${Date.now()}`,
        title: file.name.replace(/\.[^/.]+$/, '') || `Uploaded Reference ${config.items.length + 1}`,
        url: dataUrl,
      };

      const updated = {
        ...config,
        items: [...config.items, newItem],
      };
      setConfig(updated);
      saveReferenceConfig(updated);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const handleDeleteItem = (id: string) => {
    const updated = {
      ...config,
      items: config.items.filter((item) => item.id !== id),
    };
    setConfig(updated);
    saveReferenceConfig(updated);
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-[10000] flex items-center justify-center p-3 sm:p-5 bg-black/60 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 14 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 14 }}
          className="w-full max-w-2xl bg-white dark:bg-[#121319] text-zinc-900 dark:text-zinc-100 rounded-3xl border border-zinc-200 dark:border-zinc-800 shadow-2xl flex flex-col max-h-[90vh] overflow-hidden"
        >
          {/* Header */}
          <div className="px-5 sm:px-6 py-4 border-b border-zinc-100 dark:border-zinc-800/80 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-2xl bg-[#00a6ff]/10 text-[#00a6ff] flex items-center justify-center shrink-0">
                <ImageIcon size={20} strokeWidth={2.2} />
              </div>
              <div>
                <h3 className="font-bold text-base sm:text-lg leading-tight text-zinc-900 dark:text-zinc-50">
                  Reference Images & Diagram Section
                </h3>
                <p className="text-xs text-zinc-500 dark:text-zinc-400">
                  Configure custom diagram references shown for sensitive or policy queries
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="w-9 h-9 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800 text-zinc-500 hover:text-zinc-900 dark:hover:text-zinc-100 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>

          {/* Modal Body */}
          <div className="p-5 sm:p-6 overflow-y-auto space-y-6 flex-1 text-xs sm:text-sm">
            {/* 1. Custom Response Message */}
            <div className="space-y-2">
              <label className="font-semibold text-zinc-900 dark:text-zinc-200 flex items-center justify-between">
                <span>Response Message Text</span>
                <span className="text-[11px] text-zinc-400 font-normal">Shown before reference diagrams</span>
              </label>
              <input
                type="text"
                value={config.messageText}
                onChange={(e) => setConfig({ ...config, messageText: e.target.value })}
                placeholder="e.g. It have this some refance"
                className="w-full px-4 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-[#00a6ff] text-sm"
              />
              <p className="text-[11px] text-zinc-500 dark:text-zinc-400 flex items-start gap-1.5 pt-0.5">
                <Info size={13} className="shrink-0 mt-0.5 text-[#00a6ff]" />
                <span>
                  When queries touch restricted topics, this clean phrase and your diagram references appear gracefully without moralizing error messages.
                </span>
              </p>
            </div>

            {/* 2. Add New Image Form (URL or Local Upload) */}
            <div className="p-4 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200/90 dark:border-zinc-800/80 space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-zinc-900 dark:text-zinc-200">Add New Reference Image</span>
                <button
                  type="button"
                  onClick={() => fileUploadRef.current?.click()}
                  className="px-3 py-1.5 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 text-xs font-semibold flex items-center gap-1.5 hover:border-[#00a6ff] transition-all cursor-pointer"
                >
                  <Upload size={13} />
                  <span>Upload from Device</span>
                </button>
                <input
                  ref={fileUploadRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileUpload}
                  className="hidden"
                />
              </div>

              <form onSubmit={handleAddImageUrl} className="space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <input
                    type="text"
                    placeholder="Image Title / Description (e.g. Diagram 01)"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    className="px-3.5 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-xs focus:outline-none focus:border-[#00a6ff]"
                  />
                  <input
                    type="url"
                    placeholder="Image URL (https://...)"
                    value={newUrl}
                    onChange={(e) => setNewUrl(e.target.value)}
                    className="px-3.5 py-2 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-700 text-xs focus:outline-none focus:border-[#00a6ff]"
                  />
                </div>
                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={!newUrl.trim()}
                    className="px-4 py-2 rounded-xl bg-[#00a6ff] hover:bg-[#0092e0] text-white text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer disabled:opacity-50"
                  >
                    <Plus size={14} />
                    <span>Add to Reference Gallery</span>
                  </button>
                </div>
              </form>
            </div>

            {/* 3. Reference Images Gallery List */}
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-semibold text-zinc-900 dark:text-zinc-200">
                  Configured Images ({config.items.length})
                </span>
                <span className="text-[11px] text-zinc-400">Rendered in grid below response</span>
              </div>

              {config.items.length === 0 ? (
                <div className="p-8 text-center border border-dashed border-zinc-200 dark:border-zinc-800 rounded-2xl text-zinc-400">
                  No images added yet. Upload an image or add an image URL above.
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {config.items.map((item, idx) => (
                    <div
                      key={item.id}
                      className="p-3 rounded-2xl bg-zinc-50 dark:bg-zinc-900/60 border border-zinc-200 dark:border-zinc-800 flex items-center gap-3 relative group overflow-hidden"
                    >
                      <div className="w-16 h-16 rounded-xl overflow-hidden bg-zinc-200 dark:bg-zinc-800 shrink-0 border border-zinc-200 dark:border-zinc-700">
                        <img
                          src={item.url}
                          alt={item.title}
                          className="w-full h-full object-cover"
                          onError={(e) => {
                            (e.target as HTMLElement).style.display = 'none';
                          }}
                        />
                      </div>

                      <div className="min-w-0 flex-1">
                        <h4 className="font-bold text-xs text-zinc-900 dark:text-zinc-100 truncate">
                          {idx + 1}. {item.title}
                        </h4>
                        <p className="text-[10px] text-zinc-400 truncate mt-0.5 font-mono">
                          {item.url}
                        </p>
                      </div>

                      <button
                        type="button"
                        onClick={() => handleDeleteItem(item.id)}
                        className="w-7 h-7 rounded-lg bg-zinc-200 hover:bg-red-500 text-zinc-600 hover:text-white dark:bg-zinc-800 dark:hover:bg-red-500 dark:text-zinc-400 flex items-center justify-center transition-colors cursor-pointer shrink-0"
                        title="Delete reference"
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* 4. Trigger Keywords */}
            <div className="space-y-2">
              <label className="font-semibold text-zinc-900 dark:text-zinc-200 flex items-center justify-between">
                <span>Trigger Keywords</span>
                <span className="text-[11px] text-zinc-400 font-normal">Comma-separated words</span>
              </label>
              <input
                type="text"
                value={newKeywords}
                onChange={(e) => setNewKeywords(e.target.value)}
                placeholder="policy, sensitive, diagram, reference, architecture"
                className="w-full px-4 py-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-900/80 border border-zinc-200 dark:border-zinc-800 text-zinc-900 dark:text-zinc-100 focus:outline-none focus:border-[#00a6ff] text-xs font-mono"
              />
            </div>
          </div>

          {/* Modal Footer */}
          <div className="px-5 sm:px-6 py-3.5 bg-zinc-50 dark:bg-zinc-900/80 border-t border-zinc-100 dark:border-zinc-800 flex items-center justify-between">
            <button
              type="button"
              onClick={() => {
                if (onPreviewInChat) {
                  onPreviewInChat(config.messageText, config.items);
                  onClose();
                }
              }}
              className="px-3.5 py-2 rounded-xl bg-white dark:bg-zinc-800 border border-zinc-200 dark:border-zinc-700 text-zinc-700 dark:text-zinc-200 text-xs font-semibold flex items-center gap-1.5 hover:bg-zinc-100 dark:hover:bg-zinc-700 transition-all cursor-pointer"
            >
              <Eye size={14} />
              <span>Preview in Chat</span>
            </button>

            <div className="flex items-center gap-2">
              {showSavedToast && (
                <span className="text-xs text-emerald-500 font-medium flex items-center gap-1">
                  <Check size={14} />
                  <span>Saved!</span>
                </span>
              )}
              <button
                type="button"
                onClick={handleSave}
                className="px-5 py-2 rounded-xl bg-[#00a6ff] hover:bg-[#0092e0] text-white text-xs font-bold transition-all shadow-md cursor-pointer"
              >
                Save Settings
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
};
