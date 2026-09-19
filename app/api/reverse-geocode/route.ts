import { handleProvider, reverseAddress } from '@/lib/server/providers';
export const runtime = 'nodejs';
export async function POST(request: Request) { return handleProvider(request, reverseAddress); }
