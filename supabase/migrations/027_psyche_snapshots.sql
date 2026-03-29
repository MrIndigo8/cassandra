-- ═══ Psyche snapshots: individual extension, geo, global, RLS, research settings ═══

-- Индивидуальные снимки (расширение symbolic_fingerprints)
ALTER TABLE public.symbolic_fingerprints
  ADD COLUMN IF NOT EXISTS emotional_trajectory JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS archetype_trajectory JSONB NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS anomaly_entries UUID[] NOT NULL DEFAULT '{}'::uuid[],
  ADD COLUMN IF NOT EXISTS current_state JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Геолокационные снимки
CREATE TABLE IF NOT EXISTS public.geo_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  country_iso TEXT NOT NULL,
  snapshot_period TEXT NOT NULL,
  period_start TIMESTAMPTZ NOT NULL,
  period_end TIMESTAMPTZ NOT NULL,

  emotional_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  archetype_profile JSONB NOT NULL DEFAULT '{}'::jsonb,
  belief_patterns JSONB NOT NULL DEFAULT '{}'::jsonb,
  dominant_symbols JSONB NOT NULL DEFAULT '[]'::jsonb,

  avg_anxiety DOUBLE PRECISION,
  max_anxiety DOUBLE PRECISION,
  entry_count INTEGER NOT NULL DEFAULT 0,
  unique_users INTEGER NOT NULL DEFAULT 0,

  type_distribution JSONB NOT NULL DEFAULT '{}'::jsonb,
  internal_coherence DOUBLE PRECISION,

  trends JSONB NOT NULL DEFAULT '{}'::jsonb,
  signals JSONB NOT NULL DEFAULT '[]'::jsonb,
  social_forecast JSONB NOT NULL DEFAULT '[]'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT geo_snapshots_country_period_start_key UNIQUE (country_iso, snapshot_period, period_start)
);

CREATE INDEX IF NOT EXISTS idx_geo_snap_country ON public.geo_snapshots(country_iso);
CREATE INDEX IF NOT EXISTS idx_geo_snap_period ON public.geo_snapshots(period_start DESC);
CREATE INDEX IF NOT EXISTS idx_geo_snap_lookup ON public.geo_snapshots(country_iso, snapshot_period, period_start DESC);

-- Глобальные снимки
CREATE TABLE IF NOT EXISTS public.global_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),

  snapshot_date DATE NOT NULL,

  global_emotional JSONB NOT NULL DEFAULT '{}'::jsonb,
  global_archetypes JSONB NOT NULL DEFAULT '{}'::jsonb,
  cross_region JSONB NOT NULL DEFAULT '{}'::jsonb,
  global_beliefs JSONB NOT NULL DEFAULT '{}'::jsonb,

  global_coherence DOUBLE PRECISION,
  coherence_change DOUBLE PRECISION,
  anomaly_count INTEGER NOT NULL DEFAULT 0,
  prediction_confidence DOUBLE PRECISION,

  total_entries INTEGER NOT NULL DEFAULT 0,
  total_users INTEGER NOT NULL DEFAULT 0,
  countries_active INTEGER NOT NULL DEFAULT 0,

  reality_snapshot_id UUID REFERENCES public.reality_snapshots(id),
  global_social_forecast JSONB NOT NULL DEFAULT '[]'::jsonb,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT global_snapshots_snapshot_date_key UNIQUE (snapshot_date)
);

CREATE INDEX IF NOT EXISTS idx_global_snap_date ON public.global_snapshots(snapshot_date DESC);

-- RLS
ALTER TABLE public.geo_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.global_snapshots ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin reads geo" ON public.geo_snapshots;
CREATE POLICY "Admin reads geo"
  ON public.geo_snapshots FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('architect', 'admin')
    )
  );

DROP POLICY IF EXISTS "Admin reads global" ON public.global_snapshots;
CREATE POLICY "Admin reads global"
  ON public.global_snapshots FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.users
      WHERE id = auth.uid() AND role IN ('architect', 'admin')
    )
  );

INSERT INTO public.system_settings (key, value)
VALUES
  ('research_portal.enabled', '{"enabled": false}'::jsonb),
  ('research_portal.access_key', '{"key": null}'::jsonb)
ON CONFLICT (key) DO NOTHING;
