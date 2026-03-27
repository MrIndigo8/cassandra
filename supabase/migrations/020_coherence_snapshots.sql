-- ============================================================
-- Миграция 020: Coherence snapshots
-- ============================================================

CREATE TABLE IF NOT EXISTS public.coherence_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  current_coherence DOUBLE PRECISION NOT NULL,
  baseline_coherence DOUBLE PRECISION,
  stddev_coherence DOUBLE PRECISION,
  z_score DOUBLE PRECISION,
  is_anomaly BOOLEAN NOT NULL DEFAULT false,
  entry_count INTEGER NOT NULL DEFAULT 0,
  pair_count INTEGER NOT NULL DEFAULT 0,
  window_start TIMESTAMPTZ NOT NULL,
  window_end TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coherence_snapshots_created_at
  ON public.coherence_snapshots(created_at DESC);
