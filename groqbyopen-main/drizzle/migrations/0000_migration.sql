CREATE TABLE public.profiles (
  id uuid PRIMARY KEY,
  email text, display_name text, photo_url text,
  last_login_at timestamptz DEFAULT now(), updated_at timestamptz DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile select" ON public.profiles FOR SELECT TO authenticated USING (auth.uid() = id);
CREATE POLICY "own profile insert" ON public.profiles FOR INSERT TO authenticated WITH CHECK (auth.uid() = id);
CREATE POLICY "own profile update" ON public.profiles FOR UPDATE TO authenticated USING (auth.uid() = id);

CREATE TABLE public.bookings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid, name text NOT NULL, email text NOT NULL, phone text, topic text,
  selected_date text NOT NULL, selected_slot text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT INSERT ON public.bookings TO anon, authenticated;
GRANT ALL ON public.bookings TO service_role;
ALTER TABLE public.bookings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "anyone can book" ON public.bookings FOR INSERT TO anon, authenticated
  WITH CHECK (user_id IS NULL OR user_id = auth.uid());

CREATE TABLE public.user_projects (
  id text NOT NULL, user_id uuid NOT NULL, data jsonb NOT NULL DEFAULT '{}',
  last_synced_at timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (user_id, id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_projects TO authenticated;
GRANT ALL ON public.user_projects TO service_role;
ALTER TABLE public.user_projects ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own projects" ON public.user_projects FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.chat_threads (
  id text NOT NULL, user_id uuid NOT NULL, title text, prompt_banner text, active_tab text,
  messages jsonb NOT NULL DEFAULT '[]', messages_count int NOT NULL DEFAULT 0,
  last_updated timestamptz NOT NULL DEFAULT now(), PRIMARY KEY (user_id, id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.chat_threads TO authenticated;
GRANT ALL ON public.chat_threads TO service_role;
ALTER TABLE public.chat_threads ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own chats" ON public.chat_threads FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_threads;

CREATE TABLE public.site_previews (
  id text PRIMARY KEY, html text NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.site_previews TO service_role;
ALTER TABLE public.site_previews ENABLE ROW LEVEL SECURITY;