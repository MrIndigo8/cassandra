/**
 * Вычисляет rating_score пользователя на основе его верифицированных записей.
 */
export function calculateRatingScore(
  verifiedEntries: { best_match_score: number; ai_specificity: number; created_at: string }[],
  totalEntries: number
): number {
  if (verifiedEntries.length === 0 || totalEntries === 0) return 0;

  let sum = 0;
  const now = new Date().getTime();

  for (const entry of verifiedEntries) {
    // Чем старее запись, тем меньше ее вес (период полураспада ~1 год)
    const entryDate = new Date(entry.created_at).getTime();
    const daysSinceEntry = Math.max(0, (now - entryDate) / (1000 * 3600 * 24));
    const recencyWeight = 1 / (1 + daysSinceEntry / 365);
    
    // Формула для одного попадания
    const hitScore = entry.best_match_score * (entry.ai_specificity || 0.1) * recencyWeight;
    sum += hitScore;
  }

  // Пенальти за "спам" - если человек делает 1000 записей и 1 угадывает, рейтинг должен быть ниже.
  // Делим на корень из общего числа записей.
  const score = sum / Math.sqrt(totalEntries);
  
  return Number(score.toFixed(4));
}

interface UserStats {
  verifiedCount: number;
  ratingScore: number;
  daysSinceRegistration: number;
  totalEntries: number;
}

/**
 * Определяет роль пользователя на основе его статов.
 */
export function getRoleForUser(stats: UserStats): 'observer' | 'chronicler' | 'sensitive' | 'oracle' {
  // Oracle: 3+ подтверждений и очень высокий рейтинг
  if (stats.verifiedCount >= 3 && stats.ratingScore > 10) {
    return 'oracle';
  }
  
  // Sensitive: 1+ подтверждение и хороший рейтинг
  if (stats.verifiedCount >= 1 && stats.ratingScore > 5) {
    return 'sensitive';
  }
  
  // Chronicler: активный пользователь давно на платформе
  if (stats.daysSinceRegistration >= 30 && stats.totalEntries >= 10) {
    return 'chronicler';
  }
  
  // По умолчанию
  return 'observer';
}
