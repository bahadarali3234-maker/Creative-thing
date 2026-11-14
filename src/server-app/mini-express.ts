// @ts-nocheck
// Minimal Express-compatible adapter so the original server code runs unchanged
// inside TanStack Start server routes (Cloudflare Workers runtime).
type Handler = (req: any, res: MiniRes) => any;
type Route = { method: string; pattern: RegExp; keys: string[]; handler: Handler };

export const express = { json: (_opts?: unknown) => (_req: any, _res: any, next?: any) => { next?.(); } };

export class MiniRes {
  statusCode = 200;
  headers = new Headers();
  private body: BodyInit | null = null;
  private stream: TransformStream<Uint8Array, Uint8Array> | null = null;
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null;
  private enc = new TextEncoder();
  private resolveReady!: (r: Response) => void;
  ready = new Promise<Response>((r) => (this.resolveReady = r));
  private sent = false;

  status(code: number) { this.statusCode = code; return this; }
  setHeader(k: string, v: string) { this.headers.set(k, v); return this; }
  json(data: unknown) {
    this.headers.set('Content-Type', 'application/json');
    return this.send(JSON.stringify(data));
  }
  send(data: any) {
    if (this.sent) return this;
    this.sent = true;
    if (typeof data === 'string' && !this.headers.has('Content-Type')) this.headers.set('Content-Type', 'text/html; charset=utf-8');
    this.body = data;
    this.resolveReady(new Response(this.body, { status: this.statusCode, headers: this.headers }));
    return this;
  }
  flushHeaders() { this.ensureStream(); }
  private ensureStream() {
    if (this.stream || this.sent) return;
    this.sent = true;
    this.stream = new TransformStream();
    this.writer = this.stream.writable.getWriter();
    this.resolveReady(new Response(this.stream.readable, { status: this.statusCode, headers: this.headers }));
  }
  write(chunk: string) {
    this.ensureStream();
    this.writer?.write(this.enc.encode(chunk)).catch(() => {});
    return true;
  }
  end() {
    if (this.writer) this.writer.close().catch(() => {});
    else if (!this.sent) this.send('');
  }
  finalize() { if (!this.sent) this.status(204).send(null); else if (this.writer) this.end(); }
}

export class MiniApp {
  routes: Route[] = [];
  use(..._args: unknown[]) {}
  private add(method: string, paths: string | string[], handlers: any[]) {
    const handler = handlers[handlers.length - 1] as Handler;
    for (const p of Array.isArray(paths) ? paths : [paths]) {
      const keys: string[] = [];
      const src = p.replace(/:(\w+)/g, (_, k) => { keys.push(k); return '([^/]+)'; });
      this.routes.push({ method, pattern: new RegExp(`^${src}$`), keys, handler });
    }
  }
  get(p: string | string[], ...h: any[]) { this.add('GET', p, h); }
  post(p: string | string[], ...h: any[]) { this.add('POST', p, h); }

  async handle(request: Request): Promise<Response> {
    const url = new URL(request.url);
    for (const r of this.routes) {
      if (r.method !== request.method) continue;
      const m = url.pathname.match(r.pattern);
      if (!m) continue;
      const params: Record<string, string> = {};
      r.keys.forEach((k, i) => (params[k] = decodeURIComponent(m[i + 1])));
      let body: any = {};
      if (request.method === 'POST') { try { body = await request.json(); } catch { body = {}; } }
      const req = { body, params, query: Object.fromEntries(url.searchParams), headers: Object.fromEntries(request.headers), on: () => {} };
      const res = new MiniRes();
      const run = Promise.resolve()
        .then(() => r.handler(req, res))
        .then(() => res.finalize())
        .catch((err) => {
          console.error(err);
          if (!(res as any).sent) res.status(500).json({ error: String(err?.message || err) });
          else res.end();
        });
      void run;
      return res.ready;
    }
    return new Response('Not found', { status: 404 });
  }
}
