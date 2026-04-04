-- Serialized entry analysis: only one worker (sync or cron) may analyze at a time.

DO $$
BEGIN
  CREATE TYPE public.entry_analysis_status AS ENUM (
    'pending',
    'in_progress',
    'completed',
    'failed'
  );
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE public.entries
  ADD COLUMN IF NOT EXISTS analysis_status public.entry_analysis_status NOT NULL DEFAULT 'pending';

ALTER TABLE public.entries
  ADD COLUMN IF NOT EXISTS analysis_started_at TIMESTAMPTZ;

-- Existing analyzed rows → completed
UPDATE public.entries
SET analysis_status = 'completed'
WHERE ai_analyzed_at IS NOT NULL
  AND analysis_status = 'pending';

CREATE INDEX IF NOT EXISTS idx_entries_analysis_status_pending
  ON public.entries(created_at ASC)
  WHERE analysis_status = 'pending';

COMMENT ON COLUMN public.entries.analysis_status IS 'Lifecycle of AI analysis: pending → in_progress → completed | failed';
COMMENT ON COLUMN public.entries.analysis_started_at IS 'Set when analysis_status becomes in_progress; used for stuck lock recovery (10 min)';
