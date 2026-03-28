-- ============================================================
-- 024: Научный слой — deep_analysis, symbolic_fingerprints, reality_snapshots, user_insight, hash
-- Идемпотентно: IF NOT EXISTS / ADD COLUMN IF NOT EXISTS
-- ============================================================

-- Глубинный анализ записи (фоновый / второй проход)
CREATE TABLE IF NOT EXISTS public.deep_analysis (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES public.entries(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  archetypes TEXT[],
  narrative_structure TEXT,
  symbolic_elements JSONB,
  emotional_spectrum JSONB,
  cognitive_markers JSONB,
  is_recurring BOOLEAN NOT NULL DEFAULT false,
  recurring_elements TEXT[],
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT deep_analysis_entry_id_key UNIQUE (entry_id)
);

CREATE INDEX IF NOT EXISTS idx_deep_analysis_user ON public.deep_analysis(user_id);
CREATE INDEX IF NOT EXISTS idx_deep_analysis_created_at ON public.deep_analysis(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_deep_analysis_archetypes ON public.deep_analysis USING gin (archetypes);

-- Символьный отпечаток пользователя
CREATE TABLE IF NOT EXISTS public.symbolic_fingerprints (
  user_id UUID PRIMARY KEY REFERENCES public.users(id) ON DELETE CASCADE,
  symbol_frequency JSONB NOT NULL DEFAULT '{}'::jsonb,
  dominant_archetypes TEXT[] NOT NULL DEFAULT '{}'::text[],
  narrative_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  emotional_baseline JSONB NOT NULL DEFAULT '{}'::jsonb,
  cognitive_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  predictive_patterns JSONB NOT NULL DEFAULT '[]'::jsonb,
  total_dreams_analyzed INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ежедневные снимки «реальности» (агрегат коллектива)
CREATE TABLE IF NOT EXISTS public.reality_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_date DATE NOT NULL,
  dominant_scenes JSONB,
  emotional_weather JSONB,
  archetype_activity JSONB,
  coherence_index DOUBLE PRECISION,
  coherence_change DOUBLE PRECISION,
  anomalies JSONB,
  prediction JSONB,
  total_entries_analyzed INTEGER NOT NULL DEFAULT 0,
  total_users INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT reality_snapshots_snapshot_date_key UNIQUE (snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_reality_snapshots_date ON public.reality_snapshots(snapshot_date DESC);

-- Запись: хеш содержимого + флаг верификации времени + инсайт для UI
ALTER TABLE public.entries ADD COLUMN IF NOT EXISTS content_hash TEXT;
ALTER TABLE public.entries ADD COLUMN IF NOT EXISTS timestamp_verified BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE public.entries ADD COLUMN IF NOT EXISTS user_insight TEXT;

-- RLS
ALTER TABLE public.deep_analysis ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.symbolic_fingerprints ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reality_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "deep_analysis_select_own" ON public.deep_analysis;
CREATE POLICY "deep_analysis_select_own"
  ON public.deep_analysis FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "symbolic_fingerprints_select_own" ON public.symbolic_fingerprints;
CREATE POLICY "symbolic_fingerprints_select_own"
  ON public.symbolic_fingerprints FOR SELECT
  USING (auth.uid() = user_id);

-- Запись в fingerprint/deep_analysis — только service_role (RLS без INSERT для пользователя)

-- Снимки: чтение всем авторизованным (агрегаты не персональные)
DROP POLICY IF EXISTS "reality_snapshots_select_authenticated" ON public.reality_snapshots;
CREATE POLICY "reality_snapshots_select_authenticated"
  ON public.reality_snapshots FOR SELECT
  TO authenticated
  USING (true);

-- Архитектор по email (если есть в auth.users)
DO $$
BEGIN
  UPDATE public.users u
  SET role = 'architect'
  FROM auth.users au
  WHERE u.id = au.id
    AND au.email = 'ruslankasiankou@gmail.com'
    AND COALESCE(u.role, '') <> 'architect';
EXCEPTION
  WHEN OTHERS THEN
    NULL;
END $$;
