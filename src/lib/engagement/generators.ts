import type { SupabaseClient } from '@supabase/supabase-js';

export async function generateDeepInsight(entry: {
  id: string;
  title: string | null;
  content: string | null;
  prediction_potential?: number | null;
}, supabase: SupabaseClient): Promise<string> {
  const { data: deep } = await supabase
    .from('deep_analysis')
    .select('archetypes, narrative_structure')
    .eq('entry_id', entry.id)
    .maybeSingle();

  if (!deep) {
    return `Ваша запись "${entry.title || (entry.content || '').slice(0, 50)}..." проанализирована. Откройте запись, чтобы увидеть детали.`;
  }

  const parts: string[] = [];

  const mainArch = Array.isArray(deep.archetypes) ? deep.archetypes[0] : null;
  if (mainArch) {
    const archDescriptions: Record<string, string> = {
      Shadow: 'Ваше бессознательное обрабатывает скрытые стороны — это важный процесс интеграции.',
      Hero: 'Внутри вас активна энергия преодоления — вы готовитесь к важному шагу.',
      Explorer: 'Ваша психика ищет новый опыт — впереди открытия.',
      Magician: 'Активен процесс внутренней трансформации — обратите внимание на перемены.',
      Destroyer: 'Что-то старое уходит — бессознательное освобождает место для нового.',
      Mother: 'Тема заботы и защиты активна — прислушайтесь к отношениям с близкими.',
      Trickster: 'Ваше бессознательное ломает шаблоны — возможно, пора взглянуть на ситуацию иначе.',
    };
    parts.push(archDescriptions[mainArch] || `В вашей записи активен архетип "${mainArch}".`);
  }

  if (typeof deep.narrative_structure === 'string' && deep.narrative_structure.trim()) {
    parts.push(`Нарратив записи: ${deep.narrative_structure.trim()}.`);
  }

  if ((entry.prediction_potential || 0) > 0.6) {
    parts.push('🔮 Эта запись имеет высокий предчувственный потенциал. Мы продолжаем отслеживание совпадений.');
  }

  return parts.join('\n\n') || 'Ваша запись содержит ценный материал — система продолжает анализ.';
}

export async function findSimilarEntries(
  entry: {
    anxiety_score?: number | null;
    threat_type?: string | null;
  },
  userId: string,
  supabase: SupabaseClient
): Promise<{ count: number; message: string }> {
  const sevenDays = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: similar } = await supabase
    .from('entries')
    .select('id, anxiety_score, threat_type, ip_country_code')
    .neq('user_id', userId)
    .eq('is_public', true)
    .gte('created_at', sevenDays)
    .not('anxiety_score', 'is', null)
    .limit(500);

  const entryAnxiety = entry.anxiety_score || 0;
  const entryThreat = entry.threat_type || null;
  const matches = (similar || []).filter((s) => {
    const anxietyClose = Math.abs((s.anxiety_score || 0) - entryAnxiety) <= 2;
    const threatMatch = entryThreat && s.threat_type === entryThreat;
    return Boolean(anxietyClose || threatMatch);
  });

  if (matches.length === 0) return { count: 0, message: '' };

  const countries = new Set(matches.map((m) => m.ip_country_code).filter(Boolean));
  let message = `${matches.length} пользователей`;
  if (countries.size > 1) message += ` из ${countries.size} стран`;
  message += ' за последнюю неделю сообщили о похожем переживании.';
  if (entryThreat && entryThreat !== 'unknown' && entryThreat !== 'personal') {
    message += ` Общая тема: ${entryThreat}.`;
  }
  message += '\n\nОткройте Карту, чтобы увидеть географию сигнала.';
  return { count: matches.length, message };
}

