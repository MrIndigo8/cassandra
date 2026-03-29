import {
  averageEmotionMaps,
  centroidEmotionCoherence,
  flattenEmotionalSpectrum,
} from '@/lib/scientific/emotion-spectrum';
import { inferBeliefNarrative } from '@/lib/scientific/narrative-infer';
import { calculateSocialForecast } from '@/lib/scientific/social-forecast';

export type EntryJoin = {
  ip_country_code: string | null;
  anxiety_score: number | null;
  threat_type: string | null;
  type: string | null;
};

export type DeepRow = {
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

export function getEntry(a: DeepRow): EntryJoin | null {
  const e = a.entries;
  if (!e) return null;
  return Array.isArray(e) ? e[0] || null : e;
}

export function mostCommon(arr: string[]): string {
  const counts: Record<string, number> = {};
  for (const v of arr) counts[v] = (counts[v] || 0) + 1;
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'neutral';
}

export type PrevGeoSnap = {
  avg_anxiety: number | null;
  internal_coherence: number | null;
  belief_patterns: unknown;
} | null;

/**
 * Строка для upsert в geo_snapshots (одна страна, одно окно).
 */
export function buildGeoSnapshotUpsert(
  iso: string,
  analyses: DeepRow[],
  globalSpectrumAvg: Record<string, number>,
  prevSnap: PrevGeoSnap,
  periodStart: string,
  periodEnd: string
): Record<string, unknown> {
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

  const trends: Record<string, unknown> = {};
  if (prevSnap?.avg_anxiety != null && avgAnxiety != null) {
    trends.anxiety_change = Math.round((avgAnxiety - prevSnap.avg_anxiety) * 100) / 100;
  }
  if (prevSnap?.internal_coherence != null && internalCoherence != null) {
    trends.coherence_change =
      Math.round((internalCoherence - prevSnap.internal_coherence) * 100) / 100;
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

  return {
    country_iso: iso,
    snapshot_period: '6h',
    period_start: periodStart,
    period_end: periodEnd,
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
  };
}
