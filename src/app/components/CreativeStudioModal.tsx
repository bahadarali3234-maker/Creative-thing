import React, { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  X,
  Download,
  Copy,
  Trash2,
  Play,
  Loader2,
  Sparkles,
  Image as ImageIcon,
  Film,
  Volume2,
  Palette,
  Scissors,
  Upload,
  Check,
  ArrowUpRight,
  Plus,
} from 'lucide-react';
import {
  PALETTES,
  FONTS,
  STUDIO_VOICES,
  ThumbnailTemplate,
  ImageFormatTemplate,
  VideoTemplate,
  allTemplates,
  renderThumbnail,
  saveTemplate,
  deleteTemplate,
  loadCustomTemplates,
  saveAllCustomTemplatesLocal,
  mergeFirestoreCustomTemplates,
  removeBackground,
  loadImageElement,
  fileToDataURL,
} from '../utils/mythoriaLib';
import { subscribeToAuth, subscribeToCustomTemplates } from '../firebase';
import { speakWithGeminiTts, stopGeminiTts } from '../utils/geminiTts';
import { AttachedFile } from '../types';

export type StudioTabId =
  | 'thumbnails'
  | 'images'
  | 'videos'
  | 'voices'
  | 'styles'
  | 'cutout';

export interface CreativeStudioModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLaunchPromptInChat?: (prompt: string, attachedFile?: AttachedFile) => void;
}

