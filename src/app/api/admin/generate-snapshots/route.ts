import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyCronAuth, unauthorizedResponse } from '@/lib/auth/verifyCron';
import {
  averageEmotionMaps,
  centroidEmotionCoherence,
  flattenEmotionalSpectrum,
} from '@/lib/scientific/emotion-spectrum';
import { inferBeliefNarrative } from '@/lib/scientific/narrative-infer';
import { calculateSocialForecast } from '@/lib/scientific/social-forecast';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

type EntryJoin = {
  ip_country_code: string | null;
  anxiety_score: number | null;
  threat_type: string | null;
  type: string | null;
};

type DeepRow = {
  entry_id: string;
  user_id: string;
  archetypes: string[] | null;
  narrative_structure: string | null;
  symbolic_elements: {
    verification_keywords?: string[];
  } | null;
  emotional_spectrum: unknown;
  entries: EntryJoin | EntryJoin[] | null;
};

function getEntry(a: DeepRow): EntryJoin | null {
  const e = a.entries;
  if (!e) return null;
  return Array.isArray(e) ? e[0] || null : e;
}

function mostCommon(arr: string[]): string {
  const counts: Record<string, number> = {};
  for (const v of arr) counts[v] = (counts[v] || 0) + 1;
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'neutral';
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
    .gte('created_at', sixHoursAgo.toISOString());

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

  const geoResults: string[] = [];

  for (const [iso, analyses] of Object.entries(byCountry)) {
    if (analyses.length < 3) continue;

    const emotionMaps: Record<string, number>[] = [];
    let emotionCount = 0;
    for (const a of analyses) {
      const flat = flattenEmotionalSpectrum(a.emotional_spectrum);
      if (Object.keys(flat).length > 0) {
        emotionMaps.push(flat);
        emotionCount++;
      }
    }

    const emotionalProfile =
      emotionCount > 0 ? averageEmotionMaps(emotionMaps, emotionCount) : {};

    const vsGlobal: Record<string, number> = {};
    for (const [em, val] of Object.entries(emotionalProfile)) {
      const g = globalSpectrumAvg[em] ?? 0;
      vsGlobal[em] = Math.round((val - g) * 1000) / 1000;
    }

    const dominantEmotions = Object.entries(emotionalProfile)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([emotion, score]) => ({ emotion, score }));

    const archetypeCounts: Record<string, number> = {};
    for (const a of analyses) {
      for (const arch of a.archetypes || []) {
        if (!arch) continue;
        archetypeCounts[arch] = (archetypeCounts[arch] || 0) + 1;
      }
    }
    const totalArchetypes = Object.values(archetypeCounts).reduce((s, c) => s + c, 0) || 1;
    const archetypeDistribution: Record<string, number> = {};
    for (const [arch, count] of Object.entries(archetypeCounts)) {
      archetypeDistribution[arch] = Math.round((count / totalArchetypes) * 100) / 100;
    }
    const dominantArchetypes = Object.entries(archetypeCounts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([x]) => x);

    const narrativeCounts: Record<string, number> = {};
    for (const a of analyses) {
      const ent = getEntry(a);
      const mode = inferBeliefNarrative(a.narrative_structure, ent?.threat_type ?? null);
      narrativeCounts[mode] = (narrativeCounts[mode] || 0) + 1;
    }
    const totalNarratives = Object.values(narrativeCounts).reduce((s, c) => s + c, 0) || 1;
    const narrativeDistribution: Record<string, number> = {};
    for (const [n, count] of Object.entries(narrativeCounts)) {
      narrativeDistribution[n] = Math.round((count / totalNarratives) * 100) / 100;
    }
    const dominantNarrative =
      Object.entries(narrativeCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'fragmented';

    const symbolMap: Record<string, { count: number; valences: string[]; users: Set<string> }> = {};
    for (const a of analyses) {
      const kws = a.symbolic_elements?.verification_keywords || [];
      const inten = (() => {
        const es = a.emotional_spectrum as { emotional_intensity?: string } | null;
        return es?.emotional_intensity || 'neutral';
      })();
      for (const kw of kws) {
        const sym = String(kw).toLowerCase().slice(0, 64);
        if (!sym) continue;
        if (!symbolMap[sym]) symbolMap[sym] = { count: 0, valences: [], users: new Set() };
        symbolMap[sym].count++;
        symbolMap[sym].valences.push(inten);
        symbolMap[sym].users.add(a.user_id);
      }
    }
    const dominantSymbols = Object.entries(symbolMap)
      .sort((a, b) => b[1].count - a[1].count)
      .slice(0, 10)
      .map(([symbol, data]) => ({
        symbol,
        count: data.count,
        uniqueUsers: data.users.size,
        avgValence: mostCommon(data.valences),
      }));

    const anxietyScores = analyses
      .map((x) => getEntry(x)?.anxiety_score)
      .filter((s): s is number => s != null && typeof s === 'number');
    const avgAnxiety =
      anxietyScores.length > 0
        ? Math.round((anxietyScores.reduce((a, b) => a + b, 0) / anxietyScores.length) * 10) / 10
        : null;

    const typeDistribution: Record<string, number> = {};
    for (const a of analyses) {
      const ty = getEntry(a)?.type || 'unknown';
      typeDistribution[ty] = (typeDistribution[ty] || 0) + 1;
    }

    const uniqueUsers = new Set(analyses.map((a) => a.user_id)).size;

    const internalCoherence =
      emotionMaps.length >= 2 ? centroidEmotionCoherence(emotionMaps) : null;

    const { data: prevSnap } = await supabase
      .from('geo_snapshots')
      .select('avg_anxiety, internal_coherence, belief_patterns, dominant_symbols')
      .eq('country_iso', iso)
      .eq('snapshot_period', '6h')
      .lt('period_start', sixHoursAgo.toISOString())
      .order('period_start', { ascending: false })
      .limit(1)
      .maybeSingle();

    const trends: Record<string, unknown> = {};
    if (prevSnap?.avg_anxiety != null && avgAnxiety != null) {
      trends.anxiety_change = Math.round((avgAnxiety - prevSnap.avg_anxiety) * 100) / 100;
    }
    if (prevSnap?.internal_coherence != null && internalCoherence != null) {
      trends.coherence_change = Math.round((internalCoherence - prevSnap.internal_coherence) * 100) / 100;
    }
    const prevDom = (prevSnap?.belief_patterns as { dominant_narrative?: string } | null)
      ?.dominant_narrative;
    if (prevDom && prevDom !== dominantNarrative) {
      trends.narrative_shift = `${prevDom}→${dominantNarrative}`;
    }

    const signals: Array<{ type: string; severity: number; description: string }> = [];
    if (prevSnap?.avg_anxiety != null && avgAnxiety != null && prevSnap.avg_anxiety > 0) {
      const pct = ((avgAnxiety - prevSnap.avg_anxiety) / prevSnap.avg_anxiety) * 100;
      if (pct >= 25) {
        signals.push({
          type: 'anxiety_spike',
          severity: Math.min(1, pct / 100),
          description: `Anxiety up ${Math.round(pct)}% vs previous window`,
        });
      }
    }

    const forecast = calculateSocialForecast({
      avgAnxiety: avgAnxiety ?? 0,
      emotions: emotionalProfile,
      dominantArchetypes,
      dominantNarrative,
      coherence: internalCoherence ?? 0,
      entryCount: analyses.length,
      uniqueUsers,
    });

    const { error: upErr } = await supabase.from('geo_snapshots').upsert(
      {
        country_iso: iso,
        snapshot_period: '6h',
        period_start: sixHoursAgo.toISOString(),
        period_end: now.toISOString(),
        emotional_profile: {
          dominant_emotions: dominantEmotions,
          spectrum: emotionalProfile,
          vs_global: vsGlobal,
        },
        archetype_profile: {
          dominant: dominantArchetypes,
          distribution: archetypeDistribution,
        },
        belief_patterns: {
          dominant_narrative: dominantNarrative,
          distribution: narrativeDistribution,
        },
        dominant_symbols: dominantSymbols,
        avg_anxiety: avgAnxiety,
        max_anxiety: anxietyScores.length > 0 ? Math.max(...anxietyScores) : null,
        entry_count: analyses.length,
        unique_users: uniqueUsers,
        type_distribution: typeDistribution,
        internal_coherence: internalCoherence,
        trends,
        signals,
        social_forecast: forecast.slice(0, 5),
      },
      { onConflict: 'country_iso,snapshot_period,period_start' }
    );

    if (!upErr) geoResults.push(iso);
  }

  const hour = now.getUTCHours();
  let globalGenerated = false;

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

        const globalForecast = calculateSocialForecast({
          avgAnxiety:
            geoSnaps.reduce((s, g) => s + (g.avg_anxiety || 0) * (g.entry_count || 0), 0) /
              Math.max(1, geoSnaps.reduce((s, g) => s + (g.entry_count || 0), 0)) || 0,
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
