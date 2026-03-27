import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyCronAuth, unauthorizedResponse } from '@/lib/auth/verifyCron';
import { cosineSimilarity, parseEmbeddingValue } from '@/lib/embeddings';

export const dynamic = 'force-dynamic';
export const maxDuration = 60;

type EntryRow = {
  id: string;
  user_id: string;
  embedding: unknown;
  created_at: string;
};

function mean(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((s, v) => s + v, 0) / values.length;
}

function stddev(values: number[], avg: number): number {
  if (values.length <= 1) return 0;
  const variance = values.reduce((s, v) => s + (v - avg) * (v - avg), 0) / values.length;
  return Math.sqrt(variance);
}

function computePairwiseCoherence(entries: Array<{ userId: string; vec: number[] }>) {
  const scores: number[] = [];
  for (let i = 0; i < entries.length; i += 1) {
    for (let j = i + 1; j < entries.length; j += 1) {
      if (entries[i].userId === entries[j].userId) continue;
      scores.push(cosineSimilarity(entries[i].vec, entries[j].vec));
    }
  }
  return { pairCount: scores.length, coherence: mean(scores) };
}

async function run(request: Request) {
  try {
    if (!verifyCronAuth(request)) return unauthorizedResponse();

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRole = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRole) {
      return NextResponse.json({ error: 'Missing Supabase config' }, { status: 500 });
    }
    const admin = createClient(supabaseUrl, serviceRole, { auth: { persistSession: false } });

    const now = new Date();
    const windowStart = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString();
    const baselineStart = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000).toISOString();

    const { data: currentRows, error: currentError } = await admin
      .from('entries')
      .select('id, user_id, embedding, created_at')
      .not('embedding', 'is', null)
      .gte('created_at', windowStart)
      .eq('is_public', true)
      .order('created_at', { ascending: false })
      .limit(200);
    if (currentError) {
      return NextResponse.json({ error: currentError.message }, { status: 500 });
    }

    const currentEntries = ((currentRows || []) as EntryRow[])
      .map((row) => ({ userId: row.user_id, vec: parseEmbeddingValue(row.embedding) }))
      .filter((row) => row.vec.length > 0);
    const current = computePairwiseCoherence(currentEntries);

    const { data: historyRows, error: historyError } = await admin
      .from('coherence_snapshots')
      .select('current_coherence, created_at')
      .gte('created_at', baselineStart)
      .order('created_at', { ascending: false })
      .limit(120);
    if (historyError) {
      return NextResponse.json({ error: historyError.message }, { status: 500 });
    }

    const baselineValues = (historyRows || [])
      .map((r: { current_coherence: number }) => Number(r.current_coherence))
      .filter((n: number) => Number.isFinite(n));
    const baseline = mean(baselineValues);
    const sd = stddev(baselineValues, baseline);
    const z = sd > 0 ? (current.coherence - baseline) / sd : 0;
    const isAnomaly = baselineValues.length >= 5 && z >= 2;

    const { error: insertError } = await admin.from('coherence_snapshots').insert({
      current_coherence: current.coherence,
      baseline_coherence: baselineValues.length ? baseline : null,
      stddev_coherence: baselineValues.length ? sd : null,
      z_score: baselineValues.length ? z : null,
      is_anomaly: isAnomaly,
      entry_count: currentEntries.length,
      pair_count: current.pairCount,
      window_start: windowStart,
      window_end: now.toISOString(),
    });
    if (insertError) {
      return NextResponse.json({ error: insertError.message }, { status: 500 });
    }

    return NextResponse.json({
      currentCoherence: current.coherence,
      baselineCoherence: baselineValues.length ? baseline : null,
      stddev: baselineValues.length ? sd : null,
      zScore: baselineValues.length ? z : null,
      isAnomaly,
      entryCount: currentEntries.length,
      pairCount: current.pairCount,
    });
  } catch (error) {
    console.error('coherence POST error:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  return run(request);
}

export async function GET(request: Request) {
  return run(request);
}
