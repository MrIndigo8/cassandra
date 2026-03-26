ALTER TABLE public.entries ADD COLUMN IF NOT EXISTS anxiety_score SMALLINT CHECK (anxiety_score BETWEEN 0 AND 10);
ALTER TABLE public.entries ADD COLUMN IF NOT EXISTS threat_type TEXT CHECK (threat_type IN ('conflict','disaster','economic','health','social','personal','unknown'));
ALTER TABLE public.entries ADD COLUMN IF NOT EXISTS temporal_urgency TEXT CHECK (temporal_urgency IN ('imminent','near_term','distant','unclear'));
ALTER TABLE public.entries ADD COLUMN IF NOT EXISTS emotional_intensity TEXT CHECK (emotional_intensity IN ('panic','anxiety','foreboding','neutral'));
ALTER TABLE public.entries ADD COLUMN IF NOT EXISTS geography_iso TEXT;

CREATE INDEX IF NOT EXISTS idx_entries_anxiety ON public.entries(anxiety_score) WHERE anxiety_score IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_entries_geography_iso ON public.entries(geography_iso) WHERE geography_iso IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_entries_threat_type ON public.entries(threat_type) WHERE threat_type IS NOT NULL;
