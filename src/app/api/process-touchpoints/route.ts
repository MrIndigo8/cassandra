import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyCronAuth, unauthorizedResponse } from '@/lib/auth/verifyCron';
import {
  findSimilarEntries,
  generateDeepInsight,
  get14DayReport,
  getTrackingStatus,
} from '@/lib/engagement/generators';

export const dynamic = 'force-dynamic';
export const maxDuration = 300;

type ScheduledNotification = {
  id: string;
  user_id: string;
  action_type: string | null;
  data: { template?: string; [key: string]: unknown } | null;
  entries: {
    id: string;
    title: string | null;
    content: string | null;
    type: string | null;
    anxiety_score: number | null;
    prediction_potential: number | null;
    sensory_data: { verification_keywords?: string[] } | null;
    scope: string | null;
    created_at: string;
    threat_type: string | null;
  } | Array<{
    id: string;
    title: string | null;
    content: string | null;
    type: string | null;
    anxiety_score: number | null;
    prediction_potential: number | null;
    sensory_data: { verification_keywords?: string[] } | null;
    scope: string | null;
    created_at: string;
    threat_type: string | null;
  }> | null;
};

function getEntry(
  n: ScheduledNotification
): {
  id: string;
  title: string | null;
  content: string | null;
  type: string | null;
  anxiety_score: number | null;
  prediction_potential: number | null;
  sensory_data: { verification_keywords?: string[] } | null;
  scope: string | null;
  created_at: string;
  threat_type: string | null;
} | null {
  if (!n.entries) return null;
  return Array.isArray(n.entries) ? n.entries[0] || null : n.entries;
}

export async function POST(request: Request) {
  if (!verifyCronAuth(request)) return unauthorizedResponse();

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!supabaseUrl || !supabaseServiceKey) {
    return NextResponse.json({ error: 'Server misconfigured' }, { status: 500 });
  }
  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  const now = new Date().toISOString();

  const { data: pending, error } = await supabase
    .from('notifications')
    .select(
      `id, user_id, action_type, data, entries:entry_id (
        id, title, content, type, anxiety_score, prediction_potential,
        sensory_data, scope, created_at, threat_type
      )`
    )
    .eq('status', 'scheduled')
    .lte('scheduled_for', now)
    .order('scheduled_for', { ascending: true })
    .limit(100);

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
  const items = (pending || []) as unknown as ScheduledNotification[];
  if (items.length === 0) return NextResponse.json({ processed: 0, skipped: 0 });

  let processed = 0;
  let cancelled = 0;

  for (const notification of items) {
    const template = notification.data?.template;
    const entry = getEntry(notification);

    if (!entry) {
      await supabase.from('notifications').update({ status: 'cancelled' }).eq('id', notification.id);
      cancelled++;
      continue;
    }

    let title = '';
    let message = '';
    let shouldSend = true;
    let actionTarget: string | null = null;

    try {
      switch (template) {
        case 'deep_insight':
          title = '✦ Глубинный анализ готов';
          message = await generateDeepInsight(entry, supabase);
          actionTarget = `/entry/${entry.id}`;
          break;
        case 'similar_patterns': {
          const similar = await findSimilarEntries(entry, notification.user_id, supabase);
          if (similar.count > 0) {
            title = `🔗 ${similar.count} людей чувствуют похожее`;
            message = similar.message;
            actionTarget = '/map';
          } else {
            shouldSend = false;
          }
          break;
        }
        case 'tracking_status':
          title = '🔮 Статус вашего предчувствия';
          message = await getTrackingStatus(entry, supabase);
          actionTarget = `/entry/${entry.id}`;
          break;
        case 'tracking_14d':
          title = '📊 Отчёт по вашей записи';
          message = await get14DayReport(entry, supabase);
          actionTarget = `/entry/${entry.id}`;
          break;
        case 'self_report_7d':
          title = '🔮 Произошло ли что-то похожее?';
          message = `Вы записали "${entry.title || (entry.content || '').slice(0, 50)}..." 7 дней назад. Сбылось ли что-то похожее?`;
          actionTarget = `/entry/${entry.id}`;
          break;
        case 'self_report_14d':
          title = '🔮 Вернитесь к вашей записи';
          message = `Прошло 14 дней с записи "${entry.title || (entry.content || '').slice(0, 50)}...". Совпало ли что-то в вашей жизни?`;
          actionTarget = `/entry/${entry.id}`;
          break;
        default:
          shouldSend = false;
      }
    } catch (e) {
      console.warn('[touchpoints] generator failed:', e);
      shouldSend = false;
    }

    if (shouldSend) {
      await supabase
        .from('notifications')
        .update({
          status: 'unread',
          title,
          message,
          data: { ...(notification.data || {}), action_target: actionTarget },
          read_at: null,
        })
        .eq('id', notification.id);
      processed++;
    } else {
      await supabase.from('notifications').update({ status: 'cancelled' }).eq('id', notification.id);
      cancelled++;
    }
  }

  return NextResponse.json({ processed, cancelled, total: items.length });
}
