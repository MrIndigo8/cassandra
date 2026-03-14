// ============================================================
// Кассандра — Глобальные типы
// Центральное хранилище всех типов проекта
// ============================================================

// --- Роли пользователей ---
export type UserRole = 'observer' | 'chronicler' | 'sensitive' | 'oracle';

// --- Типы записей ---
export type EntryType = 'dream' | 'premonition';

// --- Статусы верификации ---
export type VerificationStatus = 'pending' | 'processing' | 'verified' | 'rejected';

// --- Статусы уведомлений ---
export type NotificationStatus = 'unread' | 'read' | 'archived';

// --- Типы уведомлений ---
export type NotificationType =
  | 'match_found'       // Найдено совпадение с реальным событием
  | 'role_upgrade'      // Повышение роли
  | 'cluster_alert'     // Аномалия в кластере
  | 'streak_milestone'  // Достижение серии
  | 'system';           // Системное уведомление

// --- Профиль пользователя ---
export interface User {
  id: string;
  email: string;
  username: string;
  display_name: string | null;
  avatar_url: string | null;
  bio: string | null;
  role: UserRole;
  rating: number;
  trust_score: number;
  streak: number;
  longest_streak: number;
  total_entries: number;
  total_matches: number;
  is_public: boolean;
  created_at: string;         // ISO timestamp
  updated_at: string;         // ISO timestamp
  last_entry_at: string | null;
}

// --- Запись сна / предчувствия ---
export interface Entry {
  id: string;
  user_id: string;
  type: EntryType;
  title: string;
  content: string;             // Основной текст записи
  emotion: string | null;      // Эмоциональный тон (от Claude)
  symbols: string[];           // Ключевые символы/образы (от Claude)
  location: string | null;     // Упомянутая локация
  intensity: number | null;    // Интенсивность 1-10

  // Поля AI-анализа (заполняются фоновой задачей)
  ai_summary: string | null;
  ai_symbols: string[] | null;
  ai_emotions: string[] | null;
  ai_themes: string[] | null;
  ai_prediction_score: number | null;  // Вероятность совпадения 0-1
  ai_analyzed_at: string | null;

  is_public: boolean;
  is_anonymous: boolean;       // Публичная, но без имени автора

  created_at: string;          // ТОЛЬКО ОТ СЕРВЕРА — DEFAULT NOW()
  updated_at: string;
}

// --- История правок записи (неудаляемая) ---
export interface EntryEdit {
  id: string;
  entry_id: string;
  user_id: string;
  field_name: string;          // Какое поле изменено
  old_value: string | null;
  new_value: string | null;
  edited_at: string;           // ISO timestamp
}

// --- Совпадение записи с реальным событием ---
export interface Match {
  id: string;
  entry_id: string;
  user_id: string;

  // Данные о реальном событии
  event_title: string;
  event_description: string | null;
  event_source: string;        // GDELT, NewsAPI, USGS, ReliefWeb
  event_url: string | null;
  event_date: string;          // ОБЯЗАТЕЛЬНО > entry.created_at
  event_location: string | null;

  // Оценка совпадения
  similarity_score: number;    // 0-1, от Claude
  matched_symbols: string[];   // Какие символы совпали
  explanation: string | null;  // Объяснение от Claude

  // Верификация
  verification_status: VerificationStatus;
  verified_by: string | null;  // ID модератора или 'auto'
  verified_at: string | null;

  created_at: string;
  updated_at: string;
}

// --- Коллективный кластер образов ---
export interface Cluster {
  id: string;
  title: string;
  description: string | null;
  symbols: string[];           // Общие символы кластера
  themes: string[];            // Общие темы
  entry_ids: string[];         // ID записей в кластере
  user_count: number;          // Сколько разных пользователей

  // Метрики аномалии
  anomaly_score: number;       // Насколько аномальный (0-1)
  baseline_frequency: number;  // Обычная частота появления
  current_frequency: number;   // Текущая частота

  geo_center: string | null;   // Географический центр (если есть)
  is_active: boolean;

  created_at: string;
  updated_at: string;
  expires_at: string | null;   // Кластеры могут затухать
}

// --- Уведомление ---
export interface Notification {
  id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  message: string;
  data: Record<string, unknown> | null;  // Дополнительные данные (JSON)
  status: NotificationStatus;
  read_at: string | null;
  created_at: string;
}

// --- API Response типы ---
export interface ApiResponse<T> {
  data: T | null;
  error: string | null;
  status: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
  has_more: boolean;
}

// --- Форма создания записи ---
export interface CreateEntryInput {
  type: EntryType;
  title: string;
  content: string;
  emotion: string | null;
  symbols: string[];
  location: string | null;
  intensity: number | null;
  is_public: boolean;
  is_anonymous: boolean;
}

// --- Форма обновления записи ---
export interface UpdateEntryInput {
  title?: string;
  content?: string;
  emotion?: string | null;
  symbols?: string[];
  location?: string | null;
  intensity?: number | null;
  is_public?: boolean;
  is_anonymous?: boolean;
}

// --- Форма обновления профиля ---
export interface UpdateUserInput {
  display_name?: string | null;
  bio?: string | null;
  avatar_url?: string | null;
  is_public?: boolean;
}

// --- Весовые коэффициенты ролей для кластеров ---
export const ROLE_WEIGHTS: Record<UserRole, number> = {
  observer: 0.5,
  chronicler: 1.0,
  sensitive: 2.0,
  oracle: 5.0,
} as const;

// --- Требования для повышения ролей ---
export const ROLE_REQUIREMENTS = {
  chronicler: {
    min_days: 30,
    min_entries: 10,
  },
  sensitive: {
    min_matches: 1,
    min_rating: 5,
  },
  oracle: {
    min_matches: 3,
    top_percentile: 0.001, // Топ 0.1%
  },
} as const;
