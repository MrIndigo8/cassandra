import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { updateUserScoring } from '@/lib/scoring';

export async function POST(request: Request) {
  const auth = request.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: users, error } = await supabase
    .from('users')
    .select('id')
    .order('created_at', { ascending: true });

  if (error || !users) {
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }

  const results: { userId: string; rating: number; role: string; error?: string }[] = [];

  for (const user of users) {
    try {
      const scoring = await updateUserScoring(user.id, supabase);
      results.push({ userId: user.id, rating: scoring.rating_score, role: scoring.role });
    } catch (err) {
      results.push({ userId: user.id, rating: 0, role: 'observer', error: String(err) });
    }
  }

  const summary = {
    total: results.length,
    success: results.filter((r) => !r.error).length,
    failed: results.filter((r) => r.error).length,
    roles: {
      observer: results.filter((r) => r.role === 'observer').length,
      chronicler: results.filter((r) => r.role === 'chronicler').length,
      sensitive: results.filter((r) => r.role === 'sensitive').length,
      oracle: results.filter((r) => r.role === 'oracle').length,
    },
  };

  return NextResponse.json({ summary, results });
}
