import crypto from 'crypto';
import Anthropic from '@anthropic-ai/sdk';
import { createAdminClient, createServerSupabaseClient } from '@/lib/supabase/server';
import { fetchAllEvents } from '@/lib/news';
import type { NewsAudienceProfile, NewsEvent } from '@/lib/news/types';
import { getModel } from '@/lib/claude/models';

type Section = 'relevant' | 'all';
type Locale = 'ru' | 'en';
type RelevanceType = 'geography' | 'sensory' | 'keywords';

const eventsCache = new Map<string, { data: NewsEvent[]; timestamp: number }>();
const CACHE_TTL = 15 * 60 * 1000;
let translatedEventsCache: { data: EventWithTranslation[]; timestamp: number; locale: Locale } | null = null;
const TRANSLATED_EVENTS_CACHE_TTL = 30 * 60 * 1000;
const translationWarmups = new Map<string, Promise<void>>();

interface UserEntryRow {
  id: string;
  title: string | null;
  created_at: string;
  geography_iso: string | null;
  ai_images: string[] | null;
  ai_geography: string | null;
  sensory_data: {
    sensory_patterns?: Array<{ sensation?: string }>;
    verification_keywords?: string[];
  } | null;
  content: string | null;
}

interface RelevanceReason {
  type: RelevanceType;
  detail: string;
  matchedPatterns?: string[];
  matchedKeywords?: string[];
  matchedEntries: Array<{ id: string; title: string; date: string }>;
}

interface EventWithTranslation extends NewsEvent {
  originalTitle?: string;
  originalDescription?: string;
}

