-- Migration 028: Security fixes and performance indexes
-- Fixes: RLS on matches (was public to anon), adds missing indexes

-- ============================================================
-- 1. Fix RLS on matches — restrict SELECT to entry owner
-- ============================================================
DROP POLICY IF EXISTS "Anyone can read matches" ON public.matches;
DROP POLICY IF EXISTS "matches_select_own" ON public.matches;

CREATE POLICY "matches_select_own" ON public.matches
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.entries
      WHERE entries.id = matches.entry_id
        AND entries.user_id = auth.uid()
    )
    OR
    EXISTS (
      SELECT 1 FROM public.users
      WHERE users.id = auth.uid()
        AND users.role IN ('architect', 'admin', 'moderator')
    )
  );

-- ============================================================
-- 2. Missing indexes for hot query paths
-- ============================================================

-- Feed stats: reactions by user + emoji + entry
CREATE INDEX IF NOT EXISTS idx_reactions_user_emoji_entry
  ON public.entry_reactions(user_id, emoji, entry_id);

-- Admin audit: filter by admin + action type, sort by date
CREATE INDEX IF NOT EXISTS idx_admin_actions_admin_type_created
  ON public.admin_actions(admin_id, action_type, created_at DESC);

-- Clusters: active sorted by anomaly score
CREATE INDEX IF NOT EXISTS idx_clusters_active_anomaly
  ON public.clusters(is_active, anomaly_score DESC, created_at DESC)
  WHERE is_active = true;

-- External signals: filter by source, sort by date
CREATE INDEX IF NOT EXISTS idx_external_signals_source_published
  ON public.external_signals(source, published_at DESC);

-- ============================================================
-- 3. Atomic streak update function (prevents TOCTOU race)
-- ============================================================
CREATE OR REPLACE FUNCTION public.increment_entry_stats(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_today DATE := CURRENT_DATE;
  v_last_date DATE;
  v_streak INT;
BEGIN
  SELECT last_entry_date, streak_count INTO v_last_date, v_streak
  FROM public.users WHERE id = p_user_id FOR UPDATE;

  IF NOT FOUND THEN RETURN; END IF;

  IF v_last_date = v_today THEN
    -- Already posted today, just increment total
    UPDATE public.users
    SET total_entries = COALESCE(total_entries, 0) + 1,
        streak_count = GREATEST(COALESCE(v_streak, 0), 1)
    WHERE id = p_user_id;
  ELSIF v_last_date = v_today - 1 THEN
    -- Consecutive day
    UPDATE public.users
    SET total_entries = COALESCE(total_entries, 0) + 1,
        streak_count = COALESCE(v_streak, 0) + 1,
        last_entry_date = v_today
    WHERE id = p_user_id;
  ELSE
    -- Streak broken or first entry
    UPDATE public.users
    SET total_entries = COALESCE(total_entries, 0) + 1,
        streak_count = 1,
        last_entry_date = v_today
    WHERE id = p_user_id;
  END IF;
END;
$$;

-- Entry views: allow SELECT for view counts
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'entry_views' AND policyname = 'entry_views_select'
  ) THEN
    CREATE POLICY "entry_views_select" ON public.entry_views
      FOR SELECT USING (true);
  END IF;
END $$;
