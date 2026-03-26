-- Индекс для выборки ленты (публичные записи, сортировка по дате)
CREATE INDEX IF NOT EXISTS idx_entries_public_feed
  ON public.entries(created_at DESC)
  WHERE is_public = true;

-- Индекс для подсчёта лайков по entry
CREATE INDEX IF NOT EXISTS idx_reactions_entry_emoji
  ON public.reactions(entry_id, emoji);

-- Индекс для подсчёта комментариев по entry
CREATE INDEX IF NOT EXISTS idx_comments_entry
  ON public.comments(entry_id);

-- Индекс для быстрой проверки "лайкнул ли пользователь"
CREATE INDEX IF NOT EXISTS idx_reactions_user_entry_emoji
  ON public.reactions(user_id, entry_id, emoji);
