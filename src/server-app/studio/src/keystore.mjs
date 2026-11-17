// Encrypted-at-rest storage for the LLM config (key never returned to the client).
import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

export function createKeystore({ dir, secret }) {
  if (!secret || secret.length < 24) throw new Error('STUDIO_SECRET must be set (>= 24 characters) to store the API key');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'llm-config.enc.json');
  const derive = (salt) => crypto.scryptSync(secret, salt, 32);
  return {
    save(cfg) {
      const salt = crypto.randomBytes(16), iv = crypto.randomBytes(12);
      const cipher = crypto.createCipheriv('aes-256-gcm', derive(salt), iv);
      const data = Buffer.concat([cipher.update(JSON.stringify(cfg), 'utf8'), cipher.final()]);
      const tag = cipher.getAuthTag();
      fs.writeFileSync(file, JSON.stringify({ v: 1, salt: salt.toString('base64'), iv: iv.toString('base64'), tag: tag.toString('base64'), data: data.toString('base64'), savedAt: new Date().toISOString(), provider: cfg.provider, model: cfg.model, keyLast4: String(cfg.apiKey).slice(-4) }), { mode: 0o600 });
    },
    load() {
      if (!fs.existsSync(file)) return null;
      const j = JSON.parse(fs.readFileSync(file, 'utf8'));
      const d = crypto.createDecipheriv('aes-256-gcm', derive(Buffer.from(j.salt, 'base64')), Buffer.from(j.iv, 'base64'));
      d.setAuthTag(Buffer.from(j.tag, 'base64'));
      return JSON.parse(Buffer.concat([d.update(Buffer.from(j.data, 'base64')), d.final()]).toString('utf8'));
    },
    status() {
      if (!fs.existsSync(file)) return { configured: false };
      const j = JSON.parse(fs.readFileSync(file, 'utf8'));
      return { configured: true, provider: j.provider, model: j.model, keyLast4: j.keyLast4, savedAt: j.savedAt };
    },
    clear() { if (fs.existsSync(file)) fs.unlinkSync(file); },
  };
}
