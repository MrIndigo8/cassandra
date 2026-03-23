CREATE TABLE IF NOT EXISTS external_signals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source TEXT CHECK (source IN ('reddit','polymarket','rss')),
  external_id TEXT NOT NULL,
  title TEXT,
  content TEXT,
  url TEXT,
  geography TEXT,
  published_at TIMESTAMPTZ,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(source, external_id)
);
ALTER TABLE external_signals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "external_signals_public" ON external_signals
  FOR SELECT USING (true);
