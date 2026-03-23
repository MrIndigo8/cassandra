import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { runAnalysis } from "@/lib/analysis";
import { runVerification } from "@/lib/verification";
import { runClustering } from "@/lib/clustering";
import { fetchDreamSubreddits } from '@/lib/external/reddit';
import { fetchPolymarketEvents } from '@/lib/external/polymarket';

export const dynamic = 'force-dynamic';
export const maxDuration = 300; // 5 минут (максимум для Hobby)

/**
 * Единый endpoint для всех фоновых задач (Vercel Cron)
 * Позволяет обходить ограничение Hobby-плана (1 daily cron job)
 */
export async function GET(request: Request) {
    try {
        // Проверка авторизации (CRON_SECRET)
        const authHeader = request.headers.get('authorization');
        if (
            process.env.CRON_SECRET &&
            authHeader !== `Bearer ${process.env.CRON_SECRET}`
        ) {
            if (process.env.NODE_ENV !== 'development') {
                return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
            }
        }

        console.log('[Cron] Запуск объединенного цикла задач...');

        const supabase = createClient(
          process.env.NEXT_PUBLIC_SUPABASE_URL!,
          process.env.SUPABASE_SERVICE_ROLE_KEY!
        );

        // 0. Активация отложенных уведомлений
        console.log('[Cron] 0/3: Активация отложенных уведомлений...');
        await supabase
          .from('notifications')
          .update({ status: 'unread' })
          .eq('action_type', 'self_report')
          .eq('status', 'pending')
          .lte('scheduled_for', new Date().toISOString());

        // 1. Анализ новых записей (Claude)
        console.log('[Cron] 1/3: Запуск анализа записей...');
        const analysisResult = await runAnalysis();
        console.log('[Cron] Анализ завершен:', analysisResult);

        // 2. Проверка соответствия событиям (News API + Scoring)
        console.log('[Cron] 2/3: Запуск верификации событий...');
        const verificationResult = await runVerification();
        console.log('[Cron] Верификация завершена:', verificationResult);

        // 3. Кластеризация и поиск аномалий
        console.log('[Cron] 3/4: Запуск кластеризации...');
        const clusteringResult = await runClustering();
        console.log('[Cron] Кластеризация завершена:', clusteringResult);

        // 4. Внешний сбор (Reddit + Polymarket)
        console.log('[Cron] 4/4: Запуск интеграции внешних сигналов...');
        let savedReddit = 0;
        let savedPolymarket = 0;
        try {
          const redditSignals = await fetchDreamSubreddits();
          for (const signal of redditSignals) {
            const { error } = await supabase
              .from('external_signals')
              .upsert({
                source: 'reddit',
                external_id: signal.id,
                title: signal.title,
                content: signal.content,
                url: signal.url,
                published_at: signal.publishedAt.toISOString(),
                metadata: signal.metadata
              }, { onConflict: 'source,external_id', ignoreDuplicates: true });
            if (!error) savedReddit++;
          }

          const markets = await fetchPolymarketEvents();
          for (const market of markets) {
            const { error } = await supabase
              .from('external_signals')
              .upsert({
                source: 'polymarket',
                external_id: market.id,
                title: market.question,
                content: `Вероятность: ${Math.round(market.probability * 100)}% | Объём: $${Math.round(market.volume).toLocaleString()}`,
                published_at: new Date().toISOString(),
                metadata: {
                  probability: market.probability,
                  category: market.category,
                  endDate: market.endDate,
                  volume: market.volume
                }
              }, { onConflict: 'source,external_id', ignoreDuplicates: true });
            if (!error) savedPolymarket++;
          }
        } catch(e) {
          console.error('[Cron] Ошибка внешних сигналов:', e);
        }
        console.log(`[Cron] Интеграция завершена. Reddit: ${savedReddit}, Polymarket: ${savedPolymarket}`);

        return NextResponse.json({
            success: true,
            tasks: {
                analysis: analysisResult,
                verification: verificationResult,
                clustering: clusteringResult,
                external: { reddit: savedReddit, polymarket: savedPolymarket }
            },
            timestamp: new Date().toISOString()
        });

    } catch (error) {
        console.error('[Cron] Критическая ошибка в цикле задач:', error);
        return NextResponse.json(
            { error: 'Internal server error', details: error instanceof Error ? error.message : String(error) },
            { status: 500 }
        );
    }
}
