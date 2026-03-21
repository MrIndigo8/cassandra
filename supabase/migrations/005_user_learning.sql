-- ============================================================
-- Миграция 005: Поля самообучения профиля
-- dominant_images, avg_specificity, avg_lag_days
-- ============================================================

ALTER TABLE public.users ADD COLUMN IF NOT EXISTS dominant_images TEXT[] DEFAULT '{}';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS avg_specificity DOUBLE PRECISION DEFAULT 0;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS avg_lag_days DOUBLE PRECISION DEFAULT 0;
