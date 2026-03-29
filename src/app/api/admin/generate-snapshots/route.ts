import { NextResponse } from 'next/server';
import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { verifyCronAuth, unauthorizedResponse } from '@/lib/auth/verifyCron';
import { averageEmotionMaps, flattenEmotionalSpectrum } from '@/lib/scientific/emotion-spectrum';
import { calculateSocialForecast } from '@/lib/scientific/social-forecast';
import {
  buildGeoSnapshotUpsert,
  type DeepRow,
  getEntry,
  type PrevGeoSnap,
} from '@/lib/scientific/geo-snapshot-helpers';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

type PrevRow = {
  country_iso: string;
  avg_anxiety: number | null;
  internal_coherence: number | null;
  belief_patterns: unknown;
  period_start: string;
};

async function loadPrevGeoByCountry(
  supabase: SupabaseClient,
  countryIsos: string[],
  snapshotPeriod: string,
  before: string
): Promise<Map<string, PrevGeoSnap>> {
  const map = new Map<string, PrevGeoSnap>();
  if (countryIsos.length === 0) return map;

  const { data: rows } = await supabase
    .from('geo_snapshots')
    .select('country_iso, avg_anxiety, internal_coherence, belief_patterns, period_start')
    .in('country_iso', countryIsos)
    .eq('snapshot_period', snapshotPeriod)
    .lt('period_start', before);

  const bestByIso = new Map<string, PrevRow>();
  for (const row of (rows || []) as PrevRow[]) {
    const prev = bestByIso.get(row.country_iso);
    if (!prev || new Date(row.period_start) > new Date(prev.period_start)) {
      bestByIso.set(row.country_iso, row);
    }
  }

  bestByIso.forEach((row) => {
    map.set(row.country_iso, {
      avg_anxiety: row.avg_anxiety,
      internal_coherence: row.internal_coherence,
      belief_patterns: row.belief_patterns,
    });
  });
  return map;
}

