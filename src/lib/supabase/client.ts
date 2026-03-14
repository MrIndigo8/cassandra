// ============================================================
// Supabase — браузерный клиент
// Используется в Client Components ('use client')
// ============================================================

import { createBrowserClient } from '@supabase/ssr';

// Кэшируем клиент в браузере (синглтон), 
// чтобы избежать блокировок (Gotrue lock errors: "Lock broken by another request")
let browserClient: ReturnType<typeof createBrowserClient> | undefined;

export function createClient() {
  if (typeof window === 'undefined') {
    // На сервере (Server Components) всегда создаем новый инстанс
    return createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }

  // В браузере (Client Components) переиспользуем один и тот же инстанс
  if (!browserClient) {
    browserClient = createBrowserClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    );
  }

  return browserClient;
}
