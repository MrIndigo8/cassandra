import type { SupabaseClient } from '@supabase/supabase-js';

export interface MatchData {
  id: string;
  entry_id: string;
  similarity_score: number;
  matched_symbols: string[];
  event_title: string;
  event_description?: string | null;
  event_url?: string | null;
  event_date: string;
  created_at: string;
  sensory_match?: {
    matched_sensations: string[];
    event_nature: string;
    mapping_quality: string;
  };
  geography_match?: {
    entry_geography: string | null;
    event_geography: string;
    match_type: string;
  };
  temporal_match?: {
    days_before_event: number;
    is_prediction: boolean;
  };
}

export function parseMatchRow(row: Record<string, unknown>): MatchData {
  let sensory_match: MatchData['sensory_match'];
  let geography_match: MatchData['geography_match'];
  let temporal_match: MatchData['temporal_match'];

  const raw = row.verification_data;
  if (raw) {
    try {
      const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
      if (parsed && typeof parsed === 'object') {
        const data = parsed as {
          sensory_match?: MatchData['sensory_match'];
          geography_match?: MatchData['geography_match'];
          temporal_match?: MatchData['temporal_match'];
        };
        sensory_match = data.sensory_match;
        geography_match = data.geography_match;
        temporal_match = data.temporal_match;
      }
    } catch {}
  }

  return {
    id: String(row.id || ''),
    entry_id: String(row.entry_id || ''),
    similarity_score: Number(row.similarity_score || 0),
    matched_symbols: Array.isArray(row.matched_symbols)
      ? (row.matched_symbols as string[]).filter(Boolean)
      : [],
    event_title: String(row.event_title || ''),
    event_description: (row.event_description as string | null) || null,
    event_url: (row.event_url as string | null) || null,
    event_date: String(row.event_date || row.created_at || ''),
    created_at: String(row.created_at || ''),
    sensory_match,
    geography_match,
    temporal_match,
  };
}

export async function getMatchForEntry(entryId: string, supabase: SupabaseClient) {
  const { data } = await supabase
    .from('matches')
    .select('*')
    .eq('entry_id', entryId)
    .gt('similarity_score', 0.6)
    .order('similarity_score', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) return null;
  return parseMatchRow(data as Record<string, unknown>);
}

export async function getMatchesForEntries(entryIds: string[], supabase: SupabaseClient) {
  if (entryIds.length === 0) return [];
  const { data } = await supabase
    .from('matches')
    .select('*')
    .in('entry_id', entryIds)
    .gt('similarity_score', 0.6)
    .order('similarity_score', { ascending: false });

  return ((data || []) as Record<string, unknown>[]).map(parseMatchRow);
}

/** Keep best-scoring match per entry when multiple rows exist. */
export function bestMatchPerEntry(matches: MatchData[]): Map<string, MatchData> {
  const map = new Map<string, MatchData>();
  for (const m of matches) {
    const prev = map.get(m.entry_id);
    if (!prev || m.similarity_score > prev.similarity_score) {
      map.set(m.entry_id, m);
    }
  }
  return map;
}
