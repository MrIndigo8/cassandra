import type { SupabaseClient } from '@supabase/supabase-js';

export interface TouchpointData {
  entryId: string;
  userId: string;
  entryType: string;
  scope: 'world' | 'personal' | 'unknown';
  anxietyScore: number;
  predictionPotential: number;
  userInsight: string;
  sensoryPatterns: Array<{ sensation?: string; intensity?: string; body_response?: string }>;
}

export async function scheduleTouchpoints(
  data: TouchpointData,
  supabase: SupabaseClient
): Promise<void> {
  const now = Date.now();
  const notifications: Array<Record<string, unknown>> = [];

  const base = {
    user_id: data.userId,
    type: 'engagement',
    entry_id: data.entryId,
  };

  notifications.push({
    ...base,
    action_type: 'deep_insight',
    title: '✦ Глубинный анализ готов',
    message: 'Мы завершили дополнительный анализ вашей записи.',
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
      title: '🔗 Ищем похожие паттерны',
      message: 'Проверим, испытывают ли другие похожие ощущения.',
      status: 'scheduled',
      scheduled_for: new Date(now + 24 * 60 * 60 * 1000).toISOString(),
      data: { template: 'similar_patterns' },
    });
  }

  if (data.predictionPotential >= 0.5) {
    notifications.push({
      ...base,
      action_type: 'tracking_update',
      title: '🔮 Статус отслеживания',
      message: 'Мы продолжаем мониторить совпадения по вашей записи.',
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
        title: '🔮 Произошло ли что-то похожее?',
        message: 'Прошло 7 дней с момента вашей записи.',
        status: 'scheduled',
        scheduled_for: new Date(now + 7 * 24 * 60 * 60 * 1000).toISOString(),
        data: { template: 'self_report_7d' },
      },
      {
        ...base,
        type: 'self_report_reminder',
        action_type: 'self_report',
        title: '🔮 Вернитесь к вашей записи',
        message: 'Прошло 14 дней — важно зафиксировать итог.',
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
      title: '📊 Отчёт по вашей записи',
      message: 'Через 14 дней мы пришлем итоговый статус.',
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
