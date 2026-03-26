CREATE TABLE IF NOT EXISTS public.translation_cache (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_hash TEXT NOT NULL,
  source_text TEXT NOT NULL,
  target_locale TEXT NOT NULL,
  translated_text TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(source_hash, target_locale)
);

CREATE INDEX IF NOT EXISTS idx_translation_cache_hash
  ON public.translation_cache(source_hash, target_locale);
