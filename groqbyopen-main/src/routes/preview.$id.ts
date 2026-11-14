import { createFileRoute } from '@tanstack/react-router';
import { handleLegacyRequest } from '@/server-app';

export const Route = createFileRoute('/preview/$id')({
  server: {
    handlers: {
      GET: ({ request }) => handleLegacyRequest(request),
    },
  },
});
