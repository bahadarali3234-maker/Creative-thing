import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  X,
  Download,
  Check,
  Undo2,
  Redo2,
  Type,
  Sparkles,
  Eye,
  EyeOff,
  Lock,
  Unlock,
  ArrowUp,
  ArrowDown,
  Trash2,
  FlipHorizontal,
  Scissors,
  AlignLeft,
  AlignCenter,
  AlignRight,
  Loader2,
  Image as ImageIcon,
  Plus,
} from 'lucide-react';
import {
  CANVAS_DATA,
  ImageSceneLayer,
  LogoSceneLayer,
  renderSceneGraph,
  StudioSceneGraph,
  StudioSceneLayer,
  TextSceneLayer,
} from '../utils/studioCanvasEngine';
import { BRAND_LOGOS, LogoBadgeStyle, renderBrandLogoToDataUrl } from '../utils/brandLogoLibrary';
import { cutoutVerifyAndRefine } from '../utils/webgpuVision';

interface CanvaLayerEditorModalProps {
  isOpen: boolean;
  sceneGraph: StudioSceneGraph | null;
  title?: string;
  onClose: () => void;
  onSave: (nextGraph: StudioSceneGraph, renderedPngDataUrl: string) => void;
}

const FONT_OPTIONS = Object.entries(CANVAS_DATA.FONTS).map(([id, f]) => ({
  id,
  label: f.display,
  weight: Number(f.dw) || 800,
}));

