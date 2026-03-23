/* eslint-disable @typescript-eslint/no-explicit-any */
import { MarketSignal } from './types';

export async function fetchPolymarketEvents(): Promise<MarketSignal[]> {
  try {
    const response = await fetch(
      'https://gamma-api.polymarket.com/markets?active=true&limit=30&order=volume&ascending=false',
      { next: { revalidate: 3600 } }
    );
    if (!response.ok) throw new Error(`Polymarket error: ${response.status}`);
    
    const markets = await response.json();

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return markets
      .filter((m: any) => m.volume > 1000)
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .map((m: any) => ({
        id: m.id,
        question: m.question,
        probability: parseFloat(m.outcomePrices?.[0] || '0.5'),
        category: m.category || 'general',
        endDate: m.endDate,
        volume: parseFloat(m.volume || '0')
      }));
  } catch (e) {
    console.error('[Polymarket] Ошибка:', e);
    return [];
  }
}
