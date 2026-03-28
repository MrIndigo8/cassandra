-- Согласие с условиями и политикой (мастер-план)
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS consent_accepted_at TIMESTAMPTZ;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS consent_version TEXT;

COMMENT ON COLUMN public.users.consent_accepted_at IS 'Когда пользователь принял текущую версию условий';
COMMENT ON COLUMN public.users.consent_version IS 'Идентификатор версии документов (например дата)';
