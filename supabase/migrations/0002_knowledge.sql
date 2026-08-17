-- Wissen-Ablage: Nutzer sammeln eigene Wissensquellen (Artikel, Urteile, Dokument-Links, Notizen).
create table if not exists public.knowledge_items (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  title text not null,
  url text,
  item_type text not null default 'link' check (item_type in ('link', 'article', 'document', 'note')),
  notes text,
  created_at timestamptz not null default now()
);

alter table public.knowledge_items enable row level security;

create index if not exists knowledge_items_user_id_created_at_idx
  on public.knowledge_items (user_id, created_at desc);

create policy "knowledge_items_select_own"
  on public.knowledge_items for select
  using (auth.uid() = user_id);

create policy "knowledge_items_insert_own"
  on public.knowledge_items for insert
  with check (auth.uid() = user_id);

create policy "knowledge_items_delete_own"
  on public.knowledge_items for delete
  using (auth.uid() = user_id);
