import type { SupabaseClient } from '@supabase/supabase-js';
import { flattenEmotionalSpectrum, averageEmotionMaps } from '@/lib/scientific/emotion-spectrum';
import { inferBeliefNarrative } from '@/lib/scientific/narrative-infer';

type EntryAggRow = {
  ai_images: string[] | null;
  threat_type: string | null;
  sensory_data: {
    verification_keywords?: string[];
    potential_event_types?: Array<{ event_type?: string }>;
  } | null;
};

type DeepRow = {
  entry_id: string;
  archetypes: string[] | null;
  narrative_structure: string | null;
  symbolic_elements: { verification_keywords?: string[] } | null;
  emotional_spectrum: unknown;
  created_at: string;
  entries: { anxiety_score: number | null; threat_type: string | null } | null | Array<{
    anxiety_score: number | null;
    threat_type: string | null;
  }>;
};

function getDeepEntry(a: DeepRow): { anxiety_score: number | null; threat_type: string | null } | null {
  const e = a.entries;
  if (!e) return null;
  return Array.isArray(e) ? e[0] ?? null : e;
}

function emotionDistance(a: Record<string, number>, b: Record<string, number>): number {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)]);
  let sum = 0;
  for (const k of Array.from(keys)) {
    const d = (a[k] || 0) - (b[k] || 0);
    sum += d * d;
  }
  return Math.sqrt(sum);
}

/**
 * Агрегирует символьные и психические паттерны по записям и deep_analysis, upsert в symbolic_fingerprints.
 */
