-- ============================================================
-- Миграция 019: Embeddings (pgvector)
-- ============================================================

CREATE EXTENSION IF NOT EXISTS vector;

ALTER TABLE public.entries
  ADD COLUMN IF NOT EXISTS embedding vector(1536);

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS dream_baseline_embedding vector(1536);

CREATE INDEX IF NOT EXISTS idx_entries_embedding
  ON public.entries
  USING ivfflat (embedding vector_cosine_ops)
  WITH (lists = 100);
