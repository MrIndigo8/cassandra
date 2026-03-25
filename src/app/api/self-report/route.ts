import { createServerSupabaseClient } from '@/lib/supabase/server';
import { getRoleForUser } from '@/lib/scoring';
import { NextResponse } from 'next/server';
import { selfReportSchema } from '@/lib/validations';

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = selfReportSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }
    const { entry_id, status } = parsed.data;

    const supabase = createServerSupabaseClient();
    const { data: { user } } = await supabase.auth.getUser();
    
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

    // Сохранить self_report
    await supabase.from('self_reports').upsert({
      entry_id, user_id: user.id, status
    });

    // Отметить уведомление прочитанным
    await supabase.from('notifications')
      .update({ status: 'read' })
      .eq('entry_id', entry_id)
      .eq('user_id', user.id)
      .eq('action_type', 'self_report');

    if (status === 'fulfilled' || status === 'partial') {
      // Обновить entry
      await supabase.from('entries')
        .update({ is_verified: true })
        .eq('id', entry_id);

      // Пересчитать рейтинг
      const { data: profile } = await supabase
        .from('users')
        .select('verified_count, total_entries, rating_score, created_at')
        .eq('id', user.id)
        .single();

      const newVerifiedCount = (profile?.verified_count || 0) + 1;
      const daysSinceReg = profile?.created_at ? Math.floor((Date.now() - new Date(profile.created_at).getTime()) / (1000 * 3600 * 24)) : 30;
      
      const newRole = getRoleForUser({
        verifiedCount: newVerifiedCount,
        totalEntries: profile?.total_entries || 0,
        ratingScore: profile?.rating_score || 0,
        daysSinceRegistration: daysSinceReg
      });

      await supabase.from('users').update({
        verified_count: newVerifiedCount,
        role: newRole
      }).eq('id', user.id);

      // Уведомление о подтверждении
      await supabase.from('notifications').insert({
        user_id: user.id,
        type: 'match_confirmed',
        title: 'Сигнал подтверждён 🔮',
        message: 'Твоё предчувствие сбылось. Рейтинг обновлён.',
        status: 'unread'
      });
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    console.error('self-report API error:', err);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
