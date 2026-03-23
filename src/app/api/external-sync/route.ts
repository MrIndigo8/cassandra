import { createAdminClient } from '@/lib/supabase/server';
import { fetchDreamSubreddits } from '@/lib/external/reddit';
import { fetchPolymarketEvents } from '@/lib/external/polymarket';

export async function POST(request: Request) {
  // Проверка авторизации для cron
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (authHeader !== `Bearer ${cronSecret}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createAdminClient();
  let savedReddit = 0;
  let savedPolymarket = 0;

  // Reddit сигналы
  const redditSignals = await fetchDreamSubreddits();
  for (const signal of redditSignals) {
    const { error } = await supabase
      .from('external_signals')
      .upsert({
        source: 'reddit',
        external_id: signal.id,
        title: signal.title,
        content: signal.content,
        url: signal.url,
        published_at: signal.publishedAt.toISOString(),
        metadata: signal.metadata
      }, { onConflict: 'source,external_id', ignoreDuplicates: true });
    
    if (!error) savedReddit++;
  }

  // Polymarket сигналы
  const markets = await fetchPolymarketEvents();
  for (const market of markets) {
    const { error } = await supabase
      .from('external_signals')
      .upsert({
        source: 'polymarket',
        external_id: market.id,
        title: market.question,
        content: `Вероятность: ${Math.round(market.probability * 100)}% | Объём: $${Math.round(market.volume).toLocaleString()}`,
        published_at: new Date().toISOString(),
        metadata: {
          probability: market.probability,
          category: market.category,
          endDate: market.endDate,
          volume: market.volume
        }
      }, { onConflict: 'source,external_id', ignoreDuplicates: true });
    
    if (!error) savedPolymarket++;
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
  const { data, count } = await supabase
    .from('external_signals')
    .select('*', { count: 'exact' })
    .order('published_at', { ascending: false })
    .limit(50);
  
  return Response.json({ total: count, latest: data });
}
