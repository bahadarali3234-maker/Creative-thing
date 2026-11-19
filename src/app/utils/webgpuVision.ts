/**
 * WebGPU & Canvas Vision Engine
 * - Real WebGPU WGSL Compute Shaders (with automatic Canvas2D/RGBA fallback)
 * - Policy & Safety Pre-Flight Analyzer (blocks explicit / NSFW / unsafe swaps)
 * - Enhanced Contour-Outline Background Remover (analyzes -> draws character outline -> removes bg)
 * - Policy-Safe WebGPU Face Swapper (2-image swap or detailed prompt + user face swap)
 * - Dominant Background & Accent Color Extractor for web-searched photos
 */

import { removeBackground, removeBackgroundSimple } from './mythoriaLib';

export interface ExtractedPalette {
  bgHex: string;
  surfaceHex: string;
  primaryHex: string;
  accentHex: string;
  textHex: string;
  isDark: boolean;
  dominantColors: string[];
}

export interface SafetyCheckResult {
  safe: boolean;
  reason?: string;
  skinExposureRatio: number;
  meanLuminance: number;
}

export interface FaceBox {
  x: number;
  y: number;
  w: number;
  h: number;
  confidence: number;
  method: 'FaceDetector' | 'SkinGeometry' | 'PortraitFallback';
}

export interface ContourCutoutResult {
  method: 'webgpu-ai' | 'webgpu-contour' | 'simple';
  outlineScreenshotDataUrl: string;
  cutoutDataUrl: string;
  width: number;
  height: number;
  palette: ExtractedPalette;
}

export interface VerifiedCutoutResult extends ContourCutoutResult {
  ok: boolean;
  qualityScore: number;
  passesUsed: number;
  reason: string;
}

export interface FaceSwapResult {
  ok: boolean;
  refused?: boolean;
  reason?: string;
  usedWebGpu: boolean;
  resultDataUrl: string;
  safetyScreenshotDataUrl?: string;
  alignmentScreenshotDataUrl?: string;
  finalScreenshotDataUrl?: string;
  width: number;
  height: number;
  targetFaceBox?: FaceBox;
  sourceFaceBox?: FaceBox;
}

export type ColorGradePreset =
  | 'cinematic-teal-orange'
  | 'golden-editorial'
  | 'neon-pop'
  | 'luxury-noir'
  | 'portrait-natural';

export interface ColorGradeResult {
  canvas: HTMLCanvasElement;
  preset: ColorGradePreset;
  usedWebGpu: boolean;
}

const UNSAFE_PROMPT_REGEX =
  /\b(nude|nudity|naked|nsfw|porn|pornograph|xxx|explicit|hentai|erotic|topless|lingerie|bikini\s*strip|deepfake\s*nude|undress|remove\s*clothes|strip\s*clothes|sexual|fetish|gore|behead|bloody\s*murder|csam|underage\s*nude)\b/i;

let cachedGpuDevice: any | null = null;
let gpuProbeDone = false;

export async function getWebGpuDevice(): Promise<any | null> {
  if (gpuProbeDone) return cachedGpuDevice;
  gpuProbeDone = true;
  try {
    const gpu = (navigator as any)?.gpu;
    if (!gpu || typeof gpu.requestAdapter !== 'function') return null;
    const adapter = await gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter) return null;
    cachedGpuDevice = await adapter.requestDevice();
    return cachedGpuDevice;
  } catch {
    cachedGpuDevice = null;
    return null;
  }
}

export function isWebGpuSupported(): boolean {
  return typeof navigator !== 'undefined' && Boolean((navigator as any).gpu);
}

function rgbToHex(r: number, g: number, b: number): string {
  const c = (n: number) => Math.max(0, Math.min(255, Math.round(n))).toString(16).padStart(2, '0');
  return `#${c(r)}${c(g)}${c(b)}`;
}

function hexToRgb(hex: string): [number, number, number] {
  const clean = hex.replace('#', '');
  const full = clean.length === 3 ? clean.split('').map((ch) => ch + ch).join('') : clean;
  if (full.length !== 6) return [15, 23, 42];
  return [
    parseInt(full.slice(0, 2), 16) || 0,
    parseInt(full.slice(2, 4), 16) || 0,
    parseInt(full.slice(4, 6), 16) || 0,
  ];
}

function relLuminance(r: number, g: number, b: number): number {
  const lin = [r, g, b].map((v) => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  return 0.2126 * lin[0] + 0.7152 * lin[1] + 0.0722 * lin[2];
}

function rgbSaturation(r: number, g: number, b: number): number {
  const max = Math.max(r, g, b) / 255;
  const min = Math.min(r, g, b) / 255;
  if (max === min) return 0;
  const d = max - min;
  const l = (max + min) / 2;
  return l > 0.5 ? d / (2 - max - min) : d / (max + min);
}

export function loadImageEl(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Could not load image for processing'));
    img.src = src;
  });
}

export function imageToCanvas(img: HTMLImageElement, maxDim = 1400): HTMLCanvasElement {
  const w0 = img.naturalWidth || img.width || 1;
  const h0 = img.naturalHeight || img.height || 1;
  const scale = Math.min(1, maxDim / Math.max(w0, h0));
  const c = document.createElement('canvas');
  c.width = Math.max(1, Math.round(w0 * scale));
  c.height = Math.max(1, Math.round(h0 * scale));
  const ctx = c.getContext('2d', { willReadFrequently: true });
  ctx?.drawImage(img, 0, 0, c.width, c.height);
  return c;
}

/**
 * Extracts background, surface, primary & vibrant accent colors directly from any canvas image.
 */
export function extractDominantColorsFromCanvas(canvas: HTMLCanvasElement): ExtractedPalette {
  const s = document.createElement('canvas');
  const k = Math.min(1, 96 / Math.max(canvas.width, canvas.height, 1));
  s.width = Math.max(8, Math.round(canvas.width * k));
  s.height = Math.max(8, Math.round(canvas.height * k));
  const ctx = s.getContext('2d', { willReadFrequently: true });
  if (!ctx) {
    return {
      bgHex: '#0b1020',
      surfaceHex: '#151d33',
      primaryHex: '#0a7cf0',
      accentHex: '#4aa8ff',
      textHex: '#ffffff',
      isDark: true,
      dominantColors: ['#0b1020', '#0a7cf0', '#4aa8ff'],
    };
  }
  ctx.drawImage(canvas, 0, 0, s.width, s.height);
  const d = ctx.getImageData(0, 0, s.width, s.height).data;

  // Sample outer perimeter & upper backdrop for true background color
  let bgR = 0, bgG = 0, bgB = 0, bgN = 0;
  const bins = new Map<number, { count: number; rSum: number; gSum: number; bSum: number }>();

  for (let y = 0; y < s.height; y++) {
    for (let x = 0; x < s.width; x++) {
      const idx = (y * s.width + x) * 4;
      const a = d[idx + 3];
      if (a < 40) continue;
      const r = d[idx], g = d[idx + 1], b = d[idx + 2];

      const isBorder = x < 4 || x >= s.width - 4 || y < Math.max(4, Math.floor(s.height * 0.14));
      if (isBorder) {
        bgR += r;
        bgG += g;
        bgB += b;
        bgN++;
      }

      const key = ((r >> 5) << 10) | ((g >> 5) << 5) | (b >> 5);
      const entry = bins.get(key) || { count: 0, rSum: 0, gSum: 0, bSum: 0 };
      entry.count += 1;
      entry.rSum += r;
      entry.gSum += g;
      entry.bSum += b;
      bins.set(key, entry);
    }
  }

  const ranked = [...bins.values()]
    .map((e) => ({
      count: e.count,
      r: e.rSum / e.count,
      g: e.gSum / e.count,
      b: e.bSum / e.count,
      sat: rgbSaturation(e.rSum / e.count, e.gSum / e.count, e.bSum / e.count),
    }))
    .sort((a, b) => b.count - a.count);

  const bgRgb: [number, number, number] =
    bgN > 0
      ? [bgR / bgN, bgG / bgN, bgB / bgN]
      : ranked[0]
      ? [ranked[0].r, ranked[0].g, ranked[0].b]
      : [12, 16, 30];

  const bgHex = rgbToHex(bgRgb[0], bgRgb[1], bgRgb[2]);
  const bgLum = relLuminance(bgRgb[0], bgRgb[1], bgRgb[2]);
  const isDark = bgLum < 0.36;

  // Pick vibrant primary & accent from most saturated prominent colors
  const vibrant = [...ranked]
    .filter((c) => c.count > (s.width * s.height) * 0.004)
    .sort((a, b) => b.sat * Math.sqrt(b.count) - a.sat * Math.sqrt(a.count));

  const prim = vibrant[0] || ranked[1] || ranked[0] || { r: 10, g: 124, b: 240 };
  const acc =
    vibrant.find((v) => Math.hypot(v.r - prim.r, v.g - prim.g, v.b - prim.b) > 55) ||
    vibrant[1] || {
      r: Math.min(255, prim.r + 48),
      g: Math.min(255, prim.g + 48),
      b: Math.min(255, prim.b + 48),
    };

  const surfaceRgb: [number, number, number] = isDark
    ? [Math.min(255, bgRgb[0] + 18), Math.min(255, bgRgb[1] + 20), Math.min(255, bgRgb[2] + 26)]
    : [Math.max(0, bgRgb[0] - 12), Math.max(0, bgRgb[1] - 12), Math.max(0, bgRgb[2] - 10)];

  return {
    bgHex,
    surfaceHex: rgbToHex(surfaceRgb[0], surfaceRgb[1], surfaceRgb[2]),
    primaryHex: rgbToHex(prim.r, prim.g, prim.b),
    accentHex: rgbToHex(acc.r, acc.g, acc.b),
    textHex: isDark ? '#ffffff' : '#0f172a',
    isDark,
    dominantColors: ranked.slice(0, 4).map((c) => rgbToHex(c.r, c.g, c.b)),
  };
}

