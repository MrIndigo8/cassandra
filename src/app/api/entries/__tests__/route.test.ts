import { describe, it, expect, vi, beforeEach } from 'vitest';

const ctx = vi.hoisted(() => {
  const entryId = '00000000-0000-4000-8000-000000000001';
  const userId = '00000000-0000-4000-8000-000000000099';
  return {
    user: null as { id: string } | null,
    entryId,
    userId,
    makeFrom(table: string) {
      if (table === 'entries') {
        return {
          insert: () => ({
            select: () => ({
              single: async () => ({
                data: { id: entryId, created_at: new Date().toISOString() },
                error: null,
              }),
            }),
          }),
          update: () => ({
            eq: async () => ({ error: null }),
          }),
        };
      }
      if (table === 'users') {
        return {
          select: () => ({
            eq: () => ({
              single: async () => ({
                data: { total_entries: 0, streak_count: 0, last_entry_date: null },
                error: null,
              }),
            }),
          }),
          update: () => ({
            eq: async () => ({ error: null }),
          }),
        };
      }
      throw new Error(`unexpected table ${table}`);
    },
  };
});

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: {
      getUser: async () => ({
        data: { user: ctx.user },
        error: ctx.user ? null : new Error('auth'),
      }),
    },
    from: (t: string) => ctx.makeFrom(t),
  }),
}));

vi.mock('next/headers', () => ({
  cookies: () => ({
    getAll: () => [],
    get: () => ({ value: 'ru' }),
    set: () => {},
  }),
}));

vi.mock('@/lib/features', () => ({
  isFeatureEnabled: vi.fn(async () => false),
}));

vi.mock('@/lib/scoring', () => ({
  updateUserScoring: vi.fn(async () => {}),
}));

vi.mock('@/lib/engagement/schedule-touchpoints', () => ({
  scheduleTouchpoints: vi.fn(async () => {}),
}));

vi.mock('@/lib/supabase/server', () => ({
  createAdminClient: () => ({
    from: () => ({
      select: () => ({
        eq: () => ({
          maybeSingle: async () => ({ data: null }),
        }),
      }),
    }),
  }),
}));

const checkSpam = vi.fn();
vi.mock('@/lib/antispam', () => ({
  checkSpam: (...a: unknown[]) => checkSpam(...a),
}));

import { POST } from '../route';

describe('POST /api/entries', () => {
  beforeEach(() => {
    ctx.user = { id: ctx.userId };
    checkSpam.mockResolvedValue({ isSpam: false, isQuarantine: false });
    delete process.env.CRON_SECRET;
  });

  async function post(body: unknown) {
    return POST(
      new Request('http://localhost/api/entries', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      })
    );
  }

  it('401 без пользователя', async () => {
    ctx.user = null;
    const res = await post({
      content: 'x'.repeat(40),
      is_public: true,
    });
    expect(res.status).toBe(401);
  });

  it('400 при невалидном payload', async () => {
    ctx.user = { id: ctx.userId };
    const res = await post({ content: 'short' });
    expect(res.status).toBe(400);
  });

  it('429 при срабатывании антиспама', async () => {
    ctx.user = { id: ctx.userId };
    checkSpam.mockResolvedValue({ isSpam: true, reason: 'blocked' });
    const res = await post({
      content: 'x'.repeat(40),
      is_public: true,
    });
    expect(res.status).toBe(429);
  });

  it('201 при успешном создании записи', async () => {
    ctx.user = { id: ctx.userId };
    const res = await post({
      content: 'x'.repeat(40),
      is_public: true,
      scope: 'unknown',
    });
    expect(res.status).toBe(201);
    const json = await res.json();
    expect(json.data?.id).toBe(ctx.entryId);
  });
});
