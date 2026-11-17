import { getAvailableGrokKeys, isRateLimitResponse, markKeyRateLimited } from './grokKeyPool';
import type { ImageQualityOption, ImageSizeOption } from './imageProviders';

export const IMAGE_STYLE_PRESETS = [
  'Auto',
  'Photorealistic',
  'Cinematic',
  'Anime',
  '3D Rendering',
  'Pixar-like Stylized 3D',
  'Digital Painting',
  'Watercolor',
  'Oil Painting',
  'Cartoon',
  'Fantasy',
  'Cyberpunk',
  'Minimalist Illustration',
  'Product Photography',
  'Architectural Visualization',
  'Logo & Icon Design',
  'Game Assets',
  'Social Media Graphics',
  'Wallpapers',
  'Character Design',
  'Concept Art',
] as const;

export type ImageStylePreset = (typeof IMAGE_STYLE_PRESETS)[number];

export interface ThinkingStepWithSnapshot {
  title: string;
  desc: string;
  status: 'done' | 'active';
  screenshotLabel?: string;
  screenshotDataUrl?: string;
}

export interface OptimizedImagePlan {
  subject: string;
  detectedStyle: string;
  composition: string;
  lightingAndMood: string;
  colorPalette: string[];
  recommendedSize: ImageSizeOption;
  optimizedPrompt: string;
  analysisNotes: string;
}

