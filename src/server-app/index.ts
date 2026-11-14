import { MiniApp } from './mini-express';
import { registerRoutes } from './app';

let app: MiniApp | null = null;
export function handleLegacyRequest(request: Request) {
  if (!app) {
    app = new MiniApp();
    registerRoutes(app);
  }
  return app.handle(request);
}
