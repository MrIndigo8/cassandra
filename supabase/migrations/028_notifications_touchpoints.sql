-- Expand notifications for engagement touchpoints

-- 1) Broaden notification type enum usage
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (
    type IN (
      'match_found',
      'role_upgrade',
      'cluster_alert',
      'streak_milestone',
      'system',
      'engagement',
      'weekly_digest',
      'collective_alert',
      'self_report_reminder',
      'match_confirmed'
    )
  );

-- 2) Add scheduled lifecycle states
ALTER TABLE public.notifications
  DROP CONSTRAINT IF EXISTS notifications_status_check;

ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_status_check
  CHECK (status IN ('unread', 'read', 'archived', 'pending', 'scheduled', 'cancelled'));

-- 3) Keep scheduler query fast
CREATE INDEX IF NOT EXISTS idx_notifications_scheduled_for
  ON public.notifications(status, scheduled_for)
  WHERE status IN ('scheduled', 'pending');

-- 4) Helpful action_type index for scheduled workers
CREATE INDEX IF NOT EXISTS idx_notifications_action_type
  ON public.notifications(action_type, status);
