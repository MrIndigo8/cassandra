-- Ensure baseline scoring values exist for all users.
UPDATE public.users
SET rating_score = 0,
    role = 'observer'
WHERE rating_score IS NULL OR role IS NULL;

-- Defaults for newly created users.
ALTER TABLE public.users ALTER COLUMN rating_score SET DEFAULT 0;
ALTER TABLE public.users ALTER COLUMN role SET DEFAULT 'observer';
