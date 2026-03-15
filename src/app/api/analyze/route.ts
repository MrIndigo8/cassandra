import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { analyzeEntry } from '@/lib/claude/client';

export const maxDuration = 60; // Максимальное время выполнения (Vercel Hobby plan = 10-60s)

export async function POST() {
  try {
    // В Vercel Cron запросы приходят с хедером Authorization: Bearer <CRON_SECRET>
    // Здесь можно добавить простую защиту, если нужно:
    // const authHeader = request.headers.get('authorization');
    // if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Инициализируем admin-клиент Supabase, так как cron-джоб работает без сессии юзера
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!supabaseUrl || !supabaseServiceKey) {
      console.error("Missing Supabase admin keys");
      return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
    }

    const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
      auth: { persistSession: false },
    });

    // Получаем записи, которые еще не анализировались
    const { data: entries, error: fetchError } = await supabaseAdmin
      .from('entries')
      .select('id, content, type, direction, timeframe, quality')
      .is('ai_analyzed_at', null)
      .limit(10);

    if (fetchError) {
      console.error('Ошибка получения записей:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch entries' }, { status: 500 });
    }

    if (!entries || entries.length === 0) {
      return NextResponse.json({ processed: 0 });
    }

    let processedCount = 0;

    for (const entry of entries) {
      try {
        const analysis = await analyzeEntry(entry.content, entry.type, entry.direction, entry.timeframe, entry.quality);

        if (analysis) {
          // Сохраняем результат
          const { error: updateError } = await supabaseAdmin
            .from('entries')
            .update({
              ai_images: analysis.images,
              ai_emotions: analysis.emotions,
              ai_scale: analysis.scale,
              ai_geography: analysis.geography,
              ai_specificity: analysis.specificity,
              ai_summary: analysis.summary,
              ai_analyzed_at: new Date().toISOString(),
            })
            .eq('id', entry.id);

          if (updateError) {
            console.error(`Ошибка обновления записи ${entry.id}:`, updateError);
          } else {
            processedCount++;
          }
        }
      } catch (entryError) {
        console.error(`Ошибка обработки записи ${entry.id}:`, entryError);
        // Продолжаем со следующей записью
      }
    }

    return NextResponse.json({ processed: processedCount });

  } catch (error) {
    console.error('Необработанная ошибка в cron-job:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
