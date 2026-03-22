// ============================================================
// Next.js Middleware — точка входа
// Обновляет Supabase сессию при каждом запросе
// ============================================================

import { type NextRequest, NextResponse } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';
import createMiddleware from 'next-intl/middleware';

const intlMiddleware = createMiddleware({
  locales: ['ru', 'en'],
  defaultLocale: 'ru',
  localePrefix: 'as-needed' // русский язык без префикса, английский с префиксом /en
});

export async function middleware(request: NextRequest) {
  // Сначала проверяем авторизацию
  const supabaseResponse = await updateSession(request);
  
  // Если Supabase решил сделать редирект (например, не авторизован -> /login)
  // Мы применяем intlMiddleware к этому редиректу, или просто возвращаем его,
  // Но лучше применить intlMiddleware к request, чтобы добавить локаль.
  // Дадим next-intl сгенерировать правильный response для текущего запроса.
  const intlResponse = intlMiddleware(request);
  
  // Копируем куки сессии из ответа Supabase в ответ next-intl
  supabaseResponse.cookies.getAll().forEach(cookie => {
    intlResponse.cookies.set(cookie.name, cookie.value);
  });

  // Воспроизводим редирект Supabase, если он был (например на /login)
  // Но с учетом локали:
  if (supabaseResponse.headers.has('location')) {
    const location = supabaseResponse.headers.get('location')!;
    // Создаем новый редирект, сохраняя куки
    const redirectResponse = NextResponse.redirect(location);
    intlResponse.cookies.getAll().forEach(cookie => {
      redirectResponse.cookies.set(cookie.name, cookie.value);
    });
    return redirectResponse;
  }

  return intlResponse;
}

export const config = {
  matcher: [
    // Обрабатывать все пути, кроме статики и API
    '/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};
