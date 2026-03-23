CREATE TABLE IF NOT EXISTS self_reports (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  entry_id UUID REFERENCES entries(id) ON DELETE CASCADE,
  user_id UUID REFERENCES users(id) ON DELETE CASCADE,
  status TEXT CHECK (status IN ('fulfilled','partial','unfulfilled')),
  reported_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(entry_id, user_id)
);
ALTER TABLE self_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "users_own_reports" ON self_reports
  FOR ALL USING (auth.uid() = user_id);

ALTER TABLE notifications 
  ADD COLUMN IF NOT EXISTS entry_id UUID REFERENCES entries(id),
  ADD COLUMN IF NOT EXISTS action_type TEXT,
  ADD COLUMN IF NOT EXISTS scheduled_for TIMESTAMPTZ;
