import { NextResponse } from 'next/server';
import { getAdminContext } from '@/lib/admin/auth';

export async function GET(request: Request) {
  const { context, response } = await getAdminContext('moderator');
  if (!context) return response!;

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get('page') || 1));
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') || 20)));

  let query = context.adminSupabase
    .from('admin_actions')
    .select(
      'id, action_type, details, created_at, admin:admin_id(username), target_user:target_user_id(username)',
      { count: 'exact' }
    );

  if (searchParams.get('admin_id')) query = query.eq('admin_id', searchParams.get('admin_id')!);
  if (searchParams.get('action_type')) query = query.eq('action_type', searchParams.get('action_type')!);
  if (searchParams.get('date_from')) query = query.gte('created_at', searchParams.get('date_from')!);
  if (searchParams.get('date_to')) query = query.lte('created_at', searchParams.get('date_to')!);

  const from = (page - 1) * limit;
  const to = from + limit - 1;
  const { data, count, error } = await query.order('created_at', { ascending: false }).range(from, to);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  return NextResponse.json({ page, limit, total: count || 0, actions: data || [] });
}
