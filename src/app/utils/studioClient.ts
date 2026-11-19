import html2canvas from 'html2canvas';
import { buildWorkspaceAuthHeaders } from './workspaceSession';
import {
  applyWebGpuColorGrade,
  ColorGradePreset,
  cutoutWithUltraProV2,
  enhancedBackgroundRemove,
  extractDominantColorsFromDataUrl,
  performWebGpuFaceSwap,
} from './webgpuVision';

export interface StudioPopupSpec {
  title: string;
  body: string;
  yes: string;
  no: string;
}

export interface StudioIntentResponse {
  intent: 'generate' | 'edit' | 'maybe_generate' | 'search' | 'none';
  confidence: number;
  recipe: string | null;
  lang: 'en' | 'hi' | 'hinglish' | string;
  popup?: StudioPopupSpec;
}

export interface StudioQuestionOption {
  id: string;
  label: string;
}

export interface StudioQuestion {
  id: string;
  type: 'choice' | 'text' | string;
  question: string;
  options: StudioQuestionOption[];
  allowCustomText?: boolean;
  default?: string;
}

export interface StudioSourceAttribution {
  domain?: string;
  url?: string;
  title?: string;
}

export interface StudioThinkingLogStep {
  kind: 'understand' | 'analysis' | 'search' | 'edit' | 'decision' | 'check' | 'result' | string;
  text: string;
  file?: string;
  query?: string;
  screenshotDataUrl?: string;
  screenshotLabel?: string;
}

export interface StudioJobResult {
  html: string;
  width: number;
  height: number;
  summary: StudioThinkingLogStep[];
  sources: StudioSourceAttribution[];
  warnings: string[];
  styleName?: string;
  plan?: {
    recipe?: string;
    style?: string;
    styleName?: string;
    palette?: string;
    fonts?: string;
    layout?: string;
    text?: {
      title?: string;
      subtitle?: string;
      badge?: string;
      cta?: string;
      extra?: string[];
    };
    assets?: any[];
  };
  elapsedMs?: number;
  ok?: boolean;
}

export interface StudioAttachmentMeta {
  id: string;
  name: string;
  type: string;
  facts?: any;
}

function authHeaders(token?: string | null): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    ...buildWorkspaceAuthHeaders(token),
  };
}

export const studioApi = {
  async intent(
    body: { message: string; attachments?: StudioAttachmentMeta[] },
    token?: string | null
  ): Promise<StudioIntentResponse> {
    const r = await fetch('/api/studio/intent', {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(body),
    });
    if (!r.ok) {
      return { intent: 'none', confidence: 0, recipe: null, lang: 'en' };
    }
    return r.json();
  },

  async questions(
    body: {
      message: string;
      attachments?: StudioAttachmentMeta[];
      answers?: Record<string, string>;
      recipeOverride?: string | null;
      intentOverride?: string | null;
    },
    token?: string | null
  ): Promise<{ questions: StudioQuestion[] }> {
    const r = await fetch('/api/studio/questions', {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(body),
    });
    if (!r.ok) return { questions: [] };
    return r.json();
  },

  async startJob(
    body: {
      message: string;
      answers?: Record<string, string>;
      attachments?: StudioAttachmentMeta[];
      previousPlan?: any;
      recipeOverride?: string | null;
      intentOverride?: string | null;
    },
    token?: string | null
  ): Promise<{ jobId: string }> {
    const r = await fetch('/api/studio/jobs', {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify(body),
    });
    const j = await r.json().catch(() => ({}));
    if (!r.ok || !j?.jobId) {
      throw new Error(j?.error || `Studio job failed (${r.status})`);
    }
    return j;
  },

  async sendResult(jobId: string, taskId: string, result: any, token?: string | null) {
    await fetch(`/api/studio/jobs/${encodeURIComponent(jobId)}/client-result`, {
      method: 'POST',
      headers: authHeaders(token),
      body: JSON.stringify({ taskId, result }),
    });
  },

  async cancel(jobId: string, token?: string | null) {
    await fetch(`/api/studio/jobs/${encodeURIComponent(jobId)}/cancel`, {
      method: 'POST',
      headers: authHeaders(token),
    }).catch(() => {});
  },
};

export function previewBox(w: number, h: number, maxW = 320, maxH = 380) {
  const safeW = Math.max(100, Number(w) || 1280);
  const safeH = Math.max(100, Number(h) || 720);
  const scale = Math.min(maxW / safeW, maxH / safeH, 1);
  return {
    w: Math.round(safeW * scale),
    h: Math.round(safeH * scale),
    scale,
    aspect: `${safeW} / ${safeH}`,
  };
}

