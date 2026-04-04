import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { analyzeEntry } from '@/lib/claude/client';
import type { ClaudeAnalysisResult } from '@/lib/claude/parser';
import { averageEmbeddings, generateEmbedding, parseEmbeddingValue, toVectorLiteral } from '@/lib/embeddings';
import { runPostAnalysisPipeline } from '@/lib/analysis/postAnalysis';

const STUCK_ANALYSIS_MS = 10 * 60 * 1000;

/** Сбрасывает зависшие in_progress старше 10 минут → failed. Вызывать в начале /api/analyze. */
export async function recoverStuckAnalysisLocks(supabaseAdmin: SupabaseClient): Promise<number> {
  const threshold = new Date(Date.now() - STUCK_ANALYSIS_MS).toISOString();
  const { data, error } = await supabaseAdmin
    .from('entries')
    .update({ analysis_status: 'failed', analysis_started_at: null })
    .eq('analysis_status', 'in_progress')
    .not('analysis_started_at', 'is', null)
    .lt('analysis_started_at', threshold)
    .select('id');

  if (error) {
    console.error('[Analysis] recoverStuckAnalysisLocks:', error);
    return 0;
  }
  return data?.length ?? 0;
}

/**
 * Атомарно: pending → in_progress. Если 0 строк — другой воркер уже взял запись.
 */
export async function claimEntryForAnalysis(
  supabaseAdmin: SupabaseClient,
  entryId: string
): Promise<boolean> {
  const now = new Date().toISOString();
  const { data, error } = await supabaseAdmin
    .from('entries')
    .update({
      analysis_status: 'in_progress',
      analysis_started_at: now,
    })
    .eq('id', entryId)
    .eq('analysis_status', 'pending')
    .select('id');

  if (error) {
    console.warn('[Analysis] claimEntryForAnalysis:', error.message);
    return false;
  }
  return Array.isArray(data) && data.length > 0;
}

export async function setEntryAnalysisFailed(
  supabaseAdmin: SupabaseClient,
  entryId: string
): Promise<void> {
  await supabaseAdmin
    .from('entries')
    .update({ analysis_status: 'failed', analysis_started_at: null })
    .eq('id', entryId);
}

/** Вернуть блокировку (например после таймаута синхронного анализа), чтобы cron мог повторить. */
export async function releaseAnalysisLockToPending(
  supabaseAdmin: SupabaseClient,
  entryId: string
): Promise<void> {
  await supabaseAdmin
    .from('entries')
    .update({ analysis_status: 'pending', analysis_started_at: null })
    .eq('id', entryId)
    .eq('analysis_status', 'in_progress');
}

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
      analysis_status: 'completed',
      analysis_started_at: null,
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

async function processOneEntryAfterClaim(
  supabaseAdmin: SupabaseClient,
  entry: EntryAnalysisRow,
  analysis: ClaudeAnalysisResult
): Promise<boolean> {
  return applyClaudeAnalysisToEntry(supabaseAdmin, entry, analysis);
}

/**
 * Захват записи (pending→in_progress), вызов Claude, запись результата или failed.
 */
async function analyzeSingleEntryWithLock(
  supabaseAdmin: SupabaseClient,
  entry: EntryAnalysisRow
): Promise<boolean> {
  const claimed = await claimEntryForAnalysis(supabaseAdmin, entry.id);
  if (!claimed) return false;

  try {
    const analysis = await analyzeEntry(
      entry.content,
      entry.type,
      entry.direction,
      entry.timeframe,
      entry.quality
    );
    if (!analysis) {
      await setEntryAnalysisFailed(supabaseAdmin, entry.id);
      return false;
    }
    const ok = await processOneEntryAfterClaim(supabaseAdmin, entry, analysis);
    if (!ok) {
      await setEntryAnalysisFailed(supabaseAdmin, entry.id);
    }
    return ok;
  } catch (entryError) {
    console.error(`[Analysis] analyzeSingleEntryWithLock ${entry.id}:`, entryError);
    await setEntryAnalysisFailed(supabaseAdmin, entry.id);
    return false;
  }
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
    .eq('analysis_status', 'pending');

  if (fetchError) {
    console.error('[Analysis] runAnalysisForEntryIds fetch:', fetchError);
    return { processed: 0 };
  }

  if (!entries?.length) {
    return { processed: 0 };
  }

  let processedCount = 0;

  for (const entry of entries) {
    const ok = await analyzeSingleEntryWithLock(supabaseAdmin, entry);
    if (ok) processedCount++;
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
      .eq('analysis_status', 'pending')
      .order('created_at', { ascending: true })
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
      const ok = await analyzeSingleEntryWithLock(supabaseAdmin, entry);
      if (ok) processedCount++;
    }

    return { processed: processedCount };
  } catch (error) {
    console.error('[Analysis] Необработанная ошибка:', error);
    return { processed: 0 };
  }
}
