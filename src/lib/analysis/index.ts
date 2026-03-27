import { createClient } from '@supabase/supabase-js';
import { analyzeEntry } from '@/lib/claude/client';
import { averageEmbeddings, generateEmbedding, parseEmbeddingValue, toVectorLiteral } from '@/lib/embeddings';

/**
 * Основная функция анализа записей
 * Выбирает до 10 необработанных записей и анализирует их через Claude
 */
export async function runAnalysis(): Promise<{ processed: number }> {
    try {
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

        if (!supabaseUrl || !supabaseServiceKey) {
            console.error("[Analysis] Missing Supabase admin keys");
            return { processed: 0 };
        }

        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
            auth: { persistSession: false },
        });

        // Получаем записи, которые еще не анализировались
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
                const analysis = await analyzeEntry(entry.content, entry.type, entry.direction, entry.timeframe, entry.quality);
                const embedding = await generateEmbedding(entry.content);

                if (analysis) {
                    // Сохраняем результат
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
                            embedding: embedding ? toVectorLiteral(embedding) : null,
                            ai_analyzed_at: new Date().toISOString(),
                        })
                        .eq('id', entry.id);

                    if (updateError) {
                        console.error(`[Analysis] Ошибка обновления записи ${entry.id}:`, updateError);
                    } else {
                        // Обновляем baseline embedding пользователя как среднее по всем embeddings его записей.
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
                        processedCount++;
                    }
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
