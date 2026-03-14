// ============================================================
// Supabase — хелпер для Next.js Middleware
// Обновление сессии при каждом запросе
// ============================================================

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({
            request,
          });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // ВАЖНО: НЕ удалять этот вызов — он обновляет сессию
  // Подавляем предупреждение о неиспользуемой переменной
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Защита маршрутов: если нет сессии — редирект на логин
  // Исключения: публичные страницы
  const publicPaths = ['/', '/login', '/register'];
  const isPublicPath = publicPaths.some(
    (path) => request.nextUrl.pathname === path
  );
  const isApiPath = request.nextUrl.pathname.startsWith('/api/');
  const isStaticPath = request.nextUrl.pathname.startsWith('/_next/');

  if (!user && !isPublicPath && !isApiPath && !isStaticPath) {
    const url = request.nextUrl.clone();
    url.pathname = '/login';
    return NextResponse.redirect(url);
  }

  // Если залогинен и на странице логина — редирект в ленту
  if (user && (request.nextUrl.pathname === '/login' || request.nextUrl.pathname === '/register')) {
    const url = request.nextUrl.clone();
    url.pathname = '/feed';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
