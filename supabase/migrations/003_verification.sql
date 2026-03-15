-- Миграция 003: Модуль верификации совпадений (Добавление полей к существующим таблицам)

-- 1. Обновление таблицы matches (таблица была создана в 001_initial_schema.sql)
ALTER TABLE matches
ADD COLUMN IF NOT EXISTS event_id TEXT,
ADD COLUMN IF NOT EXISTS confidence FLOAT DEFAULT 0.0;

-- Изменяем тип с UUID на TEXT для event_id если он был случайно создан как UUID в другой миграции (перестраховка)
-- Добавляем уникальность по entry_id и event_id чтобы избежать дублей
-- Но так как в существующих данных может быть NULL для event_id, нам нужно быть аккуратными.
-- Сначала обновим старые записи (если есть), присвоив им случайный event_id (в реальности их быть не должно)
UPDATE matches SET event_id = 'legacy-' || id::text WHERE event_id IS NULL;
-- Теперь делаем колонку обязательной
ALTER TABLE matches ALTER COLUMN event_id SET NOT NULL;

-- Добавляем constraint на уникальность пары "запись + событие"
-- Сначала удалим если он уже есть (для идемпотентности)
ALTER TABLE matches DROP CONSTRAINT IF EXISTS matches_entry_id_event_id_key;
ALTER TABLE matches ADD CONSTRAINT matches_entry_id_event_id_key UNIQUE (entry_id, event_id);


-- 2. Обновление таблицы entries (поля верификации)
ALTER TABLE entries
ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS best_match_score FLOAT DEFAULT 0;

-- 3. Обновление таблицы users (рейтинг и роли)
ALTER TABLE users
ADD COLUMN IF NOT EXISTS verified_count INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS rating_score FLOAT DEFAULT 0,
ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'observer' CHECK (role IN ('observer', 'chronicler', 'sensitive', 'oracle'));

-- RLS для matches уже должно быть настроено в 001_initial_schema.sql, но на всякий случай проверяем:
ALTER TABLE matches ENABLE ROW LEVEL SECURITY;

-- API имеет service_role, поэтому добавлять INSERT/UPDATE политики не обязательно,
-- но для порядка (если нет полиси):
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'matches' AND policyname = 'Anyone can read matches') THEN
    CREATE POLICY "Anyone can read matches"
    ON matches FOR SELECT
    USING (true);
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_policies WHERE tablename = 'matches' AND policyname = 'Service bypasses RLS for matches') THEN
    CREATE POLICY "Service bypasses RLS for matches"
    ON matches USING (true) WITH CHECK (true);
  END IF;
END $$;
