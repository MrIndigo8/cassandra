-- Admin system: roles, audit and feature settings
ALTER TABLE public.users DROP CONSTRAINT IF EXISTS users_role_check;
ALTER TABLE public.users
ADD CONSTRAINT users_role_check CHECK (
  role IN ('architect', 'admin', 'moderator', 'oracle', 'sensitive', 'chronicler', 'observer', 'banned')
);

UPDATE public.users
SET role = 'architect'
WHERE id = (
  SELECT id
  FROM auth.users
  WHERE email = 'ruslankasiankou@gmail.com'
  LIMIT 1
);

CREATE TABLE IF NOT EXISTS public.admin_actions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id UUID NOT NULL REFERENCES public.users(id),
  action_type TEXT NOT NULL,
  target_user_id UUID REFERENCES public.users(id),
  target_entry_id UUID REFERENCES public.entries(id),
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_admin_actions_admin ON public.admin_actions(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_actions_created ON public.admin_actions(created_at DESC);

CREATE TABLE IF NOT EXISTS public.system_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_by UUID REFERENCES public.users(id),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

INSERT INTO public.system_settings (key, value)
VALUES
  ('features.feed', '{"enabled": true}'::jsonb),
  ('features.discoveries', '{"enabled": true}'::jsonb),
  ('features.map', '{"enabled": true}'::jsonb),
  ('features.archive', '{"enabled": true}'::jsonb),
  ('features.voice_recording', '{"enabled": true}'::jsonb),
  ('features.community_confirm', '{"enabled": true}'::jsonb),
  ('features.self_report', '{"enabled": true}'::jsonb),
  ('features.push_notifications', '{"enabled": true}'::jsonb),
  ('features.registration', '{"enabled": true}'::jsonb),
  ('ai.analysis_enabled', '{"enabled": true}'::jsonb),
  ('ai.verification_enabled', '{"enabled": true}'::jsonb),
  ('ai.clustering_enabled', '{"enabled": true}'::jsonb),
  ('ai.translation_enabled', '{"enabled": true}'::jsonb),
  ('moderation.auto_quarantine', '{"enabled": true, "threshold_days": 30}'::jsonb),
  ('moderation.min_content_length', '{"value": 30}'::jsonb),
  ('limits.entries_per_day', '{"free": 3, "pro": 50}'::jsonb),
  ('limits.comments_per_day', '{"value": 50}'::jsonb)
ON CONFLICT (key) DO NOTHING;

ALTER TABLE public.system_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_actions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admin read settings" ON public.system_settings;
CREATE POLICY "Admin read settings"
ON public.system_settings
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = auth.uid() AND role IN ('architect', 'admin')
  )
);

DROP POLICY IF EXISTS "Admin write settings" ON public.system_settings;
CREATE POLICY "Admin write settings"
ON public.system_settings
FOR ALL
USING (
  EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = auth.uid() AND role IN ('architect', 'admin')
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = auth.uid() AND role IN ('architect', 'admin')
  )
);

DROP POLICY IF EXISTS "Admin read actions" ON public.admin_actions;
CREATE POLICY "Admin read actions"
ON public.admin_actions
FOR SELECT
USING (
  EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = auth.uid() AND role IN ('architect', 'admin', 'moderator')
  )
);

DROP POLICY IF EXISTS "Admin write actions" ON public.admin_actions;
CREATE POLICY "Admin write actions"
ON public.admin_actions
FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = auth.uid() AND role IN ('architect', 'admin', 'moderator')
  )
);

CREATE OR REPLACE FUNCTION public.is_admin(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = p_user_id AND role IN ('architect', 'admin')
  );
$$;

CREATE OR REPLACE FUNCTION public.is_moderator_or_above(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.users
    WHERE id = p_user_id AND role IN ('architect', 'admin', 'moderator')
  );
$$;