export function createProgressDisplay(
  onTick: (info: { percent: number; seconds: number }) => void
) {
  let target = 0;
  let shown = 0;
  let lastPercent = -1;
  let lastSeconds = -1;
  let lastEmitAt = 0;
  const start = performance.now();
  let raf = 0;
  let stopped = false;

  const loop = (now: number) => {
    if (stopped) return;
    shown += (target - shown) * 0.08;
    if (target - shown < 0.3) shown = target;
    const pct = Math.min(99, Math.max(0, shown | 0));
    const sec = Math.max(0, ((now - start) / 1000) | 0);
    if ((pct !== lastPercent || sec !== lastSeconds) && now - lastEmitAt >= 120) {
      lastPercent = pct;
      lastSeconds = sec;
      lastEmitAt = now;
      onTick({ percent: pct, seconds: sec });
    }
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
  return {
    set(p: number) {
      target = Math.max(target, Math.min(99, p));
    },
    finish() {
      stopped = true;
      cancelAnimationFrame(raf);
      onTick({
        percent: 100,
        seconds: Math.max(1, ((performance.now() - start) / 1000) | 0),
      });
    },
    stop() {
      stopped = true;
      cancelAnimationFrame(raf);
    },
  };
}

export function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((res, rej) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => res(img);
    img.onerror = () => rej(new Error('Image load failed'));
    img.src = src;
  });
}

function drawScaled(img: HTMLImageElement, maxSize: number) {
  const k = Math.min(1, maxSize / Math.max(img.width || 1, img.height || 1));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round((img.width || 1) * k));
  c.height = Math.max(1, Math.round((img.height || 1) * k));
  const ctx = c.getContext('2d');
  if (ctx) ctx.drawImage(img, 0, 0, c.width, c.height);
  return c;
}

export function analyzeCanvas(canvas: HTMLCanvasElement, name: string) {
  const W = canvas.width;
  const H = canvas.height;
  const s = document.createElement('canvas');
  const k = Math.min(1, 96 / Math.max(W, H, 1));
  s.width = Math.max(1, Math.round(W * k));
  s.height = Math.max(1, Math.round(H * k));
  const ctx = s.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    return {
      name,
      kind: 'image',
      width: W,
      height: H,
      orientation: Math.abs(W - H) / Math.max(W, H, 1) < 0.06 ? 'square' : W > H ? 'landscape' : 'portrait',
      hasAlpha: false,
      brightness: 0.5,
      dominant: [],
      bgUniform: false,
      bgColor: '#000000',
    };
  }
  ctx.drawImage(canvas, 0, 0, s.width, s.height);
  const d = ctx.getImageData(0, 0, s.width, s.height).data;
  let sum = 0;
  let n = 0;
  let alpha = false;
  const bins = new Map<number, number>();
  for (let i = 0; i < d.length; i += 4) {
    if (d[i + 3] < 250) alpha = true;
    if (d[i + 3] < 20) continue;
    const l = (0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2]) / 255;
    sum += l;
    n++;
    const key = ((d[i] >> 5) << 6) | ((d[i + 1] >> 5) << 3) | (d[i + 2] >> 5);
    bins.set(key, (bins.get(key) || 0) + 1);
  }
  const dominant = [...bins.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([k2]) =>
      '#' +
      [(k2 >> 6) & 7, (k2 >> 3) & 7, k2 & 7]
        .map((v) => Math.min(255, v * 36 + 18).toString(16).padStart(2, '0'))
        .join('')
    );

  const ring: number[][] = [];
  const sw = s.width;
  const sh = s.height;
  const px = (x: number, y: number) => {
    const idx = (y * sw + x) * 4;
    return [d[idx], d[idx + 1], d[idx + 2]];
  };
  for (let x = 0; x < sw; x++) {
    ring.push(px(x, 0), px(x, sh - 1));
  }
  for (let y = 0; y < sh; y++) {
    ring.push(px(0, y), px(sw - 1, y));
  }
  const avg = ring
    .reduce((a, c) => [a[0] + c[0], a[1] + c[1], a[2] + c[2]], [0, 0, 0])
    .map((v) => v / Math.max(1, ring.length));
  const dev =
    ring.reduce(
      (a, c) => a + Math.hypot(c[0] - avg[0], c[1] - avg[1], c[2] - avg[2]),
      0
    ) / Math.max(1, ring.length);
  const bgColor =
    '#' + avg.map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, '0')).join('');

  return {
    name,
    kind: 'image',
    width: W,
    height: H,
    orientation:
      Math.abs(W - H) / Math.max(W, H, 1) < 0.06
        ? 'square'
        : W > H
          ? 'landscape'
          : 'portrait',
    hasAlpha: alpha,
    brightness: n ? Number((sum / n).toFixed(2)) : 0,
    dominant,
    bgUniform: dev < 28,
    bgColor,
  };
}