const ThumbnailCanvasPreview: React.FC<{
  tpl: ThumbnailTemplate;
  title: string;
  subtitle: string;
  badge: string;
  subjectImg: HTMLImageElement | null;
  onDownload: (tpl: ThumbnailTemplate) => void;
  onDuplicate: (tpl: ThumbnailTemplate) => void;
  onDelete: (id: string) => void;
  onUseInChat: (tpl: ThumbnailTemplate) => void;
}> = ({
  tpl,
  title,
  subtitle,
  badge,
  subjectImg,
  onDownload,
  onDuplicate,
  onDelete,
  onUseInChat,
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    renderThumbnail(cv, tpl, {
      title,
      subtitle,
      badge: badge || tpl.text?.badge?.text || '',
      image: subjectImg,
    });
  }, [tpl, title, subtitle, badge, subjectImg]);

  return (
    <div className="rounded-2xl bg-white border border-zinc-200 overflow-hidden flex flex-col">
      <div className="p-2.5 bg-[#0B1020] flex items-center justify-center">
        <canvas
          ref={canvasRef}
          className="w-full h-auto max-h-44 object-contain rounded-lg"
        />
      </div>

      <div className="p-3.5 flex-1 flex flex-col justify-between gap-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <h4 className="text-sm font-extrabold text-[#0A2A66] truncate">
              {tpl.name}
            </h4>
            <p className="text-[11px] font-semibold text-zinc-500 tabular-nums mt-0.5">
              {tpl.size[0]} × {tpl.size[1]} · {tpl.category?.slice(0, 2).join(', ') || 'preset'}
            </p>
          </div>
          {tpl.custom && (
            <span className="text-[10px] font-extrabold text-[#0A2A66] bg-[#00A6FF]/15 px-2 py-0.5 rounded shrink-0">
              CUSTOM
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-1.5">
          <button
            type="button"
            onClick={() => onUseInChat(tpl)}
            className="flex-1 min-h-[38px] px-3 rounded-lg bg-[#0A2A66] hover:bg-[#1450C8] text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer transition-colors"
          >
            <ArrowUpRight size={13} />
            <span>Use in Chat</span>
          </button>

          <button
            type="button"
            onClick={() => onDownload(tpl)}
            className="min-h-[38px] px-2.5 rounded-lg border border-zinc-200 hover:border-[#00A6FF] text-zinc-700 text-xs font-bold flex items-center gap-1 cursor-pointer"
            title="Download PNG"
          >
            <Download size={13} />
            <span>PNG</span>
          </button>

          <button
            type="button"
            onClick={() => onDuplicate(tpl)}
            className="min-h-[38px] px-2.5 rounded-lg border border-zinc-200 hover:border-[#00A6FF] text-zinc-700 text-xs font-bold flex items-center gap-1 cursor-pointer"
            title="Save a custom copy"
          >
            <Copy size={13} />
          </button>

          {tpl.custom && (
            <button
              type="button"
              onClick={() => onDelete(tpl.id)}
              className="min-h-[38px] px-2.5 rounded-lg border border-red-200 hover:bg-red-50 text-red-600 text-xs font-bold flex items-center justify-center cursor-pointer"
              title="Delete custom template"
            >
              <Trash2 size={13} />
            </button>
          )}
        </div>
      </div>
    </div>
  );
};

export const CreativeStudioModal: React.FC<CreativeStudioModalProps> = ({
  isOpen,
  onClose,
  onLaunchPromptInChat,
}) => {
  const [activeTab, setActiveTab] = useState<StudioTabId>('thumbnails');
  const [refreshTick, setRefreshTick] = useState(0);
  const [toastMsg, setToastMsg] = useState<string | null>(null);

  // Thumbnail preview inputs
  const [thumbTitle, setThumbTitle] = useState('HOW AI VIDEOS WORK');
  const [thumbSubtitle, setThumbSubtitle] = useState('60-Second Studio Guide');
  const [thumbBadge, setThumbBadge] = useState('');
  const [subjectDataUrl, setSubjectDataUrl] = useState<string | null>(null);
  const [subjectImgEl, setSubjectImgEl] = useState<HTMLImageElement | null>(null);

  // Voice tester state
  const [testingVoiceId, setTestingVoiceId] = useState<string | null>(null);

  // Background Remover state
  const [cutoutBusy, setCutoutBusy] = useState(false);
  const [cutoutOrigUrl, setCutoutOrigUrl] = useState<string | null>(null);
  const [cutoutResultUrl, setCutoutResultUrl] = useState<string | null>(null);
  const [cutoutMethod, setCutoutMethod] = useState<'ai' | 'simple' | null>(null);
  const [cutoutFileName, setCutoutFileName] = useState<string>('cutout.png');

  const jsonImportRef = useRef<HTMLInputElement | null>(null);
  const cutoutInputRef = useRef<HTMLInputElement | null>(null);
  const subjectInputRef = useRef<HTMLInputElement | null>(null);

  const showToast = (msg: string) => {
    setToastMsg(msg);
    setTimeout(() => setToastMsg((curr) => (curr === msg ? null : curr)), 2600);
  };

  // Real-time Firebase Firestore sync + local template update events
  useEffect(() => {
    const onLocalUpdate = () => setRefreshTick((n) => n + 1);
    window.addEventListener('mythoria-templates-updated', onLocalUpdate);

    let unsubTemplates: (() => void) | null = null;
    const unsubAuth = subscribeToAuth((user) => {
      if (unsubTemplates) {
        unsubTemplates();
        unsubTemplates = null;
      }
      if (user && !user.isAnonymous && user.uid) {
        unsubTemplates = subscribeToCustomTemplates(user.uid, (remoteItems) => {
          mergeFirestoreCustomTemplates(remoteItems);
          setRefreshTick((n) => n + 1);
        });
      }
    });

    return () => {
      window.removeEventListener('mythoria-templates-updated', onLocalUpdate);
      unsubAuth();
      if (unsubTemplates) unsubTemplates();
    };
  }, []);

  useEffect(() => {
    if (!isOpen) {
      stopGeminiTts();
      setTestingVoiceId(null);
    }
  }, [isOpen]);

  useEffect(() => {
    if (!subjectDataUrl) {
      setSubjectImgEl(null);
      return;
    }
    loadImageElement(subjectDataUrl)
      .then((img) => setSubjectImgEl(img))
      .catch(() => setSubjectImgEl(null));
  }, [subjectDataUrl]);

  if (!isOpen) return null;

  const thumbs = allTemplates('thumbnail') as ThumbnailTemplate[];
  const imageFormats = allTemplates('image') as ImageFormatTemplate[];
  const videoTemplates = allTemplates('video') as VideoTemplate[];

  const handleDownloadThumbPng = async (tpl: ThumbnailTemplate) => {
    const cv = document.createElement('canvas');
    await renderThumbnail(cv, tpl, {
      title: thumbTitle,
      subtitle: thumbSubtitle,
      badge: thumbBadge || tpl.text?.badge?.text || '',
      image: subjectImgEl,
    });
    const a = document.createElement('a');
    a.download = `${tpl.id}.png`;
    a.href = cv.toDataURL('image/png');
    a.click();
    showToast(`Downloaded ${tpl.name} (${tpl.size[0]}×${tpl.size[1]} PNG)`);
  };

  const handleDuplicateThumb = (tpl: ThumbnailTemplate) => {
    const copy: ThumbnailTemplate = {
      ...JSON.parse(JSON.stringify(tpl)),
      id: `${tpl.id}-${Date.now().toString(36).slice(-4)}`,
      name: `${tpl.name} Copy`,
      custom: true,
    };
    saveTemplate(copy);
    setRefreshTick((n) => n + 1);
    showToast(`Saved "${copy.name}" locally & synced to cloud`);
  };

  const handleDeleteTemplate = (id: string) => {
    deleteTemplate(id);
    setRefreshTick((n) => n + 1);
    showToast('Custom template deleted');
  };

  const handleExportCustomJson = () => {
    const customList = loadCustomTemplates();
    const blob = new Blob([JSON.stringify(customList, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'mythoria_custom_templates.json';
    a.click();
    showToast(`Exported ${customList.length} custom template(s)`);
  };

  const handleImportJson = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text());
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      const existing = loadCustomTemplates();
      const map = new Map(existing.map((x) => [x.id, x]));
      for (const item of arr) {
        if (item?.id) {
          saveTemplate(item);
          map.set(item.id, { ...item, custom: true });
        }
      }
      saveAllCustomTemplatesLocal(Array.from(map.values()));
      setRefreshTick((n) => n + 1);
      showToast(`Imported ${arr.length} template(s)`);
    } catch {
      showToast('Invalid template JSON file');
    } finally {
      e.target.value = '';
    }
  };

  const handleSubjectUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const dataUrl = await fileToDataURL(file);
      setSubjectDataUrl(dataUrl);
      showToast('Subject image applied to thumbnail previews');
    } catch {
      showToast('Could not read selected image');
    } finally {
      e.target.value = '';
    }
  };

  const handleRunCutout = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setCutoutFileName(file.name.replace(/\.[^.]+$/, '') + '_cutout.png');
    setCutoutBusy(true);
    setCutoutResultUrl(null);
    try {
      const orig = await fileToDataURL(file);
      setCutoutOrigUrl(orig);
      const res = await removeBackground(file);
      setCutoutResultUrl(res.dataURL);
      setCutoutMethod(res.method);
    } catch {
      showToast('Background removal failed');
    } finally {
      setCutoutBusy(false);
      e.target.value = '';
    }
  };

  const launchPrompt = (prompt: string, attachedDataUrl?: string, attachedName?: string) => {
    if (!onLaunchPromptInChat) return;
    const attachment: AttachedFile | undefined = attachedDataUrl
      ? {
          id: `studio-att-${Date.now()}`,
          name: attachedName || 'studio_cutout.png',
          size: attachedDataUrl.length,
          type: 'image/png',
          isImage: true,
          preview: attachedDataUrl,
        }
      : undefined;
    onClose();
    onLaunchPromptInChat(prompt, attachment);
  };

  const TABS: Array<{ id: StudioTabId; label: string; icon: React.ReactNode }> = [
    { id: 'thumbnails', label: 'Thumbnails', icon: <ImageIcon size={15} /> },
    { id: 'images', label: 'Image Formats', icon: <Plus size={15} /> },
    { id: 'videos', label: 'Video Templates', icon: <Film size={15} /> },
    { id: 'voices', label: 'Voices', icon: <Volume2 size={15} /> },
    { id: 'styles', label: 'Palettes & Fonts', icon: <Palette size={15} /> },
    { id: 'cutout', label: 'Background Remover', icon: <Scissors size={15} /> },
  ];

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={onClose}
        className="fixed inset-0 z-[10005] bg-black/50 backdrop-blur-sm flex items-center justify-center p-2 sm:p-5"
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.97, y: 12 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.97, y: 12 }}
          onClick={(e) => e.stopPropagation()}
          className="w-full max-w-6xl h-[90vh] rounded-3xl bg-[#F4F8FC] border border-zinc-200 shadow-2xl flex flex-col overflow-hidden text-zinc-900"
        >
          {/* Header */}
          <div className="px-5 py-4 bg-white border-b border-zinc-200 flex items-center justify-between gap-3 shrink-0">
            <div className="flex items-center gap-3 min-w-0">
              <div className="w-10 h-10 rounded-xl bg-[#0A2A66] text-white flex items-center justify-center shrink-0">
                <Sparkles size={19} />
              </div>
              <div className="min-w-0">
                <h2 className="text-base sm:text-lg font-extrabold text-[#0A2A66] truncate">
                  Creative Studio · MythoriaLib
                </h2>
                <p className="text-xs font-medium text-zinc-500 truncate">
                  Thumbnails, posters, videos (up to 120s), Gemini Studio voices, &amp; background cutouts
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] min-w-[44px] rounded-xl bg-zinc-100 hover:bg-zinc-200 text-zinc-700 flex items-center justify-center cursor-pointer shrink-0"
              aria-label="Close Creative Studio"
            >
              <X size={18} />
            </button>
          </div>

          {/* Tabs */}
          <div className="px-5 py-2.5 bg-white border-b border-zinc-200 flex items-center gap-1.5 overflow-x-auto no-scrollbar shrink-0">
            {TABS.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => setActiveTab(t.id)}
                className={`min-h-[40px] px-3.5 rounded-xl text-xs font-bold flex items-center gap-2 shrink-0 cursor-pointer transition-colors ${
                  activeTab === t.id
                    ? 'bg-[#0A2A66] text-white'
                    : 'bg-[#F4F8FC] text-[#0A2A66] hover:bg-sky-100/70'
                }`}
              >
                {t.icon}
                <span>{t.label}</span>
              </button>
            ))}
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5" key={refreshTick}>
            {activeTab === 'thumbnails' && (
              <>
                {/* Controls Bar */}
                <div className="p-4 rounded-2xl bg-white border border-zinc-200 grid grid-cols-1 md:grid-cols-12 gap-3 items-end">
                  <div className="md:col-span-4">
                    <label className="block text-[11px] font-bold text-zinc-500 mb-1">
                      Preview Headline
                    </label>
                    <input
                      type="text"
                      value={thumbTitle}
                      onChange={(e) => setThumbTitle(e.target.value)}
                      className="w-full min-h-[40px] px-3 rounded-xl border border-zinc-200 text-xs sm:text-sm font-bold text-[#0A2A66] focus:border-[#00A6FF] focus:outline-none"
                    />
                  </div>
                  <div className="md:col-span-3">
                    <label className="block text-[11px] font-bold text-zinc-500 mb-1">
                      Subtitle
                    </label>
                    <input
                      type="text"
                      value={thumbSubtitle}
                      onChange={(e) => setThumbSubtitle(e.target.value)}
                      className="w-full min-h-[40px] px-3 rounded-xl border border-zinc-200 text-xs sm:text-sm font-semibold text-zinc-800 focus:border-[#00A6FF] focus:outline-none"
                    />
                  </div>
                  <div className="md:col-span-2">
                    <label className="block text-[11px] font-bold text-zinc-500 mb-1">
                      Badge Override
                    </label>
                    <input
                      type="text"
                      value={thumbBadge}
                      placeholder="Preset default"
                      onChange={(e) => setThumbBadge(e.target.value)}
                      className="w-full min-h-[40px] px-3 rounded-xl border border-zinc-200 text-xs font-semibold text-zinc-800 focus:border-[#00A6FF] focus:outline-none"
                    />
                  </div>
                  <div className="md:col-span-3 flex flex-wrap gap-1.5">
                    <input
                      ref={subjectInputRef}
                      type="file"
                      accept="image/*"
                      onChange={handleSubjectUpload}
                      className="hidden"
                    />
                    <input
                      ref={jsonImportRef}
                      type="file"
                      accept="application/json"
                      onChange={handleImportJson}
                      className="hidden"
                    />
                    <button
                      type="button"
                      onClick={() => subjectInputRef.current?.click()}
                      className="min-h-[40px] px-3 rounded-xl border border-zinc-200 hover:border-[#00A6FF] text-xs font-bold text-[#0A2A66] flex items-center gap-1.5 cursor-pointer"
                    >
                      <Upload size={13} />
                      <span>Subject Photo</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => jsonImportRef.current?.click()}
                      className="min-h-[40px] px-2.5 rounded-xl border border-zinc-200 hover:border-[#00A6FF] text-xs font-bold text-zinc-700 cursor-pointer"
                    >
                      Import JSON
                    </button>
                    <button
                      type="button"
                      onClick={handleExportCustomJson}
                      className="min-h-[40px] px-2.5 rounded-xl border border-zinc-200 hover:border-[#00A6FF] text-xs font-bold text-zinc-700 cursor-pointer"
                    >
                      Export Custom
                    </button>
                  </div>
                </div>

                {/* Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {thumbs.map((tpl) => (
                    <ThumbnailCanvasPreview
                      key={tpl.id}
                      tpl={tpl}
                      title={thumbTitle}
                      subtitle={thumbSubtitle}
                      badge={thumbBadge}
                      subjectImg={subjectImgEl}
                      onDownload={handleDownloadThumbPng}
                      onDuplicate={handleDuplicateThumb}
                      onDelete={handleDeleteTemplate}
                      onUseInChat={(t) =>
                        launchPrompt(
                          `Create a custom ${t.size[0]}x${t.size[1]} thumbnail using the "${t.name}" (${t.id}) style with headline "${thumbTitle}" and subtitle "${thumbSubtitle}".`
                        )
                      }
                    />
                  ))}
                </div>
              </>
            )}

            {activeTab === 'images' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {imageFormats.map((imgFmt) => {
                  const [w, h] = imgFmt.size;
                  return (
                    <div
                      key={imgFmt.id}
                      className="rounded-2xl bg-white border border-zinc-200 p-4 flex flex-col justify-between gap-4"
                    >
                      <div className="space-y-3">
                        <div className="h-32 rounded-xl bg-[#F4F8FC] border border-zinc-200 flex items-center justify-center p-3">
                          <div
                            className="border-2 border-dashed border-[#0A2A66]/35 bg-white rounded-lg flex items-center justify-center text-[11px] font-extrabold text-[#0A2A66] tabular-nums px-3 py-2"
                            style={{
                              aspectRatio: `${w} / ${h}`,
                              height: h >= w ? '96px' : 'auto',
                              width: w > h ? '160px' : 'auto',
                            }}
                          >
                            {w} × {h}
                          </div>
                        </div>

                        <div>
                          <div className="flex items-center justify-between gap-2">
                            <h4 className="text-sm font-extrabold text-[#0A2A66]">{imgFmt.name}</h4>
                            {imgFmt.custom && (
                              <span className="text-[10px] font-extrabold bg-[#00A6FF]/15 text-[#0A2A66] px-2 py-0.5 rounded">
                                CUSTOM
                              </span>
                            )}
                          </div>
                          <p className="text-xs text-zinc-600 mt-1 leading-relaxed">{imgFmt.note}</p>
                        </div>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() =>
                            launchPrompt(
                              `Design a ${w}x${h} "${imgFmt.name}" (${imgFmt.id}) studio graphic. Follow format layout note: ${imgFmt.note}`
                            )
                          }
                          className="flex-1 min-h-[40px] px-3 rounded-xl bg-[#0A2A66] hover:bg-[#1450C8] text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          <ArrowUpRight size={14} />
                          <span>Create in Chat</span>
                        </button>
                        {imgFmt.custom && (
                          <button
                            type="button"
                            onClick={() => handleDeleteTemplate(imgFmt.id)}
                            className="min-h-[40px] px-3 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 flex items-center justify-center cursor-pointer"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {activeTab === 'videos' && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {videoTemplates.map((vt) => (
                  <div
                    key={vt.id}
                    className="rounded-2xl bg-white border border-zinc-200 p-4 flex flex-col justify-between gap-4"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h4 className="text-sm font-extrabold text-[#0A2A66]">{vt.name}</h4>
                          <p className="text-[11px] font-semibold text-zinc-500 tabular-nums mt-0.5">
                            {vt.style} · {vt.aspect} · {vt.duration}s · Voice: {vt.voice} · Font: {vt.font}
                          </p>
                        </div>
                        <span className="text-[11px] font-extrabold text-[#0A2A66] bg-[#F4F8FC] border border-zinc-200 px-2.5 py-1 rounded-lg tabular-nums">
                          {vt.scenes.length} scenes
                        </span>
                      </div>

                      {/* Proportional colored storyboard track */}
                      <div className="flex h-7 rounded-xl overflow-hidden border border-zinc-200">
                        {vt.scenes.map(([label, secs, color], idx) => (
                          <div
                            key={`${vt.id}-sc-${idx}`}
                            style={{
                              flex: secs,
                              backgroundColor: color,
                            }}
                            title={`${label} (${secs}s)`}
                            className="flex items-center justify-center px-1 text-[9px] font-extrabold text-white truncate"
                          >
                            {label}
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          launchPrompt(
                            `Create a ${vt.duration}s ${vt.style} video (${vt.aspect}) using the "${vt.name}" (${vt.id}) template with ${vt.voice} narration on an engaging topic.`
                          )
                        }
                        className="flex-1 min-h-[40px] px-3 rounded-xl bg-[#0A2A66] hover:bg-[#1450C8] text-white text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                      >
                        <Film size={14} />
                        <span>Create Video in Chat</span>
                      </button>
                      {vt.custom && (
                        <button
                          type="button"
                          onClick={() => handleDeleteTemplate(vt.id)}
                          className="min-h-[40px] px-3 rounded-xl border border-red-200 text-red-600 hover:bg-red-50 flex items-center justify-center cursor-pointer"
                        >
                          <Trash2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'voices' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {STUDIO_VOICES.map((v) => {
                  const testing = testingVoiceId === v.id;
                  return (
                    <div
                      key={v.id}
                      className="rounded-2xl bg-white border border-zinc-200 p-4 flex flex-col justify-between gap-3"
                    >
                      <div>
                        <div className="flex items-center justify-between gap-2">
                          <h4 className="text-sm font-extrabold text-[#0A2A66]">{v.id}</h4>
                          <span className="text-[11px] font-bold text-zinc-500 capitalize">
                            {v.gender}
                          </span>
                        </div>
                        <p className="text-xs font-semibold text-zinc-700 mt-1">{v.tone}</p>
                        <p className="text-[11px] text-zinc-500 mt-1">Best for: {v.best}</p>
                      </div>

                      <div className="flex items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            if (testing) {
                              stopGeminiTts();
                              setTestingVoiceId(null);
                              return;
                            }
                            setTestingVoiceId(v.id);
                            speakWithGeminiTts(
                              `Hello, I am ${v.id}. ${v.tone}, ideal for ${v.best}.`,
                              v.geminiVoiceId,
                              () => setTestingVoiceId(v.id),
                              () => setTestingVoiceId(null),
                              () => setTestingVoiceId(null)
                            );
                          }}
                          className="min-h-[40px] px-3 rounded-xl border border-zinc-200 hover:border-[#00A6FF] text-[#0A2A66] text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                        >
                          {testing ? (
                            <>
                              <Loader2 size={13} className="animate-spin" />
                              <span>Stop</span>
                            </>
                          ) : (
                            <>
                              <Play size={13} className="fill-current" />
                              <span>Preview</span>
                            </>
                          )}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            launchPrompt(
                              `Create a 45-second motion explainer video narrated in the "${v.id}" voice.`
                            )
                          }
                          className="flex-1 min-h-[40px] px-3 rounded-xl bg-[#0A2A66] hover:bg-[#1450C8] text-white text-xs font-bold cursor-pointer"
                        >
                          Use for Video
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}

            {activeTab === 'styles' && (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-extrabold text-[#0A2A66] mb-3">
                    Curated Palettes (Click swatch to copy hex)
                  </h3>
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
                    {PALETTES.map((p) => (
                      <div key={p.id} className="rounded-2xl bg-white border border-zinc-200 p-3.5 space-y-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-xs font-extrabold text-[#0A2A66]">{p.name}</span>
                          <span className="text-[11px] font-mono text-zinc-500">{p.id}</span>
                        </div>
                        <div className="grid grid-cols-4 gap-1.5">
                          {p.colors.map((hex) => (
                            <button
                              key={hex}
                              type="button"
                              onClick={() => {
                                navigator.clipboard.writeText(hex);
                                showToast(`Copied ${hex}`);
                              }}
                              title={`Copy ${hex}`}
                              className="h-12 rounded-lg border border-black/10 flex items-end justify-center p-1 cursor-pointer hover:scale-[1.03] transition-transform"
                              style={{ backgroundColor: hex }}
                            >
                              <span className="text-[9px] font-mono font-bold px-1 rounded bg-white/85 text-zinc-900">
                                {hex}
                              </span>
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div>
                  <h3 className="text-sm font-extrabold text-[#0A2A66] mb-3">
                    Studio Google Fonts
                  </h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {FONTS.map((f) => (
                      <div key={f.id} className="rounded-2xl bg-white border border-zinc-200 p-4 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-xs font-extrabold text-[#0A2A66]">{f.id}</span>
                          <span className="text-[11px] font-semibold text-zinc-500">
                            Weights: {f.weights.join(', ')}
                          </span>
                        </div>
                        <div
                          className="text-2xl text-zinc-900 leading-tight truncate"
                          style={{ fontFamily: `"${f.id}", sans-serif`, fontWeight: f.weights[0] }}
                        >
                          {f.id === 'Noto Sans Devanagari'
                            ? 'एआई से सीखो — तेज़ और आसान'
                            : 'Creative AI Studio Headlines 2026'}
                        </div>
                        <p className="text-xs text-zinc-600">{f.use}</p>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'cutout' && (
              <div className="rounded-2xl bg-white border border-zinc-200 p-5 space-y-5">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <h3 className="text-base font-extrabold text-[#0A2A66]">
                      Background Remover (Subject Cutout)
                    </h3>
                    <p className="text-xs text-zinc-600 mt-0.5">
                      Runs on-device AI segmentation with instant corner color-key fallback if offline.
                    </p>
                  </div>
                  <input
                    ref={cutoutInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleRunCutout}
                    className="hidden"
                  />
                  <button
                    type="button"
                    onClick={() => cutoutInputRef.current?.click()}
                    disabled={cutoutBusy}
                    className="min-h-[44px] px-4 rounded-xl bg-[#0A2A66] hover:bg-[#1450C8] disabled:opacity-50 text-white text-xs font-extrabold flex items-center gap-2 cursor-pointer"
                  >
                    {cutoutBusy ? <Loader2 size={15} className="animate-spin" /> : <Upload size={15} />}
                    <span>{cutoutBusy ? 'Removing Background...' : 'Upload Image to Cut Out'}</span>
                  </button>
                </div>

                {(cutoutOrigUrl || cutoutResultUrl) && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="rounded-xl border border-zinc-200 p-3 space-y-2">
                      <div className="text-xs font-bold text-zinc-500">Original Image</div>
                      <div className="h-64 rounded-lg bg-zinc-100 flex items-center justify-center overflow-hidden">
                        {cutoutOrigUrl && (
                          <img src={cutoutOrigUrl} alt="Original" className="max-h-full max-w-full object-contain" />
                        )}
                      </div>
                    </div>

                    <div className="rounded-xl border border-zinc-200 p-3 space-y-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-[#0A2A66]">Transparent Cutout PNG</span>
                        {cutoutMethod && (
                          <span className="text-[11px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">
                            {cutoutMethod === 'ai' ? 'AI Cutout' : 'Edge Color Cutout'}
                          </span>
                        )}
                      </div>
                      <div
                        className="h-64 rounded-lg flex items-center justify-center overflow-hidden border border-zinc-200"
                        style={{
                          backgroundImage:
                            'linear-gradient(45deg, #e5e7eb 25%, transparent 25%), linear-gradient(-45deg, #e5e7eb 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #e5e7eb 75%), linear-gradient(-45deg, transparent 75%, #e5e7eb 75%)',
                          backgroundSize: '20px 20px',
                          backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
                        }}
                      >
                        {cutoutBusy ? (
                          <div className="flex items-center gap-2 text-xs font-bold text-[#0A2A66] bg-white/90 px-3 py-2 rounded-lg">
                            <Loader2 size={14} className="animate-spin text-[#00A6FF]" />
                            <span>Processing subject edges...</span>
                          </div>
                        ) : (
                          cutoutResultUrl && (
                            <img src={cutoutResultUrl} alt="Cutout" className="max-h-full max-w-full object-contain" />
                          )
                        )}
                      </div>
                    </div>
                  </div>
                )}

                {cutoutResultUrl && (
                  <div className="flex flex-wrap items-center gap-2.5">
                    <a
                      href={cutoutResultUrl}
                      download={cutoutFileName}
                      className="min-h-[44px] px-4 rounded-xl bg-[#0A2A66] hover:bg-[#1450C8] text-white text-xs font-extrabold flex items-center gap-2"
                    >
                      <Download size={14} />
                      <span>Download PNG</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => {
                        setSubjectDataUrl(cutoutResultUrl);
                        setActiveTab('thumbnails');
                        showToast('Cutout applied to thumbnail previews');
                      }}
                      className="min-h-[44px] px-4 rounded-xl border border-zinc-200 hover:border-[#00A6FF] text-[#0A2A66] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                    >
                      <Check size={14} />
                      <span>Apply to Thumbnails</span>
                    </button>
                    {onLaunchPromptInChat && (
                      <button
                        type="button"
                        onClick={() =>
                          launchPrompt(
                            'Create a Split Hero 1280x720 thumbnail featuring this transparent subject cutout on the right side.',
                            cutoutResultUrl,
                            cutoutFileName
                          )
                        }
                        className="min-h-[44px] px-4 rounded-xl bg-[#00A6FF] hover:bg-[#0094E6] text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer"
                      >
                        <ArrowUpRight size={14} />
                        <span>Use Cutout in Chat</span>
                      </button>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Toast */}
          {toastMsg && (
            <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-[10010] px-4 py-2 rounded-xl bg-[#0A2A66] text-white text-xs font-bold shadow-xl">
              {toastMsg}
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
