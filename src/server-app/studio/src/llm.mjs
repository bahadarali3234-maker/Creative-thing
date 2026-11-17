// OpenAI-compatible chat client. Works with xAI (Grok) and Groq. Model name comes from config — never hard-coded.
export const PROVIDERS = {
  xai: { baseUrl: 'https://api.x.ai/v1', label: 'xAI (Grok)' },
  groq: { baseUrl: 'https://api.groq.com/openai/v1', label: 'Groq' },
};

export function createLlm({ provider = 'xai', apiKey, model, baseUrl, tokenParam = 'max_tokens', fetchImpl = fetch, timeoutMs = 120000 }) {
  if (!apiKey) throw new Error('LLM API key is not configured');
  const base = (baseUrl || (PROVIDERS[provider] && PROVIDERS[provider].baseUrl) || '').replace(/\/$/, '');
  if (!base) throw new Error('Unknown provider and no baseUrl given');
  const headers = { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` };

  async function call(path, init) {
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const res = await fetchImpl(base + path, { ...init, headers, signal: ctl.signal });
      const text = await res.text(); let body; try { body = JSON.parse(text); } catch { body = { raw: text }; }
      if (!res.ok) { const msg = (body && (body.error && (body.error.message || body.error))) || body.raw || res.statusText; const e = new Error(`LLM ${res.status}: ${typeof msg === 'string' ? msg : JSON.stringify(msg)}`); e.status = res.status; throw e; }
      return body;
    } finally { clearTimeout(t); }
  }

  return {
    provider, model, base,
    async listModels() { const b = await call('/models', { method: 'GET' }); return (b.data || []).map((m) => m.id); },
    async chat(messages, { temperature = 0.7, maxTokens = 6000 } = {}) {
      if (!model) throw new Error('LLM model is not configured');
      const body = { model, messages, temperature, [tokenParam]: maxTokens };
      const b = await call('/chat/completions', { method: 'POST', body: JSON.stringify(body) });
      const text = b.choices && b.choices[0] && b.choices[0].message && b.choices[0].message.content;
      if (!text) throw new Error('LLM returned an empty response');
      return String(text);
    },
  };
}

/** Test a key: list models (auth check) and, if a model is given, run a 1-token chat. */
export async function testLlmConfig(cfg, fetchImpl = fetch) {
  const result = { ok: false, provider: cfg.provider, model: cfg.model || null, models: [], steps: [] };
  try {
    const llm = createLlm({ ...cfg, fetchImpl, timeoutMs: 20000 });
    const models = await llm.listModels(); result.models = models.slice(0, 50); result.steps.push({ step: 'auth', ok: true, detail: `${models.length} models visible` });
    if (cfg.model) {
      if (models.length && !models.includes(cfg.model)) { result.steps.push({ step: 'model', ok: false, detail: `Model "${cfg.model}" not in the list for this key` }); return result; }
      const out = await llm.chat([{ role: 'user', content: 'Reply with the single word: ok' }], { maxTokens: 8, temperature: 0 });
      result.steps.push({ step: 'chat', ok: true, detail: out.slice(0, 40) });
    } else { result.steps.push({ step: 'model', ok: false, detail: 'No model chosen yet — pick one from "models".' }); return result; }
    result.ok = true;
  } catch (e) { result.steps.push({ step: 'error', ok: false, detail: String(e.message || e).slice(0, 300) }); }
  return result;
}
