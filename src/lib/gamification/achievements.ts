/** Достижения на основе уже хранимой статистики (без отдельной таблицы). */
export function getProfileAchievements(stats: {
  streak_count: number;
  verified_count: number;
  total_entries: number;
  rating_score: number;
  role: string;
}): Array<{ id: string; icon: string; key: string }> {
  const out: Array<{ id: string; icon: string; key: string }> = [];

  if (stats.total_entries >= 1) {
    out.push({ id: 'first_signal', icon: '📡', key: 'firstSignal' });
  }
  if (stats.streak_count >= 7) {
    out.push({ id: 'streak_7', icon: '🔥', key: 'streak7' });
  }
  if (stats.verified_count >= 1) {
    out.push({ id: 'first_match', icon: '✨', key: 'firstMatch' });
  }
  if (stats.verified_count >= 5) {
    out.push({ id: 'matches_5', icon: '🎯', key: 'matches5' });
  }
  if (stats.rating_score >= 4) {
    out.push({ id: 'rating_4', icon: '⭐', key: 'rating4' });
  }
  if (['oracle', 'sensitive', 'chronicler', 'architect', 'admin', 'moderator'].includes(stats.role)) {
    out.push({ id: 'role_milestone', icon: '🏅', key: 'roleMilestone' });
  }

  return out;
}