export async function analyzeImageDataUrl(dataUrl: string, name: string) {
  const img = await loadImage(dataUrl);
  return analyzeCanvas(drawScaled(img, 600), name);
}

const fmtSec = (t: number) =>
  `${Math.floor(t / 60)}:${String(Math.floor(t % 60)).padStart(2, '0')}`;

/**
 * Samples N frames from an uploaded video into ONE tiled contact-sheet JPEG with timestamp overlays.
 * Returns facts matching Section 2.1 + 2.3 of the Creative Studio System Prompt Module.
 */
export async function analyzeVideoSource(
  source: File | string,
  fileName: string,
  frames = 12,
  cols = 4
): Promise<{ facts: any; contactSheetDataUrl: string } | null> {
  let objUrl: string | null = null;
  try {
    const srcUrl = typeof source === 'string' ? source : (objUrl = URL.createObjectURL(source));
    const v = document.createElement('video');
    v.muted = true;
    v.playsInline = true;
    v.preload = 'metadata';
    v.src = srcUrl;

    await new Promise<void>((resolve, reject) => {
      const to = setTimeout(() => reject(new Error('video metadata timeout')), 8000);
      v.onloadedmetadata = () => {
        clearTimeout(to);
        resolve();
      };
      v.onerror = () => {
        clearTimeout(to);
        reject(new Error('video load failed'));
      };
    });

    const dur = Number.isFinite(v.duration) && v.duration > 0 ? v.duration : 1;
    const vw = v.videoWidth || 640;
    const vh = v.videoHeight || 360;
    const tw = 240;
    const th = Math.max(90, Math.round((tw * vh) / vw) || 135);
    const rows = Math.ceil(frames / cols);
    const sheet = document.createElement('canvas');
    sheet.width = tw * cols;
    sheet.height = th * rows;
    const g = sheet.getContext('2d');
    if (!g) return null;
    g.fillStyle = '#000';
    g.fillRect(0, 0, sheet.width, sheet.height);

    const times: number[] = [];
    const totalSamples = dur < 1 ? 1 : frames;
    for (let i = 0; i < totalSamples; i++) {
      const targetTime = Math.min(Math.max(0, dur - 0.05), (dur * (i + 0.5)) / totalSamples);
      await new Promise<void>((resolve) => {
        let done = false;
        const finish = () => {
          if (!done) {
            done = true;
            resolve();
          }
        };
        const to = setTimeout(finish, 900);
        v.onseeked = () => {
          clearTimeout(to);
          finish();
        };
        try {
          v.currentTime = targetTime;
        } catch {
          clearTimeout(to);
          finish();
        }
      });
      const x = (i % cols) * tw;
      const y = Math.floor(i / cols) * th;
      try {
        g.drawImage(v, x, y, tw, th);
      } catch {}
      g.fillStyle = 'rgba(0,0,0,0.7)';
      g.fillRect(x, y, 54, 18);
      g.fillStyle = '#fff';
      g.font = '12px sans-serif';
      g.fillText(fmtSec(targetTime), x + 4, y + 13);
      times.push(Number(targetTime.toFixed(1)));
    }

    const contactSheetDataUrl = sheet.toDataURL('image/jpeg', 0.8);
    const sheetFacts = analyzeCanvas(sheet, fileName);
    return {
      contactSheetDataUrl,
      facts: {
        name: fileName,
        kind: 'video',
        durationSec: Number(dur.toFixed(1)),
        frameTimes: times,
        contactSheet: true,
        width: vw,
        height: vh,
        orientation: sheetFacts.orientation,
        brightness: sheetFacts.brightness,
        dominant: sheetFacts.dominant,
      },
    };
  } catch {
    return null;
  } finally {
    if (objUrl) URL.revokeObjectURL(objUrl);
  }
}

export function adjustCanvas(
  canvas: HTMLCanvasElement,
  { brightness = 1, contrast = 1, saturate = 1, blur = 0 } = {}
) {
  const c = document.createElement('canvas');
  c.width = canvas.width;
  c.height = canvas.height;
  const g = c.getContext('2d');
  if (g) {
    g.filter = `brightness(${brightness}) contrast(${contrast}) saturate(${saturate})${blur ? ` blur(${blur}px)` : ''}`;
    g.drawImage(canvas, 0, 0);
  }
  return c;
}

