import type { SupabaseClient } from '@supabase/supabase-js';

type EntryAggRow = {
  ai_images: string[] | null;
  threat_type: string | null;
  sensory_data: {
    verification_keywords?: string[];
    potential_event_types?: Array<{ event_type?: string }>;
  } | null;
};

/**
 * Агрегирует символьные паттерны по проанализированным записям пользователя и upsert в symbolic_fingerprints.
 */
export async function updateFingerprint(admin: SupabaseClient, userId: string): Promise<void> {
  const { data: rows, error } = await admin
    .from('entries')
    .select('ai_images, threat_type, sensory_data')
    .eq('user_id', userId)
    .not('ai_analyzed_at', 'is', null)
    .limit(500);

  if (error) {
    console.warn('[fingerprint] select entries:', error.message);
    return;
  }

  const list = (rows || []) as EntryAggRow[];
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

  const { error: upErr } = await admin.from('symbolic_fingerprints').upsert(
    {
      user_id: userId,
      symbol_frequency: symbolFrequency,
      dominant_archetypes,
      narrative_profile,
      emotional_baseline: {},
      cognitive_profile: {},
      predictive_patterns: [],
      total_dreams_analyzed: list.length,
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' }
  );

  if (upErr) {
    console.warn('[fingerprint] upsert:', upErr.message);
  }
}
