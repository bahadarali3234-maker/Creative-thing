export type ExternalProviderType = 'xai' | 'groq';

export interface GrokKeyEntry {
  key: string;
  slotIndex: number;
  slotLabel: string;
  provider: ExternalProviderType;
  masked: string;
  endpoint: string;
}

const PLACEHOLDER_VALUES = new Set([
  '',
  'MY_GEMINI_API_KEY',
  'MY_GROK_API_KEY',
  'MY_GROQ_API_KEY',
  'MY_PRIMARY_GROK_API_KEY',
  'MY_FALLBACK_GROK_API_KEY',
  'MY_PRIMARY_GROK_OR_GROQ_API_KEY',
  'MY_SECONDARY_RATE_LIMIT_FALLBACK_KEY',
]);

// Key -> epoch ms until which this key is considered rate-limited
const rateLimitCooldownUntil = new Map<string, number>();

export function maskApiKey(key: string): string {
  const trimmed = key.trim();
  if (trimmed.length <= 8) return '****';
  return `${trimmed.slice(0, 4)}...${trimmed.slice(-4)}`;
}

export function detectExternalProvider(key: string, envVarName: string): ExternalProviderType {
  const lower = key.trim().toLowerCase();
  if (lower.startsWith('xai-')) return 'xai';
  if (lower.startsWith('gsk_')) return 'groq';
  return envVarName.startsWith('GROK_') ? 'xai' : 'groq';
}

export function getEndpointForProvider(provider: ExternalProviderType): string {
  return provider === 'xai'
    ? 'https://api.x.ai/v1/chat/completions'
    : 'https://api.groq.com/openai/v1/chat/completions';
}

function splitEnvKeys(rawValue: string | undefined): string[] {
  if (!rawValue || typeof rawValue !== 'string') return [];
  return rawValue
    .split(',')
    .map((part) => part.trim().replace(/^['"]|['"]$/g, ''))
    .filter((k) => k.length > 0 && !PLACEHOLDER_VALUES.has(k));
}

/**
 * Returns all configured Primary + Fallback Grok/Groq keys in priority order, deduplicated.
 */
export function getConfiguredGrokKeys(): GrokKeyEntry[] {
  const sources: Array<{ envName: string; isFallbackSlot: boolean }> = [
    { envName: 'GROK_API_KEY', isFallbackSlot: false },
    { envName: 'GROK_API_KEY_1', isFallbackSlot: false },
    { envName: 'GROQ_API_KEY', isFallbackSlot: false },
    { envName: 'GROQ_API_KEY_1', isFallbackSlot: false },
    { envName: 'GROK_API_KEY_FALLBACK', isFallbackSlot: true },
    { envName: 'GROK_API_KEY_2', isFallbackSlot: true },
    { envName: 'GROQ_API_KEY_FALLBACK', isFallbackSlot: true },
    { envName: 'GROQ_API_KEY_2', isFallbackSlot: true },
  ];

  const entries: GrokKeyEntry[] = [];
  const seenKeys = new Set<string>();

  for (const src of sources) {
    const keys = splitEnvKeys(process.env[src.envName]);
    for (const key of keys) {
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      const slotIndex = entries.length + 1;
      const provider = detectExternalProvider(key, src.envName);
      const slotLabel =
        src.isFallbackSlot || slotIndex > 1
          ? `Fallback Key #${slotIndex}`
          : `Primary Key #${slotIndex}`;
      entries.push({
        key,
        slotIndex,
        slotLabel,
        provider,
        masked: maskApiKey(key),
        endpoint: getEndpointForProvider(provider),
      });
    }
  }

  return entries;
}

export function isRateLimitResponse(status: number, errorBody = ''): boolean {
  if (status === 429) return true;
  if (status >= 500 && /rate[_\s-]*limit|quota|too many requests|capacity/i.test(errorBody)) {
    return true;
  }
  return /rate[_\s-]*limit|too many requests|tokens per minute|requests per minute|quota exceeded|insufficient_quota/i.test(
    errorBody
  );
}

export function parseRetryAfterMs(retryAfterHeader?: string | null, defaultMs = 60_000): number {
  if (!retryAfterHeader) return defaultMs;
  const seconds = Number(retryAfterHeader.trim());
  if (!Number.isNaN(seconds) && seconds > 0) {
    return Math.min(Math.max(Math.round(seconds * 1000), 15_000), 300_000);
  }
  const dateMs = Date.parse(retryAfterHeader);
  if (!Number.isNaN(dateMs)) {
    const delta = dateMs - Date.now();
    if (delta > 0) {
      return Math.min(Math.max(delta, 15_000), 300_000);
    }
  }
  return defaultMs;
}

export function markKeyRateLimited(key: string, retryAfterHeader?: string | null): number {
  const durationMs = parseRetryAfterMs(retryAfterHeader);
  const until = Date.now() + durationMs;
  rateLimitCooldownUntil.set(key, until);
  return durationMs;
}

export function isKeyInCooldown(key: string, now = Date.now()): boolean {
  const until = rateLimitCooldownUntil.get(key);
  if (!until) return false;
  if (now >= until) {
    rateLimitCooldownUntil.delete(key);
    return false;
  }
  return true;
}

/**
 * Returns keys ordered with active (non-rate-limited) keys first, preserving Primary -> Fallback priority.
 * Keys currently in rate-limit cooldown are skipped unless `includeCooldownAsLastResort` is true.
 */
export function getAvailableGrokKeys(options?: {
  providerFilter?: ExternalProviderType;
  includeCooldownAsLastResort?: boolean;
}): GrokKeyEntry[] {
  const now = Date.now();
  const all = getConfiguredGrokKeys().filter((entry) =>
    options?.providerFilter ? entry.provider === options.providerFilter : true
  );

  const active = all.filter((entry) => !isKeyInCooldown(entry.key, now));
  if (active.length > 0 || !options?.includeCooldownAsLastResort) {
    return active;
  }

  // Sort cooling-down keys by earliest expiry if caller explicitly wants last resort
  return [...all].sort((a, b) => {
    const ua = rateLimitCooldownUntil.get(a.key) || 0;
    const ub = rateLimitCooldownUntil.get(b.key) || 0;
    return ua - ub;
  });
}

export function getGrokKeyPoolHealth() {
  const now = Date.now();
  const all = getConfiguredGrokKeys();
  const activeCount = all.filter((e) => !isKeyInCooldown(e.key, now)).length;
  return {
    totalKeys: all.length,
    activeKeys: activeCount,
    coolingDownKeys: all.length - activeCount,
    hasPrimaryKey: all.length >= 1,
    hasFallbackKey: all.length >= 2,
    providers: Array.from(new Set(all.map((e) => e.provider))),
  };
}

export function _resetGrokRateLimitCooldowns() {
  rateLimitCooldownUntil.clear();
}
