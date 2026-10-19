import { createFileRoute } from '@tanstack/react-router';
import { uploadOpenApi } from '@/lib/uploads.openapi';
export const Route = createFileRoute('/api/public/uploads/openapi')({ server: { handlers: { GET: () => Response.json(uploadOpenApi('https://kilegends.pl')) } } });