export async function updateFingerprint(admin: SupabaseClient, userId: string): Promise<void> {
  const { data: deepRows, error: deepErr } = await admin
    .from('deep_analysis')
    .select(
      `
      entry_id,
      archetypes,
      narrative_structure,
      symbolic_elements,
      emotional_spectrum,
      created_at,
      entries:entry_id ( anxiety_score, threat_type )
    `
    )
    .eq('user_id', userId)
    .order('created_at', { ascending: true });

  const { data: existing } = await admin
    .from('symbolic_fingerprints')
    .select('*')
    .eq('user_id', userId)
    .maybeSingle();

  const { data: entryRows, error: entErr } = await admin
    .from('entries')
    .select('ai_images, threat_type, sensory_data')
    .eq('user_id', userId)
    .not('ai_analyzed_at', 'is', null)
    .limit(500);

  if (deepErr) {
    console.warn('[fingerprint] deep_analysis:', deepErr.message);
  }
  if (entErr) {
    console.warn('[fingerprint] select entries:', entErr.message);
    return;
  }

  const analyses = (deepRows || []) as unknown as DeepRow[];
  const list = (entryRows || []) as EntryAggRow[];

  const symbolFrequency: Record<string, number> = {};
  const archetypeCounts: Record<string, number> = {};

  for (const row of list) {
    for (const img of row.ai_images || []) {
      const k = String(img).toLowerCase().slice(0, 64);
      if (!k) continue;
      symbolFrequency[k] = (symbolFrequency[k] || 0) + 1;
    }
    const tt = row.threat_type;
    if (tt) archetypeCounts[tt] = (archetypeCounts[tt] || 0) + 1;
    const kws = row.sensory_data?.verification_keywords;
    if (kws) {
      for (const w of kws) {
        const key = String(w).toLowerCase().slice(0, 48);
        if (!key) continue;
        symbolFrequency[key] = (symbolFrequency[key] || 0) + 0.5;
      }
    }
    const pets = row.sensory_data?.potential_event_types;
    if (pets) {
      for (const p of pets) {
        const et = p.event_type;
        if (et) archetypeCounts[`event:${et}`] = (archetypeCounts[`event:${et}`] || 0) + 0.25;
      }
    }
  }

  for (const a of analyses) {
    for (const kw of a.symbolic_elements?.verification_keywords || []) {
      const key = String(kw).toLowerCase().slice(0, 48);
      if (!key) continue;
      symbolFrequency[key] = (symbolFrequency[key] || 0) + 1;
    }
    for (const arch of a.archetypes || []) {
      if (!arch) continue;
      archetypeCounts[arch] = (archetypeCounts[arch] || 0) + 1;
    }
  }

  const emotionMaps: Record<string, number>[] = [];
  for (const a of analyses) {
    const flat = flattenEmotionalSpectrum(a.emotional_spectrum);
    if (Object.keys(flat).length > 0) emotionMaps.push(flat);
  }

  const emotional_baseline =
    emotionMaps.length > 0 ? averageEmotionMaps(emotionMaps, emotionMaps.length) : {};

  const dominant_archetypes = Object.entries(archetypeCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([k]) => k);

  const narrative_profile = {
    top_symbols: Object.entries(symbolFrequency)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([sym, n]) => ({ sym, n })),
  };

  const cognitive_profile =
    existing && typeof existing.cognitive_profile === 'object' && existing.cognitive_profile
      ? (existing.cognitive_profile as Record<string, unknown>)
      : {};

  const predictive_patterns = Array.isArray(existing?.predictive_patterns)
    ? existing?.predictive_patterns
    : [];

  let current_state: Record<string, unknown> = {};
  type EmoPoint = { date: string; dominant: string; anxiety: number | null };
  type ArchPoint = { date: string; dominant: string; archetypes: string[] };

  let emotional_trajectory: EmoPoint[] = Array.isArray(existing?.emotional_trajectory)
    ? ([...(existing.emotional_trajectory as EmoPoint[])])
    : [];
  let archetype_trajectory: ArchPoint[] = Array.isArray(existing?.archetype_trajectory)
    ? ([...(existing.archetype_trajectory as ArchPoint[])])
    : [];
  let anomaly_entries: string[] = Array.isArray(existing?.anomaly_entries)
    ? [...(existing.anomaly_entries as string[])]
    : [];

  if (analyses.length > 0) {
    const recent5 = analyses.slice(-5);
    const recentEmotions: Record<string, number> = {};
    let recentCount = 0;
    for (const a of recent5) {
      const flat = flattenEmotionalSpectrum(a.emotional_spectrum);
      if (Object.keys(flat).length === 0) continue;
      recentCount++;
      for (const [em, val] of Object.entries(flat)) {
        recentEmotions[em] = (recentEmotions[em] || 0) + val;
      }
    }
    const currentDominantEmotion =
      recentCount > 0
        ? Object.entries(recentEmotions).sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown'
        : 'unknown';

    const recentArchetypes: Record<string, number> = {};
    for (const a of recent5) {
      for (const arch of a.archetypes || []) {
        if (!arch) continue;
        recentArchetypes[arch] = (recentArchetypes[arch] || 0) + 1;
      }
    }
    const currentDominantArchetype =
      Object.entries(recentArchetypes).sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown';

    const recentNarratives: Record<string, number> = {};
    for (const a of recent5) {
      const mode = inferBeliefNarrative(
        a.narrative_structure,
        getDeepEntry(a)?.threat_type ?? null
      );
      recentNarratives[mode] = (recentNarratives[mode] || 0) + 1;
    }
    const currentNarrative =
      Object.entries(recentNarratives).sort((a, b) => b[1] - a[1])[0]?.[0] || 'unknown';

    const baselineAnxiety =
      typeof emotional_baseline.anxiety === 'number' ? emotional_baseline.anxiety * 10 : null;
    const recentAnxietyScores = recent5
      .map((a) => getDeepEntry(a)?.anxiety_score)
      .filter((s): s is number => s != null && typeof s === 'number');
    const recentAvgAnxiety =
      recentAnxietyScores.length > 0
        ? recentAnxietyScores.reduce((x, y) => x + y, 0) / recentAnxietyScores.length
        : null;

    let anxiety_trend: 'rising' | 'falling' | 'stable' = 'stable';
    if (baselineAnxiety != null && recentAvgAnxiety != null) {
      const d = recentAvgAnxiety - baselineAnxiety;
      if (d > 0.5) anxiety_trend = 'rising';
      else if (d < -0.5) anxiety_trend = 'falling';
    }

    current_state = {
      dominant_emotion: currentDominantEmotion,
      dominant_archetype: currentDominantArchetype,
      narrative_mode: currentNarrative,
      anxiety_trend,
      updated_at: new Date().toISOString(),
    };

    const today = new Date().toISOString().split('T')[0]!;
    emotional_trajectory = emotional_trajectory.filter(
      (p: { date?: string }) => p?.date !== today
    );
    emotional_trajectory.push({
      date: today,
      dominant: currentDominantEmotion,
      anxiety: recentAvgAnxiety,
    });
    if (emotional_trajectory.length > 90) {
      emotional_trajectory = emotional_trajectory.slice(-90);
    }

    archetype_trajectory = archetype_trajectory.filter((p: { date?: string }) => p?.date !== today);
    archetype_trajectory.push({
      date: today,
      dominant: currentDominantArchetype,
      archetypes: Object.entries(recentArchetypes)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([x]) => x),
    });
    if (archetype_trajectory.length > 90) {
      archetype_trajectory = archetype_trajectory.slice(-90);
    }

    const baselineForDist =
      Object.keys(emotional_baseline).length > 0 ? emotional_baseline : { anxiety: 0 };
    anomaly_entries = [];
    for (const a of analyses) {
      const flat = flattenEmotionalSpectrum(a.emotional_spectrum);
      if (Object.keys(flat).length === 0) continue;
      const d = emotionDistance(flat, baselineForDist);
      if (d > 0.85) anomaly_entries.push(a.entry_id);
    }
    if (anomaly_entries.length > 64) anomaly_entries = anomaly_entries.slice(-64);
  }

  const total_dreams_analyzed = analyses.length > 0 ? analyses.length : list.length;

  const { error: upErr } = await admin.from('symbolic_fingerprints').upsert(
    {
      user_id: userId,
      symbol_frequency: symbolFrequency,
      dominant_archetypes,
      narrative_profile,
      emotional_baseline,
      cognitive_profile,
      predictive_patterns,
      total_dreams_analyzed,
      updated_at: new Date().toISOString(),
      current_state,
      emotional_trajectory,
      archetype_trajectory,
      anomaly_entries,
    },
    { onConflict: 'user_id' }
  );

  if (upErr) {
    console.warn('[fingerprint] upsert:', upErr.message);
  }
}
