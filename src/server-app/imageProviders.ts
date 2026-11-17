export type ImageOutputFormat = 'png' | 'jpeg' | 'webp';
export type ImageQualityOption = 'low' | 'medium' | 'high' | 'auto';
export type ImageSizeOption = '1024x1024' | '1536x1024' | '1024x1536' | 'auto';

export interface ImageGenerationInput {
  apiKey: string;
  model: string;
  prompt: string;
  size?: ImageSizeOption;
  quality?: ImageQualityOption;
  outputFormat?: ImageOutputFormat;
}

export interface ImageEditInput {
  apiKey: string;
  model: string;
  prompt: string;
  sourceBuffer: Buffer;
  sourceMimeType: string;
  size?: ImageSizeOption;
  quality?: ImageQualityOption;
  outputFormat?: ImageOutputFormat;
}

export interface ImageGenerationResult {
  buffer: Buffer;
  mimeType: string;
  modelUsed: string;
  provider: 'openai';
  revisedPrompt?: string;
}

export type ImageProviderErrorCode =
  | 'MISSING_OPENAI_KEY'
  | 'INVALID_OPENAI_KEY'
  | 'INSUFFICIENT_CREDITS'
  | 'RATE_LIMITED'
  | 'MODERATION_BLOCKED'
  | 'INVALID_IMAGE_INPUT'
  | 'MODEL_UNAVAILABLE'
  | 'PROVIDER_ERROR';

export class ImageProviderError extends Error {
  code: ImageProviderErrorCode;
  status: number;
  retryAfterSec?: number;

  constructor(code: ImageProviderErrorCode, message: string, status = 400, retryAfterSec?: number) {
    super(message);
    this.code = code;
    this.status = status;
    this.retryAfterSec = retryAfterSec;
  }
}

export interface ImageProviderAdapter {
  readonly id: string;
  generate(input: ImageGenerationInput): Promise<ImageGenerationResult>;
  edit(input: ImageEditInput): Promise<ImageGenerationResult>;
  variation(input: ImageEditInput): Promise<ImageGenerationResult>;
  testConnection(apiKey: string): Promise<{ ok: boolean; status: number; message: string; availableModels: string[] }>;
}

const DEFAULT_OPENAI_IMAGE_MODEL = 'gpt-image-1';

export const ALLOWED_OPENAI_IMAGE_MODELS = [
  'gpt-image-1',
  'gpt-image-1.5',
  'gpt-image-1-mini',
  'dall-e-3',
] as const;

export function normalizeImageModel(requested?: string): string {
  const clean = String(requested || '').trim();
  if (!clean) return DEFAULT_OPENAI_IMAGE_MODEL;
  if (/^[a-zA-Z0-9._-]{3,64}$/.test(clean)) return clean;
  return DEFAULT_OPENAI_IMAGE_MODEL;
}

function mapQualityForModel(model: string, quality?: ImageQualityOption): string | undefined {
  const q = quality || 'auto';
  if (model === 'dall-e-3') {
    if (q === 'high') return 'hd';
    if (q === 'low' || q === 'medium') return 'standard';
    return 'standard';
  }
  return q;
}

function mapSizeForModel(model: string, size?: ImageSizeOption): string {
  const s = size || '1024x1024';
  if (model === 'dall-e-3') {
    if (s === '1536x1024') return '1792x1024';
    if (s === '1024x1536') return '1024x1792';
    return '1024x1024';
  }
  return s;
}

