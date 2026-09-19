import { handleProvider, roadRoute } from '@/lib/server/providers';
export const runtime = 'nodejs';
export async function POST(request: Request) { return handleProvider(request, (body: { coordinates: Parameters<typeof roadRoute>[0] }) => roadRoute(body.coordinates)); }
