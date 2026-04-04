-- P0-3: Шаблонные уведомления (template_key + template_params) и локаль строки

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS template_key TEXT;

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS template_params JSONB NOT NULL DEFAULT '{}'::jsonb;

ALTER TABLE public.notifications
  ADD COLUMN IF NOT EXISTS locale TEXT;

COMMENT ON COLUMN public.notifications.template_key IS 'Ключ относительно messages touchpoints.* (например scheduled.deep_insight, body.deep_insight)';
COMMENT ON COLUMN public.notifications.template_params IS 'ICU-параметры и/или сгенерированные поля title/message';
COMMENT ON COLUMN public.notifications.locale IS 'Локаль при создании/обработке (ru|en) для серверной генерации body';
