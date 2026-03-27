import { NextResponse } from 'next/server';
import { getAdminContext } from '@/lib/admin/auth';

export async function GET() {
  const { context, response } = await getAdminContext('moderator');
  if (!context) return response!;

  const s = context.adminSupabase;
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString();
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const monthAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

  const [{ count: usersTotal }, { count: entriesTotal }, { count: matchesTotal }] = await Promise.all([
    s.from('users').select('id', { count: 'exact', head: true }),
    s.from('entries').select('id', { count: 'exact', head: true }),
    s.from('matches').select('id', { count: 'exact', head: true }),
  ]);

  const [activeTodayQ, active7dQ, active30dQ, newTodayQ, new7dQ] = await Promise.all([
    s.from('entries').select('user_id').gte('created_at', dayAgo),
    s.from('entries').select('user_id').gte('created_at', weekAgo),
    s.from('entries').select('user_id').gte('created_at', monthAgo),
    s.from('users').select('id', { count: 'exact', head: true }).gte('created_at', dayAgo),
    s.from('users').select('id', { count: 'exact', head: true }).gte('created_at', weekAgo),
  ]);

  const { data: usersByRoleRows } = await s.from('users').select('role');
  const byRole: Record<string, number> = {
    architect: 0,
    admin: 0,
    moderator: 0,
    oracle: 0,
    sensitive: 0,
    chronicler: 0,
    observer: 0,
    banned: 0,
  };
  (usersByRoleRows || []).forEach((r) => {
    const key = String(r.role || 'observer');
    byRole[key] = (byRole[key] || 0) + 1;
  });

  const { data: topUsers } = await s
    .from('users')
    .select('id, username, rating_score, role, verified_count, total_entries, streak_count')
    .order('rating_score', { ascending: false })
    .limit(10);

  const [{ count: entriesToday }, { count: entriesWeek }, { count: entriesMonth }] = await Promise.all([
    s.from('entries').select('id', { count: 'exact', head: true }).gte('created_at', dayAgo),
    s.from('entries').select('id', { count: 'exact', head: true }).gte('created_at', weekAgo),
    s.from('entries').select('id', { count: 'exact', head: true }).gte('created_at', monthAgo),
  ]);

  const { data: entriesMeta } = await s
    .from('entries')
    .select('type, scope, anxiety_score, is_quarantine, ai_analyzed_at');

  const byType: Record<string, number> = { dream: 0, premonition: 0, feeling: 0, vision: 0, unknown: 0 };
  const byScope: Record<string, number> = { world: 0, personal: 0, unknown: 0 };
  let anxietySum = 0;
  let anxietyCount = 0;
  let quarantined = 0;
  let analyzed = 0;
  let notAnalyzed = 0;
  (entriesMeta || []).forEach((e) => {
    byType[String(e.type || 'unknown')] = (byType[String(e.type || 'unknown')] || 0) + 1;
    byScope[String(e.scope || 'unknown')] = (byScope[String(e.scope || 'unknown')] || 0) + 1;
    if (typeof e.anxiety_score === 'number') {
      anxietySum += e.anxiety_score;
      anxietyCount += 1;
    }
    if (e.is_quarantine) quarantined += 1;
    if (e.ai_analyzed_at) analyzed += 1;
    else notAnalyzed += 1;
  });

  const [{ count: matchesWeek }, { data: matchMeta }, { data: bestMatch }] = await Promise.all([
    s.from('matches').select('id', { count: 'exact', head: true }).gte('created_at', weekAgo),
    s.from('matches').select('similarity_score, verification_data'),
    s
      .from('matches')
      .select('similarity_score, event_title, entries:entry_id(title, users:user_id(username))')
      .order('similarity_score', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  let avgScore = 0;
  const byThreatType: Record<string, number> = {};
  if (matchMeta?.length) {
    avgScore = matchMeta.reduce((acc, m) => acc + Number(m.similarity_score || 0), 0) / matchMeta.length;
    matchMeta.forEach((m) => {
      const threat = String((m.verification_data as { threat_type?: string } | null)?.threat_type || 'unknown');
      byThreatType[threat] = (byThreatType[threat] || 0) + 1;
    });
  }

  const [{ count: commentsToday }, { count: reactionsToday }, { count: viewsToday }, { count: selfReportsTotal }, { count: communityConfirmations }] = await Promise.all([
    s.from('comments').select('id', { count: 'exact', head: true }).gte('created_at', dayAgo),
    s.from('reactions').select('id', { count: 'exact', head: true }).gte('created_at', dayAgo),
    s.from('entry_views').select('id', { count: 'exact', head: true }).gte('viewed_at', dayAgo),
    s.from('self_reports').select('id', { count: 'exact', head: true }),
    s.from('community_confirmations').select('id', { count: 'exact', head: true }),
  ]);

  const [{ count: entriesAwaitingAnalysis }, { count: clustersActive }, { count: translationsCached }, { data: featuresRows }, { data: latestAnalyze }, { data: latestVerify }, { data: latestCluster }] = await Promise.all([
    s.from('entries').select('id', { count: 'exact', head: true }).is('ai_analyzed_at', null),
    s.from('clusters').select('id', { count: 'exact', head: true }).eq('is_resolved', false),
    s.from('translation_cache').select('id', { count: 'exact', head: true }),
    s.from('system_settings').select('key, value').like('key', 'features.%'),
    s.from('admin_actions').select('created_at').eq('action_type', 'run_analyze').order('created_at', { ascending: false }).limit(1).maybeSingle(),
    s.from('admin_actions').select('created_at').eq('action_type', 'run_verify').order('created_at', { ascending: false }).limit(1).maybeSingle(),
    s.from('admin_actions').select('created_at').eq('action_type', 'run_cluster').order('created_at', { ascending: false }).limit(1).maybeSingle(),
  ]);

  const features: Record<string, boolean> = {};
  (featuresRows || []).forEach((row) => {
    features[String(row.key)] = Boolean((row.value as { enabled?: boolean } | null)?.enabled ?? true);
  });

  return NextResponse.json({
    users: {
      total: usersTotal || 0,
      activeToday: new Set((activeTodayQ.data || []).map((r) => r.user_id)).size,
      active7d: new Set((active7dQ.data || []).map((r) => r.user_id)).size,
      active30d: new Set((active30dQ.data || []).map((r) => r.user_id)).size,
      newToday: newTodayQ.count || 0,
      new7d: new7dQ.count || 0,
      byRole,
      topByRating: topUsers || [],
    },
    entries: {
      total: entriesTotal || 0,
      today: entriesToday || 0,
      week: entriesWeek || 0,
      month: entriesMonth || 0,
      byType,
      byScope,
      avgAnxietyScore: anxietyCount > 0 ? Math.round((anxietySum / anxietyCount) * 100) / 100 : 0,
      quarantined,
      analyzed,
      notAnalyzed,
    },
    matches: {
      total: matchesTotal || 0,
      thisWeek: matchesWeek || 0,
      avgScore: Math.round(avgScore * 1000) / 1000,
      byThreatType,
      bestMatch: bestMatch
        ? {
            entry_title: (bestMatch.entries as { title?: string } | null)?.title || null,
            event_title: bestMatch.event_title || null,
            score: bestMatch.similarity_score || 0,
            user_username: ((bestMatch.entries as { users?: { username?: string } } | null)?.users as { username?: string } | undefined)?.username || null,
          }
        : null,
    },
    activity: {
      commentsToday: commentsToday || 0,
      reactionsToday: reactionsToday || 0,
      viewsToday: viewsToday || 0,
      selfReportsTotal: selfReportsTotal || 0,
      communityConfirmations: communityConfirmations || 0,
    },
    ai: {
      entriesAnalyzed: analyzed,
      entriesAwaitingAnalysis: entriesAwaitingAnalysis || 0,
      verificationsRun: matchesTotal || 0,
      clustersActive: clustersActive || 0,
      translationsCached: translationsCached || 0,
    },
    system: {
      features,
      lastAnalyzeRun: latestAnalyze?.created_at || null,
      lastVerifyRun: latestVerify?.created_at || null,
      lastClusterRun: latestCluster?.created_at || null,
    },
  });
}
