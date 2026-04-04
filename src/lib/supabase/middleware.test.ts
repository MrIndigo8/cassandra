import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';
import { updateSession } from './middleware';

const mockGetUser = vi.fn();
const mockSingle = vi.fn();

vi.mock('@supabase/ssr', () => ({
  createServerClient: () => ({
    auth: {
      getUser: () => mockGetUser(),
    },
    from: () => ({
      select: () => ({
        eq: () => ({
          single: () => mockSingle(),
        }),
      }),
    }),
  }),
}));

describe('updateSession', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = 'test-anon';
    mockSingle.mockResolvedValue({ data: { role: 'user' }, error: null });
  });

  it('редирект неавторизованного с /feed на /login', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const req = new NextRequest(new URL('http://localhost/feed'));
    const res = await updateSession(req);
    expect(res.headers.get('location')).toMatch(/\/login$/);
  });

  it('пускает неавторизованного на лендинг /', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null }, error: null });
    const req = new NextRequest(new URL('http://localhost/'));
    const res = await updateSession(req);
    expect(res.headers.get('location')).toBeNull();
    expect(res.status).toBe(200);
  });

  it('редирект авторизованного с /login на /feed', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    const req = new NextRequest(new URL('http://localhost/login'));
    const res = await updateSession(req);
    expect(res.headers.get('location')).toMatch(/\/feed$/);
  });

  it('редирект с /admin на /feed без роли admin', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    mockSingle.mockResolvedValue({ data: { role: 'user' }, error: null });
    const req = new NextRequest(new URL('http://localhost/admin'));
    const res = await updateSession(req);
    expect(res.headers.get('location')).toMatch(/\/feed$/);
  });

  it('пускает /admin при роли admin', async () => {
    mockGetUser.mockResolvedValue({ data: { user: { id: 'u1' } }, error: null });
    mockSingle.mockResolvedValue({ data: { role: 'admin' }, error: null });
    const req = new NextRequest(new URL('http://localhost/admin'));
    const res = await updateSession(req);
    expect(res.headers.get('location')).toBeNull();
    expect(res.status).toBe(200);
  });
});
