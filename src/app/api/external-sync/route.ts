import { createAdminClient } from '@/lib/supabase/server';
import { fetchDreamSubreddits } from '@/lib/external/reddit';
import { fetchPolymarketEvents } from '@/lib/external/polymarket';
import { verifyCronAuth } from '@/lib/auth/verifyCron';

const CHUNK_SIZE = 200;

function chunkArray<T>(items: T[], chunkSize: number): T[][] {
  const result: T[][] = [];
  for (let i = 0; i < items.length; i += chunkSize) {
    result.push(items.slice(i, i + chunkSize));
  }
  return result;
}

export async function POST(request: Request) {
  if (!verifyCronAuth(request)) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  let savedReddit = 0;
  let savedPolymarket = 0;

  // Reddit сигналы
  const redditSignals = await fetchDreamSubreddits();
  const redditRows = redditSignals.map((signal) => ({
    source: 'reddit',
    external_id: signal.id,
    title: signal.title,
    content: signal.content,
    url: signal.url,
    published_at: signal.publishedAt.toISOString(),
    metadata: signal.metadata,
  }));

  for (const chunk of chunkArray(redditRows, CHUNK_SIZE)) {
    const { error } = await supabase
      .from('external_signals')
      .upsert(chunk, { onConflict: 'source,external_id', ignoreDuplicates: true });
    if (!error) {
      savedReddit += chunk.length;
    }
  }

  // Polymarket сигналы
  const markets = await fetchPolymarketEvents();
  const polymarketRows = markets.map((market) => ({
    source: 'polymarket',
    external_id: market.id,
    title: market.question,
    content: `Вероятность: ${Math.round(market.probability * 100)}% | Объём: $${Math.round(market.volume).toLocaleString()}`,
    published_at: new Date().toISOString(),
    metadata: {
      probability: market.probability,
      category: market.category,
      endDate: market.endDate,
      volume: market.volume,
    },
  }));

  for (const chunk of chunkArray(polymarketRows, CHUNK_SIZE)) {
    const { error } = await supabase
      .from('external_signals')
      .upsert(chunk, { onConflict: 'source,external_id', ignoreDuplicates: true });
    if (!error) {
      savedPolymarket += chunk.length;
    }
  }

  console.log(`[External Sync] Reddit: ${savedReddit}, Polymarket: ${savedPolymarket}`);
  return Response.json({ 
    success: true,
    reddit: savedReddit,
    polymarket: savedPolymarket
  });
}

// GET для тестирования
export async function GET() {
  const supabase = createAdminClient();
  
  const { data: redditData } = await supabase
    .from('external_signals')
    .select('*')
    .eq('source', 'reddit')
    .order('published_at', { ascending: false })
    .limit(20);

  const { data: polymarketData } = await supabase
    .from('external_signals')
    .select('*')
    .eq('source', 'polymarket')
    .order('published_at', { ascending: false })
    .limit(20);
  
  const combined = [...(redditData || []), ...(polymarketData || [])];
  
  return Response.json({ total: combined.length, latest: combined });
}
