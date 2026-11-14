import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Play,
  Pause,
  Volume2,
  VolumeX,
  Download,
  Code2,
  Eye,
  Maximize2,
  Copy,
  CheckCircle2,
  Loader2,
  Film,
  Image as ImageIcon,
  RefreshCw,
  Layers,
  Wand2,
} from 'lucide-react';
import html2canvas from 'html2canvas';
import {
  VideoPlan,
  StudioToolCall,
  resolveStudioPlaceholders,
} from '../utils/mythoriaLib';

const GOOGLE_FONTS_LINK =
  'https://fonts.googleapis.com/css2?family=Bebas+Neue&family=Noto+Sans+Devanagari:wght@600;800&family=Playfair+Display:wght@700;900&family=Poppins:wght@400;600;800;900&family=Space+Grotesk:wght@500;700&display=swap';

function parseCanvasSize(html: string, fallback: [number, number] = [1280, 720]): [number, number] {
  if (!html) return fallback;
  const wMatch = html.match(/#canvas[\s\S]{0,400}?width:\s*(\d{3,4})px/i) || html.match(/id=["']canvas["'][^>]*style=["'][^"']*width:\s*(\d{3,4})px/i);
  const hMatch = html.match(/#canvas[\s\S]{0,400}?height:\s*(\d{3,4})px/i) || html.match(/id=["']canvas["'][^>]*style=["'][^"']*height:\s*(\d{3,4})px/i);
  const w = wMatch ? Math.max(320, Math.min(3000, Number(wMatch[1]))) : fallback[0];
  const h = hMatch ? Math.max(320, Math.min(3000, Number(hMatch[1]))) : fallback[1];
  return [w, h];
}

function prepareStudioSrcDoc(rawHtml: string, width: number, height: number): string {
  let html = (rawHtml || '').trim();
  if (!html) return '';
  const hasDoc = /<!DOCTYPE|<html/i.test(html);
  const extraHead = `<link rel="stylesheet" href="${GOOGLE_FONTS_LINK}"><style>html,body{margin:0!important;padding:0!important;width:${width}px!important;height:${height}px!important;overflow:hidden!important;background:#0b1020;}#canvas,#stage{margin:0!important;}</style>`;
  if (!hasDoc) {
    return `<!DOCTYPE html><html><head><meta charset="utf-8">${extraHead}</head><body>${html}</body></html>`;
  }
  if (/<\/head>/i.test(html)) {
    return html.replace(/<\/head>/i, `${extraHead}</head>`);
  }
  return html.replace(/<body/i, `<head>${extraHead}</head><body`);
}

function base64ToBlobUrl(base64Data: string, mimeType = 'audio/wav'): string {
  const bin = atob(base64Data);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) {
    bytes[i] = bin.charCodeAt(i);
  }
  return URL.createObjectURL(new Blob([bytes], { type: mimeType }));
}

function formatClock(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${String(rem).padStart(2, '0')}`;
}

export interface StudioImageCardProps {
  htmlCode: string;
  uploadsMap?: Record<string, string>;
  fileName?: string;
  isStreaming?: boolean;
  onOpenFullScreenEditor?: (code: string, fileName?: string, lang?: string) => void;
}

export const StudioImageCard: React.FC<StudioImageCardProps> = ({
  htmlCode,
  uploadsMap = {},
  fileName = 'design.html',
  isStreaming = false,
  onOpenFullScreenEditor,
}) => {
  const [tab, setTab] = useState<'preview' | 'code'>('preview');
  const [copied, setCopied] = useState(false);
  const [exportingPng, setExportingPng] = useState(false);
  const [containerWidth, setContainerWidth] = useState(640);
  const stageWrapRef = useRef<HTMLDivElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);

  const [canvasW, canvasH] = useMemo(() => parseCanvasSize(htmlCode, [1280, 720]), [htmlCode]);
  const resolvedHtml = useMemo(
    () => resolveStudioPlaceholders(htmlCode, uploadsMap),
    [htmlCode, uploadsMap]
  );
  const srcDoc = useMemo(
    () => prepareStudioSrcDoc(resolvedHtml, canvasW, canvasH),
    [resolvedHtml, canvasW, canvasH]
  );

  useEffect(() => {
    const el = stageWrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 60) {
          setContainerWidth(entry.contentRect.width);
        }
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [tab]);

  const scale = Math.min(1, containerWidth / canvasW);
  const scaledHeight = Math.max(180, Math.round(canvasH * scale));

  const handleDownloadPng = async () => {
    const iframeDoc = iframeRef.current?.contentDocument;
    if (!iframeDoc) return;
    const targetEl = (iframeDoc.getElementById('canvas') || iframeDoc.body) as HTMLElement;
    if (!targetEl) return;

    setExportingPng(true);
    try {
      const renderedCanvas = await html2canvas(targetEl, {
        width: canvasW,
        height: canvasH,
        scale: 1,
        useCORS: true,
        allowTaint: true,
        backgroundColor: null,
        windowWidth: canvasW,
        windowHeight: canvasH,
      });
      const dataUrl = renderedCanvas.toDataURL('image/png');
      const a = document.createElement('a');
      a.href = dataUrl;
      a.download = `${fileName.replace(/\.html?$/i, '')}_${canvasW}x${canvasH}.png`;
      a.click();
    } catch (err) {
      console.warn('PNG export fallback warning:', err);
      // Fallback HTML export if canvas snapshot failed on cross-origin element
      const blob = new Blob([resolvedHtml], { type: 'text/html' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = fileName;
      a.click();
    } finally {
      setExportingPng(false);
    }
  };

  return (
    <div className="mt-3 rounded-2xl bg-white border border-zinc-200 overflow-hidden text-zinc-900">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-zinc-200 bg-[#F4F8FC]">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[#0A2A66] text-white flex items-center justify-center shrink-0">
            <ImageIcon size={16} />
          </div>
          <div className="min-w-0">
            <div className="text-xs sm:text-sm font-extrabold text-[#0A2A66] truncate">
              Creative Studio Graphic
            </div>
            <div className="text-[11px] font-semibold text-zinc-500 tabular-nums">
              {canvasW} × {canvasH} px
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          {!isStreaming && (
            <>
              <div className="flex items-center rounded-lg border border-zinc-200 bg-white p-0.5 mr-1">
                <button
                  type="button"
                  onClick={() => setTab('preview')}
                  className={`px-2.5 py-1.5 rounded-md text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                    tab === 'preview' ? 'bg-[#0A2A66] text-white' : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  <Eye size={12} />
                  <span>Canvas</span>
                </button>
                <button
                  type="button"
                  onClick={() => setTab('code')}
                  className={`px-2.5 py-1.5 rounded-md text-[11px] font-bold flex items-center gap-1 cursor-pointer transition-colors ${
                    tab === 'code' ? 'bg-[#0A2A66] text-white' : 'text-zinc-600 hover:text-zinc-900'
                  }`}
                >
                  <Code2 size={12} />
                  <span>HTML</span>
                </button>
              </div>

              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(resolvedHtml);
                  setCopied(true);
                  setTimeout(() => setCopied(false), 1800);
                }}
                className="min-h-[36px] w-9 rounded-lg border border-zinc-200 bg-white hover:border-[#00A6FF] text-zinc-700 flex items-center justify-center cursor-pointer"
                title="Copy HTML"
              >
                {copied ? <CheckCircle2 size={14} className="text-emerald-600" /> : <Copy size={14} />}
              </button>

              {onOpenFullScreenEditor && (
                <button
                  type="button"
                  onClick={() => onOpenFullScreenEditor(resolvedHtml, fileName, 'html')}
                  className="min-h-[36px] w-9 rounded-lg border border-zinc-200 bg-white hover:border-[#00A6FF] text-zinc-700 flex items-center justify-center cursor-pointer"
                  title="Edit HTML Code"
                >
                  <Maximize2 size={14} />
                </button>
              )}

              <button
                type="button"
                onClick={handleDownloadPng}
                disabled={exportingPng || tab !== 'preview'}
                className="min-h-[36px] px-3 rounded-lg bg-[#0A2A66] hover:bg-[#1450C8] disabled:opacity-50 text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer transition-colors"
              >
                {exportingPng ? <Loader2 size={13} className="animate-spin" /> : <Download size={13} />}
                <span>Export PNG</span>
              </button>
            </>
          )}
        </div>
      </div>

      {/* Body */}
      {isStreaming ? (
        <div className="p-5 flex items-center gap-2.5 text-xs font-bold text-[#0A2A66] bg-white">
          <Loader2 size={15} className="animate-spin text-[#00A6FF]" />
          <span>Composing studio artwork ({canvasW}×{canvasH})...</span>
        </div>
      ) : tab === 'preview' ? (
        <div className="p-3 sm:p-4 bg-[#F4F8FC] flex justify-center">
          <div
            ref={stageWrapRef}
            className="w-full max-w-full overflow-hidden rounded-xl border border-zinc-200 bg-zinc-950 relative"
            style={{ height: `${scaledHeight}px` }}
          >
            <iframe
              ref={iframeRef}
              srcDoc={srcDoc}
              sandbox="allow-scripts allow-same-origin"
              title="Creative Studio Image Canvas"
              style={{
                width: `${canvasW}px`,
                height: `${canvasH}px`,
                transform: `scale(${scale})`,
                transformOrigin: 'top left',
                border: '0',
                display: 'block',
                pointerEvents: 'none',
              }}
            />
          </div>
        </div>
      ) : (
        <div className="p-3 bg-white">
          <pre className="max-h-72 overflow-auto p-3 rounded-xl border border-zinc-200 bg-zinc-50 font-mono text-xs text-zinc-800 whitespace-pre">
            {resolvedHtml}
          </pre>
        </div>
      )}
    </div>
  );
};

