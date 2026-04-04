/**
 * Цепочечный мок Supabase для Vitest (admin или browser-паттерн).
 * Задавайте `mockSupabaseState` перед вызовом обработчика маршрута.
 */
export type MockQueryResult<T = unknown> = { data: T; error: unknown };

export const mockSupabaseState = {
  fromImpl: null as
    | ((table: string) => Record<string, unknown>)
    | null,
};

/** Минимальный chainable `.from().select().eq()...` */
export function createChainableMock(defaultResult: MockQueryResult = { data: null, error: null }) {
  const mk = {
    select: () => mk,
    insert: () => mk,
    update: () => mk,
    delete: () => mk,
    eq: () => mk,
    not: () => mk,
    in: () => mk,
    gte: () => mk,
    order: () => mk,
    limit: () => mk,
    single: async () => defaultResult,
    maybeSingle: async () => defaultResult,
  };
  return mk;
}

export function createMockSupabaseClient(overrides?: {
  from?: (table: string) => ReturnType<typeof createChainableMock>;
}) {
  return {
    auth: {
      getUser: async () => ({ data: { user: null }, error: null }),
      getSession: async () => ({ data: { session: null }, error: null }),
    },
    from(table: string) {
      if (mockSupabaseState.fromImpl) {
        return mockSupabaseState.fromImpl(table) as ReturnType<typeof createChainableMock>;
      }
      if (overrides?.from) {
        return overrides.from(table);
      }
      return createChainableMock();
    },
    channel: () => ({
      on: () => ({ subscribe: () => ({}) }),
    }),
    removeChannel: () => {},
  };
}
