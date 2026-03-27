-- Phase 1 alignment migration (forward-only)
-- Adds only missing schema pieces required by master plan.

-- Entries: scope and prediction potential
ALTER TABLE public.entries
  ADD COLUMN IF NOT EXISTS scope TEXT CHECK (scope IN ('world', 'personal', 'unknown')) DEFAULT 'unknown';

ALTER TABLE public.entries
  ADD COLUMN IF NOT EXISTS prediction_potential DOUBLE PRECISION;

-- Users: streak tracking fields used by app logic
ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS streak_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS last_entry_date DATE;

-- Keep role/rating defaults consistent
ALTER TABLE public.users ALTER COLUMN role SET DEFAULT 'observer';
ALTER TABLE public.users ALTER COLUMN rating_score SET DEFAULT 0;

-- Community confirmations (for "I had similar signal")
CREATE TABLE IF NOT EXISTS public.community_confirmations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES public.entries(id) ON DELETE CASCADE,
  confirmer_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  matched_patterns TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(entry_id, confirmer_id)
);

CREATE INDEX IF NOT EXISTS idx_community_confirmations_entry
  ON public.community_confirmations(entry_id);

ALTER TABLE public.community_confirmations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Auth can confirm" ON public.community_confirmations;
CREATE POLICY "Auth can confirm"
  ON public.community_confirmations
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = confirmer_id);

DROP POLICY IF EXISTS "Public can read" ON public.community_confirmations;
CREATE POLICY "Public can read"
  ON public.community_confirmations
  FOR SELECT
  USING (true);

-- Missing indexes requested by plan
CREATE INDEX IF NOT EXISTS idx_entries_scope ON public.entries(scope);
