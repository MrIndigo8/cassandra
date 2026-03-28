import { createAdminClient, createServerSupabaseClient } from '@/lib/supabase/server';
import DiscoveriesClient, { type DiscoveriesMatchRow } from './DiscoveriesClient';
import { isFeatureEnabled } from '@/lib/features';
import { FeatureDisabled } from '@/components/FeatureDisabled';
import type { HistoricalCase } from '../archive/ArchiveClient';

export const dynamic = 'force-dynamic';

const MATCH_SELECT_FULL = `
  id, user_id, event_title, event_description, event_url, event_date,
  similarity_score, matched_symbols, verification_data, created_at,
  entries:entry_id (id, title, content, type, threat_type, geography_iso, ai_images, ai_summary, created_at,
    users:user_id (id, username, avatar_url, role, rating_score))
`;

const MATCH_SELECT_NO_AI_IMAGES = `
  id, user_id, event_title, event_description, event_url, event_date,
  similarity_score, matched_symbols, verification_data, created_at,
  entries:entry_id (id, title, content, type, threat_type, geography_iso, ai_summary, created_at,
    users:user_id (id, username, avatar_url, role, rating_score))
`;

const MATCH_SELECT_MINIMAL = `
  id, user_id, event_title, event_description, event_url, event_date,
  similarity_score, matched_symbols, created_at,
  entries:entry_id (id, title, content, type, threat_type, geography_iso, ai_summary, created_at,
    users:user_id (id, username, avatar_url, role, rating_score))
`;

export default async function DiscoveriesPage() {
  if (!(await isFeatureEnabled('discoveries'))) {
    return <FeatureDisabled navKey="discoveries" />;
  }

  const supabase = createServerSupabaseClient();
  const admin = createAdminClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const [
    matchesResult,
    { data: clusters, error: clustersErr },
    { data: cases, error: casesErr },
    snapshotResult,
  ] = await Promise.all([
    (async () => {
      for (const sel of [MATCH_SELECT_FULL, MATCH_SELECT_NO_AI_IMAGES, MATCH_SELECT_MINIMAL]) {
        const r = await admin
          .from('matches')
          .select(sel)
          .gt('similarity_score', 0.6)
          .order('created_at', { ascending: false })
          .limit(80);
        if (!r.error) return r;
        console.warn('[discoveries] matches select retry:', r.error.message);
      }
      return { data: null as unknown, error: { message: 'matches select failed' } };
    })(),
    admin
      .from('clusters')
      .select('id, title, description, dominant_images, intensity_score, unique_users, entry_count, started_at')
      .eq('is_resolved', false)
      .order('intensity_score', { ascending: false })
      .limit(3),
    admin.from('historical_cases').select('*').order('date_of_event', { ascending: false }),
    admin
      .from('reality_snapshots')
      .select(
        'id, snapshot_date, dominant_scenes, emotional_weather, archetype_activity, coherence_index, coherence_change, anomalies, prediction, total_entries_analyzed, total_users, created_at'
      )
      .order('snapshot_date', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const matches = matchesResult.data as DiscoveriesMatchRow[] | null;
  const matchesErr = matchesResult.error;
  if (matchesErr) console.warn('[discoveries] matches:', matchesErr.message);
  if (clustersErr) console.warn('[discoveries] clusters:', clustersErr.message);
  if (casesErr) console.warn('[discoveries] historical_cases:', casesErr.message);
  if (snapshotResult.error) console.warn('[discoveries] reality_snapshots:', snapshotResult.error.message);

  const snapshot = snapshotResult.error ? null : snapshotResult.data;

  return (
    <DiscoveriesClient
      initialMatches={(matches || []) as DiscoveriesMatchRow[]}
      currentUserId={user?.id ?? null}
      initialClusters={clusters || []}
      initialCases={(cases || []) as HistoricalCase[]}
      latestSnapshot={snapshot ?? null}
    />
  );
}