async function parseOpenAiError(res: Response, fallbackMsg: string): Promise<ImageProviderError> {
  const retryAfterHeader = res.headers.get('retry-after');
  const retryAfterSec = retryAfterHeader && Number.isFinite(Number(retryAfterHeader))
    ? Number(retryAfterHeader)
    : undefined;

  let rawText = '';
  let errJson: any = null;
  try {
    rawText = await res.text();
    errJson = JSON.parse(rawText);
  } catch {}

  const apiMsg = String(errJson?.error?.message || rawText || fallbackMsg).trim();
  const apiCode = String(errJson?.error?.code || errJson?.error?.type || '').toLowerCase();

  if (res.status === 401 || apiCode.includes('invalid_api_key')) {
    return new ImageProviderError(
      'INVALID_OPENAI_KEY',
      'Your OpenAI API key is invalid or expired. Please check and update it in AI API Settings.',
      401
    );
  }

  if (
    res.status === 402 ||
    apiCode.includes('insufficient_quota') ||
    apiCode.includes('billing') ||
    /insufficient quota|billing|exceeded your current quota|credits/i.test(apiMsg)
  ) {
    return new ImageProviderError(
      'INSUFFICIENT_CREDITS',
      'Your OpenAI account has insufficient credits or billing quota for image generation. Please check your OpenAI billing settings.',
      402
    );
  }

  if (res.status === 429 || apiCode.includes('rate_limit')) {
    return new ImageProviderError(
      'RATE_LIMITED',
      retryAfterSec
        ? `OpenAI rate limit reached. Please retry in ${retryAfterSec} seconds.`
        : 'OpenAI rate limit reached. Please wait a moment and try again.',
      429,
      retryAfterSec
    );
  }

  if (
    apiCode.includes('content_policy') ||
    apiCode.includes('moderation') ||
    /safety system|content policy|rejected as a result of our safety/i.test(apiMsg)
  ) {
    return new ImageProviderError(
      'MODERATION_BLOCKED',
      'This image prompt was declined by OpenAI safety guidelines. Please adjust the description and try again.',
      400
    );
  }

  if (res.status === 404 || apiCode.includes('model_not_found')) {
    return new ImageProviderError(
      'MODEL_UNAVAILABLE',
      `Selected OpenAI image model is unavailable or not enabled on your key (${apiMsg}). Try switching to gpt-image-1 in AI API Settings.`,
      400
    );
  }

  return new ImageProviderError('PROVIDER_ERROR', apiMsg || fallbackMsg, res.status >= 400 ? res.status : 502);
}

async function resolveResultImageBytes(dataItem: any, format: ImageOutputFormat): Promise<ImageGenerationResult> {
  if (dataItem?.b64_json) {
    return {
      buffer: Buffer.from(String(dataItem.b64_json), 'base64'),
      mimeType: format === 'jpeg' ? 'image/jpeg' : format === 'webp' ? 'image/webp' : 'image/png',
      modelUsed: '',
      provider: 'openai',
      revisedPrompt: dataItem.revised_prompt ? String(dataItem.revised_prompt) : undefined,
    };
  }
  if (dataItem?.url) {
    const imgRes = await fetch(String(dataItem.url), { signal: AbortSignal.timeout(25_000) });
    if (!imgRes.ok) {
      throw new ImageProviderError('PROVIDER_ERROR', 'Generated image download from OpenAI failed.', 502);
    }
    const buf = Buffer.from(await imgRes.arrayBuffer());
    return {
      buffer: buf,
      mimeType: imgRes.headers.get('content-type') || 'image/png',
      modelUsed: '',
      provider: 'openai',
      revisedPrompt: dataItem.revised_prompt ? String(dataItem.revised_prompt) : undefined,
    };
  }
  throw new ImageProviderError('PROVIDER_ERROR', 'OpenAI did not return image bytes.', 502);
}

export class OpenAiImageProvider implements ImageProviderAdapter {
  readonly id = 'openai';

