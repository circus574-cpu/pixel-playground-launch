import { createFileRoute } from '@tanstack/react-router';
export const Route = createFileRoute('/api/public/uploads/from-url')({ server: { handlers: { POST: async ({ request }) => { const { handleUpload } = await import('@/lib/uploads.server'); return handleUpload(request, true); } } } });