export async function extractDominantColorsFromDataUrl(dataUrl: string): Promise<ExtractedPalette> {
  const img = await loadImageEl(dataUrl);
  return extractDominantColorsFromCanvas(imageToCanvas(img, 300));
}

function isSkinYCbCr(r: number, g: number, b: number): boolean {
  const cb = 128 - 0.168736 * r - 0.331264 * g + 0.5 * b;
  const cr = 128 + 0.5 * r - 0.418688 * g - 0.081312 * b;
  return r > 45 && g > 30 && b > 18 && cb >= 77 && cb <= 127 && cr >= 133 && cr <= 176;
}

/**
 * Policy & Safety Analyzer for face swap & generative edits.
 */
export function analyzeSafetyAndContent(canvas: HTMLCanvasElement, promptText = ''): SafetyCheckResult {
  if (UNSAFE_PROMPT_REGEX.test(promptText)) {
    return {
      safe: false,
      reason: 'Safety policy does not allow sexually explicit, nude, or non-consensual face edits.',
      skinExposureRatio: 0,
      meanLuminance: 0.5,
    };
  }

  const s = document.createElement('canvas');
  s.width = 96;
  s.height = 96;
  const ctx = s.getContext('2d', { willReadFrequently: true });
  if (!ctx) return { safe: true, skinExposureRatio: 0.1, meanLuminance: 0.5 };
  ctx.drawImage(canvas, 0, 0, 96, 96);
  const d = ctx.getImageData(0, 0, 96, 96).data;

  let skinCount = 0;
  let torsoSkinCount = 0;
  let total = 0;
  let lumSum = 0;

  for (let y = 0; y < 96; y++) {
    for (let x = 0; x < 96; x++) {
      const idx = (y * 96 + x) * 4;
      if (d[idx + 3] < 40) continue;
      total++;
      const r = d[idx], g = d[idx + 1], b = d[idx + 2];
      lumSum += (0.299 * r + 0.587 * g + 0.114 * b) / 255;
      if (isSkinYCbCr(r, g, b)) {
        skinCount++;
        // Check central lower-torso density (heuristic against nudity photos)
        if (y > 42 && y < 90 && x > 18 && x < 78) {
          torsoSkinCount++;
        }
      }
    }
  }

  const ratio = total ? skinCount / total : 0;
  const torsoRatio = total ? torsoSkinCount / (total * 0.4) : 0;

  // Only trigger skin guard when near-total explicit exposure is paired with unsafe context
  if (ratio > 0.84 && torsoRatio > 0.86) {
    return {
      safe: false,
      reason: 'Image appears overly explicit for face swapping.',
      skinExposureRatio: Number(ratio.toFixed(2)),
      meanLuminance: Number((lumSum / Math.max(1, total)).toFixed(2)),
    };
  }

  return {
    safe: true,
    skinExposureRatio: Number(ratio.toFixed(2)),
    meanLuminance: Number((lumSum / Math.max(1, total)).toFixed(2)),
  };
}

/**
 * WebGPU Compute Shader pass for Sobel Contour Edges + Rim Masking.
 * Falls back cleanly to CPU typed-array pass when WebGPU adapter is unavailable.
 */
async function computeAlphaContourMask(rgba: Uint8ClampedArray, w: number, h: number): Promise<Uint8ClampedArray> {
  const n = w * h;
  const device = await getWebGpuDevice();

  if (device && typeof (globalThis as any).GPUBufferUsage !== 'undefined') {
    try {
      const GPUBU = (globalThis as any).GPUBufferUsage;
      const GPUMap = (globalThis as any).GPUMapMode;
      const inBuf = device.createBuffer({
        size: rgba.byteLength,
        usage: GPUBU.STORAGE | GPUBU.COPY_DST,
      });
      const outBuf = device.createBuffer({
        size: n * 4,
        usage: GPUBU.STORAGE | GPUBU.COPY_SRC,
      });
      const readBuf = device.createBuffer({
        size: n * 4,
        usage: GPUBU.MAP_READ | GPUBU.COPY_DST,
      });
      const uniBuf = device.createBuffer({
        size: 16,
        usage: GPUBU.UNIFORM | GPUBU.COPY_DST,
      });

      device.queue.writeBuffer(inBuf, 0, rgba);
      device.queue.writeBuffer(uniBuf, 0, new Uint32Array([w, h, 0, 0]));

      const shader = device.createShaderModule({
        code: `
          struct Dims { w: u32, h: u32, p0: u32, p1: u32 };
          @group(0) @binding(0) var<storage, read> src: array<u32>;
          @group(0) @binding(1) var<storage, read_write> edgeOut: array<u32>;
          @group(0) @binding(2) var<uniform> dims: Dims;

          fn alphaAt(x: i32, y: i32) -> f32 {
            let cx = clamp(x, 0, i32(dims.w) - 1);
            let cy = clamp(y, 0, i32(dims.h) - 1);
            let px = src[u32(cy) * dims.w + u32(cx)];
            return f32((px >> 24u) & 255u) / 255.0;
          }

          @compute @workgroup_size(8, 8)
          fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
            if (gid.x >= dims.w || gid.y >= dims.h) { return; }
            let x = i32(gid.x);
            let y = i32(gid.y);
            let aC = alphaAt(x, y);
            let gx = abs(alphaAt(x + 1, y) - alphaAt(x - 1, y));
            let gy = abs(alphaAt(x, y + 1) - alphaAt(x, y - 1));
            let gx2 = abs(alphaAt(x + 2, y) - alphaAt(x - 2, y));
            let gy2 = abs(alphaAt(x, y + 2) - alphaAt(x, y - 2));
            let edge = min(1.0, (gx + gy + (gx2 + gy2) * 0.65));
            let isBorder = select(0u, u32(edge * 255.0), aC > 0.15 && edge > 0.14);
            edgeOut[gid.y * dims.w + gid.x] = isBorder;
          }
        `,
      });

      const pipeline = device.createComputePipeline({
        layout: 'auto',
        compute: { module: shader, entryPoint: 'main' },
      });
      const bindGroup = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: inBuf } },
          { binding: 1, resource: { buffer: outBuf } },
          { binding: 2, resource: { buffer: uniBuf } },
        ],
      });

      const enc = device.createCommandEncoder();
      const pass = enc.beginComputePass();
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bindGroup);
      pass.dispatchWorkgroups(Math.ceil(w / 8), Math.ceil(h / 8));
      pass.end();
      enc.copyBufferToBuffer(outBuf, 0, readBuf, 0, n * 4);
      device.queue.submit([enc.finish()]);

      await readBuf.mapAsync(GPUMap.READ);
      const mapped = new Uint32Array(readBuf.getMappedRange());
      const out = new Uint8ClampedArray(n);
      for (let i = 0; i < n; i++) out[i] = Math.min(255, mapped[i]);
      readBuf.unmap();
      inBuf.destroy();
      outBuf.destroy();
      readBuf.destroy();
      uniBuf.destroy();
      return out;
    } catch {
      // Fallback below
    }
  }

  // CPU typed-array contour edge detector fallback
  const out = new Uint8ClampedArray(n);
  const alphaAt = (x: number, y: number) => {
    const cx = Math.max(0, Math.min(w - 1, x));
    const cy = Math.max(0, Math.min(h - 1, y));
    return rgba[(cy * w + cx) * 4 + 3] / 255;
  };
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const aC = alphaAt(x, y);
      const edge =
        Math.abs(alphaAt(x + 1, y) - alphaAt(x - 1, y)) +
        Math.abs(alphaAt(x, y + 1) - alphaAt(x, y - 1)) +
        0.65 * (Math.abs(alphaAt(x + 2, y) - alphaAt(x - 2, y)) + Math.abs(alphaAt(x, y + 2) - alphaAt(x, y - 2)));
      if (aC > 0.15 && edge > 0.14) {
        out[y * w + x] = Math.min(255, Math.round(edge * 255));
      }
    }
  }
  return out;
}

