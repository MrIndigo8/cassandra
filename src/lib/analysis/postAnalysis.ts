import type { SupabaseClient } from '@supabase/supabase-js';
import type { ClaudeAnalysisResult } from '@/lib/claude/parser';
import { updateFingerprint } from '@/lib/scientific/fingerprint';

/**
 * Сохраняет «глубинный» слой из результата первого прохода Claude (без второго LLM-вызова).
 */
export async function syncDeepAnalysisFromPrimary(
  admin: SupabaseClient,
  entryId: string,
  userId: string,
  analysis: ClaudeAnalysisResult
): Promise<void> {
  const archetypes: string[] = [];
  if (analysis.threat_type) archetypes.push(analysis.threat_type);
  const pet = analysis.sensory_data?.potential_event_types;
  if (pet?.length) {
    for (const p of pet.slice(0, 4)) {
      if (p.event_type && !archetypes.includes(p.event_type)) archetypes.push(p.event_type);
    }
  }

  const symbolicElements = {
    verification_keywords: analysis.sensory_data?.verification_keywords ?? [],
    collectivity: analysis.sensory_data?.collectivity,
    potential_event_types: analysis.sensory_data?.potential_event_types ?? [],
  };

  const emotionalSpectrum = {
    emotions: analysis.emotions,
    emotional_intensity: analysis.emotional_intensity,
    anxiety_score: analysis.anxiety_score,
  };

  const cognitiveMarkers = {
    specificity: analysis.specificity,
    temporal_urgency: analysis.temporal_urgency,
    scale: analysis.scale,
  };

  const { error } = await admin.from('deep_analysis').upsert(
    {
      entry_id: entryId,
      user_id: userId,
      archetypes: archetypes.slice(0, 12),
      narrative_structure: analysis.summary?.slice(0, 2000) || null,
      symbolic_elements: symbolicElements,
      emotional_spectrum: emotionalSpectrum,
      cognitive_markers: cognitiveMarkers,
      is_recurring: false,
      recurring_elements: [],
    },
    { onConflict: 'entry_id' }
  );

  if (error) {
    console.warn('[deep_analysis] upsert:', error.message);
  }
}

export async function runPostAnalysisPipeline(
  admin: SupabaseClient,
  entryId: string,
  userId: string,
  analysis: ClaudeAnalysisResult
): Promise<void> {
  try {
    await syncDeepAnalysisFromPrimary(admin, entryId, userId, analysis);
  } catch (e) {
    console.warn('[postAnalysis] deep:', e);
  }
  try {
    await updateFingerprint(admin, userId);
  } catch (e) {
    console.warn('[postAnalysis] fingerprint:', e);
  }
}
