import { NextResponse } from 'next/server';
import { getAdminContext, logAdminAction } from '@/lib/admin/auth';
import { hasPermission } from '@/lib/admin/permissions';

export async function GET(request: Request) {
  const { context, response } = await getAdminContext('moderator');
  if (!context) return response!;

  const { searchParams } = new URL(request.url);
  const page = Math.max(1, Number(searchParams.get('page') || 1));
  const limit = Math.min(100, Math.max(1, Number(searchParams.get('limit') || 20)));

  let query = context.adminSupabase
    .from('entries')
    .select(
      'id, user_id, type, title, content, scope, anxiety_score, is_quarantine, is_verified, is_public, ai_analyzed_at, created_at, users:user_id(username, role)',
      { count: 'exact' }
    );

  if (searchParams.get('user_id')) query = query.eq('user_id', searchParams.get('user_id')!);
  if (searchParams.get('type')) query = query.eq('type', searchParams.get('type')!);
  if (searchParams.get('scope')) query = query.eq('scope', searchParams.get('scope')!);
  if (searchParams.get('is_quarantine')) query = query.eq('is_quarantine', searchParams.get('is_quarantine') === 'true');
  if (searchParams.get('is_verified')) query = query.eq('is_verified', searchParams.get('is_verified') === 'true');

  const from = (page - 1) * limit;
  const to = from + limit - 1;
  const { data, count, error } = await query.order('created_at', { ascending: false }).range(from, to);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ page, limit, total: count || 0, entries: data || [] });
}

export async function DELETE(request: Request) {
  const { context, response } = await getAdminContext('moderator');
  if (!context) return response!;
  if (!hasPermission(context.role, 'canDeleteAnyEntry')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const body = (await request.json()) as { entry_id: string; reason?: string };
  await context.adminSupabase.from('entries').delete().eq('id', body.entry_id);
  await logAdminAction({
    adminSupabase: context.adminSupabase,
    adminId: context.userId,
    actionType: 'delete_entry',
    targetEntryId: body.entry_id,
    details: { reason: body.reason || null },
  });
  return NextResponse.json({ ok: true });
}

export async function PATCH(request: Request) {
  const { context, response } = await getAdminContext('moderator');
  if (!context) return response!;
  const body = (await request.json()) as {
    entry_id: string;
    action: 'quarantine' | 'unquarantine' | 'make_public' | 'make_private';
  };
  const patch: Record<string, unknown> = {};
  if (body.action === 'quarantine') patch.is_quarantine = true;
  if (body.action === 'unquarantine') patch.is_quarantine = false;
  if (body.action === 'make_public') patch.is_public = true;
  if (body.action === 'make_private') patch.is_public = false;
  await context.adminSupabase.from('entries').update(patch).eq('id', body.entry_id);
  await logAdminAction({
    adminSupabase: context.adminSupabase,
    adminId: context.userId,
    actionType: body.action,
    targetEntryId: body.entry_id,
    details: patch,
  });
  return NextResponse.json({ ok: true });
}
