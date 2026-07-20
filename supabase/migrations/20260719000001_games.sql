create table public.games (
  id text primary key,
  title text not null,
  short text not null,
  long text not null,
  cat text not null check (cat in ('ARCADE', 'PUZZLE', 'SHOOTER', 'VERSUS')),
  cover text not null,
  color text not null check (color in ('cyan', 'magenta', 'yellow', 'green')),
  best integer not null,
  plays text not null
);

alter table public.games enable row level security;

create policy "games are publicly readable"
  on public.games for select
  to anon, authenticated
  using (true);

insert into public.games (id, title, short, long, cat, cover, color, best, plays) values (
  'asteroids',
  'ASTEROIDS',
  'Pulveriza asteroides en gravedad cero.',
  'Tu nave triangular flota en vacío absoluto. Dispara y rota para dividir rocas en fragmentos cada vez más pequeños. Cuidado con los OVNIs en el horizonte.',
  'SHOOTER',
  'cover-rocas',
  'yellow',
  41200,
  '15.6K'
);
