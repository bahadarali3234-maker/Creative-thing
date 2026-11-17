import dns from 'node:dns/promises';
import net from 'node:net';

export function isPrivateIp(ip) {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split('.').map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 100 && b >= 64 && b <= 127) || a >= 224;
  }
  if (net.isIPv6(ip)) {
    const x = ip.toLowerCase();
    if (x === '::1' || x === '::') return true;
    if (x.startsWith('fc') || x.startsWith('fd') || x.startsWith('fe8') || x.startsWith('fe9') || x.startsWith('fea') || x.startsWith('feb')) return true;
    const m = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/.exec(x); if (m) return isPrivateIp(m[1]);
    return false;
  }
  return true;
}

/** Throws if the URL is not a public http(s) URL. */
export async function assertPublicUrl(raw, lookup = dns.lookup) {
  let u; try { u = new URL(raw); } catch { throw new Error('Invalid URL'); }
  if (!/^https?:$/.test(u.protocol)) throw new Error('Only http/https URLs are allowed');
  if (u.username || u.password) throw new Error('Credentials in URL not allowed');
  if (/^(localhost|.*\.local|.*\.internal)$/i.test(u.hostname)) throw new Error('Private host blocked');
  if (net.isIP(u.hostname)) { if (isPrivateIp(u.hostname)) throw new Error('Private address blocked'); return u; }
  const addrs = await lookup(u.hostname, { all: true });
  if (!addrs.length || addrs.some((a) => isPrivateIp(a.address))) throw new Error('Private address blocked');
  return u;
}

/** Fetch an image through the guard (re-validates every redirect hop). */
export async function fetchImageSafe(url, { maxBytes = 8 * 1024 * 1024, timeoutMs = 9000, maxRedirects = 3, fetchImpl = fetch, lookup } = {}) {
  let cur = url;
  for (let i = 0; i <= maxRedirects; i++) {
    await assertPublicUrl(cur, lookup);
    const ctl = new AbortController(); const t = setTimeout(() => ctl.abort(), timeoutMs);
    try {
      const res = await fetchImpl(cur, { redirect: 'manual', signal: ctl.signal, headers: { 'User-Agent': 'Mozilla/5.0 StudioImageProxy', Accept: 'image/*' } });
      if (res.status >= 300 && res.status < 400 && res.headers.get('location')) { cur = new URL(res.headers.get('location'), cur).href; continue; }
      if (!res.ok) throw new Error('Upstream ' + res.status);
      const type = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
      if (!/^image\/(png|jpe?g|webp|gif|avif|bmp)$/.test(type)) throw new Error('Not an allowed image type: ' + type);
      const buf = Buffer.from(await res.arrayBuffer());
      if (buf.length > maxBytes) throw new Error('Image too large');
      return { buffer: buf, contentType: type };
    } finally { clearTimeout(t); }
  }
  throw new Error('Too many redirects');
}
