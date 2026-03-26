import { createServerSupabaseClient } from '@/lib/supabase/server';
import { fetchAllEvents } from '@/lib/news';
import type { NewsEvent } from '@/lib/news/types';

type Section = 'relevant' | 'all';
type RelevanceReason = 'geography' | 'images' | 'keywords' | null;

let eventsCache: { data: NewsEvent[]; timestamp: number } | null = null;
const CACHE_TTL = 15 * 60 * 1000;

interface UserEntryRow {
  ai_images: string[] | null;
  ai_geography: string | null;
  ai_emotions: string[] | null;
  content: string;
}

function normalizeWord(value: string): string {
  return value.toLowerCase().replace(/[^a-zа-я0-9\s-]/gi, '').trim();
}

function simpleHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = (hash * 31 + input.charCodeAt(i)) | 0;
  }
  return `ev_${Math.abs(hash)}`;
}

function extractKeywords(contents: string[]): string[] {
  const freq = new Map<string, number>();
  const stopWords = new Set([
    'this', 'that', 'with', 'from', 'have', 'were', 'been', 'they', 'them',
    'your', 'about', 'there', 'would', 'could', 'which', 'where', 'когда',
    'чтобы', 'котор', 'были', 'было', 'есть', 'если', 'тогда', 'после',
  ]);

  contents.forEach((content) => {
    content
      .split(/\s+/)
      .map(normalizeWord)
      .filter((word) => word.length > 4 && !stopWords.has(word))
      .forEach((word) => {
        freq.set(word, (freq.get(word) || 0) + 1);
      });
  });

  return Array.from(freq.entries())
    .filter(([, count]) => count > 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 40)
    .map(([word]) => word);
}

function detectDominantCategory(entries: UserEntryRow[]): string | null {
  const categoryHints: Record<string, string[]> = {
    conflict: ['war', 'conflict', 'attack', 'army', 'война', 'удар', 'армия'],
    earthquake: ['earthquake', 'quake', 'disaster', 'землетряс', 'катастроф'],
    politics: ['election', 'government', 'president', 'полит', 'правитель'],
    economy: ['market', 'inflation', 'economy', 'рынок', 'инфляц', 'эконом'],
  };

  const scores = new Map<string, number>();
  Object.keys(categoryHints).forEach((c) => scores.set(c, 0));

  entries.forEach((entry) => {
    const haystack = normalizeWord(`${entry.content} ${(entry.ai_emotions || []).join(' ')}`);
    Object.entries(categoryHints).forEach(([category, hints]) => {
      const matches = hints.reduce((sum, hint) => sum + (haystack.includes(hint) ? 1 : 0), 0);
      if (matches > 0) {
        scores.set(category, (scores.get(category) || 0) + matches);
      }
    });
  });

  let winner: string | null = null;
  let max = 0;
  scores.forEach((value, key) => {
    if (value > max) {
      max = value;
      winner = key;
    }
  });
  return max > 0 ? winner : null;
}

async function getEventsWithCache(): Promise<NewsEvent[]> {
  const now = Date.now();
  if (eventsCache && now - eventsCache.timestamp < CACHE_TTL) {
    return eventsCache.data;
  }
  const data = await fetchAllEvents(3);
  eventsCache = { data, timestamp: now };
  return data;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get('page') || 1));
  const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit') || 20)));
  const section = (searchParams.get('section') || 'relevant') as Section;

  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const allEvents = await getEventsWithCache();

  let sortedEvents = allEvents.map((event) => ({
    event,
    relevanceScore: 0,
    relevanceReason: null as RelevanceReason,
  }));

  if (user && section === 'relevant') {
    const [{ data: profile }, { data: userEntries }] = await Promise.all([
      supabase.from('users').select('dominant_images, avg_specificity').eq('id', user.id).single(),
      supabase
        .from('entries')
        .select('ai_images, ai_geography, ai_emotions, content')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(20),
    ]);

    const entries = (userEntries || []) as UserEntryRow[];
    const images = new Set<string>(
      entries.flatMap((e) => (e.ai_images || []).map((v) => normalizeWord(v))).filter(Boolean)
    );
    (profile?.dominant_images || []).forEach((img: string) => images.add(normalizeWord(img)));

    const geographies = new Set<string>(
      entries
        .map((e) => normalizeWord(e.ai_geography || ''))
        .filter(Boolean)
    );
    const keywords = new Set(extractKeywords(entries.map((e) => e.content)));
    const dominantCategory = detectDominantCategory(entries);

    sortedEvents = sortedEvents
      .map(({ event }) => {
        const haystack = normalizeWord(`${event.title} ${event.description || ''}`);
        const eventGeo = normalizeWord(event.geography || '');

        let relevanceScore = 0;
        let relevanceReason: RelevanceReason = null;

        if (eventGeo && geographies.has(eventGeo)) {
          relevanceScore += 3;
          relevanceReason = 'geography';
        }

        const imageHit = Array.from(images).some((word) => word && haystack.includes(word));
        if (imageHit) {
          relevanceScore += 2;
          if (!relevanceReason) relevanceReason = 'images';
        }

        const keywordHit = Array.from(keywords).some((word) => word && haystack.includes(word));
        if (keywordHit) {
          relevanceScore += 1;
          if (!relevanceReason) relevanceReason = 'keywords';
        }

        if (dominantCategory && event.category === dominantCategory) {
          relevanceScore += 0.5;
        }

        return { event, relevanceScore, relevanceReason };
      })
      .sort((a, b) => {
        if (b.relevanceScore !== a.relevanceScore) return b.relevanceScore - a.relevanceScore;
        return new Date(b.event.publishedAt).getTime() - new Date(a.event.publishedAt).getTime();
      });
  } else {
    sortedEvents = sortedEvents.sort(
      (a, b) => new Date(b.event.publishedAt).getTime() - new Date(a.event.publishedAt).getTime()
    );
  }

  const total = sortedEvents.length;
  const from = (page - 1) * limit;
  const to = from + limit;
  const pageData = sortedEvents.slice(from, to);

  return Response.json({
    events: pageData.map(({ event, relevanceScore, relevanceReason }) => ({
      id: simpleHash(`${event.title}:${event.source}`),
      title: event.title,
      description: event.description || null,
      url: event.url,
      publishedAt: event.publishedAt.toISOString(),
      geography: event.geography || null,
      category: event.category || 'other',
      relevanceScore,
      relevanceReason,
    })),
    total,
    page,
    hasMore: to < total,
  });
}