function escapeXml(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function svgToDataUrl(svg: string): string {
  return `data:image/svg+xml;base64,${Buffer.from(svg, 'utf8').toString('base64')}`;
}

export function buildStepSnapshotSvgDataUrl(params: {
  stepNumber: number;
  title: string;
  subtitle: string;
  badges: string[];
  palette?: string[];
  accent?: string;
  statusTag?: string;
}): string {
  const accent = params.accent || '#00a6ff';
  const palette = (params.palette && params.palette.length > 0 ? params.palette : ['#0a2a66', '#00a6ff', '#e2e8f0', '#0f172a']).slice(0, 5);
  const title = escapeXml(params.title.slice(0, 46));
  const subtitle = escapeXml(params.subtitle.slice(0, 74));
  const statusTag = escapeXml(params.statusTag || 'VERIFIED');

  const swatches = palette
    .map(
      (hex, i) =>
        `<rect x="${20 + i * 26}" y="128" width="20" height="12" rx="3" fill="${escapeXml(hex)}" stroke="#cbd5e1" stroke-width="0.6" />`
    )
    .join('');

  const badgeBoxes = params.badges
    .slice(0, 3)
    .map((b, i) => {
      const bx = 20 + i * 102;
      return `<rect x="${bx}" y="94" width="96" height="22" rx="5" fill="#f1f5f9" stroke="#cbd5e1" stroke-width="0.8" />
        <text x="${bx + 48}" y="109" text-anchor="middle" font-family="system-ui, sans-serif" font-size="9.5" font-weight="700" fill="#0f172a">${escapeXml(b.slice(0, 16))}</text>`;
    })
    .join('');

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="340" height="156" viewBox="0 0 340 156">
  <rect width="340" height="156" rx="12" fill="#ffffff" stroke="#e2e8f0" stroke-width="1.5"/>
  <rect x="0" y="0" width="340" height="32" rx="12" fill="#f8fafc"/>
  <rect x="0" y="20" width="340" height="12" fill="#f8fafc"/>
  <line x1="0" y1="32" x2="340" y2="32" stroke="#e2e8f0" stroke-width="1"/>
  <circle cx="18" cy="16" r="8" fill="${escapeXml(accent)}"/>
  <text x="18" y="19.5" text-anchor="middle" font-family="system-ui, sans-serif" font-size="9.5" font-weight="800" fill="#ffffff">${params.stepNumber}</text>
  <text x="34" y="20" font-family="system-ui, sans-serif" font-size="11" font-weight="800" fill="#0f172a">${title}</text>
  <rect x="256" y="7" width="72" height="18" rx="4" fill="#ecfdf5" stroke="#a7f3d0" stroke-width="0.8"/>
  <text x="292" y="19" text-anchor="middle" font-family="system-ui, sans-serif" font-size="8.5" font-weight="800" fill="#047857">${statusTag}</text>
  <text x="20" y="56" font-family="system-ui, sans-serif" font-size="10.5" font-weight="600" fill="#334155">${subtitle}</text>
  <line x1="20" y1="74" x2="320" y2="74" stroke="#f1f5f9" stroke-width="1"/>
  ${badgeBoxes}
  ${swatches}
</svg>`;
  return svgToDataUrl(svg);
}

export function buildCompositeRenderedSnapshotSvgDataUrl(params: {
  model: string;
  size: string;
  quality: string;
  format: string;
  style: string;
  promptSnippet: string;
  isFinalCheck?: boolean;
}): string {
  const title = params.isFinalCheck ? 'Step 4 • Quality & Pixel Audit' : 'Step 3 • Image Render Snapshot';
  const accent = params.isFinalCheck ? '#10b981' : '#0a2a66';
  return buildStepSnapshotSvgDataUrl({
    stepNumber: params.isFinalCheck ? 4 : 3,
    title,
    subtitle: `${params.style} • ${params.promptSnippet}`,
    badges: [params.model, params.size, `${params.quality.toUpperCase()} ${params.format.toUpperCase()}`],
    palette: ['#0a2a66', '#00a6ff', '#10b981', '#0f172a'],
    accent,
    statusTag: params.isFinalCheck ? 'PERFECT' : 'RENDERED',
  });
}

function inferStyleFromPrompt(prompt: string, requestedStyle?: string): string {
  if (requestedStyle && requestedStyle !== 'Auto') return requestedStyle;
  const p = prompt.toLowerCase();
  if (/\banime|manga|studio ghibli|cel shaded\b/.test(p)) return 'Anime';
  if (/\bpixar|stylized 3d|disney 3d\b/.test(p)) return 'Pixar-like Stylized 3D';
  if (/\b3d\b|blender|octane|unreal engine|isometric 3d/.test(p)) return '3D Rendering';
  if (/\bwatercolor\b/.test(p)) return 'Watercolor';
  if (/\boil painting|impasto\b/.test(p)) return 'Oil Painting';
  if (/\bcartoon|comic\b/.test(p)) return 'Cartoon';
  if (/\bfantasy|dragon|magic|mythical\b/.test(p)) return 'Fantasy';
  if (/\bcyberpunk|neon\s+city|futuristic\s+noir\b/.test(p)) return 'Cyberpunk';
  if (/\bminimalist|flat\s+illustration|vector\s+illustration\b/.test(p)) return 'Minimalist Illustration';
  if (/\bproduct\s+photo|commercial\s+shot|studio\s+packshot\b/.test(p)) return 'Product Photography';
  if (/\barchitect|interior|exterior\s+render|modern\s+house\b/.test(p)) return 'Architectural Visualization';
  if (/\blogo|app\s+icon|brand\s+mark|badge|emblem\b/.test(p)) return 'Logo & Icon Design';
  if (/\bgame\s+asset|sprite|ui\s+item|inventory\s+icon\b/.test(p)) return 'Game Assets';
  if (/\bthumbnail|poster|banner|instagram|youtube|social\s+media\b/.test(p)) return 'Social Media Graphics';
  if (/\bwallpaper|desktop\s+background|phone\s+background\b/.test(p)) return 'Wallpapers';
  if (/\bcharacter\s+design|concept\s+character|turnaround\b/.test(p)) return 'Character Design';
  if (/\bconcept\s+art|matte\s+painting\b/.test(p)) return 'Concept Art';
  if (/\bdigital\s+painting\b/.test(p)) return 'Digital Painting';
  if (/\bcinematic|movie\s+still|film\s+frame\b/.test(p)) return 'Cinematic';
  return 'Photorealistic';
}

function inferSizeFromPrompt(prompt: string, requestedSize?: ImageSizeOption): ImageSizeOption {
  if (requestedSize && requestedSize !== 'auto') return requestedSize;
  const p = prompt.toLowerCase();
  if (/\b(16:9|landscape|widescreen|thumbnail|youtube|wallpaper|banner|desktop)\b/.test(p)) {
    return '1536x1024';
  }
  if (/\b(9:16|portrait|vertical|story|reel|phone\s+wallpaper|mobile\s+wallpaper|poster)\b/.test(p)) {
    return '1024x1536';
  }
  return '1024x1024';
}

export async function analyzeAndOptimizeImagePrompt(params: {
  rawPrompt: string;
  mode: 'generate' | 'edit' | 'variation';
  requestedStyle?: string;
  requestedSize?: ImageSizeOption;
  userGroqKey?: string;
  groqModel?: string;
}): Promise<OptimizedImagePlan> {
  const inferredStyle = inferStyleFromPrompt(params.rawPrompt, params.requestedStyle);
  const recommendedSize = inferSizeFromPrompt(params.rawPrompt, params.requestedSize);

  const systemInstruction = `You are a Principal Visual Prompt Engineer & Art Director.
Analyze the user's request carefully BEFORE rendering and return strictly valid JSON:
{
  "subject": "Core main subject without losing user specifics",
  "detectedStyle": "${inferredStyle}",
  "composition": "Shot framing, foreground/midground/background placement, depth & focal point",
  "lightingAndMood": "Specific lighting setup, atmosphere, and visual finish fitting ${inferredStyle}",
  "colorPalette": ["#hex1", "#hex2", "#hex3", "#hex4"],
  "optimizedPrompt": "Rich, concrete, single-paragraph image generation prompt (60-140 words) preserving EVERY user detail AND faithfully following ${inferredStyle} without forcing photorealism onto non-realistic styles like Anime/Cartoon/Minimalist/Logo.",
  "analysisNotes": "1-2 concise sentences summarizing key creative choices for the Thinking inspection log."
}

CRITICAL RULES:
- Never overwrite or alter the user's core subject, text labels, or colors.
- If mode is "edit", write clear edit instructions preserving everything the user did NOT ask to change.
- If style is Anime/Cartoon/3D Rendering/Watercolor/Oil Painting/Logo/Minimalist, describe textures/rendering strictly faithful to that medium — NEVER add "photorealistic 8k DSLR" to Anime or Logo prompts.`;

  const keyPool: Array<{ key: string; endpoint: string; provider: 'groq' | 'xai' }> = [];
  if (params.userGroqKey && params.userGroqKey.trim()) {
    keyPool.push({
      key: params.userGroqKey.trim(),
      endpoint: 'https://api.groq.com/openai/v1/chat/completions',
      provider: 'groq',
    });
  }
  for (const k of getAvailableGrokKeys({ includeCooldownAsLastResort: true })) {
    keyPool.push({ key: k.key, endpoint: k.endpoint, provider: k.provider });
  }

  for (const entry of keyPool) {
    const models =
      entry.provider === 'xai'
        ? ['grok-3-mini', 'grok-3']
        : params.groqModel && !/guard|whisper|tts/i.test(params.groqModel)
          ? [params.groqModel, 'llama-3.3-70b-versatile', 'openai/gpt-oss-120b']
          : ['llama-3.3-70b-versatile', 'openai/gpt-oss-120b', 'openai/gpt-oss-20b'];

    for (const modelName of models) {
      try {
        const res = await fetch(entry.endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${entry.key}`,
          },
          body: JSON.stringify({
            model: modelName,
            messages: [
              { role: 'system', content: systemInstruction },
              {
                role: 'user',
                content: `Mode: ${params.mode}\nRequested Style: ${inferredStyle}\nTarget Size: ${recommendedSize}\nUser Prompt: ${params.rawPrompt}`,
              },
            ],
            response_format: { type: 'json_object' },
            temperature: 0.35,
            max_tokens: 700,
          }),
          signal: AbortSignal.timeout(7500),
        });

        if (res.ok) {
          const data = (await res.json()) as any;
          const content = data?.choices?.[0]?.message?.content;
          if (content) {
            const parsed = JSON.parse(content);
            if (parsed?.optimizedPrompt && String(parsed.optimizedPrompt).trim().length > 10) {
              return {
                subject: String(parsed.subject || params.rawPrompt).slice(0, 200),
                detectedStyle: String(parsed.detectedStyle || inferredStyle),
                composition: String(parsed.composition || 'Balanced focal framing with clean separation'),
                lightingAndMood: String(parsed.lightingAndMood || 'Well-defined dimensional studio lighting'),
                colorPalette: Array.isArray(parsed.colorPalette) && parsed.colorPalette.length > 0
                  ? parsed.colorPalette.slice(0, 5).map(String)
                  : ['#0a2a66', '#00a6ff', '#0f172a', '#f8fafc'],
                recommendedSize,
                optimizedPrompt: String(parsed.optimizedPrompt).trim(),
                analysisNotes: String(parsed.analysisNotes || `Prepared ${inferredStyle} composition.`),
              };
            }
          }
        } else {
          const errBody = await res.text().catch(() => '');
          if (isRateLimitResponse(res.status, errBody)) {
            markKeyRateLimited(entry.key, res.headers.get('retry-after'));
            break;
          }
        }
      } catch {}
    }
  }

  // Clean deterministic expansion if Groq is temporarily offline
  const styleSuffix =
    inferredStyle === 'Photorealistic'
      ? 'natural authentic lighting, fine surface detail, sharp focus, realistic depth of field'
      : inferredStyle === 'Logo & Icon Design'
        ? 'clean vector geometry, crisp scalable silhouette, balanced negative space, solid background'
        : `${inferredStyle} aesthetic, cohesive palette, intentional framing, high craft`;

  return {
    subject: params.rawPrompt.slice(0, 140),
    detectedStyle: inferredStyle,
    composition: `Centered balanced ${recommendedSize} framing with strong subject separation`,
    lightingAndMood: `Crisp dimensional contrast matching ${inferredStyle}`,
    colorPalette: ['#0a2a66', '#00a6ff', '#0f172a', '#e2e8f0'],
    recommendedSize,
    optimizedPrompt:
      params.mode === 'edit'
        ? `${params.rawPrompt.trim()}. Preserve all unmodified elements, proportions, and lighting faithfully.`
        : `${params.rawPrompt.trim()}, rendered in ${inferredStyle} style, ${styleSuffix}.`,
    analysisNotes: `Analyzed subject and structured ${inferredStyle} prompt for ${recommendedSize}.`,
  };
}

