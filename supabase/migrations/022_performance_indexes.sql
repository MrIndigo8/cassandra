-- Performance indexes for hot read paths (safe forward-only migration)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- Matches: feed/events/profile/admin hot paths
CREATE INDEX IF NOT EXISTS idx_matches_recent_highscore
ON public.matches(created_at DESC)
WHERE similarity_score > 0.6;

CREATE INDEX IF NOT EXISTS idx_matches_user_highscore
ON public.matches(user_id, similarity_score DESC)
WHERE similarity_score > 0.6;

CREATE INDEX IF NOT EXISTS idx_matches_entry_highscore
ON public.matches(entry_id, similarity_score DESC)
WHERE similarity_score > 0.6;

CREATE INDEX IF NOT EXISTS idx_matches_similarity_desc
ON public.matches(similarity_score DESC);

-- Entries: profile and feed timeline
CREATE INDEX IF NOT EXISTS idx_entries_user_created
ON public.entries(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_entries_public_or_null_feed
ON public.entries(created_at DESC)
WHERE is_public = true OR is_public IS NULL;

-- Users: admin sorting and search
CREATE INDEX IF NOT EXISTS idx_users_rating_score_desc
ON public.users(rating_score DESC);

CREATE INDEX IF NOT EXISTS idx_users_created_at_desc
ON public.users(created_at DESC);

CREATE INDEX IF NOT EXISTS idx_users_username_trgm
ON public.users USING GIN (username gin_trgm_ops);

-- Admin audit
CREATE INDEX IF NOT EXISTS idx_admin_actions_type_created
ON public.admin_actions(action_type, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_admin_actions_admin_created
ON public.admin_actions(admin_id, created_at DESC);

-- Frequent list queries
CREATE INDEX IF NOT EXISTS idx_comments_entry_created
ON public.comments(entry_id, created_at ASC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
ON public.notifications(user_id, created_at DESC);

