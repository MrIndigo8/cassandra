export interface UserProfile {
  id: string;
  username: string;
  display_name?: string | null;
  bio?: string | null;
  avatar_url: string | null;
  role:
    | 'architect'
    | 'admin'
    | 'moderator'
    | 'observer'
    | 'chronicler'
    | 'oracle'
    | 'sensitive'
    | 'banned'
    | null;
  rating_score: number;
  // Legacy DB field from early schema; UI and scoring use rating_score.
  rating?: number | null;
  created_at: string;
  streak?: number | null;
  streak_count?: number | null;
  last_entry_date?: string | null;
  consent_accepted_at?: string | null;
  consent_version?: string | null;
}

/** Alias for backward-compatibility with useUser hook */
export type User = UserProfile;

export interface Entry {
  id: string;
  user_id: string;
  type:
    | 'dream'
    | 'premonition'
    | 'unknown'
    | 'feeling'
    | 'vision'
    | 'anxiety'
    | 'thought'
    | 'deja_vu'
    | 'sensation'
    | 'mood'
    | 'synchronicity';
  title: string;
  content: string;
  is_public: boolean;
  is_anonymous: boolean;
  is_quarantine: boolean;
  ip_country_code: string | null;
  ip_geography: string | null;
  image_url: string | null;
  ai_images: string[] | null;
  ai_emotions: string[] | null;
  ai_scale: 'personal' | 'local' | 'global' | null;
  ai_geography: string | null;
  ai_specificity: number | null;
  ai_summary: string | null;
  ai_analyzed_at: string | null;
  /** Сериализация анализа: pending → in_progress → completed | failed */
  analysis_status?: 'pending' | 'in_progress' | 'completed' | 'failed';
  analysis_started_at?: string | null;
  anxiety_score?: number | null;
  threat_type?: 'conflict' | 'disaster' | 'economic' | 'health' | 'social' | 'personal' | 'unknown' | null;
  temporal_urgency?: 'imminent' | 'near_term' | 'distant' | 'unclear' | null;
  emotional_intensity?: 'panic' | 'anxiety' | 'foreboding' | 'neutral' | null;
  geography_iso?: string | null;
  sensory_data?: {
    sensory_patterns?: Array<{ sensation: string; intensity: string; body_response: string }>;
    potential_event_types?: Array<{ event_type: string; confidence: number; reasoning: string }>;
    collectivity?: { is_collective: boolean; people_mentioned: string; indicator: string };
    geography_clues?: { explicit: string | null; implicit_clues: string[] };
    verification_keywords?: string[];
  } | null;
  is_verified: boolean;
  best_match_score: number | null;
  created_at: string;
  intensity?: number | null;
  prediction_potential?: number | null;
  user_insight?: string | null;

  // joined fields
  users?: UserProfile | null;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  message: string;
  data: Record<string, unknown> | null;
  status: 'unread' | 'read' | 'pending' | 'scheduled' | 'cancelled' | 'archived';
  created_at: string;
  read_at?: string;
  action_type?: string;
  entry_id?: string;
  scheduled_for?: string;
  /** Ключ в messages.touchpoints.* (например scheduled.deep_insight, body.deep_insight) */
  template_key?: string | null;
  template_params?: Record<string, unknown> | null;
  locale?: string | null;
}

export interface ExternalSignal {
  id: string;
  source: 'reddit' | 'polymarket';
  external_id: string;
  title: string;
  content: string;
  url: string | null;
  published_at: string;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface Cluster {
  id: string;
  image: string;
  intensity_score: number;
  entry_count: number;
  status: 'active' | 'resolved';
  first_seen_at: string;
  last_seen_at: string;
  geography: string[];
  prediction_text: string | null;
  affected_entries: string[];
}

export interface Match {
  id: string;
  entry_id: string;
  event_id: string;
  match_score: number;
  news_title: string;
  news_url: string;
  news_source: string;
  created_at: string;
}