function decontaminateAndTrimCutoutEdges(cutoutCanvas: HTMLCanvasElement, erodePx = 0) {
  const W = cutoutCanvas.width;
  const H = cutoutCanvas.height;
  const ctxCut = cutoutCanvas.getContext('2d', { willReadFrequently: true });
  const imgData = ctxCut?.getImageData(0, 0, W, H);
  if (!imgData || !ctxCut) return null;

  const cd = imgData.data;
  const copy = new Uint8ClampedArray(cd);

  for (let y = 1; y < H - 1; y++) {
    for (let x = 1; x < W - 1; x++) {
      const i = (y * W + x) * 4;
      const a = copy[i + 3];

      if (erodePx > 0 && a > 25) {
        let minNeighbor = a;
        for (let dy = -erodePx; dy <= erodePx; dy++) {
          const ny = Math.max(0, Math.min(H - 1, y + dy));
          for (let dx = -erodePx; dx <= erodePx; dx++) {
            const nx = Math.max(0, Math.min(W - 1, x + dx));
            const na = copy[(ny * W + nx) * 4 + 3];
            if (na < minNeighbor) minNeighbor = na;
          }
        }
        if (minNeighbor < 40) {
          cd[i + 3] = Math.round(a * 0.25);
        }
      }

      const curA = cd[i + 3];
      if (curA > 14 && curA < 232) {
        let sr = 0, sg = 0, sb = 0, sw = 0;
        for (let dy = -2; dy <= 2; dy++) {
          const ny = Math.max(0, Math.min(H - 1, y + dy));
          for (let dx = -2; dx <= 2; dx++) {
            const nx = Math.max(0, Math.min(W - 1, x + dx));
            const ni = (ny * W + nx) * 4;
            if (copy[ni + 3] > 228) {
              sr += copy[ni];
              sg += copy[ni + 1];
              sb += copy[ni + 2];
              sw += 1;
            }
          }
        }
        if (sw > 0) {
          cd[i] = Math.round(copy[i] * 0.2 + (sr / sw) * 0.8);
          cd[i + 1] = Math.round(copy[i + 1] * 0.2 + (sg / sw) * 0.8);
          cd[i + 2] = Math.round(copy[i + 2] * 0.2 + (sb / sw) * 0.8);
        }
      }
    }
  }
  ctxCut.putImageData(imgData, 0, 0);
  return imgData;
}

export function verifyCutoutQuality(canvas: HTMLCanvasElement): { ok: boolean; score: number; reason: string } {
  const s = document.createElement('canvas');
  const k = Math.min(1, 96 / Math.max(canvas.width, canvas.height, 1));
  s.width = Math.max(12, Math.round(canvas.width * k));
  s.height = Math.max(12, Math.round(canvas.height * k));
  const ctx = s.getContext('2d', { willReadFrequently: true });
  if (!ctx) return { ok: true, score: 0.75, reason: 'default pass' };

  ctx.drawImage(canvas, 0, 0, s.width, s.height);
  const d = ctx.getImageData(0, 0, s.width, s.height).data;
  const total = s.width * s.height;
  let opaque = 0;
  let semi = 0;
  let borderOpaque = 0;
  let borderTotal = 0;
  let centerOpaque = 0;
  let centerTotal = 0;

  for (let y = 0; y < s.height; y++) {
    for (let x = 0; x < s.width; x++) {
      const a = d[(y * s.width + x) * 4 + 3];
      if (a > 190) opaque++;
      else if (a > 18) semi++;

      if (x < 3 || x >= s.width - 3 || y < 3) {
        borderTotal++;
        if (a > 190) borderOpaque++;
      }
      if (x > s.width * 0.24 && x < s.width * 0.76 && y > s.height * 0.14 && y < s.height * 0.82) {
        centerTotal++;
        if (a > 160) centerOpaque++;
      }
    }
  }

  const fgRatio = opaque / total;
  const borderRatio = borderOpaque / Math.max(1, borderTotal);
  const centerRatio = centerOpaque / Math.max(1, centerTotal);
  const semiRatio = semi / total;

  if (fgRatio < 0.05) {
    return { ok: false, score: 0.15, reason: 'Cutout removed too much of the subject' };
  }
  if (fgRatio > 0.87 && borderRatio > 0.76) {
    return { ok: false, score: 0.2, reason: 'Background was not cleanly separated' };
  }
  if (centerRatio < 0.12) {
    return { ok: false, score: 0.22, reason: 'Main center subject lost during matting' };
  }

  const score = Math.max(
    0.1,
    Math.min(1, 1 - Math.max(0, borderRatio - 0.35) * 0.65 - semiRatio * 0.55)
  );
  return {
    ok: score >= 0.52,
    score: Number(score.toFixed(2)),
    reason: score >= 0.52 ? 'Clean foreground isolation' : 'Edges need tighter background removal',
  };
}

async function buildOutlinePreviewDataUrl(
  baseCanvas: HTMLCanvasElement,
  cutoutCanvas: HTMLCanvasElement,
  edgeMask: Uint8ClampedArray
): Promise<string> {
  const W = cutoutCanvas.width;
  const H = cutoutCanvas.height;
  const previewCanvas = document.createElement('canvas');
  previewCanvas.width = W;
  previewCanvas.height = H;
  const pCtx = previewCanvas.getContext('2d');
  if (pCtx) {
    pCtx.drawImage(baseCanvas, 0, 0, W, H);
    pCtx.fillStyle = 'rgba(8, 12, 24, 0.42)';
    pCtx.fillRect(0, 0, W, H);
    pCtx.drawImage(cutoutCanvas, 0, 0, W, H);

    const pData = pCtx.getImageData(0, 0, W, H);
    const pd = pData.data;
    for (let i = 0; i < edgeMask.length; i++) {
      const e = edgeMask[i];
      if (e > 20) {
        const px = i * 4;
        const mix = Math.min(1, e / 140);
        pd[px] = Math.round(pd[px] * (1 - mix));
        pd[px + 1] = Math.round(pd[px + 1] * (1 - mix) + 216 * mix);
        pd[px + 2] = Math.round(pd[px + 2] * (1 - mix) + 255 * mix);
        pd[px + 3] = 255;
      }
    }
    pCtx.putImageData(pData, 0, 0);
  }
  return previewCanvas.toDataURL('image/jpeg', 0.84);
}

/**
 * Enhanced Background Remover (single best contour pass)
 */
export async function enhancedBackgroundRemove(sourceDataUrl: string): Promise<ContourCutoutResult> {
  const verified = await cutoutVerifyAndRefine(sourceDataUrl, 1);
  return {
    method: verified.method,
    outlineScreenshotDataUrl: verified.outlineScreenshotDataUrl,
    cutoutDataUrl: verified.cutoutDataUrl,
    width: verified.width,
    height: verified.height,
    palette: verified.palette,
  };
}

/**
 * 3-Pass WebGPU Cutout Verifier & Refiner:
 * Runs progressive matte isolation & halo choke up to maxPasses (default 3)
 * and verifies foreground cleanliness before returning.
 */
