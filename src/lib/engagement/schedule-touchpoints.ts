import type { SupabaseClient } from '@supabase/supabase-js';
import type { NotifLocale } from '@/lib/engagement/generator-i18n';

export interface TouchpointData {
  entryId: string;
  userId: string;
  entryType: string;
  scope: 'world' | 'personal' | 'unknown';
  anxietyScore: number;
  predictionPotential: number;
  userInsight: string;
  sensoryPatterns: Array<{ sensation?: string; intensity?: string; body_response?: string }>;
  /** Локаль UI при создании записи — для серверной обработки touchpoints */
  locale?: NotifLocale;
}

export async function scheduleTouchpoints(
  data: TouchpointData,
  supabase: SupabaseClient
): Promise<void> {
  const now = Date.now();
  const locale: NotifLocale = data.locale ?? 'ru';
  const notifications: Array<Record<string, unknown>> = [];

  const base = {
    user_id: data.userId,
    type: 'engagement',
    entry_id: data.entryId,
    locale,
    title: '',
    message: '',
  };

  notifications.push({
    ...base,
    action_type: 'deep_insight',
    template_key: 'scheduled.deep_insight',
    template_params: {
      entry_type: data.entryType,
      anxiety_score: data.anxietyScore,
    },
    status: 'scheduled',
    scheduled_for: new Date(now + 2 * 60 * 60 * 1000).toISOString(),
    data: {
      template: 'deep_insight',
      entry_type: data.entryType,
      anxiety_score: data.anxietyScore,
    },
  });

  if (data.anxietyScore >= 4 || data.predictionPotential >= 0.4) {
    notifications.push({
      ...base,
      action_type: 'similar_patterns',
      template_key: 'scheduled.similar_patterns',
      template_params: {},
      status: 'scheduled',
      scheduled_for: new Date(now + 24 * 60 * 60 * 1000).toISOString(),
      data: { template: 'similar_patterns' },
    });
  }

  if (data.predictionPotential >= 0.5) {
    notifications.push({
      ...base,
      action_type: 'tracking_update',
      template_key: 'scheduled.tracking_update',
      template_params: {},
      status: 'scheduled',
      scheduled_for: new Date(now + 3 * 24 * 60 * 60 * 1000).toISOString(),
      data: { template: 'tracking_status' },
    });
  }

  if (data.scope === 'personal') {
    notifications.push(
      {
        ...base,
        type: 'self_report_reminder',
        action_type: 'self_report',
        template_key: 'scheduled.self_report_7d',
        template_params: {},
        status: 'scheduled',
        scheduled_for: new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString(),
        data: { template: 'self_report_7d' },
      },
      {
        ...base,
        type: 'self_report_reminder',
        action_type: 'self_report',
        template_key: 'scheduled.self_report_14d',
        template_params: {},
        status: 'scheduled',
        scheduled_for: new Date(now + 14 * 24 * 60 * 60 * 1000).toISOString(),
        data: { template: 'self_report_14d' },
      }
    );
  }

  if (data.scope === 'world' || data.scope === 'unknown') {
    notifications.push({
      ...base,
      action_type: 'tracking_update',
      template_key: 'scheduled.tracking_14d',
      template_params: {},
      status: 'scheduled',
      scheduled_for: new Date(now + 14 * 24 * 60 * 60 * 1000).toISOString(),
      data: { template: 'tracking_14d' },
    });
  }

  if (notifications.length > 0) {
    const { error } = await supabase.from('notifications').insert(notifications);
    if (error) {
      console.warn('[touchpoints] schedule insert:', error.message);
    }
  }
}
