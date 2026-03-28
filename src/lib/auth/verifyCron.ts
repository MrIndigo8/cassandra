import { NextResponse } from 'next/server';

/**
 * Проверяет авторизацию cron-запроса.
 * Используется во всех cron-эндпоинтах вместо ручных проверок.
 * Требует переменную окружения CRON_SECRET.
 *
 * Для ручного или внешнего расписания: `GET|POST /api/analyze` и другие защищённые
 * маршруты — заголовок `Authorization: Bearer <CRON_SECRET>`. Вызовы Vercel Cron
 * без кастомных заголовков по умолчанию не проходят; используйте оркестратор `/api/cron`
 * или внешний cron с тем же Bearer.
 */
export function verifyCronAuth(request: Request): boolean {
  const auth = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;

  if (!cronSecret) {
    console.warn('[Auth] CRON_SECRET не установлен!');
    return false;
  }

  return auth === `Bearer ${cronSecret}`;
}

/**
 * Возвращает 401 ответ для неавторизованных cron-запросов.
 */
export function unauthorizedResponse() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
