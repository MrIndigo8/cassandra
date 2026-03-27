import { NextResponse } from 'next/server';
import { createAdminClient, createServerSupabaseClient } from '@/lib/supabase/server';

export type AdminContext = {
  userId: string;
  role: string;
  adminSupabase: ReturnType<typeof createAdminClient>;
};

export async function getAdminContext(
  minRole: 'moderator' | 'admin' = 'moderator'
): Promise<{ context?: AdminContext; response?: NextResponse }> {
  const supabase = createServerSupabaseClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { response: NextResponse.json({ error: 'Unauthorized' }, { status: 401 }) };
  }

  const adminSupabase = createAdminClient();
  const { data: profile } = await adminSupabase
    .from('users')
    .select('role')
    .eq('id', user.id)
    .single();

  const role = profile?.role || 'observer';
  const allowed =
    minRole === 'admin'
      ? ['architect', 'admin'].includes(role)
      : ['architect', 'admin', 'moderator'].includes(role);

  if (!allowed) {
    return { response: NextResponse.json({ error: 'Forbidden' }, { status: 403 }) };
  }

  return {
    context: {
      userId: user.id,
      role,
      adminSupabase,
    },
  };
}

export async function logAdminAction(input: {
  adminSupabase: ReturnType<typeof createAdminClient>;
  adminId: string;
  actionType: string;
  targetUserId?: string | null;
  targetEntryId?: string | null;
  details?: Record<string, unknown> | null;
}) {
  await input.adminSupabase.from('admin_actions').insert({
    admin_id: input.adminId,
    action_type: input.actionType,
    target_user_id: input.targetUserId || null,
    target_entry_id: input.targetEntryId || null,
    details: input.details || {},
  });
}
