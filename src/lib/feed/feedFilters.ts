/** Фильтры ленты: общие типы для SSR и клиента (Supabase `.in('type', …)`). */

export type FeedFilterKey = 'all' | 'dreams' | 'premonitions' | 'anxieties' | 'thoughts' | 'mine' | 'community' | 'verified' | 'clusters';

const FEED_FILTER_TYPE_LISTS: Record<'dreams' | 'premonitions' | 'anxieties' | 'thoughts', string[]> = {
  dreams: ['dream'],
  premonitions: ['premonition', 'vision', 'deja_vu', 'synchronicity'],
  anxieties: ['anxiety'],
  thoughts: ['thought', 'mood', 'sensation', 'feeling'],
};

export function typesForFeedFilter(key: FeedFilterKey): string[] | null {
  if (key in FEED_FILTER_TYPE_LISTS) return FEED_FILTER_TYPE_LISTS[key as keyof typeof FEED_FILTER_TYPE_LISTS];
  return null;
}

export function isValidFeedFilter(s: string | undefined): s is FeedFilterKey {
  return (
    s === 'all' ||
    s === 'dreams' ||
    s === 'premonitions' ||
    s === 'anxieties' ||
    s === 'thoughts' ||
    s === 'mine' ||
    s === 'community' ||
    s === 'verified' ||
    s === 'clusters'
  );
}

export function parseFeedFilterParam(raw: string | string[] | undefined): FeedFilterKey {
  const s = Array.isArray(raw) ? raw[0] : raw;
  if (s && isValidFeedFilter(s)) return s;
  return 'all';
}

export function matchesFeedFilter(entryType: string, key: FeedFilterKey): boolean {
  const types = typesForFeedFilter(key);
  if (!types) return true;
  return types.includes(entryType || 'unknown');
}
