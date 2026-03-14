// ============================================================
// Scoring — алгоритм рейтинга пользователей
// trust_score, role upgrades, кластерные веса
// ============================================================

import type { UserRole } from '@/types';
import { ROLE_WEIGHTS, ROLE_REQUIREMENTS } from '@/types';

// TODO: Фаза 2, Шаг 11 — реализация

/**
 * Рассчитать trust_score пользователя
 * Учитывает: количество записей, совпадения, серию, возраст аккаунта
 */
export function calculateTrustScore(): number {
  // Заглушка
  return 0;
}

/**
 * Определить текущую роль пользователя по метрикам
 */
export function determineRole(): UserRole {
  // По умолчанию все начинают как observer
  return 'observer';
}

/**
 * Получить вес пользователя в кластерах
 */
export function getRoleWeight(role: UserRole): number {
  return ROLE_WEIGHTS[role];
}

/**
 * Проверить, готов ли пользователь к повышению роли
 */
export function checkRoleUpgrade(): { eligible: boolean; nextRole: UserRole | null } {
  // Заглушка
  void ROLE_REQUIREMENTS; // для предотвращения unused warning
  return { eligible: false, nextRole: null };
}