export interface StudioVideoPlayerCardProps {
  htmlCode: string;
  videoPlan: VideoPlan;
  uploadsMap?: Record<string, string>;
  isStreaming?: boolean;
  onOpenFullScreenEditor?: (code: string, fileName?: string, lang?: string) => void;
  onTimingDriftReport?: (reportJson: string) => void;
}

export const StudioVideoPlayerCard: React.FC<StudioVideoPlayerCardProps> = ({
  htmlCode,
  videoPlan,
  uploadsMap = {},
  isStreaming = false,
  onOpenFullScreenEditor,
  onTimingDriftReport,
}) => {
  const [tab, setTab] = useState<'player' | 'scenes' | 'code'>('player');
  const [containerWidth, setContainerWidth] = useState(640);
  const [voState, setVoState] = useState<'idle' | 'loading' | 'ready' | 'error'>('idle');
  const [voBlobUrl, setVoBlobUrl] = useState<string>('');
  const [segmentTimings, setSegmentTimings] = useState<
    Array<{ scene: string; start: number; end: number; actual: number }>
  >([]);
  const [actualTotalDuration, setActualTotalDuration] = useState<number>(videoPlan.duration || 30);
  const [driftDetected, setDriftDetected] = useState<boolean>(false);

  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [isMuted, setIsMuted] = useState<boolean>(false);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [exportProgress, setExportProgress] = useState<number | null>(null);

  const stageWrapRef = useRef<HTMLDivElement | null>(null);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const playStartPerfRef = useRef<number>(0);
  const playOffsetRef = useRef<number>(0);
  const playingRef = useRef<boolean>(false);

  const [canvasW, canvasH] = useMemo(() => {
    if (Array.isArray(videoPlan.size) && videoPlan.size.length === 2) {
      return [Number(videoPlan.size[0]) || 1280, Number(videoPlan.size[1]) || 720];
    }
    return videoPlan.aspect === '9:16' ? [1080, 1920] : [1280, 720];
  }, [videoPlan]);

  const effectiveDuration = Math.min(120, Math.max(5, actualTotalDuration || videoPlan.duration || 30));

  // Synthesize full multi-segment Gemini TTS voiceover cleanly once stream completes
  useEffect(() => {
    if (isStreaming) return;
    const segments = videoPlan?.tts?.segments || [];
    if (segments.length === 0) {
      setVoState('ready');
      return;
    }

    let cancelled = false;
    let createdUrl = '';
    setVoState('loading');

    fetch('/api/studio/voiceover', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        segments,
        voice: videoPlan.tts.voice || 'Kore',
        style: videoPlan.tts.style || 'Clear studio narrator',
      }),
    })
      .then(async (res) => {
        if (!res.ok) throw new Error(`Voiceover HTTP ${res.status}`);
        return res.json();
      })
      .then((data) => {
        if (cancelled) return;
        if (data?.audioData) {
          createdUrl = base64ToBlobUrl(data.audioData, data.mimeType || 'audio/wav');
          setVoBlobUrl(createdUrl);
          if (typeof data.totalDuration === 'number' && data.totalDuration > 1) {
            setActualTotalDuration(Math.min(120, data.totalDuration));
          }
          if (Array.isArray(data.segmentTimings)) {
            setSegmentTimings(data.segmentTimings);
            const hasDrift = data.segmentTimings.some((st: any) => {
              const plannedScene = videoPlan.scenes.find((s) => s.id === st.scene);
              if (!plannedScene) return false;
              const plannedDur = Math.max(0.5, plannedScene.end - plannedScene.start);
              return Math.abs(st.actual - plannedDur) > 0.75;
            });
            setDriftDetected(hasDrift);
          }
          setVoState('ready');
        } else {
          setVoState('error');
        }
      })
      .catch((err) => {
        if (!cancelled) {
          console.warn('Video voiceover synth warning:', err);
          setVoState('error');
        }
      });

    return () => {
      cancelled = true;
      if (createdUrl) {
        try {
          URL.revokeObjectURL(createdUrl);
        } catch {}
      }
    };
  }, [isStreaming, videoPlan]);

  const resolvedHtml = useMemo(
    () => resolveStudioPlaceholders(htmlCode, uploadsMap, voBlobUrl || ''),
    [htmlCode, uploadsMap, voBlobUrl]
  );

  const srcDoc = useMemo(
    () => prepareStudioSrcDoc(resolvedHtml, canvasW, canvasH),
    [resolvedHtml, canvasW, canvasH]
  );

  useEffect(() => {
    const el = stageWrapRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return;
    const ro = new ResizeObserver((entries) => {
      for (const entry of entries) {
        if (entry.contentRect.width > 60) {
          setContainerWidth(entry.contentRect.width);
        }
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [tab]);

  const scale = Math.min(1, containerWidth / canvasW);
  const scaledHeight = Math.max(200, Math.round(canvasH * scale));

  const seekIframeTo = async (t: number) => {
    const win = iframeRef.current?.contentWindow as any;
    if (!win) return;
    try {
      const voInIframe = iframeRef.current?.contentDocument?.getElementById('vo') as HTMLAudioElement | null;
      if (voInIframe && Number.isFinite(voInIframe.duration)) {
        voInIframe.muted = true; // External controller audioRef drives sound without double echo
      }
      if (win.VIDEO) {
        if (win.VIDEO.ready && typeof win.VIDEO.ready.then === 'function') {
          await win.VIDEO.ready;
        }
        if (typeof win.VIDEO.seek === 'function') {
          win.VIDEO.seek(t);
        }
      }
    } catch {}
  };

  const stopPlayback = () => {
    playingRef.current = false;
    setIsPlaying(false);
    if (rafRef.current) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    if (audioRef.current) {
      try {
        audioRef.current.pause();
      } catch {}
    }
  };

  useEffect(() => {
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (audioRef.current) audioRef.current.pause();
    };
  }, []);

  const handleTogglePlay = async () => {
    if (playingRef.current) {
      stopPlayback();
      return;
    }

    const startOffset = currentTime >= effectiveDuration - 0.15 ? 0 : currentTime;
    playOffsetRef.current = startOffset;
    playStartPerfRef.current = performance.now();
    playingRef.current = true;
    setIsPlaying(true);

    if (audioRef.current && voBlobUrl) {
      try {
        audioRef.current.muted = isMuted;
        audioRef.current.currentTime = Math.min(startOffset, audioRef.current.duration || startOffset);
        await audioRef.current.play();
      } catch {}
    }

    const tick = () => {
      if (!playingRef.current) return;
      const elapsed =
        audioRef.current && voBlobUrl && !audioRef.current.paused && Number.isFinite(audioRef.current.currentTime)
          ? audioRef.current.currentTime
          : playOffsetRef.current + (performance.now() - playStartPerfRef.current) / 1000;

      if (elapsed >= effectiveDuration) {
        setCurrentTime(effectiveDuration);
        seekIframeTo(effectiveDuration);
        stopPlayback();
        return;
      }

      setCurrentTime(elapsed);
      seekIframeTo(elapsed);
      rafRef.current = requestAnimationFrame(tick);
    };

    rafRef.current = requestAnimationFrame(tick);
  };

  const handleScrub = (nextTime: number) => {
    setCurrentTime(nextTime);
    playOffsetRef.current = nextTime;
    playStartPerfRef.current = performance.now();
    if (audioRef.current && voBlobUrl && Number.isFinite(audioRef.current.duration)) {
      try {
        audioRef.current.currentTime = Math.min(nextTime, audioRef.current.duration);
      } catch {}
    }
    seekIframeTo(nextTime);
  };

  const handleToggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    if (audioRef.current) {
      audioRef.current.muted = next;
    }
  };

  const handleExportWebM = async () => {
    const iframeDoc = iframeRef.current?.contentDocument;
    const win = iframeRef.current?.contentWindow as any;
    const stageCanvas = iframeDoc?.querySelector('canvas') as HTMLCanvasElement | null;
    if (!stageCanvas || typeof stageCanvas.captureStream !== 'function') {
      // Download HTML player bundle if renderer isn't Canvas 2D
      const blob = new Blob([resolvedHtml], { type: 'text/html' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${(videoPlan.title || 'studio-video').replace(/\s+/g, '_').toLowerCase()}.html`;
      a.click();
      return;
    }

    stopPlayback();
    setExportProgress(1);

    try {
      if (win?.VIDEO?.ready) await win.VIDEO.ready;
      const videoStream = stageCanvas.captureStream(videoPlan.fps || 30);
      const tracks: MediaStreamTrack[] = [...videoStream.getVideoTracks()];

      let exportAudio: HTMLAudioElement | null = null;
      let audioCtx: AudioContext | null = null;
      if (voBlobUrl) {
        try {
          exportAudio = new Audio(voBlobUrl);
          audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
          const srcNode = audioCtx.createMediaElementSource(exportAudio);
          const destNode = audioCtx.createMediaStreamDestination();
          srcNode.connect(destNode);
          srcNode.connect(audioCtx.destination);
          destNode.stream.getAudioTracks().forEach((tr) => tracks.push(tr));
        } catch {}
      }

      const mixed = new MediaStream(tracks);
      const mimeType = MediaRecorder.isTypeSupported('video/webm;codecs=vp9,opus')
        ? 'video/webm;codecs=vp9,opus'
        : 'video/webm';
      const recorder = new MediaRecorder(mixed, { mimeType });
      const chunks: Blob[] = [];
      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunks.push(ev.data);
      };

      const donePromise = new Promise<void>((resolve) => {
        recorder.onstop = () => resolve();
      });

      recorder.start(250);
      if (exportAudio) {
        exportAudio.currentTime = 0;
        exportAudio.play().catch(() => {});
      }

      const startMs = performance.now();
      while (true) {
        const elapsed = (performance.now() - startMs) / 1000;
        if (elapsed >= effectiveDuration) break;
        if (win?.VIDEO?.seek) win.VIDEO.seek(elapsed);
        setCurrentTime(elapsed);
        setExportProgress(Math.min(99, Math.round((elapsed / effectiveDuration) * 100)));
        await new Promise((r) => setTimeout(r, 33));
      }

      recorder.stop();
      await donePromise;
      if (exportAudio) exportAudio.pause();
      if (audioCtx) audioCtx.close().catch(() => {});

      const webmBlob = new Blob(chunks, { type: 'video/webm' });
      const url = URL.createObjectURL(webmBlob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${(videoPlan.title || 'studio-video').replace(/[^a-z0-9_-]/gi, '_').toLowerCase()}.webm`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 4000);
    } catch (err) {
      console.warn('WebM export failed:', err);
    } finally {
      setExportProgress(null);
    }
  };

  return (
    <div className="mt-3 rounded-2xl bg-white border border-zinc-200 overflow-hidden text-zinc-900">
      {/* Hidden audio controller for instant synchronized studio narration */}
      {voBlobUrl && (
        <audio
          ref={audioRef}
          src={voBlobUrl}
          preload="auto"
          className="hidden"
          onEnded={() => {
            stopPlayback();
            setCurrentTime(effectiveDuration);
          }}
        />
      )}

      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-4 py-3 border-b border-zinc-200 bg-[#F4F8FC]">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="w-8 h-8 rounded-lg bg-[#0A2A66] text-white flex items-center justify-center shrink-0">
            <Film size={16} />
          </div>
          <div className="min-w-0">
            <div className="text-xs sm:text-sm font-extrabold text-[#0A2A66] truncate">
              {videoPlan.title || 'Creative Video'}
            </div>
            <div className="text-[11px] font-semibold text-zinc-500 tabular-nums">
              {videoPlan.style} · {videoPlan.aspect} · {formatClock(effectiveDuration)} · Voice: {videoPlan.tts?.voice || 'Kore'}
            </div>
          </div>
        </div>

        <div className="flex items-center gap-1.5 flex-wrap">
          {!isStreaming && (
            <>
              <div className="flex items-center rounded-lg border border-zinc-200 bg-white p-0.5">
                {(['player', 'scenes', 'code'] as const).map((tKey) => (
                  <button
                    key={tKey}
                    type="button"
                    onClick={() => setTab(tKey)}
                    className={`px-2.5 py-1.5 rounded-md text-[11px] font-bold capitalize cursor-pointer transition-colors ${
                      tab === tKey ? 'bg-[#0A2A66] text-white' : 'text-zinc-600 hover:text-zinc-900'
                    }`}
                  >
                    {tKey}
                  </button>
                ))}
              </div>

              {onOpenFullScreenEditor && (
                <button
                  type="button"
                  onClick={() => onOpenFullScreenEditor(resolvedHtml, 'video-player.html', 'html')}
                  className="min-h-[36px] w-9 rounded-lg border border-zinc-200 bg-white hover:border-[#00A6FF] text-zinc-700 flex items-center justify-center cursor-pointer"
                  title="Edit Video Code"
                >
                  <Maximize2 size={14} />
                </button>
              )}

              <button
                type="button"
                onClick={handleExportWebM}
                disabled={exportProgress !== null || voState === 'loading'}
                className="min-h-[36px] px-3 rounded-lg bg-[#0A2A66] hover:bg-[#1450C8] disabled:opacity-50 text-white text-xs font-extrabold flex items-center gap-1.5 cursor-pointer transition-colors tabular-nums"
              >
                {exportProgress !== null ? (
                  <>
                    <Loader2 size={13} className="animate-spin" />
                    <span>Recording {exportProgress}%</span>
                  </>
                ) : (
                  <>
                    <Download size={13} />
                    <span>Export WebM</span>
                  </>
                )}
              </button>
            </>
          )}
        </div>
      </div>

      {/* Drift Warning Bar */}
      {driftDetected && onTimingDriftReport && segmentTimings.length > 0 && (
        <div className="px-4 py-2 bg-amber-50 border-b border-amber-200 flex items-center justify-between gap-2 text-xs">
          <span className="font-semibold text-amber-900">
            Voiceover duration ({actualTotalDuration.toFixed(1)}s) differs slightly from storyboard scenes.
          </span>
          <button
            type="button"
            onClick={() =>
              onTimingDriftReport(
                JSON.stringify({
                  timing_report: {
                    segments: segmentTimings,
                    total: actualTotalDuration,
                  },
                })
              )
            }
            className="px-2.5 py-1 rounded-md bg-amber-900 text-white font-bold flex items-center gap-1 cursor-pointer shrink-0"
          >
            <RefreshCw size={11} />
            <span>Re-sync Scenes</span>
          </button>
        </div>
      )}

      {/* Body */}
      {isStreaming ? (
        <div className="p-5 flex items-center gap-2.5 text-xs font-bold text-[#0A2A66] bg-white">
          <Loader2 size={15} className="animate-spin text-[#00A6FF]" />
          <span>Building video renderer &amp; storyboard ({videoPlan.scenes.length} scenes)...</span>
        </div>
      ) : tab === 'player' ? (
        <div className="p-3 sm:p-4 bg-[#F4F8FC] space-y-3">
          <div className="flex justify-center">
            <div
              ref={stageWrapRef}
              className="w-full overflow-hidden rounded-xl border border-zinc-200 bg-zinc-950 relative"
              style={{
                maxWidth: videoPlan.aspect === '9:16' ? '340px' : '100%',
                height: `${scaledHeight}px`,
              }}
            >
              <iframe
                ref={iframeRef}
                srcDoc={srcDoc}
                sandbox="allow-scripts allow-same-origin"
                onLoad={() => seekIframeTo(0)}
                title="Creative Studio Video Stage"
                style={{
                  width: `${canvasW}px`,
                  height: `${canvasH}px`,
                  transform: `scale(${scale})`,
                  transformOrigin: 'top left',
                  border: '0',
                  display: 'block',
                  pointerEvents: 'none',
                }}
              />

              {voState === 'loading' && (
                <div className="absolute inset-0 bg-black/45 flex items-center justify-center">
                  <div className="px-3.5 py-2 rounded-lg bg-white text-[#0A2A66] text-xs font-extrabold flex items-center gap-2 border border-zinc-200">
                    <Loader2 size={14} className="animate-spin text-[#00A6FF]" />
                    <span>Generating Gemini Studio Voiceover...</span>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Reactive Transport Controls */}
          <div className="flex items-center gap-3 px-3 py-2 rounded-xl bg-white border border-zinc-200">
            <button
              type="button"
              onClick={handleTogglePlay}
              disabled={voState === 'loading'}
              className="min-h-[44px] min-w-[44px] rounded-lg bg-[#0A2A66] hover:bg-[#1450C8] disabled:opacity-50 text-white flex items-center justify-center cursor-pointer shrink-0"
              aria-label={isPlaying ? 'Pause video' : 'Play video'}
            >
              {isPlaying ? <Pause size={16} /> : <Play size={16} className="fill-current ml-0.5" />}
            </button>

            <input
              type="range"
              min={0}
              max={effectiveDuration}
              step={0.05}
              value={Math.min(currentTime, effectiveDuration)}
              onChange={(e) => handleScrub(parseFloat(e.target.value))}
              className="flex-1 accent-[#00A6FF] cursor-pointer"
              aria-label="Video timeline"
            />

            <span className="text-xs font-bold text-[#0A2A66] tabular-nums shrink-0">
              {formatClock(currentTime)} / {formatClock(effectiveDuration)}
            </span>

            <button
              type="button"
              onClick={handleToggleMute}
              className="min-h-[44px] min-w-[44px] rounded-lg border border-zinc-200 hover:border-[#00A6FF] text-zinc-700 flex items-center justify-center cursor-pointer shrink-0"
              aria-label={isMuted ? 'Unmute' : 'Mute'}
            >
              {isMuted ? <VolumeX size={16} /> : <Volume2 size={16} />}
            </button>
          </div>
        </div>
      ) : tab === 'scenes' ? (
        <div className="p-4 bg-white space-y-2 max-h-80 overflow-y-auto">
          {videoPlan.scenes.map((sc, i) => (
            <div
              key={sc.id || i}
              onClick={() => {
                setTab('player');
                handleScrub(sc.start);
              }}
              className="p-3 rounded-xl border border-zinc-200 hover:border-[#00A6FF] cursor-pointer flex items-start justify-between gap-3 transition-colors"
            >
              <div className="min-w-0">
                <div className="text-xs font-extrabold text-[#0A2A66]">
                  Scene {i + 1}: {sc.id} ({sc.visual?.type || 'visual'})
                </div>
                {sc.narration && (
                  <p className="text-xs text-zinc-600 mt-1 leading-relaxed">{sc.narration}</p>
                )}
              </div>
              <span className="text-[11px] font-bold text-[#0A2A66] tabular-nums shrink-0">
                {sc.start.toFixed(1)}s – {sc.end.toFixed(1)}s
              </span>
            </div>
          ))}
        </div>
      ) : (
        <div className="p-3 bg-white">
          <pre className="max-h-72 overflow-auto p-3 rounded-xl border border-zinc-200 bg-zinc-50 font-mono text-xs text-zinc-800 whitespace-pre">
            {resolvedHtml}
          </pre>
        </div>
      )}
    </div>
  );
};

export const StudioToolBadge: React.FC<{ toolCall: StudioToolCall; statusText?: string }> = ({
  toolCall,
  statusText,
}) => {
  const label =
    toolCall.tool === 'remove_background'
      ? `Background Cutout (${toolCall.upload_id || 'image'})`
      : toolCall.tool === 'save_template'
      ? `Saving Custom Template (${toolCall.template?.name || toolCall.template?.id || 'template'})`
      : 'Listing Studio Templates';

  return (
    <div className="my-2 px-3.5 py-2.5 rounded-xl bg-[#F4F8FC] border border-[#00A6FF]/35 text-xs font-bold text-[#0A2A66] flex items-center gap-2.5">
      <Wand2 size={15} className="text-[#00A6FF] shrink-0" />
      <span>{statusText || label}</span>
    </div>
  );
};
