import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { fetchAllEvents } from '../news';
import { scoreMatch, EntryData } from './scorer';
import { calculateRatingScore, getRoleForUser } from '../scoring';
import { createMatchNotification } from '../notifications';
import { updateUserProfile } from '../learning';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || ''; // Нужен сервисный ключ для обхода RLS

export async function runVerification(): Promise<{ checked: number; matched: number }> {
  if (!supabaseUrl || !supabaseServiceKey) {
    console.error('[Verification] SUPABASE_URL или SUPABASE_SERVICE_ROLE_KEY не установлены');
    return { checked: 0, matched: 0 };
  }

  const supabase = createClient(supabaseUrl, supabaseServiceKey);
  
  if (process.env.NODE_ENV !== 'production') console.info('[Verification] Начало цикла проверки...');

  // 1. Берем непроверенные записи (которые были проанализированы ИИ),
  // но не старше 30 дней чтобы не проверять вечно старые.
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const { data: entries, error: entriesError } = await supabase
    .from('entries')
    .select('*')
    .eq('is_verified', false)
    .not('ai_analyzed_at', 'is', null)
    .gte('created_at', thirtyDaysAgo.toISOString())
    .limit(50); // Пакетная обработка

  if (entriesError || !entries || entries.length === 0) {

    return { checked: 0, matched: 0 };
  }

  // 2. Загружаем свежие события (за последние 3 дня)
  // В идеале мы должны брать период от самой старой entry.created_at до сейчас,
  // но ограничимся 3 днями для оптимальности.
  const events = await fetchAllEvents(3);
  if (events.length === 0) {

    return { checked: 0, matched: 0 };
  }

  let matchedCount = 0;

  // 3. Проходим по всем записями
  for (const entry of entries) {
    const entryData: EntryData = {
      id: entry.id,
      created_at: entry.created_at,
      ai_images: entry.ai_images,
      ai_summary: entry.ai_summary,
      ai_specificity: entry.ai_specificity,
      ai_scale: entry.ai_scale,
      ai_geography: entry.ai_geography,
    };

    let bestScore = entry.best_match_score || 0;
    let hasMatch = false;

    // Сравниваем с каждым событием
    for (const event of events) {
      const match = await scoreMatch(entryData, event);
      
      if (match && match.match_score > 0.6) {
        // Мы нашли сильное совпадение!
        hasMatch = true;
        bestScore = Math.max(bestScore, match.match_score);
        matchedCount++;

        // Сохраняем в таблицу matches
        // UPSERT на случай если мы уже проверили это событие
        await supabase.from('matches').upsert({
          entry_id: entry.id,
          user_id: entry.user_id, // Добавлено: user_id обязателен в 001
          event_id: event.id,
          event_source: event.source,
          event_title: event.title,
          event_url: event.url,
          event_date: event.publishedAt.toISOString(), // В 001: event_date вместо event_published_at
          similarity_score: match.match_score, // В 001: similarity_score вместо match_score
          matched_symbols: match.matched_elements, // В 001: matched_symbols вместо matched_elements
          explanation: match.explanation,
          confidence: match.confidence
        }, { onConflict: 'entry_id, event_id' });

        // Уведомляем пользователя о найденном совпадении
        await createMatchNotification(entry.user_id, {
          entryId: entry.id,
          matchScore: match.match_score,
          eventTitle: event.title,
          explanation: match.explanation,
        });
      }
    }

    // Если прошло больше какого-то времени (например 7 дней после создания),
    // мы можем пометить запись как "verified", чтобы больше к ней не возвращаться.
    // Но пока для простоты пометим "verified" после первой же проверки (или если есть совпадение).
    // Чтобы не тратить постоянно токены на одни и те же записи.
    await supabase.from('entries').update({
      is_verified: true, // Помечаем как проверенную (даже если нет 100% совпадений)
      best_match_score: bestScore
    }).eq('id', entry.id);

    // Если было найдено совпадение, нужно обновить рейтинг и профиль юзера
    if (hasMatch && entry.user_id) {
       await recalculateUserRating(supabase, entry.user_id);
       await updateUserProfile(entry.user_id);
    }
  }

  return { checked: entries.length, matched: matchedCount };
}

/**
 * Пересчитывает рейтинг пользователя и его роль
 */
async function recalculateUserRating(supabase: SupabaseClient, userId: string) {
  // 1. Считаем verified_count
  const { data: verifiedEntries } = await supabase
    .from('entries')
    .select('id, best_match_score, ai_specificity, created_at')
    .eq('user_id', userId)
    .gt('best_match_score', 0.6);

  const verifiedCount = verifiedEntries?.length || 0;

  // 2. Считаем total_entries (для пенальти за спам)
  const { count: totalEntries } = await supabase
    .from('entries')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', userId);

  const total = totalEntries || 1;

  // 3. Вычисляем rating_score по формуле
  const ratingScore = calculateRatingScore(verifiedEntries || [], total);

  // 4. Считаем возраст аккаунта и количество записей для роли
  const { data: profile } = await supabase
    .from('users')
    .select('created_at')
    .eq('id', userId)
    .single();
  
  const daysSinceRegistration = profile ? (new Date().getTime() - new Date(profile.created_at).getTime()) / (1000 * 3600 * 24) : 0;
  
  // 5. Определяем роль
  const newRole = getRoleForUser({
    verifiedCount,
    ratingScore,
    daysSinceRegistration,
    totalEntries: total
  });

  // 6. Обновляем юзера
  await supabase.from('users').update({
    verified_count: verifiedCount,
    rating_score: ratingScore,
    role: newRole
  }).eq('id', userId);
  
  if (process.env.NODE_ENV !== 'production') console.info(`[Verification] Обновлен рейтинг юзера ${userId}: score=${ratingScore}, role=${newRole}`);
}
