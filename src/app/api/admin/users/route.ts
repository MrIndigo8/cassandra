import { NextResponse } from 'next/server';
import { getAdminContext } from '@/lib/admin/auth';

export async function GET(request: Request) {
  const { context, response } = await getAdminContext('moderator');
  if (!context) return response!;

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get('page') || 1));
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') || 20)));
  const search = (searchParams.get('search') || '').trim();
  const role = (searchParams.get('role') || '').trim();
  const sort = (searchParams.get('sort') || 'created_at').trim();

  let query = context.adminSupabase
    .from('users')
    .select(
      'id, username, avatar_url, role, rating_score, verified_count, total_entries, streak_count, created_at, last_entry_date',
      { count: 'exact' }
    );

  if (role) query = query.eq('role', role);
  if (search) query = query.ilike('username', `%${search}%`);
  if (sort === 'rating_score') query = query.order('rating_score', { ascending: false });
  else if (sort === 'total_entries') query = query.order('total_entries', { ascending: false });
  else query = query.order('created_at', { ascending: false });

  const from = (page - 1) * limit;
  const to = from + limit - 1;
  const { data, count, error } = await query.range(from, to);

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ page, limit, total: count || 0, users: data || [] });
}
