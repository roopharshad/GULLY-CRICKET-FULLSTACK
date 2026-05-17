-- ============================================================
--  GullyCricket — Supabase Database Schema
--  Run this in your Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

-- ── 1. APP DATA (single-row config table) ────────────────────
-- Stores the whole JSON blob (liveMatch, schedule, banners, etc.)
-- so the existing data shape is preserved without breaking changes.
CREATE TABLE IF NOT EXISTS public.app_data (
  id          TEXT PRIMARY KEY DEFAULT 'main',
  data        JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 2. PLAYERS ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.players (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL,
  team        TEXT NOT NULL DEFAULT '',
  role        TEXT NOT NULL DEFAULT 'Batsman',
  matches     INT  NOT NULL DEFAULT 0,
  runs        INT  NOT NULL DEFAULT 0,
  balls       INT  NOT NULL DEFAULT 0,
  wickets     INT  NOT NULL DEFAULT 0,
  avg         TEXT NOT NULL DEFAULT '0.0',
  sr          TEXT NOT NULL DEFAULT '0.0',
  color       TEXT NOT NULL DEFAULT '#64748b',
  fours       INT  NOT NULL DEFAULT 0,
  sixes       INT  NOT NULL DEFAULT 0,
  bowl_balls  INT  NOT NULL DEFAULT 0,
  bowl_runs   INT  NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 3. TEAMS ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.teams (
  id          SERIAL PRIMARY KEY,
  name        TEXT NOT NULL UNIQUE,
  emoji       TEXT NOT NULL DEFAULT '🏏',
  color       TEXT NOT NULL DEFAULT '#64748b',
  played      INT  NOT NULL DEFAULT 0,
  won         INT  NOT NULL DEFAULT 0,
  lost        INT  NOT NULL DEFAULT 0,
  nr          INT  NOT NULL DEFAULT 0,
  nrr         TEXT NOT NULL DEFAULT '0.00',
  captain     TEXT NOT NULL DEFAULT '',
  team_code   TEXT NOT NULL DEFAULT '',
  players     JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 4. MATCHES ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.matches (
  id          SERIAL PRIMARY KEY,
  title       TEXT NOT NULL DEFAULT '',
  teams       TEXT NOT NULL DEFAULT '',
  t1          TEXT NOT NULL DEFAULT '',
  t2          TEXT NOT NULL DEFAULT '',
  result      TEXT NOT NULL DEFAULT '',
  top_scorer  TEXT NOT NULL DEFAULT '',
  status      TEXT NOT NULL DEFAULT 'upcoming',
  batting1    JSONB NOT NULL DEFAULT '[]'::jsonb,
  batting2    JSONB NOT NULL DEFAULT '[]'::jsonb,
  bowling1    JSONB NOT NULL DEFAULT '[]'::jsonb,
  bowling2    JSONB NOT NULL DEFAULT '[]'::jsonb,
  match_date  DATE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 5. USERS (registered players / fans) ─────────────────────
CREATE TABLE IF NOT EXISTS public.users (
  id          SERIAL PRIMARY KEY,
  phone       TEXT NOT NULL UNIQUE,
  name        TEXT NOT NULL DEFAULT '',
  team        TEXT NOT NULL DEFAULT '',
  role        TEXT NOT NULL DEFAULT 'fan',
  password    TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 6. ADMIN CREDENTIALS ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_credentials (
  id          INT PRIMARY KEY DEFAULT 1,
  username    TEXT NOT NULL DEFAULT 'admin',
  password    TEXT NOT NULL DEFAULT 'admin123',
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── 7. SOUND SETTINGS ────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.sound_settings (
  id          INT PRIMARY KEY DEFAULT 1,
  settings    JSONB NOT NULL DEFAULT '{}'::jsonb,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── ENABLE REALTIME ──────────────────────────────────────────
ALTER PUBLICATION supabase_realtime ADD TABLE public.app_data;
ALTER PUBLICATION supabase_realtime ADD TABLE public.players;
ALTER PUBLICATION supabase_realtime ADD TABLE public.teams;
ALTER PUBLICATION supabase_realtime ADD TABLE public.matches;

-- ── ROW LEVEL SECURITY ───────────────────────────────────────
-- For a public-facing app, we allow anon reads and writes
-- (the admin panel is protected by app-level password check)
ALTER TABLE public.app_data           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.players            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.teams              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.matches            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users              ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.admin_credentials  ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sound_settings     ENABLE ROW LEVEL SECURITY;

-- Allow public anon access (required for browser-based app without auth)
CREATE POLICY "anon_all_app_data"          ON public.app_data          FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_players"           ON public.players            FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_teams"             ON public.teams              FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_matches"           ON public.matches            FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_users"             ON public.users              FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_admin_credentials" ON public.admin_credentials  FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "anon_all_sound_settings"    ON public.sound_settings     FOR ALL USING (true) WITH CHECK (true);

-- ── SEED ADMIN CREDENTIALS ───────────────────────────────────
INSERT INTO public.admin_credentials (id, username, password)
VALUES (1, 'admin', 'admin123')
ON CONFLICT (id) DO NOTHING;

-- ── SEED DEFAULT APP DATA ─────────────────────────────────────
INSERT INTO public.app_data (id, data)
VALUES ('main', '{
  "liveMatch": {
    "id": 1,
    "title": "GULLY CUP — MATCH 7",
    "team1": "Street Warriors",
    "team2": "Thunder Bolts",
    "team1Score": "142/4",
    "team2Score": "89/3",
    "team1Overs": "15.3 Overs",
    "team2Overs": "10.0 Overs",
    "status": "Warriors need 53 runs in 27 balls",
    "inning": "Warriors Batting",
    "commentary": []
  },
  "battingScorecard": [],
  "bowlingScorecard": [],
  "banners": [],
  "schedule": [
    {"date":"13","month":"May","teams":"Street Warriors vs Thunder Bolts","venue":"Lane 5, Sector 4","time":"4:00 PM","status":"live"},
    {"date":"14","month":"May","teams":"Power Hitters vs Fire Starters","venue":"Park Ground, Block A","time":"5:00 PM","status":"upcoming"},
    {"date":"15","month":"May","teams":"Storm Riders vs Royal Strikers","venue":"Gully 7, Sector 9","time":"4:30 PM","status":"upcoming"},
    {"date":"17","month":"May","teams":"Street Warriors vs Fire Starters","venue":"Lane 5, Sector 4","time":"3:00 PM","status":"upcoming"},
    {"date":"10","month":"May","teams":"Warriors vs Storm","venue":"Gully 7","time":"5:00 PM","status":"completed"}
  ]
}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- ── SEED DEFAULT TEAMS ────────────────────────────────────────
INSERT INTO public.teams (name, emoji, color, played, won, lost, nr, nrr, captain, team_code, players) VALUES
  ('Street Warriors', '🦁', '#f59e0b', 8, 6, 2, 0, '+1.24', 'Raju Kumar',  'WAR001', '["Raju Kumar","Arjun Sharma"]'),
  ('Thunder Bolts',   '⚡', '#3b82f6', 8, 5, 3, 0, '+0.87', 'Kiran Singh', 'BOL002', '["Kiran Singh","Dev Patel"]'),
  ('Power Hitters',   '💪', '#8b5cf6', 7, 4, 3, 0, '+0.45', 'Manoj Rao',   'POW003', '["Manoj Rao"]'),
  ('Fire Starters',   '🔥', '#ef4444', 7, 3, 4, 0, '-0.21', 'Suresh Babu', 'FIR004', '["Suresh Babu"]'),
  ('Storm Riders',    '🌩️','#06b6d4', 6, 2, 4, 0, '-0.67', 'Vijay Nair',  'STO005', '["Vijay Nair"]'),
  ('Royal Strikers',  '👑', '#f97316', 6, 1, 5, 0, '-1.12', 'Charan Das',  'ROY006', '["Charan Das"]')
ON CONFLICT (name) DO NOTHING;

-- ── SEED DEFAULT PLAYERS ──────────────────────────────────────
INSERT INTO public.players (name, team, role, matches, runs, balls, wickets, avg, sr, color, fours, sixes, bowl_balls, bowl_runs) VALUES
  ('Raju Kumar',  'Street Warriors', 'Batsman',     12, 487, 312, 2,  '40.5', '156.0', '#f59e0b', 38, 22, 0,  0),
  ('Kiran Singh', 'Thunder Bolts',   'Bowler',      12, 78,  60,  18, '4.3',  '130.0', '#3b82f6', 4,  3,  72, 148),
  ('Suresh Babu', 'Fire Starters',   'All-Rounder', 11, 312, 220, 9,  '28.3', '141.8', '#10b981', 24, 14, 0,  0),
  ('Manoj Rao',   'Power Hitters',   'Batsman',     10, 278, 190, 1,  '27.8', '146.3', '#8b5cf6', 20, 11, 0,  0),
  ('Vijay Nair',  'Storm Riders',    'Bowler',      11, 45,  38,  14, '9.2',  '118.4', '#ef4444', 3,  1,  66, 182),
  ('Arjun Sharma','Street Warriors', 'All-Rounder', 12, 198, 145, 7,  '18.0', '136.5', '#f59e0b', 15, 8,  0,  0),
  ('Dev Patel',   'Thunder Bolts',   'Batsman',     10, 234, 178, 0,  '26.0', '131.4', '#3b82f6', 18, 7,  0,  0),
  ('Charan Das',  'Royal Strikers',  'Bowler',      9,  34,  28,  11, '7.0',  '121.4', '#f97316', 2,  0,  54, 112)
ON CONFLICT DO NOTHING;

-- ── SEED DEFAULT MATCHES ──────────────────────────────────────
INSERT INTO public.matches (title, teams, t1, t2, result, top_scorer, status) VALUES
  ('Match 6', 'Warriors vs Bolts', 'Street Warriors', 'Thunder Bolts', 'Warriors won by 34 runs', 'Raju 67*', 'completed'),
  ('Match 5', 'Hitters vs Fire',   'Power Hitters',   'Fire Starters', 'Hitters won by 5 wickets','Manoj 54',  'completed'),
  ('Match 7', 'Warriors vs Bolts', 'Street Warriors', 'Thunder Bolts', 'In Progress',              'Raju 38*', 'live')
ON CONFLICT DO NOTHING;

-- Done! ✅