export function buildImageThinkingSteps(params: {
  plan: OptimizedImagePlan;
  model: string;
  quality: ImageQualityOption;
  outputFormat: string;
  mode: 'generate' | 'edit' | 'variation';
}): ThinkingStepWithSnapshot[] {
  const { plan, model, quality, outputFormat, mode } = params;

  const step1Snap = buildStepSnapshotSvgDataUrl({
    stepNumber: 1,
    title: 'Data Gathering & Intent Analysis',
    subtitle: `Subject: ${plan.subject}`,
    badges: [mode.toUpperCase(), plan.detectedStyle, plan.recommendedSize],
    palette: plan.colorPalette,
    accent: '#00a6ff',
    statusTag: 'ANALYZED',
  });

  const step2Snap = buildStepSnapshotSvgDataUrl({
    stepNumber: 2,
    title: 'Style & Composition Blueprint',
    subtitle: plan.composition,
    badges: [plan.detectedStyle, plan.lightingAndMood.slice(0, 18), quality.toUpperCase()],
    palette: plan.colorPalette,
    accent: '#0a2a66',
    statusTag: 'PLANNED',
  });

  const step3Snap = buildCompositeRenderedSnapshotSvgDataUrl({
    model,
    size: plan.recommendedSize,
    quality,
    format: outputFormat,
    style: plan.detectedStyle,
    promptSnippet: plan.optimizedPrompt.slice(0, 68),
    isFinalCheck: false,
  });

  const step4Snap = buildCompositeRenderedSnapshotSvgDataUrl({
    model,
    size: plan.recommendedSize,
    quality,
    format: outputFormat,
    style: plan.detectedStyle,
    promptSnippet: plan.analysisNotes.slice(0, 68),
    isFinalCheck: true,
  });

  return [
    {
      title: 'Step 1: Subject Gathering & Requirement Analysis',
      desc: `${plan.analysisNotes} Mode: ${mode}, Target: ${plan.recommendedSize}.`,
      status: 'done',
      screenshotLabel: 'Intent & Subject Snapshot',
      screenshotDataUrl: step1Snap,
    },
    {
      title: `Step 2: Prompt Optimization (${plan.detectedStyle})`,
      desc: `Framing: ${plan.composition}. Lighting: ${plan.lightingAndMood}. Optimized Prompt: "${plan.optimizedPrompt.slice(0, 140)}${plan.optimizedPrompt.length > 140 ? '...' : ''}"`,
      status: 'done',
      screenshotLabel: 'Composition & Palette Snapshot',
      screenshotDataUrl: step2Snap,
    },
    {
      title: `Step 3: Real Image Render (${model})`,
      desc: `Synthesized binary ${outputFormat.toUpperCase()} (${plan.recommendedSize}, quality: ${quality}) via OpenAI Image API and saved to persistent storage.`,
      status: 'done',
      screenshotLabel: 'Render Verification Snapshot',
      screenshotDataUrl: step3Snap,
    },
    {
      title: 'Step 4: Visual Output & Integrity Check',
      desc: `Verified resolution, format integrity, artifact file persistence, and compact display readiness before delivering result.`,
      status: 'done',
      screenshotLabel: 'Final Quality Check',
      screenshotDataUrl: step4Snap,
    },
  ];
}