export async function cutoutVerifyAndRefine(
  sourceDataUrl: string,
  maxPasses = 3
): Promise<VerifiedCutoutResult> {
  const srcImg = await loadImageEl(sourceDataUrl);
  const baseCanvas = imageToCanvas(srcImg, 1200);
  const palette = extractDominantColorsFromCanvas(baseCanvas);

  const passConfigs: Array<{ mode: 'ai' | 'simple'; tolerance: number; feather: number; erode: number }> = [
    { mode: 'ai', tolerance: 46, feather: 2, erode: 0 },
    { mode: 'simple', tolerance: 38, feather: 2, erode: 1 },
    { mode: 'simple', tolerance: 62, feather: 2, erode: 1 },
  ];

  let bestResult: {
    canvas: HTMLCanvasElement;
    method: ContourCutoutResult['method'];
    edgeMask: Uint8ClampedArray;
    score: number;
    ok: boolean;
    reason: string;
    passesUsed: number;
  } | null = null;

  const limit = Math.max(1, Math.min(3, maxPasses));
  for (let passIdx = 0; passIdx < limit; passIdx++) {
    const cfg = passConfigs[passIdx];
    let cutoutCanvas: HTMLCanvasElement;
    let usedMethod: ContourCutoutResult['method'] = 'simple';

    try {
      if (cfg.mode === 'ai') {
        const cut = await removeBackground(sourceDataUrl, { edge_feather: cfg.feather, tolerance: cfg.tolerance });
        const cutImg = await loadImageEl(cut.dataURL);
        cutoutCanvas = imageToCanvas(cutImg, 1200);
        usedMethod = cut.method === 'ai' ? 'webgpu-ai' : 'webgpu-contour';
      } else {
        cutoutCanvas = await removeBackgroundSimple(sourceDataUrl, { tolerance: cfg.tolerance, feather: cfg.feather });
        usedMethod = 'webgpu-contour';
      }
    } catch {
      cutoutCanvas = await removeBackgroundSimple(sourceDataUrl, { tolerance: cfg.tolerance, feather: cfg.feather });
      usedMethod = 'simple';
    }

    const imgData = decontaminateAndTrimCutoutEdges(cutoutCanvas, cfg.erode);
    const edgeMask = imgData
      ? await computeAlphaContourMask(imgData.data, cutoutCanvas.width, cutoutCanvas.height)
      : new Uint8ClampedArray(cutoutCanvas.width * cutoutCanvas.height);

    const check = verifyCutoutQuality(cutoutCanvas);
    if (!bestResult || check.score > bestResult.score) {
      bestResult = {
        canvas: cutoutCanvas,
        method: usedMethod,
        edgeMask,
        score: check.score,
        ok: check.ok,
        reason: check.reason,
        passesUsed: passIdx + 1,
      };
    }
    if (check.ok) {
      break;
    }
  }

  const chosen = bestResult!;
  const outlineScreenshotDataUrl = await buildOutlinePreviewDataUrl(baseCanvas, chosen.canvas, chosen.edgeMask);

  return {
    ok: chosen.ok,
    qualityScore: chosen.score,
    passesUsed: chosen.passesUsed,
    reason: chosen.reason,
    method: chosen.method,
    outlineScreenshotDataUrl,
    cutoutDataUrl: chosen.canvas.toDataURL('image/png'),
    width: chosen.canvas.width,
    height: chosen.canvas.height,
    palette,
  };
}

/**
 * Cleanly infills rectangular regions (e.g. detected text regions on an uploaded flat graphic)
 * by interpolating surrounding border pixels so users can drag/edit scanned Canva text layers cleanly.
 */
export function createInpaintedBackdrop(
  srcCanvas: HTMLCanvasElement,
  boxes: Array<{ xPct: number; yPct: number; wPct: number; hPct: number; bgSample?: string }>
): HTMLCanvasElement {
  const out = document.createElement('canvas');
  out.width = srcCanvas.width;
  out.height = srcCanvas.height;
  const ctx = out.getContext('2d', { willReadFrequently: true });
  if (!ctx) return out;
  ctx.drawImage(srcCanvas, 0, 0);

  const W = out.width;
  const H = out.height;
  for (const b of boxes) {
    const padX = Math.max(4, Math.round(W * 0.01));
    const padY = Math.max(4, Math.round(H * 0.01));
    const x0 = Math.max(0, Math.floor((b.xPct / 100) * W) - padX);
    const y0 = Math.max(0, Math.floor((b.yPct / 100) * H) - padY);
    const bw = Math.min(W - x0, Math.ceil((b.wPct / 100) * W) + padX * 2);
    const bh = Math.min(H - y0, Math.ceil((b.hPct / 100) * H) + padY * 2);
    if (bw < 6 || bh < 6) continue;

    // Sample vertical strips immediately above & below box to blend cleanly across gradients/photos
    const topY = Math.max(0, y0 - 3);
    const botY = Math.min(H - 1, y0 + bh + 2);
    const imgData = ctx.getImageData(x0, y0, bw, bh);
    const topStrip = ctx.getImageData(x0, topY, bw, 1).data;
    const botStrip = ctx.getImageData(x0, botY, bw, 1).data;
    const d = imgData.data;

    for (let py = 0; py < bh; py++) {
      const ty = py / Math.max(1, bh - 1);
      for (let px = 0; px < bw; px++) {
        const si = px * 4;
        const di = (py * bw + px) * 4;
        const r = Math.round(topStrip[si] * (1 - ty) + botStrip[si] * ty);
        const g = Math.round(topStrip[si + 1] * (1 - ty) + botStrip[si + 1] * ty);
        const bl = Math.round(topStrip[si + 2] * (1 - ty) + botStrip[si + 2] * ty);
        d[di] = r;
        d[di + 1] = g;
        d[di + 2] = bl;
        d[di + 3] = 255;
      }
    }
    ctx.putImageData(imgData, x0, y0);
  }
  return out;
}

/**
 * Locates face bounding box using browser FaceDetector API when present,
 * falling back to robust HSV/YCbCr skin-cluster & portrait aspect landmark localization.
 */
export async function detectPrimaryFaceBox(canvas: HTMLCanvasElement): Promise<FaceBox> {
  const W = canvas.width;
  const H = canvas.height;

  // 1. Native Chrome/Edge Shape Detection API (fastest & landmark-accurate when available)
  try {
    const FD = (window as any).FaceDetector;
    if (typeof FD === 'function') {
      const detector = new FD({ fastMode: true, maxDetectedFaces: 3 });
      const faces = await detector.detect(canvas);
      if (Array.isArray(faces) && faces.length > 0) {
        faces.sort((a: any, b: any) => (b.boundingBox?.width || 0) * (b.boundingBox?.height || 0) - (a.boundingBox?.width || 0) * (a.boundingBox?.height || 0));
        const bb = faces[0].boundingBox;
        if (bb && bb.width > 12 && bb.height > 12) {
          return {
            x: bb.x,
            y: bb.y,
            w: bb.width,
            h: bb.height,
            confidence: 0.94,
            method: 'FaceDetector',
          };
        }
      }
    }
  } catch {
    // Fallback below
  }

  // 2. YCbCr Skin-cluster + Upper-Body Centroid Estimator
  const sw = 120;
  const sh = Math.max(40, Math.round((120 * H) / Math.max(1, W)));
  const s = document.createElement('canvas');
  s.width = sw;
  s.height = sh;
  const ctx = s.getContext('2d', { willReadFrequently: true });
  if (ctx) {
    ctx.drawImage(canvas, 0, 0, sw, sh);
    const d = ctx.getImageData(0, 0, sw, sh).data;
    let sumX = 0, sumY = 0, weightSum = 0;
    const skinPts: Array<[number, number, number]> = [];

    // Bias search toward upper 68% where faces typically appear
    for (let y = Math.floor(sh * 0.04); y < Math.floor(sh * 0.68); y++) {
      for (let x = Math.floor(sw * 0.08); x < Math.floor(sw * 0.92); x++) {
        const idx = (y * sw + x) * 4;
        if (d[idx + 3] < 80) continue;
        if (isSkinYCbCr(d[idx], d[idx + 1], d[idx + 2])) {
          const centerWeight = 1.4 - Math.abs(x / sw - 0.5) * 0.7 - (y / sh) * 0.45;
          const wgt = Math.max(0.25, centerWeight);
          skinPts.push([x, y, wgt]);
          sumX += x * wgt;
          sumY += y * wgt;
          weightSum += wgt;
        }
      }
    }

    if (skinPts.length > 24 && weightSum > 0) {
      const cx = sumX / weightSum;
      const cy = sumY / weightSum;
      // Compute tight cluster around centroid
      const localPts = skinPts.filter(([px, py]) => Math.hypot(px - cx, py - cy) < Math.max(sw, sh) * 0.28);
      if (localPts.length > 16) {
        let minX = sw, maxX = 0, minY = sh, maxY = 0;
        for (const [px, py] of localPts) {
          if (px < minX) minX = px;
          if (px > maxX) maxX = px;
          if (py < minY) minY = py;
          if (py > maxY) maxY = py;
        }
        const scaleX = W / sw;
        const scaleY = H / sh;
        let fw = Math.max(W * 0.14, (maxX - minX) * scaleX * 1.05);
        let fh = Math.max(fw * 1.18, (maxY - minY) * scaleY * 1.08);
        fw = Math.min(fw, W * 0.56);
        fh = Math.min(fh, H * 0.62);
        const fx = Math.max(0, Math.min(W - fw, cx * scaleX - fw / 2));
        const fy = Math.max(0, Math.min(H - fh, cy * scaleY - fh * 0.48));
        return { x: fx, y: fy, w: fw, h: fh, confidence: 0.76, method: 'SkinGeometry' };
      }
    }
  }

  // 3. Portrait upper-center fallback box
  const fw = W * 0.28;
  const fh = fw * 1.24;
  return {
    x: (W - fw) * 0.5,
    y: H * 0.16,
    w: fw,
    h: fh,
    confidence: 0.5,
    method: 'PortraitFallback',
  };
}

