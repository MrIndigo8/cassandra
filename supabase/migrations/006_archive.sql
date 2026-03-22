CREATE TABLE IF NOT EXISTS historical_cases (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  title_en TEXT NOT NULL,
  person TEXT NOT NULL,
  date_of_vision DATE NOT NULL,
  date_of_event DATE NOT NULL,
  vision_text TEXT NOT NULL,
  vision_text_en TEXT NOT NULL,
  event_description TEXT NOT NULL,
  event_description_en TEXT NOT NULL,
  source_url TEXT,
  source_name TEXT,
  category TEXT CHECK (category IN (
    'aviation','political','natural','personal','war','other'
  )),
  match_score FLOAT DEFAULT 1.0,
  geography TEXT,
  is_verified BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Публичное чтение
ALTER TABLE historical_cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "historical_cases_public" ON historical_cases
  FOR SELECT USING (true);
