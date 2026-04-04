import type { SupabaseClient } from '@supabase/supabase-js';
import type { NotifLocale } from '@/lib/engagement/generator-i18n';
import {
  findSimilarEntries,
  generateDeepInsight,
  get14DayReport,
  getTrackingStatus,
  selfReport14dMessage,
  selfReport7dMessage,
} from '@/lib/engagement/generators';

export type ProcessTouchpointsResult = {
  processed: number;
  cancelled: number;
  total: number;
};

type ScheduledNotification = {
  id: string;
  user_id: string;
  action_type: string | null;
  locale: string | null;
  template_key: string | null;
  template_params: Record<string, unknown> | null;
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

/**
 * Обрабатывает запланированные touchpoints: генерация текста и перевод в unread.
 */
export async function runProcessTouchpointsBatch(
  supabase: SupabaseClient,
  options: { limit: number }
): Promise<ProcessTouchpointsResult> {
  const now = new Date().toISOString();

  const { data: pending, error } = await supabase
    .from('notifications')
    .select(
      `id, user_id, action_type, data, locale, template_key, template_params, entries:entry_id (
        id, title, content, type, anxiety_score, prediction_potential,
        sensory_data, scope, created_at, threat_type
      )`
    )
    .eq('status', 'scheduled')
    .lte('scheduled_for', now)
    .order('scheduled_for', { ascending: true })
    .limit(options.limit);

  if (error) {
    throw new Error(error.message);
  }

  const items = (pending || []) as unknown as ScheduledNotification[];
  if (items.length === 0) return { processed: 0, cancelled: 0, total: 0 };

  let processed = 0;
  let cancelled = 0;

  for (const notification of items) {
    const template = notification.data?.template;
    const entry = getEntry(notification);
    const locale: NotifLocale = notification.locale === 'en' ? 'en' : 'ru';

    if (!entry) {
      await supabase.from('notifications').update({ status: 'cancelled' }).eq('id', notification.id);
      cancelled++;
      continue;
    }

    let shouldSend = true;
    let actionTarget: string | null = null;
    let templateKey: string | null = null;
    let templateParams: Record<string, unknown> = {};

    try {
      switch (template) {
        case 'deep_insight': {
          templateKey = 'body.deep_insight';
          templateParams = {
            message: await generateDeepInsight(entry, supabase, locale),
          };
          actionTarget = `/entry/${entry.id}`;
          break;
        }
        case 'similar_patterns': {
          const similar = await findSimilarEntries(entry, notification.user_id, supabase, locale);
          if (similar.count > 0) {
            templateKey = 'body.similar_patterns';
            templateParams = {
              count: similar.count,
              message: similar.message,
            };
            actionTarget = '/map';
          } else {
            shouldSend = false;
          }
          break;
        }
        case 'tracking_status': {
          templateKey = 'body.tracking_status';
          templateParams = {
            message: await getTrackingStatus(entry, supabase, locale),
          };
          actionTarget = `/entry/${entry.id}`;
          break;
        }
        case 'tracking_14d': {
          templateKey = 'body.tracking_14d';
          templateParams = {
            message: await get14DayReport(entry, supabase, locale),
          };
          actionTarget = `/entry/${entry.id}`;
          break;
        }
        case 'self_report_7d': {
          templateKey = 'body.self_report_7d';
          templateParams = {
            message: selfReport7dMessage(entry, locale),
          };
          actionTarget = `/entry/${entry.id}`;
          break;
        }
        case 'self_report_14d': {
          templateKey = 'body.self_report_14d';
          templateParams = {
            message: selfReport14dMessage(entry, locale),
          };
          actionTarget = `/entry/${entry.id}`;
          break;
        }
        default:
          shouldSend = false;
      }
    } catch (e) {
      console.warn('[touchpoints] generator failed:', e);
      shouldSend = false;
    }

    if (shouldSend && templateKey) {
      await supabase
        .from('notifications')
        .update({
          status: 'unread',
          title: '',
          message: '',
          template_key: templateKey,
          template_params: templateParams,
          locale,
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

  return { processed, cancelled, total: items.length };
}