/**
 * Computes mean R/G/B and std-dev inside an oval face region for realistic color/lighting transfer.
 */
function sampleFaceColorStats(canvas: HTMLCanvasElement, box: FaceBox) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx) return { mean: [190, 150, 130], std: [28, 24, 22] };
  const x0 = Math.max(0, Math.floor(box.x));
  const y0 = Math.max(0, Math.floor(box.y));
  const bw = Math.max(4, Math.min(canvas.width - x0, Math.floor(box.w)));
  const bh = Math.max(4, Math.min(canvas.height - y0, Math.floor(box.h)));
  const data = ctx.getImageData(x0, y0, bw, bh).data;

  let sr = 0, sg = 0, sb = 0, n = 0;
  for (let y = 0; y < bh; y++) {
    for (let x = 0; x < bw; x++) {
      const nx = (x - bw / 2) / (bw * 0.36);
      const ny = (y - bh / 2) / (bh * 0.38);
      if (nx * nx + ny * ny > 1) continue;
      const idx = (y * bw + x) * 4;
      sr += data[idx];
      sg += data[idx + 1];
      sb += data[idx + 2];
      n++;
    }
  }
  if (!n) return { mean: [190, 150, 130], std: [28, 24, 22] };
  const mean = [sr / n, sg / n, sb / n];
  let vr = 0, vg = 0, vb = 0;
  for (let y = 0; y < bh; y++) {
    for (let x = 0; x < bw; x++) {
      const nx = (x - bw / 2) / (bw * 0.36);
      const ny = (y - bh / 2) / (bh * 0.38);
      if (nx * nx + ny * ny > 1) continue;
      const idx = (y * bw + x) * 4;
      vr += (data[idx] - mean[0]) ** 2;
      vg += (data[idx + 1] - mean[1]) ** 2;
      vb += (data[idx + 2] - mean[2]) ** 2;
    }
  }
  return {
    mean,
    std: [Math.max(10, Math.sqrt(vr / n)), Math.max(10, Math.sqrt(vg / n)), Math.max(10, Math.sqrt(vb / n))],
  };
}

/**
 * Policy-Safe WebGPU Face Swapper:
 * 1. Safety-checks prompt + both images against NSFW/sexual policy
 * 2. Detects & annotates facial alignment regions (with screenshot preview)
 * 3. Runs WebGPU WGSL color/lighting transfer & oval seamless feather blend (with CPU fallback)
 */
