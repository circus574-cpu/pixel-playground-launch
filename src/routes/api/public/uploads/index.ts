import { createFileRoute } from '@tanstack/react-router';
export const Route = createFileRoute('/api/public/uploads/')({ server: { handlers: { POST: async ({ request }) => { const { handleUpload } = await import('@/lib/uploads.server'); return handleUpload(request, false); } } } });
