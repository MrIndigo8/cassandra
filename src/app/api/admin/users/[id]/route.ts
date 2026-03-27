import { NextResponse } from 'next/server';
import { getAdminContext, logAdminAction } from '@/lib/admin/auth';
import { hasPermission } from '@/lib/admin/permissions';
import { updateUserScoring } from '@/lib/scoring';

export async function PATCH(request: Request, { params }: { params: { id: string } }) {
  const { context, response } = await getAdminContext('moderator');
  if (!context) return response!;

  const targetId = params.id;
  const body = (await request.json()) as {
    action: 'change_role' | 'override_rating' | 'ban' | 'unban' | 'reset_scoring';
    new_role?: string;
    new_rating?: number;
    reason?: string;
  };

  const { data: targetUser } = await context.adminSupabase
    .from('users')
    .select('id, role')
    .eq('id', targetId)
    .single();
  if (!targetUser) return NextResponse.json({ error: 'User not found' }, { status: 404 });

  if (targetUser.role === 'architect') {
    return NextResponse.json({ error: 'Architect role can only be changed via SQL' }, { status: 403 });
  }
  if (context.role !== 'architect' && targetUser.role === 'admin') {
    return NextResponse.json({ error: 'Only architect can change admin users' }, { status: 403 });
  }

  if (body.action === 'change_role') {
    if (!hasPermission(context.role, 'canChangeAnyRole')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const nextRole = body.new_role || 'observer';
    if (nextRole === 'admin' && !hasPermission(context.role, 'canAssignAdmin')) {
      return NextResponse.json({ error: 'Only architect can assign admin' }, { status: 403 });
    }
    if (nextRole === 'moderator' && !hasPermission(context.role, 'canAssignModerator')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    await context.adminSupabase.from('users').update({ role: nextRole }).eq('id', targetId);
    await logAdminAction({
      adminSupabase: context.adminSupabase,
      adminId: context.userId,
      actionType: 'role_change',
      targetUserId: targetId,
      details: { from: targetUser.role, to: nextRole },
    });
    return NextResponse.json({ ok: true });
  }

  if (body.action === 'override_rating') {
    if (!hasPermission(context.role, 'canOverrideRating')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const rating = Math.max(0, Math.min(10, Number(body.new_rating || 0)));
    await context.adminSupabase.from('users').update({ rating_score: rating }).eq('id', targetId);
    await logAdminAction({
      adminSupabase: context.adminSupabase,
      adminId: context.userId,
      actionType: 'rating_override',
      targetUserId: targetId,
      details: { rating },
    });
    return NextResponse.json({ ok: true });
  }

  if (body.action === 'ban' || body.action === 'unban') {
    if (!hasPermission(context.role, 'canBanUsers')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const nextRole = body.action === 'ban' ? 'banned' : 'observer';
    await context.adminSupabase.from('users').update({ role: nextRole }).eq('id', targetId);
    await logAdminAction({
      adminSupabase: context.adminSupabase,
      adminId: context.userId,
      actionType: body.action,
      targetUserId: targetId,
      details: { reason: body.reason || null },
    });
    return NextResponse.json({ ok: true });
  }

  if (body.action === 'reset_scoring') {
    if (!hasPermission(context.role, 'canResetScoring')) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    const updated = await updateUserScoring(targetId, context.adminSupabase);
    await logAdminAction({
      adminSupabase: context.adminSupabase,
      adminId: context.userId,
      actionType: 'reset_scoring',
      targetUserId: targetId,
      details: { updated },
    });
    return NextResponse.json({ ok: true, scoring: updated });
  }

  return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
}