export async function performWebGpuFaceSwap({
  targetImageDataUrl,
  sourceFaceDataUrl,
  promptText = '',
}: {
  targetImageDataUrl: string;
  sourceFaceDataUrl: string;
  promptText?: string;
}): Promise<FaceSwapResult> {
  const [targetImg, faceImg] = await Promise.all([
    loadImageEl(targetImageDataUrl),
    loadImageEl(sourceFaceDataUrl),
  ]);

  const targetCanvas = imageToCanvas(targetImg, 1280);
  const faceCanvas = imageToCanvas(faceImg, 960);

  // 1. POLICY & SAFETY GUARD FIRST
  const safePrompt = analyzeSafetyAndContent(targetCanvas, promptText);
  if (!safePrompt.safe) {
    return {
      ok: false,
      refused: true,
      reason: safePrompt.reason,
      usedWebGpu: false,
      resultDataUrl: '',
      width: targetCanvas.width,
      height: targetCanvas.height,
    };
  }
  const safeFace = analyzeSafetyAndContent(faceCanvas, '');
  if (!safeFace.safe) {
    return {
      ok: false,
      refused: true,
      reason: safeFace.reason,
      usedWebGpu: false,
      resultDataUrl: '',
      width: targetCanvas.width,
      height: targetCanvas.height,
    };
  }

  // 2. DETECT FACES IN BOTH IMAGES
  const [targetBox, sourceBox] = await Promise.all([
    detectPrimaryFaceBox(targetCanvas),
    detectPrimaryFaceBox(faceCanvas),
  ]);

  // Alignment visual inspection screenshot for Thinking summary
  const alignCanvas = document.createElement('canvas');
  alignCanvas.width = targetCanvas.width;
  alignCanvas.height = targetCanvas.height;
  const aCtx = alignCanvas.getContext('2d');
  if (aCtx) {
    aCtx.drawImage(targetCanvas, 0, 0);
    aCtx.strokeStyle = '#00e5ff';
    aCtx.lineWidth = Math.max(3, Math.round(targetCanvas.width * 0.005));
    aCtx.setLineDash([10, 6]);
    aCtx.strokeRect(targetBox.x, targetBox.y, targetBox.w, targetBox.h);
    aCtx.setLineDash([]);
    aCtx.fillStyle = 'rgba(0, 229, 255, 0.9)';
    aCtx.font = `bold ${Math.max(14, Math.round(targetCanvas.width * 0.018))}px sans-serif`;
    aCtx.fillText(`WebGPU Face Target (${targetBox.method})`, Math.max(8, targetBox.x), Math.max(20, targetBox.y - 8));
  }
  const alignmentScreenshotDataUrl = alignCanvas.toDataURL('image/jpeg', 0.82);

  // 3. RESIZE SOURCE FACE TO TARGET BOX & COMPUTE COLOR STATS
  const bw = Math.max(32, Math.round(targetBox.w));
  const bh = Math.max(36, Math.round(targetBox.h));
  const bx = Math.max(0, Math.min(targetCanvas.width - bw, Math.round(targetBox.x)));
  const by = Math.max(0, Math.min(targetCanvas.height - bh, Math.round(targetBox.y)));

  const patchFace = document.createElement('canvas');
  patchFace.width = bw;
  patchFace.height = bh;
  const pfCtx = patchFace.getContext('2d', { willReadFrequently: true });
  if (!pfCtx) throw new Error('Canvas 2D unavailable for face swap');

  // Slight padding on source box so jawline/forehead blend seamlessly
  const sx = Math.max(0, sourceBox.x - sourceBox.w * 0.04);
  const sy = Math.max(0, sourceBox.y - sourceBox.h * 0.05);
  const sw = Math.min(faceCanvas.width - sx, sourceBox.w * 1.08);
  const sh = Math.min(faceCanvas.height - sy, sourceBox.h * 1.1);
  pfCtx.drawImage(faceCanvas, sx, sy, sw, sh, 0, 0, bw, bh);

  const tCtx = targetCanvas.getContext('2d', { willReadFrequently: true })!;
  const targetStats = sampleFaceColorStats(targetCanvas, { ...targetBox, x: bx, y: by, w: bw, h: bh });
  const sourceStats = sampleFaceColorStats(patchFace, { x: 0, y: 0, w: bw, h: bh, confidence: 1, method: sourceBox.method });

  const dstPatchData = tCtx.getImageData(bx, by, bw, bh);
  const srcPatchData = pfCtx.getImageData(0, 0, bw, bh);

  const dstArr = dstPatchData.data;
  const srcArr = srcPatchData.data;
  const blended = new Uint8ClampedArray(dstArr.length);

  // Try real WebGPU WGSL Compute Shader for illumination-matched face blending
  let usedWebGpu = false;
  const device = await getWebGpuDevice();
  if (device && typeof (globalThis as any).GPUBufferUsage !== 'undefined') {
    try {
      const GPUBU = (globalThis as any).GPUBufferUsage;
      const GPUMap = (globalThis as any).GPUMapMode;
      const byteLen = dstArr.byteLength;
      const srcBuf = device.createBuffer({ size: byteLen, usage: GPUBU.STORAGE | GPUBU.COPY_DST });
      const dstBuf = device.createBuffer({ size: byteLen, usage: GPUBU.STORAGE | GPUBU.COPY_DST });
      const outBuf = device.createBuffer({ size: byteLen, usage: GPUBU.STORAGE | GPUBU.COPY_SRC });
      const readBuf = device.createBuffer({ size: byteLen, usage: GPUBU.MAP_READ | GPUBU.COPY_DST });
      const paramsBuf = device.createBuffer({ size: 48, usage: GPUBU.UNIFORM | GPUBU.COPY_DST });

      device.queue.writeBuffer(srcBuf, 0, srcArr);
      device.queue.writeBuffer(dstBuf, 0, dstArr);
      // Float32 parameters: bw, bh, tm0, tm1, tm2, sm0, sm1, sm2, sc0, sc1, sc2, pad
      const scaleR = Math.max(0.65, Math.min(1.45, targetStats.std[0] / sourceStats.std[0]));
      const scaleG = Math.max(0.65, Math.min(1.45, targetStats.std[1] / sourceStats.std[1]));
      const scaleB = Math.max(0.65, Math.min(1.45, targetStats.std[2] / sourceStats.std[2]));
      device.queue.writeBuffer(
        paramsBuf,
        0,
        new Float32Array([
          bw, bh,
          targetStats.mean[0], targetStats.mean[1], targetStats.mean[2],
          sourceStats.mean[0], sourceStats.mean[1], sourceStats.mean[2],
          scaleR, scaleG, scaleB, 0,
        ])
      );

      const module = device.createShaderModule({
        code: `
          struct Params {
            w: f32, h: f32,
            tmR: f32, tmG: f32, tmB: f32,
            smR: f32, smG: f32, smB: f32,
            scR: f32, scG: f32, scB: f32, pad: f32,
          };
          @group(0) @binding(0) var<storage, read> srcPx: array<u32>;
          @group(0) @binding(1) var<storage, read> dstPx: array<u32>;
          @group(0) @binding(2) var<storage, read_write> outPx: array<u32>;
          @group(0) @binding(3) var<uniform> p: Params;

          @compute @workgroup_size(8, 8)
          fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
            let x = f32(gid.x);
            let y = f32(gid.y);
            if (x >= p.w || y >= p.h) { return; }
            let idx = gid.y * u32(p.w) + gid.x;
            let s = srcPx[idx];
            let d = dstPx[idx];

            let sr = f32(s & 255u);
            let sg = f32((s >> 8u) & 255u);
            let sb = f32((s >> 16u) & 255u);

            let dr = f32(d & 255u);
            let dg = f32((d >> 8u) & 255u);
            let db = f32((d >> 16u) & 255u);
            let da = (d >> 24u) & 255u;

            // Illumination & color harmony transfer onto source face
            let adjR = clamp((sr - p.smR) * p.scR + p.tmR, 0.0, 255.0);
            let adjG = clamp((sg - p.smG) * p.scG + p.tmG, 0.0, 255.0);
            let adjB = clamp((sb - p.smB) * p.scB + p.tmB, 0.0, 255.0);
            let tr = mix(sr, adjR, 0.78);
            let tg = mix(sg, adjG, 0.78);
            let tb = mix(sb, adjB, 0.78);

            // Soft anatomical contour feather mask (wider upper brow/cheek, tapered chin)
            let taper = mix(1.02, 0.88, clamp(y / max(1.0, p.h), 0.0, 1.0));
            let nx = (x - p.w * 0.5) / (p.w * 0.40 * taper);
            let ny = (y - p.h * 0.48) / (p.h * 0.45);
            let r = sqrt(nx * nx + ny * ny);
            let mask = clamp(1.0 - smoothstep(0.50, 0.98, r), 0.0, 1.0);
            mask = mask * mask * (3.0 - 2.0 * mask);

            let rr = u32(clamp(mix(dr, tr, mask), 0.0, 255.0));
            let rg = u32(clamp(mix(dg, tg, mask), 0.0, 255.0));
            let rb = u32(clamp(mix(db, tb, mask), 0.0, 255.0));
            outPx[idx] = rr | (rg << 8u) | (rb << 16u) | (da << 24u);
          }
        `,
      });

      const pipeline = device.createComputePipeline({
        layout: 'auto',
        compute: { module, entryPoint: 'main' },
      });
      const bg = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: srcBuf } },
          { binding: 1, resource: { buffer: dstBuf } },
          { binding: 2, resource: { buffer: outBuf } },
          { binding: 3, resource: { buffer: paramsBuf } },
        ],
      });

      const enc = device.createCommandEncoder();
      const pass = enc.beginComputePass();
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bg);
      pass.dispatchWorkgroups(Math.ceil(bw / 8), Math.ceil(bh / 8));
      pass.end();
      enc.copyBufferToBuffer(outBuf, 0, readBuf, 0, byteLen);
      device.queue.submit([enc.finish()]);

      await readBuf.mapAsync(GPUMap.READ);
      const outView = new Uint8ClampedArray(readBuf.getMappedRange());
      blended.set(outView);
      readBuf.unmap();
      srcBuf.destroy();
      dstBuf.destroy();
      outBuf.destroy();
      readBuf.destroy();
      paramsBuf.destroy();
      usedWebGpu = true;
    } catch {
      usedWebGpu = false;
    }
  }

  if (!usedWebGpu) {
    const scaleR = Math.max(0.65, Math.min(1.45, targetStats.std[0] / sourceStats.std[0]));
    const scaleG = Math.max(0.65, Math.min(1.45, targetStats.std[1] / sourceStats.std[1]));
    const scaleB = Math.max(0.65, Math.min(1.45, targetStats.std[2] / sourceStats.std[2]));
    const smoothstep = (e0: number, e1: number, x: number) => {
      const t = Math.max(0, Math.min(1, (x - e0) / (e1 - e0)));
      return t * t * (3 - 2 * t);
    };
    const clamp255 = (v: number) => Math.max(0, Math.min(255, v));
    for (let y = 0; y < bh; y++) {
      const taper = 1.02 + (0.88 - 1.02) * Math.max(0, Math.min(1, y / Math.max(1, bh)));
      for (let x = 0; x < bw; x++) {
        const i = (y * bw + x) * 4;
        const sr = srcArr[i], sg = srcArr[i + 1], sb = srcArr[i + 2];
        const dr = dstArr[i], dg = dstArr[i + 1], db = dstArr[i + 2];

        const adjR = clamp255((sr - sourceStats.mean[0]) * scaleR + targetStats.mean[0]);
        const adjG = clamp255((sg - sourceStats.mean[1]) * scaleG + targetStats.mean[1]);
        const adjB = clamp255((sb - sourceStats.mean[2]) * scaleB + targetStats.mean[2]);
        const tr = sr * 0.22 + adjR * 0.78;
        const tg = sg * 0.22 + adjG * 0.78;
        const tb = sb * 0.22 + adjB * 0.78;

        const nx = (x - bw * 0.5) / (bw * 0.4 * taper);
        const ny = (y - bh * 0.48) / (bh * 0.45);
        const dist = Math.hypot(nx, ny);
        const rawMask = Math.max(0, Math.min(1, 1 - smoothstep(0.5, 0.98, dist)));
        const mask = rawMask * rawMask * (3 - 2 * rawMask);

        blended[i] = Math.round(dr * (1 - mask) + tr * mask);
        blended[i + 1] = Math.round(dg * (1 - mask) + tg * mask);
        blended[i + 2] = Math.round(db * (1 - mask) + tb * mask);
        blended[i + 3] = dstArr[i + 3];
      }
    }
  }

  const outPatch = new ImageData(blended, bw, bh);
  tCtx.putImageData(outPatch, bx, by);

  const resultDataUrl = targetCanvas.toDataURL('image/png');
  return {
    ok: true,
    usedWebGpu,
    resultDataUrl,
    alignmentScreenshotDataUrl,
    finalScreenshotDataUrl: targetCanvas.toDataURL('image/jpeg', 0.86),
    width: targetCanvas.width,
    height: targetCanvas.height,
    targetFaceBox: targetBox,
    sourceFaceBox: sourceBox,
  };
}

