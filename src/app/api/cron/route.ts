import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { runAnalysis } from "@/lib/analysis";
import { runVerification } from "@/lib/verification";
import { runClustering } from "@/lib/clustering";

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
        console.log('[Cron] 3/3: Запуск кластеризации...');
        const clusteringResult = await runClustering();
        console.log('[Cron] Кластеризация завершена:', clusteringResult);

        return NextResponse.json({
            success: true,
            tasks: {
                analysis: analysisResult,
                verification: verificationResult,
                clustering: clusteringResult
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
