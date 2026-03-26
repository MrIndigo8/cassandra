-- 011_add_entry_ip_fields.sql
-- Добавление колонок ip_country_code, ip_geography, is_quarantine к таблице entries
-- Используются в: entries/route.ts, map-data/route.ts, clustering/index.ts

-- 1. Добавляем колонки (IF NOT EXISTS через DO-блок для идемпотентности)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'entries' AND column_name = 'ip_country_code'
  ) THEN
    ALTER TABLE entries ADD COLUMN ip_country_code TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'entries' AND column_name = 'ip_geography'
  ) THEN
    ALTER TABLE entries ADD COLUMN ip_geography TEXT;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'entries' AND column_name = 'is_quarantine'
  ) THEN
    ALTER TABLE entries ADD COLUMN is_quarantine BOOLEAN NOT NULL DEFAULT false;
  END IF;
END $$;

-- 2. Индекс на ip_country_code (для запросов карты — map-data/route.ts)
CREATE INDEX IF NOT EXISTS idx_entries_ip_country_code 
  ON entries (ip_country_code) 
  WHERE ip_country_code IS NOT NULL;

-- 3. Индекс на is_quarantine (для фильтрации в кластеризации)
CREATE INDEX IF NOT EXISTS idx_entries_is_quarantine 
  ON entries (is_quarantine) 
  WHERE is_quarantine = true;

-- 4. RLS: запрещаем анонимным пользователям читать ip_* поля
-- Supabase RLS работает на уровне строк, а не колонок.
-- Для ограничения доступа к ip_* создаём VIEW без этих полей для anon-роли.
-- Существующая RLS-политика на entries уже ограничивает SELECT для anon,
-- поэтому дополнительно создаём security-barrier view для публичного доступа.

CREATE OR REPLACE VIEW entries_public AS
  SELECT
    id,
    user_id,
    type,
    title,
    content,
    image_url,
    ai_summary,
    ai_images,
    ai_emotions,
    ai_scale,
    ai_geography,
    ai_specificity,
    is_verified,
    best_match_score,
    is_public,
    is_anonymous,
    is_quarantine,
    view_count,
    created_at,
    updated_at
  FROM entries
  WHERE is_public = true;

-- Даём anon-роли доступ только к view (без ip_* полей)
GRANT SELECT ON entries_public TO anon;