/**
 * Studio WebGPU WGSL Compute Shader for Cinema Color Grading & Depth Tone Mapping.
 * Preserves alpha channel cleanly so cutouts and transparent layers stay crisp.
 */
export async function applyWebGpuColorGrade(
  canvas: HTMLCanvasElement,
  preset: ColorGradePreset = 'portrait-natural'
): Promise<ColorGradeResult> {
  const W = canvas.width;
  const H = canvas.height;
  const outCanvas = document.createElement('canvas');
  outCanvas.width = W;
  outCanvas.height = H;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  const oCtx = outCanvas.getContext('2d', { willReadFrequently: true });
  if (!ctx || !oCtx || W < 2 || H < 2) {
    return { canvas, preset, usedWebGpu: false };
  }

  const imgData = ctx.getImageData(0, 0, W, H);
  const src = imgData.data;
  const dst = new Uint8ClampedArray(src.length);

  // Preset tuning vectors: [contrast, vibrance, shadowTintR, shadowTintG, shadowTintB, hiTintR, hiTintG, hiTintB, vignette]
  const PRESET_MAP: Record<ColorGradePreset, number[]> = {
    'cinematic-teal-orange': [1.14, 1.12, -10, 12, 20, 18, 8, -10, 0.24],
    'golden-editorial': [1.08, 1.06, 8, 5, -4, 16, 11, -6, 0.16],
    'neon-pop': [1.18, 1.24, -8, 10, 22, 12, -4, 18, 0.2],
    'luxury-noir': [1.16, 0.94, 4, 2, -2, 14, 10, -4, 0.28],
    'portrait-natural': [1.07, 1.08, 2, 2, 4, 10, 6, 0, 0.12],
  };
  const cfg = PRESET_MAP[preset] || PRESET_MAP['portrait-natural'];

  let usedWebGpu = false;
  const device = await getWebGpuDevice();
  if (device && typeof (globalThis as any).GPUBufferUsage !== 'undefined') {
    try {
      const GPUBU = (globalThis as any).GPUBufferUsage;
      const GPUMap = (globalThis as any).GPUMapMode;
      const byteLen = src.byteLength;
      const inBuf = device.createBuffer({ size: byteLen, usage: GPUBU.STORAGE | GPUBU.COPY_DST });
      const outBuf = device.createBuffer({ size: byteLen, usage: GPUBU.STORAGE | GPUBU.COPY_SRC });
      const readBuf = device.createBuffer({ size: byteLen, usage: GPUBU.MAP_READ | GPUBU.COPY_DST });
      const paramBuf = device.createBuffer({ size: 48, usage: GPUBU.UNIFORM | GPUBU.COPY_DST });

      device.queue.writeBuffer(inBuf, 0, src);
      device.queue.writeBuffer(
        paramBuf,
        0,
        new Float32Array([W, H, cfg[0], cfg[1], cfg[2], cfg[3], cfg[4], cfg[5], cfg[6], cfg[7], cfg[8], 0])
      );

      const module = device.createShaderModule({
        code: `
          struct Params {
            w: f32, h: f32, contrast: f32, vibrance: f32,
            sr: f32, sg: f32, sb: f32,
            hr: f32, hg: f32, hb: f32,
            vig: f32, pad: f32,
          };
          @group(0) @binding(0) var<storage, read> srcPx: array<u32>;
          @group(0) @binding(1) var<storage, read_write> outPx: array<u32>;
          @group(0) @binding(2) var<uniform> p: Params;

          @compute @workgroup_size(8, 8)
          fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
            let x = f32(gid.x);
            let y = f32(gid.y);
            if (x >= p.w || y >= p.h) { return; }
            let idx = gid.y * u32(p.w) + gid.x;
            let px = srcPx[idx];
            let a = (px >> 24u) & 255u;
            if (a < 4u) {
              outPx[idx] = px;
              return;
            }
            var r = f32(px & 255u);
            var g = f32((px >> 8u) & 255u);
            var b = f32((px >> 16u) & 255u);

            // S-curve contrast around midpoint
            r = clamp((r - 128.0) * p.contrast + 128.0, 0.0, 255.0);
            g = clamp((g - 128.0) * p.contrast + 128.0, 0.0, 255.0);
            b = clamp((b - 128.0) * p.contrast + 128.0, 0.0, 255.0);

            // Vibrance boost
            let lum = 0.299 * r + 0.587 * g + 0.114 * b;
            r = clamp(lum + (r - lum) * p.vibrance, 0.0, 255.0);
            g = clamp(lum + (g - lum) * p.vibrance, 0.0, 255.0);
            b = clamp(lum + (b - lum) * p.vibrance, 0.0, 255.0);

            // Shadow / Highlight split toning
            let t = clamp(lum / 255.0, 0.0, 1.0);
            let sh = (1.0 - t) * (1.0 - t);
            let hi = t * t;
            r = clamp(r + p.sr * sh + p.hr * hi, 0.0, 255.0);
            g = clamp(g + p.sg * sh + p.hg * hi, 0.0, 255.0);
            b = clamp(b + p.sb * sh + p.hb * hi, 0.0, 255.0);

            // Soft optical edge vignette (only on opaque background plates)
            if (a > 240u) {
              let dx = (x / p.w) - 0.5;
              let dy = (y / p.h) - 0.5;
              let dist = sqrt(dx * dx + dy * dy);
              let v = 1.0 - smoothstep(0.42, 0.85, dist) * p.vig;
              r *= v;
              g *= v;
              b *= v;
            }

            let rr = u32(clamp(r, 0.0, 255.0));
            let rg = u32(clamp(g, 0.0, 255.0));
            let rb = u32(clamp(b, 0.0, 255.0));
            outPx[idx] = rr | (rg << 8u) | (rb << 16u) | (a << 24u);
          }
        `,
      });

      const pipeline = device.createComputePipeline({
        layout: 'auto',
        compute: { module, entryPoint: 'main' },
      });
      const bg = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: inBuf } },
          { binding: 1, resource: { buffer: outBuf } },
          { binding: 2, resource: { buffer: paramBuf } },
        ],
      });

      const enc = device.createCommandEncoder();
      const pass = enc.beginComputePass();
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bg);
      pass.dispatchWorkgroups(Math.ceil(W / 8), Math.ceil(H / 8));
      pass.end();
      enc.copyBufferToBuffer(outBuf, 0, readBuf, 0, byteLen);
      device.queue.submit([enc.finish()]);

      await readBuf.mapAsync(GPUMap.READ);
      dst.set(new Uint8ClampedArray(readBuf.getMappedRange()));
      readBuf.unmap();
      inBuf.destroy();
      outBuf.destroy();
      readBuf.destroy();
      paramBuf.destroy();
      usedWebGpu = true;
    } catch {
      usedWebGpu = false;
    }
  }

  if (!usedWebGpu) {
    const [contrast, vibrance, sr, sg, sb, hr, hg, hb, vig] = cfg;
    const clamp255 = (v: number) => (v < 0 ? 0 : v > 255 ? 255 : v);
    for (let y = 0; y < H; y++) {
      const dy = y / H - 0.5;
      for (let x = 0; x < W; x++) {
        const i = (y * W + x) * 4;
        const a = src[i + 3];
        if (a < 4) {
          dst[i] = src[i];
          dst[i + 1] = src[i + 1];
          dst[i + 2] = src[i + 2];
          dst[i + 3] = a;
          continue;
        }
        let r = clamp255((src[i] - 128) * contrast + 128);
        let g = clamp255((src[i + 1] - 128) * contrast + 128);
        let b = clamp255((src[i + 2] - 128) * contrast + 128);
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        r = clamp255(lum + (r - lum) * vibrance);
        g = clamp255(lum + (g - lum) * vibrance);
        b = clamp255(lum + (b - lum) * vibrance);
        const t = lum / 255;
        const sh = (1 - t) * (1 - t);
        const hi = t * t;
        r = clamp255(r + sr * sh + hr * hi);
        g = clamp255(g + sg * sh + hg * hi);
        b = clamp255(b + sb * sh + hb * hi);
        if (a > 240) {
          const dx = x / W - 0.5;
          const dist = Math.hypot(dx, dy);
          const s = Math.max(0, Math.min(1, (dist - 0.42) / 0.43));
          const v = 1 - s * s * (3 - 2 * s) * vig;
          r *= v;
          g *= v;
          b *= v;
        }
        dst[i] = Math.round(r);
        dst[i + 1] = Math.round(g);
        dst[i + 2] = Math.round(b);
        dst[i + 3] = a;
      }
    }
  }

  oCtx.putImageData(new ImageData(dst, W, H), 0, 0);
  return { canvas: outCanvas, preset, usedWebGpu };
}