  async generate(input: ImageGenerationInput): Promise<ImageGenerationResult> {
    if (!input.apiKey || !input.apiKey.trim()) {
      throw new ImageProviderError(
        'MISSING_OPENAI_KEY',
        'OpenAI API key is required for image generation. Open Settings -> AI API Settings to add your OpenAI key.',
        400
      );
    }

    const model = normalizeImageModel(input.model);
    const outputFormat: ImageOutputFormat = input.outputFormat || 'png';
    const isGptImage = model.startsWith('gpt-image');

    const payload: Record<string, any> = {
      model,
      prompt: input.prompt,
      n: 1,
      size: mapSizeForModel(model, input.size),
    };

    const q = mapQualityForModel(model, input.quality);
    if (q) payload.quality = q;

    if (isGptImage) {
      payload.output_format = outputFormat;
    } else {
      payload.response_format = 'b64_json';
    }

    const res = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${input.apiKey.trim()}`,
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(75_000),
    });

    if (!res.ok) {
      throw await parseOpenAiError(res, 'OpenAI image generation failed.');
    }

    const json = (await res.json()) as { data?: any[] };
    const first = json?.data?.[0];
    const resolved = await resolveResultImageBytes(first, isGptImage ? outputFormat : 'png');
    resolved.modelUsed = model;
    return resolved;
  }

  async edit(input: ImageEditInput): Promise<ImageGenerationResult> {
    if (!input.apiKey || !input.apiKey.trim()) {
      throw new ImageProviderError(
        'MISSING_OPENAI_KEY',
        'OpenAI API key is required for image editing. Open Settings -> AI API Settings to add your OpenAI key.',
        400
      );
    }

    let model = normalizeImageModel(input.model);
    // dall-e-3 does not support /v1/images/edits; default cleanly to gpt-image-1 for editing
    if (model === 'dall-e-3') model = 'gpt-image-1';
    const outputFormat: ImageOutputFormat = input.outputFormat || 'png';

    const form = new FormData();
    const ext = input.sourceMimeType.includes('webp')
      ? 'webp'
      : input.sourceMimeType.includes('jpeg') || input.sourceMimeType.includes('jpg')
        ? 'jpg'
        : 'png';
    const imgBlob = new Blob([new Uint8Array(input.sourceBuffer)], { type: input.sourceMimeType || 'image/png' });
    form.append('image', imgBlob, `source.${ext}`);
    form.append('model', model);
    form.append('prompt', input.prompt);
    form.append('size', mapSizeForModel(model, input.size));
    const q = mapQualityForModel(model, input.quality);
    if (q) form.append('quality', q);
    if (model.startsWith('gpt-image')) {
      form.append('output_format', outputFormat);
    }

    const res = await fetch('https://api.openai.com/v1/images/edits', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${input.apiKey.trim()}`,
      },
      body: form,
      signal: AbortSignal.timeout(75_000),
    });

    if (!res.ok) {
      throw await parseOpenAiError(res, 'OpenAI image edit failed.');
    }

    const json = (await res.json()) as { data?: any[] };
    const first = json?.data?.[0];
    const resolved = await resolveResultImageBytes(first, model.startsWith('gpt-image') ? outputFormat : 'png');
    resolved.modelUsed = model;
    return resolved;
  }

  async variation(input: ImageEditInput): Promise<ImageGenerationResult> {
    return this.edit({
      ...input,
      prompt: `Create an artistic creative variation of this exact image while keeping the main subject identity and composition harmonious: ${input.prompt}`,
    });
  }

  async testConnection(apiKey: string) {
    if (!apiKey || !apiKey.trim()) {
      return { ok: false, status: 400, message: 'No OpenAI API key provided.', availableModels: [] };
    }
    try {
      const res = await fetch('https://api.openai.com/v1/models', {
        headers: { Authorization: `Bearer ${apiKey.trim()}` },
        signal: AbortSignal.timeout(8000),
      });
      if (!res.ok) {
        const err = await parseOpenAiError(res, 'OpenAI connection test failed.');
        return { ok: false, status: err.status, message: err.message, availableModels: [] };
      }
      const data = (await res.json()) as { data?: Array<{ id?: string }> };
      const allIds = (data?.data || []).map((m) => String(m.id || ''));
      const imageModels = allIds.filter((id) => /gpt-image|dall-e/i.test(id)).slice(0, 8);
      return {
        ok: true,
        status: 200,
        message: 'Connected to OpenAI API successfully.',
        availableModels: imageModels.length > 0 ? imageModels : [...ALLOWED_OPENAI_IMAGE_MODELS],
      };
    } catch (err: any) {
      return {
        ok: false,
        status: 502,
        message: err?.message || 'Could not reach OpenAI API.',
        availableModels: [],
      };
    }
  }
}

export const defaultImageProvider: ImageProviderAdapter = new OpenAiImageProvider();
