-- Labour Relations App — Initiales Supabase-Schema
-- Ergänzt die bestehende Router→RAG→Executor-Pipeline (Qdrant bleibt für RAG-Ähnlichkeitssuche
-- zuständig) um eine strukturierte, pro Nutzer abfragbare Fallhistorie sowie minimale Profile.

create extension if not exists "pgcrypto";

-- ── profiles ─────────────────────────────────────────────────────────────────
-- Minimal, kein volles Rollensystem — reicht für Einzel-/Kleinteam-Betrieb.
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text,
  role text not null default 'admin',
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

create policy "profiles_select_own"
  on public.profiles for select
  using (auth.uid() = id);

create policy "profiles_update_own"
  on public.profiles for update
  using (auth.uid() = id);

create policy "profiles_insert_own"
  on public.profiles for insert
  with check (auth.uid() = id);

-- Automatisch ein Profil anlegen, sobald sich ein neuer Nutzer registriert.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into public.profiles (id, display_name)
  values (new.id, coalesce(new.raw_user_meta_data ->> 'display_name', new.email));
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ── cases ────────────────────────────────────────────────────────────────────
-- Strukturierte Fallhistorie fürs Frontend (Verlauf/Fälle, Risiko-Radar, Agenten-Kennzahlen).
-- Ergänzt die bestehende Qdrant-Vektorspeicherung (pipeline.js qdrantStore()) — ersetzt sie nicht.
create table if not exists public.cases (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  session_id text not null,
  prompt_id text not null,
  prompt_name text,
  agent_id text,
  title text,
  question text not null,
  answer text not null,
  answer_html text,
  escalation_suggested boolean not null default false,
  escalation_target text,
  created_at timestamptz not null default now()
);

alter table public.cases enable row level security;

create index if not exists cases_user_id_created_at_idx
  on public.cases (user_id, created_at desc);

create index if not exists cases_prompt_id_idx
  on public.cases (prompt_id);

create policy "cases_select_own"
  on public.cases for select
  using (auth.uid() = user_id);

create policy "cases_insert_own"
  on public.cases for insert
  with check (auth.uid() = user_id);

-- Hinweis: Das Backend schreibt Case-Zeilen server-seitig mit dem Service-Role-Key (umgeht RLS
-- bewusst, wie beim bestehenden Qdrant-Store-Muster in pipeline.js — Schreibfehler dürfen die
-- Chat-Antwort nicht blockieren). RLS schützt hier ausschließlich die Leserichtung fürs Frontend.
