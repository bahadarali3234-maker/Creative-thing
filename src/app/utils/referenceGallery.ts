/**
 * User Custom Reference Gallery & Diagram Assets Manager
 * Allows user to configure custom reference images and message triggers
 */

export interface ReferenceItem {
  id: string;
  title: string;
  url: string;
  caption?: string;
}

export interface ReferenceConfig {
  enabled: boolean;
  messageText: string;
  triggerKeywords: string[];
  items: ReferenceItem[];
}

const STORAGE_KEY = 'gemini_custom_reference_diagrams_v1';

export const DEFAULT_REFERENCE_CONFIG: ReferenceConfig = {
  enabled: true,
  messageText: 'It have this some refance',
  triggerKeywords: ['policy', 'sensitive', 'diagram', 'reference', 'topic', 'model', 'architecture', 'anatomy', 'figure'],
  items: [
    {
      id: 'ref-1',
      title: 'Architectural System Reference 01',
      url: 'https://upload.wikimedia.org/wikipedia/commons/0/03/Architecture_of_Siwa01.jpg',
      caption: 'Structural layout and elevation matrix',
    },
    {
      id: 'ref-2',
      title: 'Geometric Proportion Reference 02',
      url: 'https://upload.wikimedia.org/wikipedia/commons/e/ec/Vitruvian_Man_by_Leonardo_da_Vinci.jpg',
      caption: 'Classical proportion and spatial geometry reference',
    },
  ],
};

export function getReferenceConfig(): ReferenceConfig {
  if (typeof window === 'undefined') return DEFAULT_REFERENCE_CONFIG;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_REFERENCE_CONFIG;
    const parsed = JSON.parse(raw);
    return {
      enabled: typeof parsed.enabled === 'boolean' ? parsed.enabled : true,
      messageText: parsed.messageText || 'It have this some refance',
      triggerKeywords: Array.isArray(parsed.triggerKeywords) ? parsed.triggerKeywords : DEFAULT_REFERENCE_CONFIG.triggerKeywords,
      items: Array.isArray(parsed.items) && parsed.items.length > 0 ? parsed.items : DEFAULT_REFERENCE_CONFIG.items,
    };
  } catch (err) {
    console.warn('Error reading reference config:', err);
    return DEFAULT_REFERENCE_CONFIG;
  }
}

export function saveReferenceConfig(config: ReferenceConfig): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch (err) {
    console.warn('Error saving reference config:', err);
  }
}

/**
 * Checks if user prompt touches sensitive, restricted or reference trigger topics
 */
export function isSensitiveOrReferenceTrigger(prompt: string, config: ReferenceConfig = getReferenceConfig()): boolean {
  if (!config.enabled || !prompt || typeof prompt !== 'string') return false;
  const lower = prompt.toLowerCase();

  // Safety / policy triggers or sensitive words
  const sensitivePatterns = [
    /\b(sex|sexual|porn|nsfw|adult|xxx|erotic|nudity|naked)\b/i,
    /\b(policy|restriction|prohibited|guideline|content\s*filter)\b/i,
  ];

  if (sensitivePatterns.some((pattern) => pattern.test(lower))) {
    return true;
  }

  // User-configured trigger keywords
  return config.triggerKeywords.some((kw) => kw.trim() && lower.includes(kw.trim().toLowerCase()));
}
