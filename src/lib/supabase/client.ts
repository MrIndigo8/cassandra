// ============================================================
// Supabase — браузерный клиент
// Используется в Client Components ('use client')
// ============================================================

import { createBrowserClient } from '@supabase/ssr';

// Кэшируем клиент в браузере (синглтон),
// чтобы избежать блокировок (Gotrue lock errors: "Lock broken by another request").
// Привязан к конкретному URL+key — при смене env (не происходит в рантайме) создастся новый.
let browserClient: ReturnType<typeof createBrowserClient> | undefined;

export function createClient() {
  if (typeof window === 'undefined') {
    // На сервере (Server Components) всегда создаем новый инстанс
    return createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }

  // В браузере (Client Components) переиспользуем один и тот же инстанс.
  // createBrowserClient из @supabase/ssr уже корректно обрабатывает смену сессий
  // через onAuthStateChange — при логауте/логине токен обновляется внутри клиента,
  // новый инстанс не нужен.
  if (!browserClient) {
    browserClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }

  return browserClient;
}

/** Сброс клиента — вызывать при явном logout для чистоты. */
export function resetBrowserClient() {
  browserClient = undefined;
}
