import { createFileRoute } from '@tanstack/react-router';
import { handleLegacyRequest } from '@/server-app';

export const Route = createFileRoute('/api/$')({
  server: {
    handlers: {
      GET: ({ request }) => handleLegacyRequest(request),
      POST: ({ request }) => handleLegacyRequest(request),
    },
  },
});
