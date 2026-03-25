export interface UserProfile {
  id: string;
  username: string;
  avatar_url: string | null;
  role: 'observer' | 'chronicler' | 'oracle' | 'sensitive' | null;
  rating_score: number;
}

export interface Entry {
  id: string;
  user_id: string;
  type: 'dream' | 'premonition' | 'unknown' | 'feeling' | 'vision';
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
  is_verified: boolean;
  best_match_score: number | null;
  created_at: string;
  intensity?: number | null;
  
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
  status: 'unread' | 'read' | 'pending';
  created_at: string;
  read_at?: string;
  action_type?: string;
  entry_id?: string;
  scheduled_for?: string;
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
