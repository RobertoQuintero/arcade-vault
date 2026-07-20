create table public.scores (
  id uuid primary key default gen_random_uuid(),
  game text not null,
  score integer not null,
  name text not null,
  user_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now()
);

alter table public.scores enable row level security;

create policy "scores are publicly readable"
  on public.scores for select
  to anon, authenticated
  using (true);

create policy "anyone can insert a score"
  on public.scores for insert
  to anon, authenticated
  with check (true);