export async function runStudioClientTask(
  task: string,
  p: any,
  getUploadDataUrl: (uploadId: string) => { dataUrl: string; name: string } | null
) {
  if (task === 'face_swap') {
    const faceUp = getUploadDataUrl(String(p.faceUploadId || ''));
    if (!faceUp?.dataUrl) return { error: 'source face upload missing' };

    let targetDataUrl = '';
    let chosen: any = null;
    if (p.source === 'upload' && p.targetUploadId) {
      const targetUp = getUploadDataUrl(String(p.targetUploadId));
      if (!targetUp?.dataUrl) return { error: 'target scene upload missing' };
      targetDataUrl = targetUp.dataUrl;
    } else {
      for (const c of p.candidates || []) {
        try {
          const src = c.url || c.thumbnail;
          if (!src) continue;
          const img = await loadImage(`/api/studio/img-proxy?url=${encodeURIComponent(src)}`);
          const cv = drawScaled(img, p.maxSize || 1400);
          targetDataUrl = cv.toDataURL('image/png');
          chosen = c;
          break;
        } catch {
          // try next candidate
        }
      }
      if (!targetDataUrl) return { error: 'no target scene could be loaded' };
    }

    const swapRes = await performWebGpuFaceSwap({
      targetImageDataUrl: targetDataUrl,
      sourceFaceDataUrl: faceUp.dataUrl,
      promptText: String(p.promptText || ''),
    });

    if (swapRes.refused) {
      return { refused: true, reason: swapRes.reason };
    }
    if (!swapRes.ok || !swapRes.resultDataUrl) {
      return { error: swapRes.reason || 'face swap failed' };
    }

    const palette = await extractDominantColorsFromDataUrl(targetDataUrl).catch(() => null);
    return {
      dataUrl: swapRes.resultDataUrl,
      usedWebGpu: swapRes.usedWebGpu,
      alignmentScreenshotDataUrl: swapRes.alignmentScreenshotDataUrl,
      finalScreenshotDataUrl: swapRes.finalScreenshotDataUrl,
      palette,
      width: swapRes.width,
      height: swapRes.height,
      chosen,
    };
  }

  if (task === 'render_preview') {
    try {
      const w = Math.max(120, Number(p?.width) || 1080);
      const h = Math.max(120, Number(p?.height) || 1080);
      const dataUrl = await exportStudioHtmlToPngDataUrl(String(p?.html || ''), w, h);
      return { dataUrl, width: w, height: h };
    } catch (err: any) {
      return { error: String(err?.message || err || 'preview render failed') };
    }
  }

  if (task !== 'prepare_asset') return { error: 'unknown task' };
  let img: HTMLImageElement | null = null;
  let chosen: any = null;
  let uploadName = 'asset';

  if (p.source === 'upload') {
    const up = getUploadDataUrl(String(p.uploadId || ''));
    if (!up?.dataUrl) return { error: 'upload missing' };
    uploadName = up.name || 'upload.png';
    img = await loadImage(up.dataUrl);
  } else {
    for (const c of p.candidates || []) {
      try {
        const src = c.url || c.thumbnail;
        if (!src) continue;
        img = await loadImage(`/api/studio/img-proxy?url=${encodeURIComponent(src)}`);
        chosen = c;
        break;
      } catch {
        // try next candidate
      }
    }
    if (!img) return { error: 'no candidate could be loaded' };
  }

  let canvas = drawScaled(img, p.maxSize || 1600);
  const displayName =
    p.source === 'upload' ? uploadName : chosen?.title || 'web image';
  const facts = analyzeCanvas(canvas, displayName);

  const baseDataUrl = canvas.toDataURL('image/png');
  let palette = await extractDominantColorsFromDataUrl(baseDataUrl).catch(() => null);
  let outlineScreenshotDataUrl: string | undefined;

  let method = 'none';
  if (p.removeBackground) {
    try {
      const cut = await cutoutWithUltraProV2(baseDataUrl, { maxPasses: 3, enableVisionInspect: true });
      const cutImg = await loadImage(cut.cutoutDataUrl);
      const cutCanvas = document.createElement('canvas');
      cutCanvas.width = cutImg.width;
      cutCanvas.height = cutImg.height;
      cutCanvas.getContext('2d')?.drawImage(cutImg, 0, 0);
      canvas = cutCanvas;
      outlineScreenshotDataUrl = cut.outlineScreenshotDataUrl;
      palette = cut.palette || palette;
      method = cut.method;
    } catch {
      try {
        const fallbackCut = await enhancedBackgroundRemove(baseDataUrl);
        const cutImg = await loadImage(fallbackCut.cutoutDataUrl);
        const cutCanvas = document.createElement('canvas');
        cutCanvas.width = cutImg.width;
        cutCanvas.height = cutImg.height;
        cutCanvas.getContext('2d')?.drawImage(cutImg, 0, 0);
        canvas = cutCanvas;
        outlineScreenshotDataUrl = fallbackCut.outlineScreenshotDataUrl;
        palette = fallbackCut.palette || palette;
        method = fallbackCut.method;
      } catch {
        method = 'none';
      }
    }
  }

  let colorGradePreset: string | undefined;
  let usedWebGpuColorGrade = false;
  if (p.adjust?.colorGrade) {
    try {
      const graded = await applyWebGpuColorGrade(canvas, p.adjust.colorGrade as ColorGradePreset);
      canvas = graded.canvas;
      colorGradePreset = graded.preset;
      usedWebGpuColorGrade = graded.usedWebGpu;
    } catch {}
  }

  if (p.adjust && Object.keys(p.adjust).some((k) => k !== 'colorGrade')) {
    canvas = adjustCanvas(canvas, p.adjust);
  }

  return {
    dataUrl: canvas.toDataURL('image/png'),
    outlineScreenshotDataUrl,
    palette,
    colorGradePreset,
    usedWebGpuColorGrade,
    width: canvas.width,
    height: canvas.height,
    facts: { ...facts, hasAlpha: facts.hasAlpha || method !== 'none' },
    method,
    chosen,
  };
}

