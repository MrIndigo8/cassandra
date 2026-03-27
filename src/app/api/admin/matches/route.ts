import { NextResponse } from 'next/server';
import { getAdminContext } from '@/lib/admin/auth';

export async function GET(request: Request) {
  const { context, response } = await getAdminContext('moderator');
  if (!context) return response!;
  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get('page') || 1));
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') || 20)));

  const from = (page - 1) * limit;
  const to = from + limit - 1;
  const { data, count, error } = await context.adminSupabase
    .from('matches')
    .select(
      'id, similarity_score, event_title, event_url, event_date, verification_data, entries:entry_id(id, title, users:user_id(username))',
      { count: 'exact' }
    )
    .order('created_at', { ascending: false })
    .range(from, to);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ page, limit, total: count || 0, matches: data || [] });
}

export async function DELETE(request: Request) {
  const { context, response } = await getAdminContext('moderator');
  if (!context) return response!;
  const { id } = (await request.json()) as { id: string };
  const { error } = await context.adminSupabase.from('matches').delete().eq('id', id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ ok: true });
}