export interface WebGpuCapabilityReport {
  available: boolean;
  runtimeMode: 'webgpu' | 'canvas-fallback';
  maxBufferSize: number;
  adapterLabel: string;
}

/**
 * Checks real browser WebGPU GPUAdapter & memory limits cleanly without pretending
 * WebGPU generates pixels directly (execution acceleration layer only).
 */
export async function probeWebGpuCapabilities(): Promise<WebGpuCapabilityReport> {
  try {
    const gpu = (navigator as any)?.gpu;
    if (!gpu || typeof gpu.requestAdapter !== 'function') {
      return { available: false, runtimeMode: 'canvas-fallback', maxBufferSize: 0, adapterLabel: 'CPU Canvas Fallback' };
    }
    const adapter = await gpu.requestAdapter({ powerPreference: 'high-performance' });
    if (!adapter) {
      return { available: false, runtimeMode: 'canvas-fallback', maxBufferSize: 0, adapterLabel: 'CPU Canvas Fallback' };
    }
    const maxBufferSize = Number(adapter.limits?.maxBufferSize || 0);
    const info = (adapter as any).info || {};
    const label = [info.vendor, info.architecture, info.device].filter(Boolean).join(' ') || 'WebGPU Hardware Adapter';
    const device = await getWebGpuDevice();
    if (!device) {
      return { available: false, runtimeMode: 'canvas-fallback', maxBufferSize, adapterLabel: 'CPU Canvas Fallback' };
    }
    return {
      available: true,
      runtimeMode: 'webgpu',
      maxBufferSize,
      adapterLabel: label,
    };
  } catch {
    return { available: false, runtimeMode: 'canvas-fallback', maxBufferSize: 0, adapterLabel: 'CPU Canvas Fallback' };
  }
}

/**
 * Subtle WGSL Unsharp-Mask sharpening pass (with CPU fallback) that crisps edges and
 * final layered compositions while strictly preserving alpha.
 */
export async function applyWebGpuSharpen(
  canvas: HTMLCanvasElement,
  strength = 0.2
): Promise<{ canvas: HTMLCanvasElement; usedWebGpu: boolean }> {
  const W = canvas.width;
  const H = canvas.height;
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  if (!ctx || W < 4 || H < 4 || strength <= 0) {
    return { canvas, usedWebGpu: false };
  }

  const outCanvas = document.createElement('canvas');
  outCanvas.width = W;
  outCanvas.height = H;
  const oCtx = outCanvas.getContext('2d', { willReadFrequently: true });
  if (!oCtx) return { canvas, usedWebGpu: false };

  const imgData = ctx.getImageData(0, 0, W, H);
  const src = imgData.data;
  const dst = new Uint8ClampedArray(src.length);

  let usedWebGpu = false;
  const device = await getWebGpuDevice();
  if (device && typeof (globalThis as any).GPUBufferUsage !== 'undefined' && src.byteLength <= 64 * 1024 * 1024) {
    try {
      const GPUBU = (globalThis as any).GPUBufferUsage;
      const GPUMap = (globalThis as any).GPUMapMode;
      const byteLen = src.byteLength;
      const inBuf = device.createBuffer({ size: byteLen, usage: GPUBU.STORAGE | GPUBU.COPY_DST });
      const outBuf = device.createBuffer({ size: byteLen, usage: GPUBU.STORAGE | GPUBU.COPY_SRC });
      const readBuf = device.createBuffer({ size: byteLen, usage: GPUBU.MAP_READ | GPUBU.COPY_DST });
      const paramBuf = device.createBuffer({ size: 16, usage: GPUBU.UNIFORM | GPUBU.COPY_DST });

      device.queue.writeBuffer(inBuf, 0, src);
      device.queue.writeBuffer(paramBuf, 0, new Float32Array([W, H, strength, 0]));

      const module = device.createShaderModule({
        code: `
          struct Params { w: f32, h: f32, strength: f32, pad: f32 };
          @group(0) @binding(0) var<storage, read> srcPx: array<u32>;
          @group(0) @binding(1) var<storage, read_write> outPx: array<u32>;
          @group(0) @binding(2) var<uniform> p: Params;

          fn sampleRgb(x: i32, y: i32, iw: i32, ih: i32) -> vec3<f32> {
            let cx = clamp(x, 0, iw - 1);
            let cy = clamp(y, 0, ih - 1);
            let px = srcPx[u32(cy * iw + cx)];
            return vec3<f32>(f32(px & 255u), f32((px >> 8u) & 255u), f32((px >> 16u) & 255u));
          }

          @compute @workgroup_size(8, 8)
          fn main(@builtin(global_invocation_id) gid: vec3<u32>) {
            let iw = i32(p.w);
            let ih = i32(p.h);
            let ix = i32(gid.x);
            let iy = i32(gid.y);
            if (ix >= iw || iy >= ih) { return; }
            let idx = u32(iy * iw + ix);
            let raw = srcPx[idx];
            let a = (raw >> 24u) & 255u;
            if (a < 8u) {
              outPx[idx] = raw;
              return;
            }
            let c = sampleRgb(ix, iy, iw, ih);
            let avg = (
              sampleRgb(ix - 1, iy, iw, ih) +
              sampleRgb(ix + 1, iy, iw, ih) +
              sampleRgb(ix, iy - 1, iw, ih) +
              sampleRgb(ix, iy + 1, iw, ih)
            ) * 0.25;
            let sharp = clamp(c + (c - avg) * p.strength, vec3<f32>(0.0), vec3<f32>(255.0));
            let rr = u32(sharp.x);
            let rg = u32(sharp.y);
            let rb = u32(sharp.z);
            outPx[idx] = rr | (rg << 8u) | (rb << 16u) | (a << 24u);
          }
        `,
      });

      const pipeline = device.createComputePipeline({
        layout: 'auto',
        compute: { module, entryPoint: 'main' },
      });
      const bg = device.createBindGroup({
        layout: pipeline.getBindGroupLayout(0),
        entries: [
          { binding: 0, resource: { buffer: inBuf } },
          { binding: 1, resource: { buffer: outBuf } },
          { binding: 2, resource: { buffer: paramBuf } },
        ],
      });

      const enc = device.createCommandEncoder();
      const pass = enc.beginComputePass();
      pass.setPipeline(pipeline);
      pass.setBindGroup(0, bg);
      pass.dispatchWorkgroups(Math.ceil(W / 8), Math.ceil(H / 8));
      pass.end();
      enc.copyBufferToBuffer(outBuf, 0, readBuf, 0, byteLen);
      device.queue.submit([enc.finish()]);

      await readBuf.mapAsync(GPUMap.READ);
      dst.set(new Uint8ClampedArray(readBuf.getMappedRange()));
      readBuf.unmap();
      inBuf.destroy();
      outBuf.destroy();
      readBuf.destroy();
      paramBuf.destroy();
      usedWebGpu = true;
    } catch {
      usedWebGpu = false;
    }
  }

  if (!usedWebGpu) {
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const idx = (y * W + x) * 4;
        const a = src[idx + 3];
        if (a < 8 || x === 0 || y === 0 || x === W - 1 || y === H - 1) {
          dst[idx] = src[idx];
          dst[idx + 1] = src[idx + 1];
          dst[idx + 2] = src[idx + 2];
          dst[idx + 3] = a;
          continue;
        }
        const up = ((y - 1) * W + x) * 4;
        const dn = ((y + 1) * W + x) * 4;
        const lf = (y * W + (x - 1)) * 4;
        const rt = (y * W + (x + 1)) * 4;
        for (let c = 0; c < 3; c++) {
          const avg = (src[up + c] + src[dn + c] + src[lf + c] + src[rt + c]) * 0.25;
          const v = src[idx + c] + (src[idx + c] - avg) * strength;
          dst[idx + c] = v < 0 ? 0 : v > 255 ? 255 : Math.round(v);
        }
        dst[idx + 3] = a;
      }
    }
  }

  oCtx.putImageData(new ImageData(dst, W, H), 0, 0);
  return { canvas: outCanvas, usedWebGpu };
}
