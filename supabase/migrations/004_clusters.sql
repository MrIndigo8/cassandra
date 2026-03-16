-- SQL Migration 004: Clusterization Expansion
-- Расширение таблицы clusters для хранения продвинутой аналитики по общим сигналам

ALTER TABLE clusters
ADD COLUMN IF NOT EXISTS dominant_images TEXT[],
ADD COLUMN IF NOT EXISTS secondary_images TEXT[],
ADD COLUMN IF NOT EXISTS dominant_emotion TEXT,
ADD COLUMN IF NOT EXISTS entry_count INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS unique_users INT DEFAULT 0,
ADD COLUMN IF NOT EXISTS intensity_score FLOAT DEFAULT 0,
ADD COLUMN IF NOT EXISTS baseline_count INT,
ADD COLUMN IF NOT EXISTS anomaly_factor FLOAT,
ADD COLUMN IF NOT EXISTS geography_data JSONB,
ADD COLUMN IF NOT EXISTS ai_prediction TEXT,
ADD COLUMN IF NOT EXISTS prediction_confidence FLOAT,
ADD COLUMN IF NOT EXISTS signal_type TEXT,
ADD COLUMN IF NOT EXISTS time_horizon TEXT,
ADD COLUMN IF NOT EXISTS is_resolved BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS started_at TIMESTAMPTZ DEFAULT NOW(),
ADD COLUMN IF NOT EXISTS resolved_at TIMESTAMPTZ;
