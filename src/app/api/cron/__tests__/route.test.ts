import { describe, it, expect, vi, beforeEach } from 'vitest';
import { POST } from '../route';

describe('POST /api/cron', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('fetch', fetchMock);
    process.env.CRON_SECRET = 'cron-secret';
    process.env.NEXT_PUBLIC_APP_URL = 'http://localhost:3000';
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ ok: true }),
    });
  });

  it('401 без Authorization', async () => {
    const req = new Request('http://localhost/api/cron', { method: 'POST' });
    const res = await POST(req);
    expect(res.status).toBe(401);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('последовательно вызывает вложенные API с Bearer', async () => {
    const req = new Request('http://localhost/api/cron', {
      method: 'POST',
      headers: { Authorization: 'Bearer cron-secret' },
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    expect(fetchMock).toHaveBeenCalled();
    const urls = fetchMock.mock.calls.map((c) => (c[0] as string));
    expect(urls[0]).toContain('/api/external-sync');
    expect(urls.some((u) => u.includes('/api/analyze'))).toBe(true);
  });
});
