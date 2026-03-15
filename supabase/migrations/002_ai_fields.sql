-- Миграция 002: AI поля + метаданные переживания

-- AI поля анализа
ALTER TABLE entries
ADD COLUMN IF NOT EXISTS ai_images TEXT[],
ADD COLUMN IF NOT EXISTS ai_emotions TEXT[],
ADD COLUMN IF NOT EXISTS ai_scale TEXT CHECK (ai_scale IN ('personal','local','global')),
ADD COLUMN IF NOT EXISTS ai_geography TEXT,
ADD COLUMN IF NOT EXISTS ai_specificity FLOAT,
ADD COLUMN IF NOT EXISTS ai_summary TEXT,
ADD COLUMN IF NOT EXISTS ai_analyzed_at TIMESTAMPTZ;

-- Метаданные переживания (заполняет пользователь)
ALTER TABLE entries
ADD COLUMN IF NOT EXISTS direction TEXT CHECK (direction IN ('personal','other','collective')),
ADD COLUMN IF NOT EXISTS timeframe TEXT CHECK (timeframe IN ('now','soon','distant')),
ADD COLUMN IF NOT EXISTS quality TEXT CHECK (quality IN ('warning','neutral','revelation'));

-- Сбросить ai_analyzed_at для существующих записей
-- чтобы они попали в очередь анализа
UPDATE entries SET ai_analyzed_at = NULL;
