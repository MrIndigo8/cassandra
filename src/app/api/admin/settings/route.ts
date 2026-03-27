import { NextResponse } from 'next/server';
import { getAdminContext, logAdminAction } from '@/lib/admin/auth';
import { hasPermission } from '@/lib/admin/permissions';

export async function GET() {
  const { context, response } = await getAdminContext('admin');
  if (!context) return response!;
  const { data, error } = await context.adminSupabase
    .from('system_settings')
    .select('key, value, updated_by, updated_at')
    .order('key');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ settings: data || [] });
}

export async function PATCH(request: Request) {
  const { context, response } = await getAdminContext('admin');
  if (!context) return response!;
  if (!hasPermission(context.role, 'canEditSystemSettings')) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }
  const body = (await request.json()) as { key: string; value: Record<string, unknown> };
  const { error } = await context.adminSupabase.from('system_settings').upsert({
    key: body.key,
    value: body.value,
    updated_by: context.userId,
    updated_at: new Date().toISOString(),
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  await logAdminAction({
    adminSupabase: context.adminSupabase,
    adminId: context.userId,
    actionType: 'feature_toggle',
    details: { key: body.key, value: body.value },
  });
  return NextResponse.json({ ok: true });
}