interface TranslationCacheRow {
  source_hash: string;
  translated_text: string;
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

function tokenize(text: string): string[] {
  return normalizeWord(text)
    .split(/\s+/)
    .filter((w) => w.length > 3);
}

function getAudienceKey(audience: NewsAudienceProfile): string {
  return JSON.stringify({
    locale: audience.locale || 'en',
    preferredCountries: [...(audience.preferredCountries || [])].sort(),
    preferredRegions: [...(audience.preferredRegions || [])].sort(),
    preferredTopics: [...(audience.preferredTopics || [])].sort(),
  });
}

function buildAudienceProfileFromRequest(request: Request, locale: Locale): NewsAudienceProfile {
  const lang = (request.headers.get('accept-language') || '').toLowerCase();
  const country = (request.headers.get('x-vercel-ip-country') || '').toLowerCase();
  const audience: NewsAudienceProfile = {
    locale,
    preferredCountries: [],
    preferredRegions: [],
    preferredTopics: [],
  };

  if (country) {
    audience.preferredCountries?.push(country);
    if (country === 'pl') {
      audience.preferredCountries?.push('poland');
      audience.preferredRegions?.push('europe');
    }
  }

  if (lang.includes('pl')) {
    audience.preferredCountries?.push('pl', 'poland');
    audience.preferredRegions?.push('europe');
  }
  if (lang.includes('de')) audience.preferredCountries?.push('de', 'germany');
  if (lang.includes('fr')) audience.preferredCountries?.push('fr', 'france');
  if (lang.includes('it')) audience.preferredCountries?.push('it', 'italy');
  if (lang.includes('es')) audience.preferredCountries?.push('es', 'spain');

  if (locale === 'ru') {
    audience.preferredTopics?.push('iran', 'war', 'crypto', 'bitcoin');
  }

  return audience;
}

async function getEventsWithCache(audience: NewsAudienceProfile): Promise<NewsEvent[]> {
  const key = getAudienceKey(audience);
  const now = Date.now();
  const cached = eventsCache.get(key);
  if (cached && now - cached.timestamp < CACHE_TTL) {
    return cached.data;
  }
  const data = await fetchAllEvents(3, audience);
  eventsCache.set(key, { data, timestamp: now });
  return data;
}

function hashText(text: string): string {
  return crypto.createHash('sha256').update(text).digest('hex').slice(0, 16);
}

async function callClaudeTranslation(
  payload: Array<{ id: number; title: string }>
): Promise<Array<{ id: number; title: string }>> {
  if (!process.env.ANTHROPIC_API_KEY || payload.length === 0) return payload;
  const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const input = payload.map((item) => `${item.id}|${item.title}`).join('\n');

  const response = await anthropic.messages.create({
    model: getModel('utility'),
    max_tokens: 3000,
    temperature: 0,
    messages: [
      {
        role: 'user',
        content: `Переведи каждый заголовок новости на русский. Формат ответа: номер|перевод. Без пояснений.\n\n${input}`,
      },
    ],
  });

  const text = response.content.find((block) => block.type === 'text')?.text || '';
  const lines = text.trim().split('\n').filter(Boolean);
  const parsed = payload.map((item) => {
    const line = lines.find((row) => row.startsWith(`${item.id}|`));
    const translated = line?.split('|').slice(1).join('|').trim();
    return { id: item.id, title: translated || item.title };
  });
  return parsed;
}

async function applyCachedTranslations(
  events: EventWithTranslation[],
  locale: Locale,
  admin: ReturnType<typeof createAdminClient>
): Promise<EventWithTranslation[]> {
  if (locale === 'en') return events;

  const capped = events.slice(0, 30);
  const items = capped.map((event, id) => ({
    id,
    title: event.title,
    hash: hashText(event.title),
  }));

  const { data: cachedRaw } = await admin
    .from('translation_cache')
    .select('source_hash, translated_text')
    .eq('target_locale', locale)
    .in('source_hash', items.map((item) => item.hash));

  const cached = (cachedRaw || []) as TranslationCacheRow[];
  const cachedMap = new Map<string, string>(cached.map((row) => [row.source_hash, row.translated_text]));
  return events.map((event, idx) => {
    if (idx >= 30) return event;
    const src = items.find((item) => item.id === idx);
    const fromCacheRaw = src ? cachedMap.get(src.hash) : null;
    if (fromCacheRaw) {
      let cachedTitle = fromCacheRaw;
      if (fromCacheRaw.trim().startsWith('{')) {
        try {
          const parsed = JSON.parse(fromCacheRaw) as { title?: string };
          cachedTitle = parsed.title || cachedTitle;
        } catch {}
      }
      return {
        ...event,
        title: cachedTitle || event.title,
        originalTitle: event.title,
      };
    }
    return event;
  });
}

async function warmMissingTranslations(
  events: EventWithTranslation[],
  locale: Locale,
  admin: ReturnType<typeof createAdminClient>
): Promise<void> {
  if (locale === 'en' || events.length === 0) return;
  const capped = events.slice(0, 30);
  const items = capped.map((event, id) => ({
    id,
    title: event.title,
    hash: hashText(event.title),
  }));

  const warmupKey = `${locale}:${items.map((i) => i.hash).join(',')}`;
  if (translationWarmups.has(warmupKey)) return;

  const warmupPromise = (async () => {
    const { data: cachedRaw } = await admin
      .from('translation_cache')
      .select('source_hash')
      .eq('target_locale', locale)
      .in('source_hash', items.map((item) => item.hash));

    const existing = new Set((cachedRaw || []).map((row) => String((row as { source_hash: string }).source_hash)));
    const missing = items.filter((item) => !existing.has(item.hash));
    if (missing.length === 0) return;

    const translated = await callClaudeTranslation(missing.map((item) => ({ id: item.id, title: item.title })));
    const inserts = translated.map((item) => {
      const src = missing.find((m) => m.id === item.id);
      return {
        source_hash: src?.hash || hashText(src?.title || ''),
        source_text: src?.title || '',
        target_locale: locale,
        translated_text: item.title,
      };
    });

    if (inserts.length > 0) {
      await admin.from('translation_cache').upsert(inserts, { onConflict: 'source_hash,target_locale' });
    }
  })()
    .catch((error) => {
      console.error('[Events translation] Warmup failed:', error);
    })
    .finally(() => {
      translationWarmups.delete(warmupKey);
    });

  translationWarmups.set(warmupKey, warmupPromise);
}

function buildRelevanceReasons(
  event: NewsEvent,
  userEntries: UserEntryRow[],
  locale: Locale
): RelevanceReason[] {
  const reasons: RelevanceReason[] = [];
  const eventText = `${event.title} ${event.description || ''}`.toLowerCase();

  for (const entry of userEntries) {
    const eventGeo = normalizeWord(event.geography || '');
    const entryGeo = normalizeWord(entry.ai_geography || '');
    if (eventGeo && entryGeo && (eventGeo.includes(entryGeo) || entryGeo.includes(eventGeo))) {
      reasons.push({
        type: 'geography',
        detail:
          locale === 'ru'
            ? `Событие связано с регионом из вашей записи "${entry.title || (entry.content || '').slice(0, 40)}"`
            : `Event relates to the region from your entry "${entry.title || (entry.content || '').slice(0, 40)}"`,
        matchedEntries: [
          {
            id: entry.id,
            title: entry.title || (entry.content || '').slice(0, 50),
            date: entry.created_at,
          },
        ],
      });
      break;
    }
  }

  for (const entry of userEntries) {
    const keywords = entry.sensory_data?.verification_keywords || [];
    const matched = keywords.filter((keyword) => eventText.includes(keyword.toLowerCase()));
    if (matched.length > 0) {
      const patterns =
        entry.sensory_data?.sensory_patterns
          ?.map((p) => p.sensation || '')
          .filter(Boolean)
          .slice(0, 3) || [];
      reasons.push({
        type: 'sensory',
        detail:
          locale === 'ru'
            ? `Ваши ощущения (${patterns.join(', ') || 'паттерны'}) связаны с характером события`
            : `Your sensations (${patterns.join(', ') || 'patterns'}) relate to the nature of this event`,
        matchedPatterns: patterns,
        matchedKeywords: matched.slice(0, 5),
        matchedEntries: [
          {
            id: entry.id,
            title: entry.title || (entry.content || '').slice(0, 50),
            date: entry.created_at,
          },
        ],
      });
      break;
    }
  }

  for (const entry of userEntries) {
    const words = normalizeWord(entry.content || '')
      .split(/\s+/)
      .filter((w) => w.length > 4);
    const matched = words.filter((word) => eventText.includes(word));
    if (matched.length >= 2) {
      reasons.push({
        type: 'keywords',
        detail:
          locale === 'ru'
            ? 'Темы из вашей записи совпадают с событием'
            : 'Topics from your entry match this event',
        matchedKeywords: matched.slice(0, 5),
        matchedEntries: [
          {
            id: entry.id,
            title: entry.title || (entry.content || '').slice(0, 50),
            date: entry.created_at,
          },
        ],
      });
      break;
    }
  }

  return reasons;
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get('page') || 1));
  const limit = Math.min(50, Math.max(1, Number(searchParams.get('limit') || 20)));
  const section = (searchParams.get('section') || 'relevant') as Section;
  const locale = (searchParams.get('locale') || 'en') as Locale;

  const supabase = createServerSupabaseClient();
  const admin = createAdminClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const audience = buildAudienceProfileFromRequest(request, locale);
  const allEvents = await getEventsWithCache(audience);
  let localizedEvents: EventWithTranslation[] = allEvents.map((e) => ({ ...e }));
  if (locale === 'ru') {
    const now = Date.now();
    if (
      translatedEventsCache &&
      translatedEventsCache.locale === locale &&
      now - translatedEventsCache.timestamp < TRANSLATED_EVENTS_CACHE_TTL
    ) {
      localizedEvents = translatedEventsCache.data;
    } else {
      localizedEvents = await applyCachedTranslations(localizedEvents, locale, admin);
      void warmMissingTranslations(localizedEvents, locale, admin);
      translatedEventsCache = { data: localizedEvents, timestamp: now, locale };
    }
  }

  let sortedEvents = localizedEvents.map((event) => ({
    event,
    relevanceScore: 0,
    relevanceReasons: [] as RelevanceReason[],
  }));

  if (user && section === 'relevant') {
    const [{ data: profile }, { data: userEntries }] = await Promise.all([
      supabase.from('users').select('dominant_images, avg_specificity').eq('id', user.id).single(),
      supabase
        .from('entries')
        .select('id, title, created_at, geography_iso, ai_images, ai_geography, sensory_data, content')
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
    const geographyFragments = new Set<string>(
      Array.from(geographies).flatMap((g) => g.split(/\s+/).filter((w) => w.length > 2))
    );
    const keywords = new Set(extractKeywords(entries.map((e) => e.content || '').filter(Boolean)));
    const verificationKeywords = new Set(
      entries
        .flatMap((e) => e.sensory_data?.verification_keywords || [])
        .map((k) => normalizeWord(k))
        .filter((k) => k.length > 3)
    );
    const interestKeywords = new Set<string>([...keywords, ...verificationKeywords]);

    const userTextKeywords = new Set(
      entries
        .flatMap((e) => tokenize(`${e.title || ''} ${e.content || ''}`))
        .filter((w) => w.length > 4)
    );
    userTextKeywords.forEach((k) => interestKeywords.add(k));

    const userPrefersEurope =
      Array.from(geographies).some((g) => g.includes('pol') || g.includes('europe') || g.includes('eu')) ||
      Array.from(interestKeywords).some((k) => ['poland', 'europe', 'eu', 'ukraine'].includes(k));

    const userInterestInIranOrCrypto = Array.from(interestKeywords).some((k) =>
      ['iran', 'israel', 'middle', 'east', 'bitcoin', 'btc', 'crypto', 'ethereum'].includes(k)
    );

    sortedEvents = sortedEvents
      .map(({ event }) => {
        const haystack = normalizeWord(`${event.title} ${event.description || ''}`);
        const eventGeo = normalizeWord(event.geography || '');
        const eventGeoTokens = new Set(tokenize(eventGeo));
        const matchedInterest = Array.from(interestKeywords).filter((word) => word && haystack.includes(word));

        let relevanceScore = 0;
        if (eventGeo && geographies.has(eventGeo)) relevanceScore += 5;
        if (eventGeo && Array.from(geographyFragments).some((token) => token && eventGeo.includes(token))) relevanceScore += 3;
        if (Array.from(images).some((word) => word && haystack.includes(word))) relevanceScore += 2;
        relevanceScore += Math.min(6, matchedInterest.length * 2);
        if (Array.from(keywords).some((word) => word && haystack.includes(word))) relevanceScore += 1;

        if (userPrefersEurope && (eventGeo.includes('usa') || eventGeo.includes('united states'))) {
          relevanceScore -= 2;
        }
        if (
          userInterestInIranOrCrypto &&
          !haystack.includes('iran') &&
          !haystack.includes('israel') &&
          !haystack.includes('middle east') &&
          !haystack.includes('bitcoin') &&
          !haystack.includes('crypto')
        ) {
          relevanceScore -= 1;
        }
        if (eventGeoTokens.has('europe') || eventGeoTokens.has('poland')) relevanceScore += 1;

        const relevanceReasons = buildRelevanceReasons(
          { ...event, title: event.originalTitle || event.title, description: event.originalDescription || event.description },
          entries,
          locale
        );
        return { event, relevanceScore, relevanceReasons };
      })
      .filter(({ relevanceScore }) => relevanceScore > 0)
      .sort((a, b) => {
        if (b.relevanceScore !== a.relevanceScore) return b.relevanceScore - a.relevanceScore;
        return new Date(b.event.publishedAt).getTime() - new Date(a.event.publishedAt).getTime();
      });

    if (sortedEvents.length < 8) {
      const fallback = localizedEvents
        .map((event) => ({
          event,
          relevanceScore: 0,
          relevanceReasons: [] as RelevanceReason[],
        }))
        .sort((a, b) => new Date(b.event.publishedAt).getTime() - new Date(a.event.publishedAt).getTime());
      const seen = new Set(sortedEvents.map((item) => item.event.url));
      const merged = [...sortedEvents];
      for (const item of fallback) {
        if (seen.has(item.event.url)) continue;
        seen.add(item.event.url);
        merged.push(item);
      }
      sortedEvents = merged.slice(0, Math.max(20, sortedEvents.length));
    }
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
    events: pageData.map(({ event, relevanceScore, relevanceReasons }) => ({
      id: simpleHash(`${event.title}:${event.source}`),
      title: event.title,
      description: event.description || null,
      originalTitle: event.originalTitle || null,
      url: event.url,
      source: event.source,
      publishedAt: event.publishedAt.toISOString(),
      geography: event.geography || null,
      category: event.category || 'other',
      relevanceScore,
      relevanceReasons,
    })),
    total,
    page,
    hasMore: to < total,
    sources: ['newsapi', 'guardian', 'usgs'],
  });
}
