-- P0-4: Идемпотентное наличие колонок IP/гео для entries
-- Первичное создание: 011_add_entry_ip_fields.sql (ip_*), 016_anxiety_fields.sql (geography_iso).
-- Эта миграция безопасна при повторном запуске: только IF NOT EXISTS / DO-блоки.
-- Устраняет "column does not exist", если старые миграции не применялись.

-- ip_country_code, ip_geography, is_quarantine (см. также 011)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'entries' AND column_name = 'ip_country_code'
  ) THEN
    ALTER TABLE public.entries ADD COLUMN ip_country_code TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'entries' AND column_name = 'ip_geography'
  ) THEN
    ALTER TABLE public.entries ADD COLUMN ip_geography TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'entries' AND column_name = 'is_quarantine'
  ) THEN
    ALTER TABLE public.entries ADD COLUMN is_quarantine BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

-- geography_iso — извлечение региона из текста/AI (см. также 016)
ALTER TABLE public.entries ADD COLUMN IF NOT EXISTS geography_iso TEXT;

CREATE INDEX IF NOT EXISTS idx_entries_ip_country_code
  ON public.entries (ip_country_code)
  WHERE ip_country_code IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_entries_is_quarantine
  ON public.entries (is_quarantine)
  WHERE is_quarantine = true;

CREATE INDEX IF NOT EXISTS idx_entries_geography_iso
  ON public.entries (geography_iso)
  WHERE geography_iso IS NOT NULL;

COMMENT ON COLUMN public.entries.ip_country_code IS 'ISO-код страны по IP (напр. Vercel x-vercel-ip-country); миграция 011, дубль-проверка 031';
COMMENT ON COLUMN public.entries.ip_geography IS 'Человекочитаемое имя страны/региона по IP; миграция 011';
COMMENT ON COLUMN public.entries.is_quarantine IS 'Пометка антиспама/карантина; миграция 011';
COMMENT ON COLUMN public.entries.geography_iso IS 'Регион из анализа текста/AI; миграция 016';

-- Deprecated / не используется в src для записей (только legacy в 001): columns emotion, symbols, location на entries.
-- Не удаляем — возможны старые данные; новый код предпочитает ai_* и geography_iso.
