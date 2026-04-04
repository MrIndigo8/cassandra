import { describe, it, expect, vi, beforeEach } from 'vitest';
import { GET } from '../route';

const recoverStuck = vi.fn();
const runAnalysis = vi.fn();
const runForIds = vi.fn();
const isFeatureEnabled = vi.fn();

vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(),
}));

vi.mock('@/lib/analysis', () => ({
  recoverStuckAnalysisLocks: (...a: unknown[]) => recoverStuck(...a),
  runAnalysis: (...a: unknown[]) => runAnalysis(...a),
  runAnalysisForEntryIds: (...a: unknown[]) => runForIds(...a),
}));

vi.mock('@/lib/features', () => ({
  isFeatureEnabled: (...a: unknown[]) => isFeatureEnabled(...a),
}));

describe('GET /api/analyze', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.CRON_SECRET = 'secret';
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'http://localhost:54321';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service';
    recoverStuck.mockResolvedValue(0);
    isFeatureEnabled.mockResolvedValue(true);
    runAnalysis.mockResolvedValue({ processed: 0 });
    runForIds.mockResolvedValue({ processed: 0 });
  });

  it('401 без CRON_SECRET', async () => {
    const req = new Request('http://localhost/api/analyze');
    const res = await GET(req);
    expect(res.status).toBe(401);
    expect(runAnalysis).not.toHaveBeenCalled();
  });

  it('с CRON_SECRET вызывает runAnalysis (batch)', async () => {
    const req = new Request('http://localhost/api/analyze', {
      headers: { Authorization: 'Bearer secret' },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    expect(runAnalysis).toHaveBeenCalled();
    const body = await res.json();
    expect(body.mode).toBe('batch');
  });

  it('нет записей — успех с processed: 0', async () => {
    runAnalysis.mockResolvedValue({ processed: 0 });
    const req = new Request('http://localhost/api/analyze', {
      headers: { Authorization: 'Bearer secret' },
    });
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.processed).toBe(0);
  });
});
