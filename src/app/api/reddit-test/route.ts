import { fetchDreamSubreddits } from '@/lib/external/reddit';

export const dynamic = 'force-dynamic';

export async function GET() {
  const result = await fetchDreamSubreddits();
  return Response.json({ count: result.length, data: result });
}