export function watchStudioJob(
  jobId: string,
  handlers: {
    onProgress?: (e: any) => void;
    onStep?: (step: StudioThinkingLogStep) => void;
    onResult?: (e: StudioJobResult) => void;
    onRefused?: (e: { reason: string }) => void;
    onError?: (e: { message: string }) => void;
  },
  getUploadDataUrl: (uploadId: string) => { dataUrl: string; name: string } | null,
  token?: string | null
) {
  const es = new EventSource(`/api/studio/jobs/${encodeURIComponent(jobId)}/events`);
  es.onmessage = async (ev) => {
    let e: any;
    try {
      e = JSON.parse(ev.data);
    } catch {
      return;
    }
    if (e.type === 'progress') handlers.onProgress?.(e);
    else if (e.type === 'step') handlers.onStep?.(e.step);
    else if (e.type === 'client_task') {
      const res = await runStudioClientTask(e.task, e.payload, getUploadDataUrl);
      await studioApi.sendResult(jobId, e.taskId, res, token);
    } else if (e.type === 'result') {
      es.close();
      handlers.onResult?.(e);
    } else if (e.type === 'refused') {
      es.close();
      handlers.onRefused?.(e);
    } else if (e.type === 'error') {
      es.close();
      handlers.onError?.(e);
    }
  };
  es.onerror = () => {
    es.close();
    handlers.onError?.({ message: 'Lost connection to Creative Studio stream.' });
  };
  return () => es.close();
}

/**
 * Renders a script-free Studio HTML composition inside an offscreen exact-pixel container to a crisp PNG data URL.
 */
export async function exportStudioHtmlToPngDataUrl(
  html: string,
  width: number,
  height: number
): Promise<string> {
  const iframe = document.createElement('iframe');
  iframe.setAttribute('sandbox', 'allow-same-origin');
  iframe.style.position = 'fixed';
  iframe.style.left = '-99999px';
  iframe.style.top = '0';
  iframe.style.width = `${width}px`;
  iframe.style.height = `${height}px`;
  iframe.style.border = '0';
  iframe.style.opacity = '0';
  iframe.style.pointerEvents = 'none';
  document.body.appendChild(iframe);

  try {
    const doc = iframe.contentDocument;
    if (!doc) throw new Error('Unable to access composition document');
    doc.open();
    doc.write(html);
    doc.close();

    // Wait briefly for web fonts & data-URI images to settle
    await new Promise<void>((resolve) => setTimeout(resolve, 420));
    try {
      await (iframe.contentDocument as any).fonts?.ready;
    } catch {}

    const target = iframe.contentDocument?.body || iframe.contentDocument?.documentElement;
    if (!target) throw new Error('Empty studio composition document');

    const canvas = await html2canvas(target as HTMLElement, {
      width,
      height,
      windowWidth: width,
      windowHeight: height,
      scale: 1,
      useCORS: true,
      allowTaint: true,
      backgroundColor: null,
      logging: false,
    });
    return canvas.toDataURL('image/png');
  } finally {
    iframe.remove();
  }
}
