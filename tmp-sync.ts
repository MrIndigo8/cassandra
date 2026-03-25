import { createClient } from "@supabase/supabase-js";
import { fetchDreamSubreddits } from './src/lib/external/reddit';
import { fetchPolymarketEvents } from './src/lib/external/polymarket';
import * as dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function sync() {
  console.log('Fetching Reddit...');
  const redditSignals = await fetchDreamSubreddits();
  let savedReddit = 0;
  for (const signal of redditSignals) {
    const { error } = await supabase.from('external_signals').upsert({
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

  console.log('Fetching Polymarket...');
  const markets = await fetchPolymarketEvents();
  let savedPolymarket = 0;
  for (const market of markets) {
    const { error } = await supabase.from('external_signals').upsert({
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
  console.log(`Done! Reddit: ${savedReddit}, Polymarket: ${savedPolymarket}`);
}

sync().catch(console.error);
