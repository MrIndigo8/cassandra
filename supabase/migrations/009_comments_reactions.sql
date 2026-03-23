-- Комментарии
CREATE TABLE IF NOT EXISTS comments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID REFERENCES entries(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK (length(content) >= 1 AND length(content) <= 500),
  created_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "comments_public_read" ON comments 
  FOR SELECT USING (true);
CREATE POLICY "comments_auth_insert" ON comments 
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "comments_own_delete" ON comments 
  FOR DELETE USING (auth.uid() = user_id);

-- Реакции
CREATE TABLE IF NOT EXISTS reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID REFERENCES entries(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  emoji TEXT CHECK (emoji IN ('🔮','😨','✨','🌊','🔥','⚡','👁')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(entry_id, user_id, emoji)
);
ALTER TABLE reactions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "reactions_public_read" ON reactions 
  FOR SELECT USING (true);
CREATE POLICY "reactions_auth_all" ON reactions 
  FOR ALL USING (auth.uid() = user_id);

-- Картинки в записях
ALTER TABLE entries ADD COLUMN IF NOT EXISTS image_url TEXT;
