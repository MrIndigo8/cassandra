import type { SupabaseClient } from '@supabase/supabase-js';

export interface UserScoringData {
  rating_score: number;
  role: string;
  verified_count: number;
  total_entries: number;
}

/**
 * Рассчитывает рейтинг пользователя (0..10)
 * Формула: matchScore(0-5) + activityScore(0-2) + qualityScore(0-2) + communityScore(0-1)
 */
export async function calculateRatingScore(
  userId: string,
  supabase: SupabaseClient
): Promise<number> {
  const { data: matches } = await supabase
    .from('matches')
    .select('similarity_score, created_at')
    .eq('user_id', userId)
    .gt('similarity_score', 0.6);

  let matchPoints = 0;
  if (matches && matches.length > 0) {
    const now = Date.now();
    for (const match of matches) {
      const ageDays = (now - new Date(match.created_at).getTime()) / (1000 * 60 * 60 * 24);
      const recencyWeight = Math.max(0.3, 1 - ageDays / 500);
      matchPoints += (match.similarity_score || 0) * recencyWeight;
    }
  }
  const matchScore = Math.min(5, matchPoints * 1.5);

  const { data: user } = await supabase
    .from('users')
    .select('total_entries, avg_specificity, dominant_images')
    .eq('id', userId)
    .single();

  const totalEntries = user?.total_entries || 0;
  let activityScore = 0;
  if (totalEntries >= 31) activityScore = 2.0;
  else if (totalEntries >= 16) activityScore = 1.5;
  else if (totalEntries >= 6) activityScore = 1.0;
  else if (totalEntries >= 1) activityScore = 0.5;

  const avgSpec = user?.avg_specificity || 0;
  const dominantImages = user?.dominant_images || [];
  const qualityScore = Math.min(2, avgSpec * 1.5 + Math.min(0.5, dominantImages.length * 0.1));

  const { count: commentCount } = await supabase
    .from('comments')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', userId);

  let communityScore = 0;
  const comments = commentCount || 0;
  if (comments >= 31) communityScore = 1.0;
  else if (comments >= 11) communityScore = 0.6;
  else if (comments >= 1) communityScore = 0.3;

  const total = matchScore + activityScore + qualityScore + communityScore;
  return Math.round(Math.min(10, total) * 10) / 10;
}

/**
 * Определяет роль пользователя по рейтингу и статистике
 */
export function getRoleForUser(
  ratingScore: number,
  verifiedCount: number,
  totalEntries: number
): 'observer' | 'chronicler' | 'sensitive' | 'oracle' {
  if (ratingScore >= 7 && verifiedCount >= 3) return 'oracle';
  if (ratingScore >= 4 && verifiedCount >= 1) return 'sensitive';
  if (ratingScore >= 2 || totalEntries >= 10) return 'chronicler';
  return 'observer';
}

/**
 * Пересчитывает и сохраняет рейтинг + роль пользователя.
 */
export async function updateUserScoring(
  userId: string,
  supabase: SupabaseClient
): Promise<UserScoringData> {
  const ratingScore = await calculateRatingScore(userId, supabase);

  const { data: user } = await supabase
    .from('users')
    .select('verified_count, total_entries, role')
    .eq('id', userId)
    .single();

  const verifiedCount = user?.verified_count || 0;
  const totalEntries = user?.total_entries || 0;
  const currentRole = String(user?.role || 'observer');
  const lockedRoles = new Set(['architect', 'admin', 'moderator', 'banned']);
  const role = lockedRoles.has(currentRole)
    ? currentRole
    : getRoleForUser(ratingScore, verifiedCount, totalEntries);

  await supabase
    .from('users')
    .update({ rating_score: ratingScore, role })
    .eq('id', userId);

  return {
    rating_score: ratingScore,
    role,
    verified_count: verifiedCount,
    total_entries: totalEntries,
  };
}

export function getProgressToNextRole(
  ratingScore: number,
  verifiedCount: number,
  totalEntries: number,
  currentRole: string
): { nextRole: string; progress: number; hint: string } | null {
  switch (currentRole) {
    case 'observer': {
      const progressToChronicler = Math.max(ratingScore / 2, totalEntries / 10);
      return {
        nextRole: 'chronicler',
        progress: Math.min(1, progressToChronicler),
        hint: totalEntries < 10
          ? `Напишите ещё ${10 - totalEntries} записей`
          : 'Повышайте качество записей',
      };
    }
    case 'chronicler': {
      const ratingProgress = Math.min(1, ratingScore / 4);
      const matchProgress = verifiedCount >= 1 ? 1 : 0;
      return {
        nextRole: 'sensitive',
        progress: (ratingProgress + matchProgress) / 2,
        hint: verifiedCount < 1
          ? 'Нужно хотя бы 1 подтверждённое совпадение'
          : 'Повышайте рейтинг качественными записями',
      };
    }
    case 'sensitive':
      return {
        nextRole: 'oracle',
        progress: Math.min(1, (ratingScore / 7 + Math.min(1, verifiedCount / 3)) / 2),
        hint: verifiedCount < 3
          ? `Нужно ещё ${3 - verifiedCount} совпадений`
          : 'Продолжайте — вы близки к статусу Оракула',
      };
    case 'oracle':
    default:
      return null;
  }
}
