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

  // Убираем префиксы локалей из пути
  let pathWithoutLocale = request.nextUrl.pathname;
  if (pathWithoutLocale.startsWith('/en/') || pathWithoutLocale === '/en') {
    pathWithoutLocale = pathWithoutLocale.replace(/^\/en/, '') || '/';
  }
  if (pathWithoutLocale.startsWith('/ru/') || pathWithoutLocale === '/ru') {
    pathWithoutLocale = pathWithoutLocale.replace(/^\/ru/, '') || '/';
  }

  // Защита маршрутов: если нет сессии — редирект на логин
  // Исключения: публичные страницы
  const publicPaths = ['/', '/login', '/register', '/terms', '/privacy'];
  const isPublicPath = publicPaths.some(
    (path) => pathWithoutLocale === path
  );
  const isApiPath = request.nextUrl.pathname.startsWith('/api/');
  const isStaticPath = request.nextUrl.pathname.startsWith('/_next/');

  if (!user && !isPublicPath && !isApiPath && !isStaticPath) {
    const url = request.nextUrl.clone();
    // Сохраняем префикс если он был
    const prefix = request.nextUrl.pathname.startsWith('/en') ? '/en' : '';
    url.pathname = `${prefix}/login`;
    return NextResponse.redirect(url);
  }

  // Если залогинен и на странице логина — редирект в ленту
  if (user && (pathWithoutLocale === '/login' || pathWithoutLocale === '/register')) {
    const url = request.nextUrl.clone();
    const prefix = request.nextUrl.pathname.startsWith('/en') ? '/en' : '';
    url.pathname = `${prefix}/feed`;
    return NextResponse.redirect(url);
  }

  // Admin routes guard
  const pathname = request.nextUrl.pathname;
  const isAdminPath =
    pathname.startsWith('/admin') ||
    pathname.startsWith('/ru/admin') ||
    pathname.startsWith('/en/admin');

  if (isAdminPath) {
    if (!user) {
      const url = request.nextUrl.clone();
      const prefix = pathname.startsWith('/en') ? '/en' : '';
      url.pathname = `${prefix}/login`;
      return NextResponse.redirect(url);
    }

    const { data: profile } = await supabase
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single();

    if (!profile || !['architect', 'admin', 'moderator'].includes(profile.role)) {
      const url = request.nextUrl.clone();
      const prefix = pathname.startsWith('/en') ? '/en' : '';
      url.pathname = `${prefix}/feed`;
      return NextResponse.redirect(url);
    }
  }

  return supabaseResponse;
}
