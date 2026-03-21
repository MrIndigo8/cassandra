import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

interface MatchNotificationData {
  matchId?: string;
  entryId: string;
  matchScore: number;
  eventTitle: string;
  explanation?: string;
}

/**
 * Создаёт уведомление о найденном совпадении для пользователя.
 * Вызывается из verification после успешного upsert в matches.
 */
export async function createMatchNotification(
  userId: string,
  matchData: MatchNotificationData
): Promise<void> {
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('[Notifications] Missing SUPABASE_URL or SERVICE_ROLE_KEY');
    return;
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);

  const explanationSnippet = matchData.explanation
    ? matchData.explanation.slice(0, 100)
    : 'Найдено совпадение';

  const body = `${explanationSnippet} — ${matchData.eventTitle}`;

  const { error } = await supabase.from('notifications').insert({
    user_id: userId,
    type: 'match_found',
    title: 'Твой сигнал резонирует с реальным событием 🔮',
    message: body,
    data: {
      match_id: matchData.matchId || null,
      entry_id: matchData.entryId,
      match_score: matchData.matchScore,
      event_title: matchData.eventTitle,
    },
    status: 'unread',
  });

  if (error) {
    console.error('[Notifications] Ошибка создания уведомления:', error);
  } else {
    console.log(`[Notifications] Уведомление создано для ${userId}`);
  }
}
