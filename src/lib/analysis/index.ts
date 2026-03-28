import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { analyzeEntry } from '@/lib/claude/client';
import type { ClaudeAnalysisResult } from '@/lib/claude/parser';
import { averageEmbeddings, generateEmbedding, parseEmbeddingValue, toVectorLiteral } from '@/lib/embeddings';
import { runPostAnalysisPipeline } from '@/lib/analysis/postAnalysis';

export type EntryAnalysisRow = {
  id: string;
  user_id: string;
  content: string;
  type: string | null;
  direction: string | null;
  timeframe: string | null;
  quality: string | null;
};

/**
 * Записывает результат Claude в `entries`, эмбеддинг, пост-пайплайн и baseline пользователя.
 */
export async function applyClaudeAnalysisToEntry(
  supabaseAdmin: SupabaseClient,
  entry: EntryAnalysisRow,
  analysis: ClaudeAnalysisResult
): Promise<boolean> {
  const embedding = await generateEmbedding(entry.content);

  const { error: updateError } = await supabaseAdmin
    .from('entries')
    .update({
      title: analysis.title,
      type: analysis.type,
      ai_images: analysis.sensory_data?.verification_keywords || [],
      ai_emotions: analysis.emotions,
      ai_scale: analysis.scale,
      ai_geography: analysis.sensory_data?.geography_clues?.explicit || null,
      ai_specificity: analysis.specificity,
      ai_summary: analysis.summary,
      anxiety_score: analysis.anxiety_score,
      threat_type: analysis.threat_type,
      temporal_urgency: analysis.temporal_urgency,
      emotional_intensity: analysis.emotional_intensity,
      geography_iso: analysis.geography_iso,
      sensory_data: analysis.sensory_data,
      user_insight: analysis.user_insight,
      prediction_potential: analysis.prediction_potential,
      embedding: embedding ? toVectorLiteral(embedding) : null,
      ai_analyzed_at: new Date().toISOString(),
    })
    .eq('id', entry.id);

  if (updateError) {
    console.error(`[Analysis] Ошибка обновления записи ${entry.id}:`, updateError);
    return false;
  }

  await runPostAnalysisPipeline(supabaseAdmin, entry.id, entry.user_id, analysis);

  if (entry.user_id) {
    const { data: userEmbeddings } = await supabaseAdmin
      .from('entries')
      .select('embedding')
      .eq('user_id', entry.user_id)
      .not('embedding', 'is', null)
      .limit(500);
    const vectors = (userEmbeddings || [])
      .map((row) => parseEmbeddingValue((row as { embedding: unknown }).embedding))
      .filter((arr) => arr.length > 0);
    const baseline = averageEmbeddings(vectors);
    if (baseline) {
      await supabaseAdmin
        .from('users')
        .update({ dream_baseline_embedding: toVectorLiteral(baseline) })
        .eq('id', entry.user_id);
    }
  }

  return true;
}

async function processOneEntry(
  supabaseAdmin: SupabaseClient,
  entry: EntryAnalysisRow,
  analysis: ClaudeAnalysisResult
): Promise<boolean> {
  return applyClaudeAnalysisToEntry(supabaseAdmin, entry, analysis);
}

/** Снижает гонку: другой воркер мог уже выставить ai_analyzed_at (например POST sync). */
async function entryStillUnanalyzed(
  supabaseAdmin: SupabaseClient,
  entryId: string
): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from('entries')
    .select('id')
    .eq('id', entryId)
    .is('ai_analyzed_at', null)
    .maybeSingle();
  return Boolean(data);
}

/**
 * Обрабатывает конкретные записи по id (для немедленного анализа после POST /api/entries).
 */
export async function runAnalysisForEntryIds(entryIds: string[]): Promise<{ processed: number }> {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !supabaseServiceKey || entryIds.length === 0) {
    return { processed: 0 };
  }

  const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
    auth: { persistSession: false },
  });

  const uniqueIds = Array.from(new Set(entryIds)).slice(0, 5);

  const { data: entries, error: fetchError } = await supabaseAdmin
    .from('entries')
    .select('id, user_id, content, type, direction, timeframe, quality')
    .in('id', uniqueIds)
    .is('ai_analyzed_at', null);

  if (fetchError) {
    console.error('[Analysis] runAnalysisForEntryIds fetch:', fetchError);
    return { processed: 0 };
  }

  if (!entries?.length) {
    return { processed: 0 };
  }

  let processedCount = 0;

  for (const entry of entries) {
    try {
      if (!(await entryStillUnanalyzed(supabaseAdmin, entry.id))) continue;

      const analysis = await analyzeEntry(
        entry.content,
        entry.type,
        entry.direction,
        entry.timeframe,
        entry.quality
      );
      if (analysis) {
        if (!(await entryStillUnanalyzed(supabaseAdmin, entry.id))) continue;
        const ok = await processOneEntry(supabaseAdmin, entry, analysis);
        if (ok) processedCount++;
      }
    } catch (entryError) {
      console.error(`[Analysis] runAnalysisForEntryIds ${entry.id}:`, entryError);
    }
  }

  return { processed: processedCount };
}

/**
 * Пакетный анализ до 10 необработанных записей (cron).
 */
export async function runAnalysis(): Promise<{ processed: number }> {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('[Analysis] Missing Supabase admin keys');
      return { processed: 0 };
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    const { data: entries, error: fetchError } = await supabaseAdmin
      .from('entries')
      .select('id, user_id, content, type, direction, timeframe, quality')
      .is('ai_analyzed_at', null)
      .limit(10);

    if (fetchError) {
      console.error('[Analysis] Ошибка получения записей:', fetchError);
      return { processed: 0 };
    }

    if (!entries || entries.length === 0) {
      console.log('[Analysis] Нет новых записей для анализа.');
      return { processed: 0 };
    }

    let processedCount = 0;

    for (const entry of entries) {
      try {
        if (!(await entryStillUnanalyzed(supabaseAdmin, entry.id))) continue;

        const analysis = await analyzeEntry(
          entry.content,
          entry.type,
          entry.direction,
          entry.timeframe,
          entry.quality
        );

        if (analysis) {
          if (!(await entryStillUnanalyzed(supabaseAdmin, entry.id))) continue;
          const ok = await processOneEntry(supabaseAdmin, entry, analysis);
          if (ok) processedCount++;
        }
      } catch (entryError) {
        console.error(`[Analysis] Ошибка обработки записи ${entry.id}:`, entryError);
      }
    }

    return { processed: processedCount };
  } catch (error) {
    console.error('[Analysis] Необработанная ошибка:', error);
    return { processed: 0 };
  }
}