export async function POST(request: Request) {
  if (!verifyCronAuth(request)) {
    return unauthorizedResponse();
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }

  const supabase = createClient(url, key);

  const now = new Date();
  const sixHoursAgo = new Date(now.getTime() - 6 * 60 * 60 * 1000);
  const sixHoursAgoIso = sixHoursAgo.toISOString();

  const { data: recentAnalyses, error: fetchErr } = await supabase
    .from('deep_analysis')
    .select(
      `
      entry_id,
      user_id,
      archetypes,
      narrative_structure,
      symbolic_elements,
      emotional_spectrum,
      entries:entry_id (
        ip_country_code,
        anxiety_score,
        threat_type,
        type
      )
    `
    )
    .gte('created_at', sixHoursAgoIso);

  if (fetchErr) {
    return NextResponse.json({ error: fetchErr.message }, { status: 500 });
  }

  const list = (recentAnalyses || []) as DeepRow[];

  if (list.length === 0) {
    return NextResponse.json({ geo_snapshots: 0, reason: 'no_data' });
  }

  const globalEmotionMaps: Record<string, number>[] = [];
  let globalEmotionCount = 0;
  for (const a of list) {
    const flat = flattenEmotionalSpectrum(a.emotional_spectrum);
    if (Object.keys(flat).length > 0) {
      globalEmotionMaps.push(flat);
      globalEmotionCount++;
    }
  }

  const globalSpectrumAvg =
    globalEmotionCount > 0
      ? averageEmotionMaps(globalEmotionMaps, globalEmotionCount)
      : {};

  const byCountry: Record<string, DeepRow[]> = {};
  for (const a of list) {
    const iso = getEntry(a)?.ip_country_code?.trim().toUpperCase();
    if (!iso || iso.length !== 2) continue;
    if (!byCountry[iso]) byCountry[iso] = [];
    byCountry[iso].push(a);
  }

  const eligibleIsos = Object.keys(byCountry).filter((iso) => byCountry[iso].length >= 3);

  const prevByCountry = await loadPrevGeoByCountry(
    supabase,
    eligibleIsos,
    '6h',
    sixHoursAgoIso
  );

  const geoResults: string[] = [];

  for (const iso of eligibleIsos) {
    const analyses = byCountry[iso];
    const rawPrev = prevByCountry.get(iso);
    const prevSnap: PrevGeoSnap = rawPrev
      ? {
          avg_anxiety: rawPrev.avg_anxiety,
          internal_coherence: rawPrev.internal_coherence,
          belief_patterns: rawPrev.belief_patterns,
        }
      : null;

    const payload = buildGeoSnapshotUpsert(
      iso,
      analyses,
      globalSpectrumAvg,
      prevSnap,
      sixHoursAgoIso,
      now.toISOString()
    );

    const { error: upErr } = await supabase
      .from('geo_snapshots')
      .upsert(payload, { onConflict: 'country_iso,snapshot_period,period_start' });

    if (!upErr) geoResults.push(iso);
  }

  let globalGenerated = false;
  const hour = now.getUTCHours();

  if (hour >= 3 && hour < 9) {
    const today = now.toISOString().split('T')[0]!;
    const { data: existing } = await supabase
      .from('global_snapshots')
      .select('id')
      .eq('snapshot_date', today)
      .maybeSingle();

    if (!existing) {
      const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      const { data: geoSnaps } = await supabase
        .from('geo_snapshots')
        .select('*')
        .gte('period_start', oneDayAgo.toISOString());

      if (geoSnaps && geoSnaps.length >= 3) {
        const globalEmotionSums: Record<string, number> = {};
        let totalEntries = 0;
        let totalUsers = 0;
        const countriesActive = new Set<string>();
        let coherenceWeighted = 0;
        let coherenceW = 0;

        for (const snap of geoSnaps) {
          const weight = snap.entry_count || 0;
          totalEntries += snap.entry_count || 0;
          totalUsers += snap.unique_users || 0;
          countriesActive.add(snap.country_iso);
          const spectrum = (snap.emotional_profile as { spectrum?: Record<string, number> })?.spectrum || {};
          for (const [em, val] of Object.entries(spectrum)) {
            globalEmotionSums[em] = (globalEmotionSums[em] || 0) + (val || 0) * weight;
          }
          if (snap.internal_coherence != null && weight > 0) {
            coherenceWeighted += snap.internal_coherence * weight;
            coherenceW += weight;
          }
        }

        const globalEmotional: Record<string, number> = {};
        for (const [em, sum] of Object.entries(globalEmotionSums)) {
          if (totalEntries > 0) {
            globalEmotional[em] = Math.round((sum / totalEntries) * 1000) / 1000;
          }
        }
        const globalDominantEmotion =
          Object.entries(globalEmotional).sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown';

        const globalArchCounts: Record<string, number> = {};
        for (const snap of geoSnaps) {
          const dist = (snap.archetype_profile as { distribution?: Record<string, number> })?.distribution || {};
          for (const [arch, score] of Object.entries(dist)) {
            globalArchCounts[arch] = (globalArchCounts[arch] || 0) + (score || 0) * (snap.entry_count || 0);
          }
        }

        const regionalBeliefs: Record<string, string> = {};
        for (const snap of geoSnaps) {
          const dn = (snap.belief_patterns as { dominant_narrative?: string } | null)?.dominant_narrative;
          if (dn) regionalBeliefs[snap.country_iso] = dn;
        }
        const globalNarrativeCounts: Record<string, number> = {};
        for (const n of Object.values(regionalBeliefs)) {
          globalNarrativeCounts[n] = (globalNarrativeCounts[n] || 0) + 1;
        }
        const globalDominantNarrative =
          Object.entries(globalNarrativeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown';

        const globalCoherence =
          coherenceW > 0 ? Math.round((coherenceWeighted / coherenceW) * 1000) / 1000 : null;

        const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000).toISOString().split('T')[0]!;
        const { data: prevGlobal } = await supabase
          .from('global_snapshots')
          .select('global_coherence')
          .eq('snapshot_date', yesterday)
          .maybeSingle();

        const coherenceChange =
          prevGlobal?.global_coherence != null && globalCoherence != null
            ? Math.round((globalCoherence - prevGlobal.global_coherence) * 1000) / 1000
            : null;

        const globalDominantArchetypes = Object.entries(globalArchCounts)
          .sort((a, b) => b[1] - a[1])
          .slice(0, 3)
          .map(([a]) => a);

        const weightSum = geoSnaps.reduce((s, g) => s + (g.entry_count || 0), 0);
        const globalForecast = calculateSocialForecast({
          avgAnxiety:
            weightSum > 0
              ? geoSnaps.reduce((s, g) => s + (g.avg_anxiety || 0) * (g.entry_count || 0), 0) / weightSum
              : 0,
          emotions: globalEmotional,
          dominantArchetypes: globalDominantArchetypes,
          dominantNarrative: globalDominantNarrative,
          coherence: globalCoherence ?? 0,
          entryCount: totalEntries,
          uniqueUsers: Math.max(1, Math.floor(totalUsers / Math.max(1, countriesActive.size))),
        });

        const { data: rs } = await supabase
          .from('reality_snapshots')
          .select('id')
          .eq('snapshot_date', today)
          .maybeSingle();

        await supabase.from('global_snapshots').insert({
          snapshot_date: today,
          global_emotional: {
            dominant: globalDominantEmotion,
            spectrum: globalEmotional,
            trend: coherenceChange != null && coherenceChange > 0 ? 'rising' : 'stable',
          },
          global_archetypes: {
            dominant: globalDominantArchetypes,
            distribution: globalArchCounts,
          },
          cross_region: {
            countries_sampled: countriesActive.size,
          },
          global_beliefs: {
            dominant_narrative: globalDominantNarrative,
            regional_variations: regionalBeliefs,
          },
          global_coherence: globalCoherence,
          coherence_change: coherenceChange,
          anomaly_count: 0,
          prediction_confidence:
            totalEntries >= 50 ? 0.8 : Math.round((totalEntries / 50) * 0.8 * 100) / 100,
          total_entries: totalEntries,
          total_users: totalUsers,
          countries_active: countriesActive.size,
          reality_snapshot_id: rs?.id ?? null,
          global_social_forecast: globalForecast.slice(0, 5),
        });

        globalGenerated = true;
      }
    }
  }

  return NextResponse.json({
    geo_snapshots: geoResults.length,
    countries: geoResults,
    global_generated: globalGenerated,
  });
}
