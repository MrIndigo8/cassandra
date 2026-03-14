-- ============================================================
-- Кассандра — Миграция 001: Основные таблицы
-- Создание всех таблиц + триггеры + RLS
-- ============================================================

-- Расширения
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- 1. ТАБЛИЦА USERS (профили пользователей)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.users (
  id            UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email         TEXT NOT NULL,
  username      TEXT NOT NULL UNIQUE,
  display_name  TEXT,
  avatar_url    TEXT,
  bio           TEXT,
  role          TEXT NOT NULL DEFAULT 'observer'
                CHECK (role IN ('observer', 'chronicler', 'sensitive', 'oracle')),
  rating        DOUBLE PRECISION NOT NULL DEFAULT 0,
  trust_score   DOUBLE PRECISION NOT NULL DEFAULT 0,
  streak        INTEGER NOT NULL DEFAULT 0,
  longest_streak INTEGER NOT NULL DEFAULT 0,
  total_entries INTEGER NOT NULL DEFAULT 0,
  total_matches INTEGER NOT NULL DEFAULT 0,
  is_public     BOOLEAN NOT NULL DEFAULT false,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_entry_at TIMESTAMPTZ
);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);
CREATE INDEX IF NOT EXISTS idx_users_role ON public.users(role);
CREATE INDEX IF NOT EXISTS idx_users_rating ON public.users(rating DESC);

