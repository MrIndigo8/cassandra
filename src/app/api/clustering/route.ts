import { NextResponse } from 'next/server';
import { runClustering } from '@/lib/clustering';

/**
 * Endpoint для запуска кластеризации
 * /api/clustering
 */
export async function POST(request: Request) {
  try {
    // В идеале здесь должна быть проверка на авторизацию админа или cron-секрета
    const authHeader = request.headers.get('authorization');
    if (
      process.env.CRON_SECRET &&
      authHeader !== `Bearer ${process.env.CRON_SECRET}` &&
      authHeader !== `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
    ) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Запускаем асинхронно, не ожидая полного завершения для HTTP-ответа
    // чтобы Vercel не убил функцию по таймауту (если кластеризация займет > 10с)
    runClustering().catch(console.error);

    return NextResponse.json({ 
      status: 'success', 
      message: 'Кластеризация запущена в фоне' 
    });
  } catch (error) {
    console.error('[API Clustering] Ошибка:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
