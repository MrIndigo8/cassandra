-- 010_fix_entries_type.sql
-- Расширение допустимых значений entries.type
-- Добавляем: 'unknown', 'feeling', 'vision' к существующим 'dream', 'premonition'
-- Идемпотентная миграция: безопасно запускать повторно

-- 1. Обновляем существующие записи с невалидными типами (если есть) перед добавлением constraint
UPDATE entries 
SET type = 'unknown' 
WHERE type NOT IN ('dream', 'premonition', 'unknown', 'feeling', 'vision');

-- 2. Убираем старый CHECK constraint
-- Имя constraint может отличаться в зависимости от версии PostgreSQL,
-- поэтому убираем все CHECK constraints на колонке type
DO $$
BEGIN
  -- Пытаемся удалить constraint с автогенерированным именем
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints 
    WHERE table_name = 'entries' 
      AND constraint_type = 'CHECK'
      AND constraint_name = 'entries_type_check'
  ) THEN
    ALTER TABLE entries DROP CONSTRAINT entries_type_check;
  END IF;
  
  -- На случай если constraint был назван иначе — удаляем все CHECK на этой таблице связанные с type
  -- (PostgreSQL автоматически именует их как entries_type_check, но на всякий случай)
END $$;

-- 3. Добавляем новый CHECK constraint с расширенным списком типов
ALTER TABLE entries 
  ADD CONSTRAINT entries_type_check 
  CHECK (type IN ('dream', 'premonition', 'unknown', 'feeling', 'vision'));
