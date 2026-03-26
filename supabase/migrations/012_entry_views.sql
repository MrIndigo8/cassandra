-- Счётчик просмотров
ALTER TABLE public.entries ADD COLUMN IF NOT EXISTS view_count INTEGER NOT NULL DEFAULT 0;

-- Таблица уникальных просмотров
CREATE TABLE IF NOT EXISTS public.entry_views (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID NOT NULL REFERENCES public.entries(id) ON DELETE CASCADE,
  viewer_id UUID REFERENCES public.users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(entry_id, viewer_id)
);

CREATE INDEX IF NOT EXISTS idx_entry_views_entry ON public.entry_views(entry_id);

-- RLS
ALTER TABLE public.entry_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can insert views" ON public.entry_views;
CREATE POLICY "Authenticated users can insert views" ON public.entry_views
  FOR INSERT TO authenticated WITH CHECK (true);

-- Функция атомарного инкремента
CREATE OR REPLACE FUNCTION public.increment_view_count(p_entry_id UUID, p_viewer_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_inserted BOOLEAN := false;
  v_count INTEGER;
BEGIN
  BEGIN
    INSERT INTO public.entry_views (entry_id, viewer_id)
    VALUES (p_entry_id, p_viewer_id);
    v_inserted := true;
  EXCEPTION WHEN unique_violation THEN
    v_inserted := false;
  END;

  IF v_inserted THEN
    UPDATE public.entries
    SET view_count = view_count + 1
    WHERE id = p_entry_id
    RETURNING view_count INTO v_count;
  ELSE
    SELECT view_count INTO v_count
    FROM public.entries
    WHERE id = p_entry_id;
  END IF;

  RETURN COALESCE(v_count, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