export async function getTrackingStatus(
  entry: {
    id: string;
    title: string | null;
    content: string | null;
    prediction_potential?: number | null;
    sensory_data?: { verification_keywords?: string[] } | null;
  },
  supabase: SupabaseClient
): Promise<string> {
  const { data: match } = await supabase
    .from('matches')
    .select('similarity_score, event_title')
    .eq('entry_id', entry.id)
    .gt('similarity_score', 0.5)
    .order('similarity_score', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (match) {
    return `🔴 Обнаружено возможное совпадение.\n\n"${match.event_title}" — ${Math.round((match.similarity_score || 0) * 100)}%.\n\nОткройте запись, чтобы посмотреть детали.`;
  }

  const indicators = entry.sensory_data?.verification_keywords?.length || 0;
  const title = entry.title || (entry.content || '').slice(0, 40);
  const parts = [
    `Ваша запись "${title}..." остаётся под наблюдением.`,
    '',
    '📡 Что делает система:',
    '• Сканирует мировые события по расписанию',
    `• Отслеживает ${indicators} ключевых индикаторов`,
  ];
  if ((entry.prediction_potential || 0) > 0.7) {
    parts.push('• Потенциал: ВЫСОКИЙ');
  }
  parts.push('', 'Если совпадение будет найдено, вы получите уведомление сразу.');
  return parts.join('\n');
}

export async function get14DayReport(
  entry: { id: string; title: string | null; content: string | null; created_at: string },
  supabase: SupabaseClient
): Promise<string> {
  const { data: matches } = await supabase
    .from('matches')
    .select('similarity_score, event_title')
    .eq('entry_id', entry.id)
    .gt('similarity_score', 0.5);

  const head = [
    `📊 Отчёт по записи от ${new Date(entry.created_at).toLocaleDateString()}`,
    `"${entry.title || (entry.content || '').slice(0, 50)}..."`,
    '',
  ];
  if (matches && matches.length > 0) {
    const best = [...matches].sort((a, b) => (b.similarity_score || 0) - (a.similarity_score || 0))[0];
    head.push(`✅ Обнаружено совпадение: "${best.event_title}" (${Math.round((best.similarity_score || 0) * 100)}%).`);
    head.push('Откройте запись для подробностей.');
  } else {
    head.push('🔍 Совпадений пока не найдено.');
    head.push('Это не означает, что сигнал неверный: некоторые корреляции проявляются позже.');
  }
  return head.join('\n');
}

export async function generateWeeklyDigest(
  userId: string,
  supabase: SupabaseClient
): Promise<{ title: string; message: string } | null> {
  const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: entries } = await supabase
    .from('entries')
    .select('id')
    .eq('user_id', userId)
    .gte('created_at', weekAgo);
  if (!entries || entries.length === 0) return null;

  const entryIds = entries.map((e) => e.id);
  const [{ data: myMatches }, { data: user }, { data: fp }, { count: platformMatches }] = await Promise.all([
    supabase
      .from('matches')
      .select('similarity_score, event_title')
      .eq('user_id', userId)
      .gt('similarity_score', 0.6)
      .gte('created_at', weekAgo),
    supabase
      .from('users')
      .select('streak_count, rating_score')
      .eq('id', userId)
      .maybeSingle(),
    supabase
      .from('symbolic_fingerprints')
      .select('total_dreams_analyzed')
      .eq('user_id', userId)
      .maybeSingle(),
    supabase
      .from('matches')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', weekAgo),
  ]);

  const parts = [`🔮 Ваша неделя в Кассандре`, '', `📝 Записей: ${entryIds.length}`];
  if ((user?.streak_count || 0) > 0) parts.push(`🔥 Серия: ${user?.streak_count} дней`);
  if ((user?.rating_score || 0) > 0) parts.push(`⚡ Рейтинг: ${(user?.rating_score || 0).toFixed(1)}`);
  parts.push('');

  if (myMatches && myMatches.length > 0) {
    parts.push('🎯 Ваши совпадения:');
    myMatches.slice(0, 3).forEach((m) => {
      parts.push(`• "${m.event_title}" — ${Math.round((m.similarity_score || 0) * 100)}%`);
    });
    parts.push('');
  }

  parts.push(`🌍 На платформе за неделю: ${platformMatches || 0} совпадений`);

  const analyzed = fp?.total_dreams_analyzed || 0;
  if (analyzed < 10) {
    parts.push('', `🧠 Символьный профиль: ${analyzed}/10`);
  } else if (analyzed < 20) {
    parts.push('', `🔮 Персональный оракул: ${analyzed}/20`);
  }
  parts.push('', 'Что вы чувствуете прямо сейчас? Новая запись усиливает точность профиля.');

  return {
    title: `🔮 Неделя: ${entryIds.length} записей${myMatches?.length ? `, ${myMatches.length} совпадений` : ''}`,
    message: parts.join('\n'),
  };
}
