import { createServerSupabaseClient } from '@/lib/supabase/server';
import EventsClient from './EventsClient';

export const dynamic = 'force-dynamic';

export default async function EventsPage() {
  const supabase = createServerSupabaseClient();

  const { data: matches } = await supabase
    .from('matches')
    .select(`
      id, event_title, event_description, event_url, event_date,
      similarity_score, matched_symbols, verification_data, created_at,
      entries:entry_id (id, title, content, type, geography_iso, ai_images, ai_summary, created_at,
        users:user_id (id, username, avatar_url, role, rating_score))
    `)
    .gt('similarity_score', 0.6)
    .order('created_at', { ascending: false })
    .limit(5);

  const { data: clusters } = await supabase
    .from('clusters')
    .select('id, title, description, dominant_images, intensity_score, unique_users, entry_count, started_at')
    .eq('is_resolved', false)
    .order('intensity_score', { ascending: false })
    .limit(3);

  return <EventsClient initialMatches={matches || []} initialClusters={clusters || []} />;
}