export const CanvaLayerEditorModal: React.FC<CanvaLayerEditorModalProps> = ({
  isOpen,
  sceneGraph,
  title = 'Canva Layer Editor',
  onClose,
  onSave,
}) => {
  const [graph, setGraph] = useState<StudioSceneGraph | null>(null);
  const [history, setHistory] = useState<StudioSceneGraph[]>([]);
  const [future, setFuture] = useState<StudioSceneGraph[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [renderedUrl, setRenderedUrl] = useState<string>('');
  const [isRendering, setIsRendering] = useState(false);
  const [isRecutting, setIsRecutting] = useState(false);
  const [inlineEditId, setInlineEditId] = useState<string | null>(null);
  const [showAddLogoMenu, setShowAddLogoMenu] = useState(false);

  const stageWrapRef = useRef<HTMLDivElement | null>(null);
  const stageBoxRef = useRef<HTMLDivElement | null>(null);
  const [stageSize, setStageSize] = useState<{ w: number; h: number }>({ w: 640, h: 360 });
  const dragStateRef = useRef<{
    type: 'move' | 'resize-se' | 'resize-nw' | 'resize-ne' | 'resize-sw';
    layerId: string;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    origW: number;
    origH: number;
    origFontSize?: number;
  } | null>(null);

  // Initialize working graph when opened
  useEffect(() => {
    if (!isOpen || !sceneGraph) return;
    const cloned = JSON.parse(JSON.stringify(sceneGraph)) as StudioSceneGraph;
    setGraph(cloned);
    setHistory([]);
    setFuture([]);
    setSelectedId(cloned.layers[cloned.layers.length - 1]?.id || null);
    setInlineEditId(null);
    setShowAddLogoMenu(false);
  }, [isOpen, sceneGraph]);

  // Fit stage dimensions cleanly to viewport center container
  useEffect(() => {
    if (!isOpen || !graph) return;
    const updateSize = () => {
      const wrap = stageWrapRef.current;
      const availW = wrap ? Math.max(260, wrap.clientWidth - 40) : 720;
      const availH = wrap ? Math.max(220, wrap.clientHeight - 40) : 480;
      const k = Math.min(availW / graph.width, availH / graph.height, 1);
      setStageSize({
        w: Math.max(220, Math.round(graph.width * k)),
        h: Math.max(180, Math.round(graph.height * k)),
      });
    };
    updateSize();
    window.addEventListener('resize', updateSize);
    return () => window.removeEventListener('resize', updateSize);
  }, [isOpen, graph?.width, graph?.height]);

  // Live debounced re-render of composite canvas via code engine
  useEffect(() => {
    if (!isOpen || !graph) return;
    let cancelled = false;
    const timer = window.setTimeout(async () => {
      setIsRendering(true);
      try {
        const url = await renderSceneGraph(graph);
        if (!cancelled) setRenderedUrl(url);
      } catch {
      } finally {
        if (!cancelled) setIsRendering(false);
      }
    }, 65);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [isOpen, graph]);

  const commitGraph = useCallback(
    (updater: (prev: StudioSceneGraph) => StudioSceneGraph, recordHistory = true) => {
      setGraph((prev) => {
        if (!prev) return prev;
        if (recordHistory) {
          setHistory((h) => [...h.slice(-24), prev]);
          setFuture([]);
        }
        return updater(prev);
      });
    },
    []
  );

  const handleUndo = () => {
    if (!history.length || !graph) return;
    const prev = history[history.length - 1];
    setHistory((h) => h.slice(0, -1));
    setFuture((f) => [graph, ...f.slice(0, 24)]);
    setGraph(prev);
  };

  const handleRedo = () => {
    if (!future.length || !graph) return;
    const next = future[0];
    setFuture((f) => f.slice(1));
    setHistory((h) => [...h, graph]);
    setGraph(next);
  };

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (inlineEditId) setInlineEditId(null);
        else onClose();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isOpen, inlineEditId, onClose]);

  // Pointer drag & corner resize handlers
  useEffect(() => {
    if (!isOpen) return;
    const onPointerMove = (e: PointerEvent) => {
      const ds = dragStateRef.current;
      const box = stageBoxRef.current;
      if (!ds || !box || !graph) return;

      const scaleX = graph.width / Math.max(1, stageSize.w);
      const scaleY = graph.height / Math.max(1, stageSize.h);
      const dx = (e.clientX - ds.startX) * scaleX;
      const dy = (e.clientY - ds.startY) * scaleY;

      setGraph((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          layers: prev.layers.map((l) => {
            if (l.id !== ds.layerId) return l;
            if (ds.type === 'move') {
              return { ...l, x: Math.round(ds.origX + dx), y: Math.round(ds.origY + dy) };
            }
            let nx = ds.origX;
            let ny = ds.origY;
            let nw = ds.origW;
            let nh = ds.origH;
            if (ds.type === 'resize-se') {
              nw = Math.max(40, Math.round(ds.origW + dx));
              nh = Math.max(28, Math.round(ds.origH + dy));
            } else if (ds.type === 'resize-nw') {
              nw = Math.max(40, Math.round(ds.origW - dx));
              nh = Math.max(28, Math.round(ds.origH - dy));
              nx = Math.round(ds.origX + (ds.origW - nw));
              ny = Math.round(ds.origY + (ds.origH - nh));
            } else if (ds.type === 'resize-ne') {
              nw = Math.max(40, Math.round(ds.origW + dx));
              nh = Math.max(28, Math.round(ds.origH - dy));
              ny = Math.round(ds.origY + (ds.origH - nh));
            } else if (ds.type === 'resize-sw') {
              nw = Math.max(40, Math.round(ds.origW - dx));
              nh = Math.max(28, Math.round(ds.origH + dy));
              nx = Math.round(ds.origX + (ds.origW - nw));
            }
            if (l.kind === 'text' && ds.origFontSize) {
              const ratio = nh / Math.max(1, ds.origH);
              return { ...l, x: nx, y: ny, w: nw, h: nh, fontSize: Math.max(12, Math.round(ds.origFontSize * ratio)) };
            }
            return { ...l, x: nx, y: ny, w: nw, h: nh };
          }),
        };
      });
    };
    const onPointerUp = () => {
      dragStateRef.current = null;
    };
    window.addEventListener('pointermove', onPointerMove);
    window.addEventListener('pointerup', onPointerUp);
    return () => {
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
    };
  }, [isOpen, graph?.width, graph?.height, stageSize.w, stageSize.h]);

  const selectedLayer = useMemo(
    () => graph?.layers.find((l) => l.id === selectedId) || null,
    [graph, selectedId]
  );

  if (!isOpen || !graph) return null;

  const updateLayer = (id: string, patch: Partial<StudioSceneLayer>) => {
    commitGraph((prev) => ({
      ...prev,
      layers: prev.layers.map((l) => (l.id === id ? ({ ...l, ...patch } as StudioSceneLayer) : l)),
    }));
  };

  const handleMoveZ = (id: string, dir: 'up' | 'down') => {
    commitGraph((prev) => {
      const idx = prev.layers.findIndex((l) => l.id === id);
      if (idx === -1) return prev;
      const target = dir === 'up' ? idx + 1 : idx - 1;
      if (target < 0 || target >= prev.layers.length) return prev;
      const copy = [...prev.layers];
      const [item] = copy.splice(idx, 1);
      copy.splice(target, 0, item);
      return { ...prev, layers: copy };
    });
  };

  const handleDeleteLayer = (id: string) => {
    commitGraph((prev) => ({
      ...prev,
      layers: prev.layers.filter((l) => l.id !== id),
    }));
    if (selectedId === id) setSelectedId(null);
  };

  const handleAddTextLayer = () => {
    const W = graph.width;
    const H = graph.height;
    const newId = `txt_${Date.now()}`;
    const newLayer: TextSceneLayer = {
      id: newId,
      kind: 'text',
      name: 'New Text',
      textRole: 'custom',
      text: 'Edit Headline Text',
      fontPairId: 'modern-grotesk',
      fontFamily: 'Space Grotesk',
      fontWeight: 800,
      fontSize: Math.round(H * 0.075),
      color: '#ffffff',
      accentColor: graph.background.accentHex || '#00e5ff',
      strokeColor: '#000000',
      strokeWidth: 4,
      align: 'center',
      shadowBlur: Math.round(W * 0.01),
      x: Math.round(W * 0.15),
      y: Math.round(H * 0.42),
      w: Math.round(W * 0.7),
      h: Math.round(H * 0.16),
      opacity: 1,
      visible: true,
      locked: false,
    };
    commitGraph((prev) => ({ ...prev, layers: [...prev.layers, newLayer] }));
    setSelectedId(newId);
    setInlineEditId(newId);
  };

  const handleAddBrandLogo = async (brandId: string, label: string) => {
    setShowAddLogoMenu(false);
    const H = graph.height;
    const W = graph.width;
    const logoH = Math.max(46, Math.round(H * 0.095));
    const rendered = await renderBrandLogoToDataUrl(brandId, {
      size: Math.round(logoH * 0.7),
      style: 'glass',
      withLabel: true,
      customLabel: label,
    });
    if (!rendered) return;
    const lw = Math.round(logoH * (rendered.width / rendered.height));
    const newId = `logo_${brandId}_${Date.now()}`;
    const newLayer: LogoSceneLayer = {
      id: newId,
      kind: 'logo',
      name: label,
      brandId,
      label,
      badgeStyle: 'glass',
      withLabel: true,
      dataUrl: rendered.dataUrl,
      x: Math.round((W - lw) / 2),
      y: Math.round(H * 0.06),
      w: lw,
      h: logoH,
      opacity: 1,
      visible: true,
      locked: false,
    };
    commitGraph((prev) => ({ ...prev, layers: [...prev.layers, newLayer] }));
    setSelectedId(newId);
  };

  const handleRecutLayer = async (layer: ImageSceneLayer) => {
    setIsRecutting(true);
    try {
      const src = layer.originalDataUrl || layer.dataUrl;
      const cut = await cutoutVerifyAndRefine(src, 3);
      updateLayer(layer.id, { dataUrl: cut.cutoutDataUrl, cutout: true });
    } catch {
    } finally {
      setIsRecutting(false);
    }
  };

  const snapImageCorner = (layer: ImageSceneLayer, corner: 'left-corner' | 'center' | 'right-corner') => {
    const W = graph.width;
    const H = graph.height;
    const pad = Math.round(W * 0.015);
    const x =
      corner === 'left-corner'
        ? pad
        : corner === 'right-corner'
          ? Math.round(W - layer.w - pad)
          : Math.round((W - layer.w) / 2);
    const y = layer.cutout ? Math.round(H - layer.h) : layer.y;
    updateLayer(layer.id, { x, y });
  };

  const handleDownload = async () => {
    const finalUrl = renderedUrl || (await renderSceneGraph(graph));
    const a = document.createElement('a');
    a.href = finalUrl;
    a.download = `canva-studio-${graph.width}x${graph.height}.png`;
    a.click();
  };

  const handleSaveAndClose = async () => {
    const finalUrl = await renderSceneGraph(graph);
    onSave(graph, finalUrl);
    onClose();
  };

  const startDrag = (
    e: React.PointerEvent,
    layer: StudioSceneLayer,
    type: 'move' | 'resize-se' | 'resize-nw' | 'resize-ne' | 'resize-sw'
  ) => {
    if (layer.locked || inlineEditId === layer.id) return;
    e.stopPropagation();
    setSelectedId(layer.id);
    setHistory((h) => [...h.slice(-24), graph]);
    setFuture([]);
    dragStateRef.current = {
      type,
      layerId: layer.id,
      startX: e.clientX,
      startY: e.clientY,
      origX: layer.x,
      origY: layer.y,
      origW: layer.w,
      origH: layer.h,
      origFontSize: layer.kind === 'text' ? layer.fontSize : undefined,
    };
  };

  return (
    <div className="fixed inset-0 z-[10035] bg-neutral-950/96 backdrop-blur-md text-neutral-100 flex flex-col select-none">
      {/* Top Bar */}
      <header className="h-14 border-b border-neutral-800 px-3 sm:px-5 flex items-center justify-between gap-2 bg-neutral-900/95 shrink-0">
        <div className="flex items-center gap-3 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[var(--primary)]/15 border border-[var(--primary)]/35 flex items-center justify-center shrink-0">
            <Sparkles size={15} className="text-[var(--primary-light)]" />
          </div>
          <div className="min-w-0">
            <h2 className="text-sm font-bold text-white truncate">{title}</h2>
            <p className="text-[11px] text-neutral-400 font-mono tabular-nums truncate">
              {graph.width}×{graph.height} px · {graph.layers.length} layers
            </p>
          </div>
          <div className="hidden sm:flex items-center gap-1 ml-2 pl-3 border-l border-neutral-800">
            <button
              type="button"
              onClick={handleUndo}
              disabled={!history.length}
              className="w-8 h-8 rounded-lg border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 disabled:opacity-35 flex items-center justify-center cursor-pointer"
              title="Undo"
            >
              <Undo2 size={14} />
            </button>
            <button
              type="button"
              onClick={handleRedo}
              disabled={!future.length}
              className="w-8 h-8 rounded-lg border border-neutral-800 bg-neutral-900 hover:bg-neutral-800 disabled:opacity-35 flex items-center justify-center cursor-pointer"
              title="Redo"
            >
              <Redo2 size={14} />
            </button>
          </div>
        </div>

        <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
          <button
            type="button"
            onClick={handleAddTextLayer}
            className="h-8 px-2.5 sm:px-3 rounded-lg border border-neutral-700 bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-white flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
          >
            <Type size={13} />
            <span>Add Text</span>
          </button>

          <div className="relative">
            <button
              type="button"
              onClick={() => setShowAddLogoMenu((v) => !v)}
              className="h-8 px-2.5 sm:px-3 rounded-lg border border-neutral-700 bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-white flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
            >
              <Plus size={13} />
              <span>Add Logo</span>
            </button>
            {showAddLogoMenu && (
              <div className="absolute right-0 top-10 w-52 max-h-72 overflow-y-auto rounded-xl border border-neutral-700 bg-neutral-900 shadow-2xl p-1.5 z-50">
                {BRAND_LOGOS.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => handleAddBrandLogo(b.id, b.label)}
                    className="w-full px-2.5 py-1.5 rounded-lg text-left text-xs font-medium text-neutral-200 hover:bg-neutral-800 flex items-center justify-between cursor-pointer"
                  >
                    <span>{b.name}</span>
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: b.accentColor }}
                    />
                  </button>
                ))}
              </div>
            )}
          </div>

          <button
            type="button"
            onClick={handleDownload}
            className="h-8 px-2.5 sm:px-3 rounded-lg border border-neutral-700 bg-neutral-800 hover:bg-neutral-700 text-xs font-semibold text-white flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
          >
            <Download size={13} />
            <span className="hidden md:inline">Download PNG</span>
          </button>

          <button
            type="button"
            onClick={handleSaveAndClose}
            className="h-8 px-3 rounded-lg theme-button-primary text-xs font-bold text-white flex items-center gap-1.5 cursor-pointer whitespace-nowrap shrink-0"
          >
            <Check size={13} />
            <span>Save Changes</span>
          </button>

          <button
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-lg border border-neutral-800 bg-neutral-900 hover:bg-red-600/80 text-neutral-300 hover:text-white flex items-center justify-center cursor-pointer shrink-0"
            title="Close editor"
          >
            <X size={15} />
          </button>
        </div>
      </header>

      {/* Main Workspace */}
      <div className="flex-1 flex flex-col lg:flex-row min-h-0">
        {/* Center Interactive Stage */}
        <div
          ref={stageWrapRef}
          onClick={() => {
            setSelectedId(null);
            setInlineEditId(null);
            setShowAddLogoMenu(false);
          }}
          className="flex-1 min-h-0 flex items-center justify-center p-4 bg-neutral-950 overflow-hidden relative"
        >
          <div
            ref={stageBoxRef}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: `${stageSize.w}px`,
              height: `${stageSize.h}px`,
              backgroundImage:
                'linear-gradient(45deg, #171717 25%, transparent 25%), linear-gradient(-45deg, #171717 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #171717 75%), linear-gradient(-45deg, transparent 75%, #171717 75%)',
              backgroundSize: '20px 20px',
              backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
            }}
            className="relative rounded-lg border border-neutral-800 overflow-hidden shadow-2xl"
          >
            {renderedUrl && (
              <img
                src={renderedUrl}
                alt="Canva Interactive Canvas"
                draggable={false}
                className="w-full h-full object-contain block pointer-events-none"
              />
            )}

            {isRendering && (
              <div className="absolute top-2.5 right-2.5 px-2 py-1 rounded bg-black/75 border border-neutral-700 text-[11px] font-mono text-neutral-200 flex items-center gap-1.5 pointer-events-none">
                <Loader2 size={11} className="animate-spin text-[var(--primary-light)]" />
                <span>Syncing</span>
              </div>
            )}

            {/* Interactive Draggable Layer Hitboxes */}
            {graph.layers.map((layer) => {
              if (!layer.visible) return null;
              const isSelected = layer.id === selectedId;
              const isInline = inlineEditId === layer.id && layer.kind === 'text';
              const leftPct = (layer.x / graph.width) * 100;
              const topPct = (layer.y / graph.height) * 100;
              const wPct = (layer.w / graph.width) * 100;
              const hPct = (layer.h / graph.height) * 100;

              return (
                <div
                  key={layer.id}
                  onPointerDown={(e) => startDrag(e, layer, 'move')}
                  onDoubleClick={(e) => {
                    e.stopPropagation();
                    if (layer.kind === 'text' && !layer.locked) {
                      setSelectedId(layer.id);
                      setInlineEditId(layer.id);
                    }
                  }}
                  style={{
                    left: `${leftPct}%`,
                    top: `${topPct}%`,
                    width: `${wPct}%`,
                    height: `${hPct}%`,
                    cursor: layer.locked ? 'not-allowed' : isInline ? 'text' : 'move',
                  }}
                  className={`absolute transition-colors ${
                    isSelected
                      ? 'ring-2 ring-sky-400 bg-sky-400/5'
                      : 'hover:ring-1 hover:ring-white/40'
                  }`}
                >
                  {isInline && layer.kind === 'text' ? (
                    <textarea
                      autoFocus
                      value={layer.text}
                      onChange={(e) => updateLayer(layer.id, { text: e.target.value })}
                      onBlur={() => setInlineEditId(null)}
                      onPointerDown={(e) => e.stopPropagation()}
                      className="w-full h-full resize-none bg-black/80 text-white text-xs sm:text-sm font-bold p-2 rounded border border-sky-400 focus:outline-none"
                    />
                  ) : null}

                  {isSelected && !layer.locked && !isInline && (
                    <>
                      <div
                        onPointerDown={(e) => startDrag(e, layer, 'resize-nw')}
                        className="absolute -top-1.5 -left-1.5 w-3 h-3 rounded-sm bg-white border border-sky-500 cursor-nwse-resize"
                      />
                      <div
                        onPointerDown={(e) => startDrag(e, layer, 'resize-ne')}
                        className="absolute -top-1.5 -right-1.5 w-3 h-3 rounded-sm bg-white border border-sky-500 cursor-nesw-resize"
                      />
                      <div
                        onPointerDown={(e) => startDrag(e, layer, 'resize-sw')}
                        className="absolute -bottom-1.5 -left-1.5 w-3 h-3 rounded-sm bg-white border border-sky-500 cursor-nesw-resize"
                      />
                      <div
                        onPointerDown={(e) => startDrag(e, layer, 'resize-se')}
                        className="absolute -bottom-1.5 -right-1.5 w-3 h-3 rounded-sm bg-white border border-sky-500 cursor-nwse-resize"
                      />
                    </>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Right Inspector + Layer Stack */}
        <aside className="w-full lg:w-80 border-t lg:border-t-0 lg:border-l border-neutral-800 bg-neutral-900 flex flex-col min-h-0 max-h-[42vh] lg:max-h-none">
          {/* Selected Element Properties */}
          <div className="p-3.5 border-b border-neutral-800 space-y-3 overflow-y-auto flex-1">
            {!selectedLayer ? (
              <div className="text-xs text-neutral-400 space-y-2 py-2">
                <p className="font-semibold text-neutral-200">Select any element on canvas</p>
                <p>Drag to reposition, pull corner handles to resize, or double-click any text to edit inline.</p>
                <div className="pt-2 space-y-1.5">
                  <label className="block text-[11px] uppercase tracking-wider text-neutral-400 font-semibold">
                    Background Overlay Dim
                  </label>
                  <input
                    type="range"
                    min={0}
                    max={0.9}
                    step={0.05}
                    value={graph.background.overlayOpacity}
                    onChange={(e) =>
                      commitGraph((prev) => ({
                        ...prev,
                        background: { ...prev.background, overlayOpacity: Number(e.target.value) },
                      }))
                    }
                    className="w-full accent-sky-400"
                  />
                </div>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs font-bold text-white truncate">{selectedLayer.name}</span>
                  <span className="text-[10px] font-mono uppercase text-neutral-400">
                    {selectedLayer.kind}
                  </span>
                </div>

                {/* Spatial Telemetry Strip */}
                <div className="grid grid-cols-4 gap-1.5 font-mono tabular-nums text-[11px]">
                  <div className="px-2 py-1 rounded bg-neutral-950 border border-neutral-800">
                    <span className="text-neutral-500 mr-1">X</span>
                    {selectedLayer.x}
                  </div>
                  <div className="px-2 py-1 rounded bg-neutral-950 border border-neutral-800">
                    <span className="text-neutral-500 mr-1">Y</span>
                    {selectedLayer.y}
                  </div>
                  <div className="px-2 py-1 rounded bg-neutral-950 border border-neutral-800">
                    <span className="text-neutral-500 mr-1">W</span>
                    {selectedLayer.w}
                  </div>
                  <div className="px-2 py-1 rounded bg-neutral-950 border border-neutral-800">
                    <span className="text-neutral-500 mr-1">H</span>
                    {selectedLayer.h}
                  </div>
                </div>

                {/* Opacity */}
                <div>
                  <div className="flex items-center justify-between text-[11px] text-neutral-400 mb-1">
                    <span>Opacity</span>
                    <span className="font-mono tabular-nums">{Math.round(selectedLayer.opacity * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0.1}
                    max={1}
                    step={0.05}
                    value={selectedLayer.opacity}
                    onChange={(e) => updateLayer(selectedLayer.id, { opacity: Number(e.target.value) })}
                    className="w-full accent-sky-400"
                  />
                </div>

                {/* TEXT LAYER INSPECTOR */}
                {selectedLayer.kind === 'text' && (
                  <div className="space-y-2.5 pt-1 border-t border-neutral-800">
                    <div>
                      <label className="block text-[11px] text-neutral-400 mb-1">Text Content</label>
                      <textarea
                        rows={2}
                        value={selectedLayer.text}
                        onChange={(e) => updateLayer(selectedLayer.id, { text: e.target.value })}
                        className="w-full px-2.5 py-1.5 rounded-lg bg-neutral-950 border border-neutral-800 text-xs text-white focus:outline-none focus:border-sky-400"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="block text-[11px] text-neutral-400 mb-1">Highlight Word</label>
                        <input
                          type="text"
                          value={selectedLayer.accentWord || ''}
                          onChange={(e) => updateLayer(selectedLayer.id, { accentWord: e.target.value })}
                          placeholder="Optional"
                          className="w-full h-8 px-2 rounded-lg bg-neutral-950 border border-neutral-800 text-xs text-white focus:outline-none focus:border-sky-400"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] text-neutral-400 mb-1">Font Size</label>
                        <input
                          type="number"
                          min={14}
                          max={320}
                          value={selectedLayer.fontSize}
                          onChange={(e) =>
                            updateLayer(selectedLayer.id, { fontSize: Math.max(12, Number(e.target.value) || 40) })
                          }
                          className="w-full h-8 px-2 rounded-lg bg-neutral-950 border border-neutral-800 text-xs text-white font-mono tabular-nums focus:outline-none focus:border-sky-400"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-[11px] text-neutral-400 mb-1">Font Family</label>
                      <select
                        value={selectedLayer.fontPairId}
                        onChange={(e) => {
                          const opt = FONT_OPTIONS.find((f) => f.id === e.target.value);
                          if (opt) {
                            updateLayer(selectedLayer.id, {
                              fontPairId: opt.id,
                              fontFamily: opt.label,
                              fontWeight: opt.weight,
                            });
                          }
                        }}
                        className="w-full h-8 px-2 rounded-lg bg-neutral-950 border border-neutral-800 text-xs text-white focus:outline-none"
                      >
                        {FONT_OPTIONS.map((f) => (
                          <option key={f.id} value={f.id}>
                            {f.label}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <input
                          type="color"
                          value={selectedLayer.color}
                          onChange={(e) => updateLayer(selectedLayer.id, { color: e.target.value })}
                          title="Text Color"
                          className="w-7 h-7 rounded border border-neutral-700 bg-transparent cursor-pointer"
                        />
                        <input
                          type="color"
                          value={selectedLayer.accentColor}
                          onChange={(e) => updateLayer(selectedLayer.id, { accentColor: e.target.value })}
                          title="Accent Color"
                          className="w-7 h-7 rounded border border-neutral-700 bg-transparent cursor-pointer"
                        />
                      </div>
                      <div className="flex items-center gap-1">
                        {(['left', 'center', 'right'] as const).map((al) => (
                          <button
                            key={al}
                            type="button"
                            onClick={() => updateLayer(selectedLayer.id, { align: al })}
                            className={`w-7 h-7 rounded border flex items-center justify-center cursor-pointer ${
                              selectedLayer.align === al
                                ? 'bg-sky-500/20 border-sky-400 text-white'
                                : 'border-neutral-800 bg-neutral-950 text-neutral-400'
                            }`}
                          >
                            {al === 'left' ? (
                              <AlignLeft size={12} />
                            ) : al === 'center' ? (
                              <AlignCenter size={12} />
                            ) : (
                              <AlignRight size={12} />
                            )}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          updateLayer(selectedLayer.id, {
                            strokeWidth: (selectedLayer.strokeWidth || 0) > 0 ? 0 : 6,
                            strokeColor: selectedLayer.strokeColor || '#000000',
                          })
                        }
                        className={`h-7 px-2.5 rounded border text-[11px] font-semibold cursor-pointer ${
                          (selectedLayer.strokeWidth || 0) > 0
                            ? 'bg-sky-500/20 border-sky-400 text-white'
                            : 'border-neutral-800 bg-neutral-950 text-neutral-300'
                        }`}
                      >
                        Outline Stroke
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          updateLayer(selectedLayer.id, {
                            bgPlateColor: selectedLayer.bgPlateColor ? undefined : graph.background.primaryHex,
                          })
                        }
                        className={`h-7 px-2.5 rounded border text-[11px] font-semibold cursor-pointer ${
                          selectedLayer.bgPlateColor
                            ? 'bg-sky-500/20 border-sky-400 text-white'
                            : 'border-neutral-800 bg-neutral-950 text-neutral-300'
                        }`}
                      >
                        Pill Plate
                      </button>
                    </div>
                  </div>
                )}

                {/* IMAGE / CHARACTER LAYER INSPECTOR */}
                {selectedLayer.kind === 'image' && (
                  <div className="space-y-2.5 pt-1 border-t border-neutral-800">
                    <div>
                      <span className="block text-[11px] text-neutral-400 mb-1.5">Corner Placement</span>
                      <div className="grid grid-cols-3 gap-1.5">
                        {(
                          [
                            ['left-corner', 'Left Corner'],
                            ['center', 'Center'],
                            ['right-corner', 'Right Corner'],
                          ] as const
                        ).map(([cId, cLabel]) => (
                          <button
                            key={cId}
                            type="button"
                            onClick={() => snapImageCorner(selectedLayer, cId)}
                            className="h-7 px-1.5 rounded border border-neutral-800 bg-neutral-950 hover:bg-neutral-800 text-[11px] font-semibold text-neutral-200 cursor-pointer whitespace-nowrap"
                          >
                            {cLabel}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-1.5">
                      <button
                        type="button"
                        onClick={() => updateLayer(selectedLayer.id, { flipX: !selectedLayer.flipX })}
                        className={`h-7 px-2.5 rounded border text-[11px] font-semibold flex items-center gap-1 cursor-pointer ${
                          selectedLayer.flipX
                            ? 'bg-sky-500/20 border-sky-400 text-white'
                            : 'border-neutral-800 bg-neutral-950 text-neutral-300'
                        }`}
                      >
                        <FlipHorizontal size={12} />
                        <span>Flip</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => updateLayer(selectedLayer.id, { rimGlow: !selectedLayer.rimGlow })}
                        className={`h-7 px-2.5 rounded border text-[11px] font-semibold flex items-center gap-1 cursor-pointer ${
                          selectedLayer.rimGlow
                            ? 'bg-sky-500/20 border-sky-400 text-white'
                            : 'border-neutral-800 bg-neutral-950 text-neutral-300'
                        }`}
                      >
                        <Sparkles size={12} />
                        <span>Rim Glow</span>
                      </button>
                      <button
                        type="button"
                        disabled={isRecutting}
                        onClick={() => handleRecutLayer(selectedLayer)}
                        className="h-7 px-2.5 rounded border border-neutral-800 bg-neutral-950 hover:bg-neutral-800 text-[11px] font-semibold text-neutral-200 flex items-center gap-1 cursor-pointer disabled:opacity-45"
                      >
                        {isRecutting ? <Loader2 size={12} className="animate-spin" /> : <Scissors size={12} />}
                        <span>3-Pass Cutout</span>
                      </button>
                    </div>
                  </div>
                )}

                {/* LOGO LAYER INSPECTOR */}
                {selectedLayer.kind === 'logo' && (
                  <div className="space-y-2.5 pt-1 border-t border-neutral-800">
                    <div>
                      <label className="block text-[11px] text-neutral-400 mb-1">Brand Mark</label>
                      <select
                        value={selectedLayer.brandId}
                        onChange={(e) => {
                          const found = BRAND_LOGOS.find((b) => b.id === e.target.value);
                          if (found) {
                            updateLayer(selectedLayer.id, { brandId: found.id, label: found.label, name: found.label });
                          }
                        }}
                        className="w-full h-8 px-2 rounded-lg bg-neutral-950 border border-neutral-800 text-xs text-white focus:outline-none"
                      >
                        {BRAND_LOGOS.map((b) => (
                          <option key={b.id} value={b.id}>
                            {b.name}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="flex items-center gap-1.5 flex-wrap">
                      {(['glass', 'dark-pill', 'light-pill', 'clean'] as LogoBadgeStyle[]).map((st) => (
                        <button
                          key={st}
                          type="button"
                          onClick={() => updateLayer(selectedLayer.id, { badgeStyle: st })}
                          className={`h-7 px-2 rounded border text-[11px] font-semibold cursor-pointer ${
                            selectedLayer.badgeStyle === st
                              ? 'bg-sky-500/20 border-sky-400 text-white'
                              : 'border-neutral-800 bg-neutral-950 text-neutral-300'
                          }`}
                        >
                          {st}
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      onClick={() => updateLayer(selectedLayer.id, { withLabel: !selectedLayer.withLabel })}
                      className={`h-7 px-2.5 rounded border text-[11px] font-semibold cursor-pointer ${
                        selectedLayer.withLabel
                          ? 'bg-sky-500/20 border-sky-400 text-white'
                          : 'border-neutral-800 bg-neutral-950 text-neutral-300'
                      }`}
                    >
                      {selectedLayer.withLabel ? 'Label: Visible' : 'Icon Only'}
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Layer Stack Panel */}
          <div className="h-52 lg:h-60 border-t border-neutral-800 flex flex-col">
            <div className="px-3.5 py-2 border-b border-neutral-800 flex items-center justify-between text-[11px] uppercase tracking-wider font-semibold text-neutral-400">
              <span>Layers</span>
              <span className="font-mono tabular-nums">{graph.layers.length}</span>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-neutral-800/80">
              {[...graph.layers].reverse().map((layer) => {
                const active = layer.id === selectedId;
                return (
                  <div
                    key={layer.id}
                    onClick={() => setSelectedId(layer.id)}
                    className={`px-3 py-2 flex items-center justify-between gap-2 cursor-pointer transition-colors ${
                      active ? 'bg-sky-500/12' : 'hover:bg-neutral-800/60'
                    }`}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {layer.kind === 'text' ? (
                        <Type size={13} className="text-sky-400 shrink-0" />
                      ) : layer.kind === 'logo' ? (
                        <Sparkles size={13} className="text-amber-400 shrink-0" />
                      ) : (
                        <ImageIcon size={13} className="text-emerald-400 shrink-0" />
                      )}
                      <span className="text-xs font-medium text-neutral-200 truncate">{layer.name}</span>
                    </div>

                    <div className="flex items-center gap-0.5 shrink-0" onClick={(e) => e.stopPropagation()}>
                      <button
                        type="button"
                        onClick={() => handleMoveZ(layer.id, 'up')}
                        className="w-6 h-6 rounded hover:bg-neutral-700 text-neutral-400 hover:text-white flex items-center justify-center cursor-pointer"
                        title="Bring forward"
                      >
                        <ArrowUp size={11} />
                      </button>
                      <button
                        type="button"
                        onClick={() => handleMoveZ(layer.id, 'down')}
                        className="w-6 h-6 rounded hover:bg-neutral-700 text-neutral-400 hover:text-white flex items-center justify-center cursor-pointer"
                        title="Send backward"
                      >
                        <ArrowDown size={11} />
                      </button>
                      <button
                        type="button"
                        onClick={() => updateLayer(layer.id, { visible: !layer.visible })}
                        className="w-6 h-6 rounded hover:bg-neutral-700 text-neutral-400 hover:text-white flex items-center justify-center cursor-pointer"
                        title="Toggle visibility"
                      >
                        {layer.visible ? <Eye size={11} /> : <EyeOff size={11} />}
                      </button>
                      <button
                        type="button"
                        onClick={() => updateLayer(layer.id, { locked: !layer.locked })}
                        className="w-6 h-6 rounded hover:bg-neutral-700 text-neutral-400 hover:text-white flex items-center justify-center cursor-pointer"
                        title="Lock layer"
                      >
                        {layer.locked ? <Lock size={11} /> : <Unlock size={11} />}
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDeleteLayer(layer.id)}
                        className="w-6 h-6 rounded hover:bg-red-500/20 text-neutral-400 hover:text-red-400 flex items-center justify-center cursor-pointer"
                        title="Delete layer"
                      >
                        <Trash2 size={11} />
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
};
