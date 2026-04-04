-- =============================================================================
-- P0-2: entries.type — единый CHECK с приложением (parser.ts ALLOWED_ENTRY_TYPES)
--
-- История ограничений в репозитории:
--   001_initial_schema:  CHECK (type IN ('dream', 'premonition'))  — на колонке
--   010_fix_entries_type: dream, premonition, unknown, feeling, vision
--   025_expand_entry_types: полный список из 11 значений (включая unknown)
--
-- «Старый» constraint перед этой миграцией (если применены 010/025): имя
--   entries_type_check — те же 11 значений, что и ниже.
-- На старых БД без 025 мог остаться только набор из 001 или 010 — тогда после
--   UPDATE невалидные строки станут 'unknown', новый CHECK гарантирует
--   совместимость с POST /api/entries (type = 'unknown').
--
-- «Новый» constraint: см. список в ADD CONSTRAINT ниже (11 значений).
-- =============================================================================

ALTER TABLE public.entries DROP CONSTRAINT IF EXISTS entries_type_check;

-- Привести данные к допустимым значениям до ADD CONSTRAINT
UPDATE public.entries
SET type = 'unknown'
WHERE type IS NULL
   OR type NOT IN (
     'dream',
     'premonition',
     'unknown',
     'feeling',
     'vision',
     'anxiety',
     'thought',
     'deja_vu',
     'sensation',
     'mood',
     'synchronicity'
   );

ALTER TABLE public.entries
  ADD CONSTRAINT entries_type_check
  CHECK (
    type IN (
      'dream',
      'premonition',
      'unknown',
      'feeling',
      'vision',
      'anxiety',
      'thought',
      'deja_vu',
      'sensation',
      'mood',
      'synchronicity'
    )
  );