-- ============================================================
-- 2. ТАБЛИЦА ENTRIES (записи снов и предчувствий)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.entries (
  id               UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id          UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type             TEXT NOT NULL CHECK (type IN ('dream', 'premonition')),
  title            TEXT NOT NULL,
  content          TEXT NOT NULL,
  emotion          TEXT,
  symbols          TEXT[] DEFAULT '{}',
  location         TEXT,
  intensity        INTEGER CHECK (intensity >= 1 AND intensity <= 10),

  -- Поля AI-анализа (заполняются фоновой задачей Claude API)
  ai_summary          TEXT,
  ai_symbols          TEXT[],
  ai_emotions         TEXT[],
  ai_themes           TEXT[],
  ai_prediction_score DOUBLE PRECISION CHECK (
    ai_prediction_score >= 0 AND ai_prediction_score <= 1
  ),
  ai_analyzed_at      TIMESTAMPTZ,

  is_public        BOOLEAN NOT NULL DEFAULT false,
  is_anonymous     BOOLEAN NOT NULL DEFAULT false,

  -- КРИТИЧЕСКОЕ ПРАВИЛО: created_at ТОЛЬКО от сервера
  created_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_entries_user_id ON public.entries(user_id);
CREATE INDEX IF NOT EXISTS idx_entries_type ON public.entries(type);
CREATE INDEX IF NOT EXISTS idx_entries_created_at ON public.entries(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_entries_is_public ON public.entries(is_public) WHERE is_public = true;
CREATE INDEX IF NOT EXISTS idx_entries_symbols ON public.entries USING GIN(symbols);

-- ============================================================
-- 3. ТАБЛИЦА ENTRY_EDITS (история правок — неудаляемая)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.entry_edits (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entry_id    UUID NOT NULL REFERENCES public.entries(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  field_name  TEXT NOT NULL,
  old_value   TEXT,
  new_value   TEXT,
  edited_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_entry_edits_entry_id ON public.entry_edits(entry_id);
CREATE INDEX IF NOT EXISTS idx_entry_edits_user_id ON public.entry_edits(user_id);

-- ============================================================
-- 4. ТАБЛИЦА MATCHES (совпадения с реальными событиями)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.matches (
  id                    UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  entry_id              UUID NOT NULL REFERENCES public.entries(id) ON DELETE CASCADE,
  user_id               UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,

  -- Данные события
  event_title           TEXT NOT NULL,
  event_description     TEXT,
  event_source          TEXT NOT NULL,  -- GDELT, NewsAPI, USGS, ReliefWeb
  event_url             TEXT,
  event_date            TIMESTAMPTZ NOT NULL,
  event_location        TEXT,

  -- Оценка совпадения
  similarity_score      DOUBLE PRECISION NOT NULL CHECK (
    similarity_score >= 0 AND similarity_score <= 1
  ),
  matched_symbols       TEXT[] DEFAULT '{}',
  explanation           TEXT,

  -- Верификация
  verification_status   TEXT NOT NULL DEFAULT 'pending'
                        CHECK (verification_status IN ('pending', 'processing', 'verified', 'rejected')),
  verified_by           TEXT,
  verified_at           TIMESTAMPTZ,

  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_matches_entry_id ON public.matches(entry_id);
CREATE INDEX IF NOT EXISTS idx_matches_user_id ON public.matches(user_id);
CREATE INDEX IF NOT EXISTS idx_matches_status ON public.matches(verification_status);

-- ============================================================
-- 5. ТАБЛИЦА CLUSTERS (коллективные кластеры образов)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.clusters (
  id                  UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  title               TEXT NOT NULL,
  description         TEXT,
  symbols             TEXT[] DEFAULT '{}',
  themes              TEXT[] DEFAULT '{}',
  entry_ids           UUID[] DEFAULT '{}',
  user_count          INTEGER NOT NULL DEFAULT 0,

  -- Метрики аномалии
  anomaly_score       DOUBLE PRECISION NOT NULL DEFAULT 0
                      CHECK (anomaly_score >= 0 AND anomaly_score <= 1),
  baseline_frequency  DOUBLE PRECISION NOT NULL DEFAULT 0,
  current_frequency   DOUBLE PRECISION NOT NULL DEFAULT 0,

  geo_center          TEXT,
  is_active           BOOLEAN NOT NULL DEFAULT true,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at          TIMESTAMPTZ
);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_clusters_active ON public.clusters(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_clusters_anomaly ON public.clusters(anomaly_score DESC);
CREATE INDEX IF NOT EXISTS idx_clusters_symbols ON public.clusters USING GIN(symbols);

-- ============================================================
-- 6. ТАБЛИЦА NOTIFICATIONS (уведомления)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id          UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id     UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  type        TEXT NOT NULL CHECK (
    type IN ('match_found', 'role_upgrade', 'cluster_alert', 'streak_milestone', 'system')
  ),
  title       TEXT NOT NULL,
  message     TEXT NOT NULL,
  data        JSONB,
  status      TEXT NOT NULL DEFAULT 'unread'
              CHECK (status IN ('unread', 'read', 'archived')),
  read_at     TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Индексы
CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_status ON public.notifications(user_id, status)
  WHERE status = 'unread';


-- ============================================================
-- ТРИГГЕРЫ
-- ============================================================

-- Автоматическое обновление updated_at
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Применяем триггер updated_at к таблицам
CREATE TRIGGER set_updated_at_users
  BEFORE UPDATE ON public.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_entries
  BEFORE UPDATE ON public.entries
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_matches
  BEFORE UPDATE ON public.matches
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE TRIGGER set_updated_at_clusters
  BEFORE UPDATE ON public.clusters
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================================
-- КРИТИЧЕСКИЙ ТРИГГЕР: protect_created_at
-- Запрещает изменение created_at в entries НАВСЕГДА
-- ============================================================
CREATE OR REPLACE FUNCTION public.protect_created_at()
RETURNS TRIGGER AS $$
BEGIN
  IF OLD.created_at IS DISTINCT FROM NEW.created_at THEN
    RAISE EXCEPTION 'Изменение created_at запрещено. Поле created_at в entries защищено.';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER protect_entries_created_at
  BEFORE UPDATE ON public.entries
  FOR EACH ROW EXECUTE FUNCTION public.protect_created_at();

-- ============================================================
-- ТРИГГЕР: автосоздание профиля при регистрации
-- ============================================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.users (id, email, username)
  VALUES (
    NEW.id,
    NEW.email,
    COALESCE(
      NEW.raw_user_meta_data->>'username',
      SPLIT_PART(NEW.email, '@', 1) || '_' || SUBSTR(NEW.id::TEXT, 1, 4)
    )
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ============================================================
-- ТРИГГЕР: запись правок в entry_edits
-- ============================================================
CREATE OR REPLACE FUNCTION public.log_entry_edit()
RETURNS TRIGGER AS $$
BEGIN
  -- Логируем изменение каждого поля
  IF OLD.title IS DISTINCT FROM NEW.title THEN
    INSERT INTO public.entry_edits (entry_id, user_id, field_name, old_value, new_value)
    VALUES (OLD.id, OLD.user_id, 'title', OLD.title, NEW.title);
  END IF;

  IF OLD.content IS DISTINCT FROM NEW.content THEN
    INSERT INTO public.entry_edits (entry_id, user_id, field_name, old_value, new_value)
    VALUES (OLD.id, OLD.user_id, 'content', OLD.content, NEW.content);
  END IF;

  IF OLD.emotion IS DISTINCT FROM NEW.emotion THEN
    INSERT INTO public.entry_edits (entry_id, user_id, field_name, old_value, new_value)
    VALUES (OLD.id, OLD.user_id, 'emotion', OLD.emotion, NEW.emotion);
  END IF;

  IF OLD.location IS DISTINCT FROM NEW.location THEN
    INSERT INTO public.entry_edits (entry_id, user_id, field_name, old_value, new_value)
    VALUES (OLD.id, OLD.user_id, 'location', OLD.location, NEW.location);
  END IF;

  IF OLD.is_public IS DISTINCT FROM NEW.is_public THEN
    INSERT INTO public.entry_edits (entry_id, user_id, field_name, old_value, new_value)
    VALUES (OLD.id, OLD.user_id, 'is_public', OLD.is_public::TEXT, NEW.is_public::TEXT);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER log_entry_changes
  AFTER UPDATE ON public.entries
  FOR EACH ROW EXECUTE FUNCTION public.log_entry_edit();


-- ============================================================
-- RLS (Row Level Security) — ПОЛИТИКИ
-- ============================================================

-- Включаем RLS на всех таблицах
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entries ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entry_edits ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clusters ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- --- USERS ---
-- Просмотр: публичные профили видны всем, свой видит свой
CREATE POLICY "users_select_public"
  ON public.users FOR SELECT
  USING (is_public = true OR auth.uid() = id);

-- Обновление: только свой профиль
CREATE POLICY "users_update_own"
  ON public.users FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- --- ENTRIES ---
-- Просмотр: публичные записи видны всем, свои — автору
CREATE POLICY "entries_select"
  ON public.entries FOR SELECT
  USING (is_public = true OR auth.uid() = user_id);

-- Создание: только авторизованный пользователь создаёт свои записи
CREATE POLICY "entries_insert"
  ON public.entries FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Обновление: только автор
CREATE POLICY "entries_update"
  ON public.entries FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Удаление: только автор
CREATE POLICY "entries_delete"
  ON public.entries FOR DELETE
  USING (auth.uid() = user_id);

-- --- ENTRY_EDITS ---
-- Просмотр: автор записи видит историю правок
CREATE POLICY "entry_edits_select"
  ON public.entry_edits FOR SELECT
  USING (auth.uid() = user_id);

-- Вставка: только система (через триггер, с SECURITY DEFINER)
-- Удаление и обновление: ЗАПРЕЩЕНЫ (нет политик = нет доступа)

-- --- MATCHES ---
-- Просмотр: автор видит свои совпадения
CREATE POLICY "matches_select"
  ON public.matches FOR SELECT
  USING (auth.uid() = user_id);

-- Вставка: только через API (service_role)
-- Обновление/удаление: запрещены для обычных пользователей

-- --- CLUSTERS ---
-- Просмотр: активные кластеры видны всем авторизованным
CREATE POLICY "clusters_select"
  ON public.clusters FOR SELECT
  USING (is_active = true);

-- Управление: только через API (service_role)

-- --- NOTIFICATIONS ---
-- Просмотр: только свои уведомления
CREATE POLICY "notifications_select"
  ON public.notifications FOR SELECT
  USING (auth.uid() = user_id);

-- Обновление статуса: только свои (для отметки прочитанным)
CREATE POLICY "notifications_update"
  ON public.notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ============================================================
-- CONSTRAINT: event_date > created_at в matches
-- Верификация ТОЛЬКО если событие произошло ПОСЛЕ записи
-- ============================================================
-- Этот constraint реализован на уровне API,
-- т.к. нужен JOIN с entries для проверки:
-- matches.event_date > entries.created_at
-- Добавлен комментарий как напоминание для API-логики.
COMMENT ON TABLE public.matches IS
  'КРИТИЧЕСКОЕ ПРАВИЛО: event_date ОБЯЗАТЕЛЬНО > entry.created_at. Проверяется в API.';
