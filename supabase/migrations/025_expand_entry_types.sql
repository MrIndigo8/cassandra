-- Расширение типов записей (мастер-план v3)
-- Безопасно: сначала нормализуем значения, затем новый CHECK

ALTER TABLE public.entries DROP CONSTRAINT IF EXISTS entries_type_check;

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
