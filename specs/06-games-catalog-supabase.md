# 06 — Catálogo de juegos real con Supabase

- **Estado:** Implementado
- **Dependencias:** SPEC 01 (MVP visual — define `Game`, `GAMES`, `CATS`), SPEC 04 (Asteroids real — único juego jugable hoy), SPEC 05 (Leaderboard Supabase — cliente Supabase en `lib/supabase/`, tabla `scores`, patrón Server Component + client hijo en `app/games/[id]/page.tsx`)
- **Fecha:** 2026-07-19

## Objetivo

Crear la tabla `games` en Supabase (sembrada manualmente solo con la fila de Asteroids), eliminar el array local `GAMES` de `lib/games.ts`, y reemplazarlo por fetches reales a esa tabla en todas las páginas que lo consumen: biblioteca (`/games`), detalle (`/games/[id]`), reproductor (`/games/[id]/play`), salón de la fama (`/hall-of-fame`) y home (`/`).

## Alcance

**Incluido:**

- Nueva tabla `games` en Supabase vía migración SQL (`supabase/migrations/`), con las mismas columnas que la interfaz `Game` actual: `id` (text, pk), `title`, `short`, `long` (text), `cat` (text, uno de `ARCADE`/`PUZZLE`/`SHOOTER`/`VERSUS`), `cover`, `color` (text, uno de `cyan`/`magenta`/`yellow`/`green`), `best` (integer), `plays` (text).
- Política RLS: solo `SELECT` público (`anon` + `authenticated`). Sin `INSERT`/`UPDATE`/`DELETE` públicos — altas futuras de juegos se hacen por migración o dashboard de Supabase, no desde el sitio.
- Seed manual: la migración inserta una única fila, la de `asteroids`, con los valores actuales de `lib/games.ts`.
- `lib/games.ts`: se elimina el array `GAMES` y `activityFeed()` deja de recibir `GAMES` como argumento implícito; se agregan `getGames(): Promise<Game[]>` y `getGameById(id): Promise<Game | undefined>` que consultan la tabla `games` vía Supabase. El tipo `Game` y `CATS`/`GameCategory` (enum fijo de categorías, no viene de la tabla) se mantienen igual.
- `app/games/page.tsx`: pasa a Server Component, hace `getGames()` en el servidor y pasa la lista a un client component nuevo (buscador, chips, toggle grid/tabla) — mismo patrón que `app/games/[id]/page.tsx`.
- `app/games/[id]/page.tsx` y `app/games/[id]/play/page.tsx`: reemplazan `GAMES.find(...)` por `await getGameById(id)`.
- `app/hall-of-fame/page.tsx`: reemplaza el import de `GAMES` por `getGames()` (fetch al montar, con estado de carga) para poblar los tabs.
- `app/page.tsx` (home): se divide en un Server Component que hace `getGames()` y un client component hijo que recibe la lista (carrusel, `activityFeed`, contador "X JUEGOS", animación reveal e IntersectionObserver que ya existen).
- `activityFeed(games: Game[])` pasa a recibir la lista de juegos como parámetro en vez de leer `GAMES` directamente.

**Explícitamente fuera de alcance:**

- Formulario o UI en el sitio para crear/editar juegos — el alta de nuevos juegos sigue siendo manual (migración o dashboard).
- Migrar `best`/`plays` a valores calculados dinámicamente (siguen siendo columnas con valores fijos, igual que hoy).
- Cambios a los componentes `GameCard`, `GameTable`, `MiniGameCard`, `GamePlayer` más allá de que reciban `Game` desde Supabase en vez del array local — su prop `game: Game` no cambia de forma.
- Tests automatizados.

## Modelo de datos

### Tabla `games` (Supabase, migración nueva)

```sql
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
```

Sin `INSERT`/`UPDATE`/`DELETE` públicos (sin política para esas operaciones, bloqueadas por RLS por defecto).

### `lib/games.ts` (modificación)

```ts
export type GameCategory = "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";

export interface Game {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: GameCategory;
  cover: string;
  color: "cyan" | "magenta" | "yellow" | "green";
  best: number;
  plays: string;
}

export const CATS: ("TODOS" | GameCategory)[] = [
  "TODOS",
  "ARCADE",
  "PUZZLE",
  "SHOOTER",
  "VERSUS",
];

// nuevo — reemplaza el array GAMES
export async function getGames(): Promise<Game[]>;
export async function getGameById(id: string): Promise<Game | undefined>;

// modificado — recibe la lista en vez de leer GAMES
export interface ActivityRow {
  title: string;
  score: number;
  color: Game["color"];
  ago: string;
}
export function activityFeed(games: Game[]): ActivityRow[];
```

`getGames`/`getGameById` usan el cliente de Supabase correspondiente al contexto del llamador (`lib/supabase/server.ts` en Server Components, `lib/supabase/client.ts` en el client component de `/hall-of-fame`). `getGameById` filtra por `id` en la tabla `games`; si no hay fila, retorna `undefined` (los `page.tsx` que lo llaman siguen haciendo `notFound()` cuando corresponde).

## Plan de implementación

1. **Migración de Supabase**: crear `supabase/migrations/XXXXXXXX_games.sql` con la tabla `games`, su política RLS de `SELECT` público, y el `insert` manual de la fila `asteroids`. Aplicar la migración vía MCP de Supabase. El proyecto sigue compilando, sin cambios visibles todavía (la tabla existe pero nada la consume aún).
2. **`lib/games.ts`**: eliminar el array `GAMES`, agregar `getGames()` y `getGameById(id)` consultando la tabla `games`, y cambiar `activityFeed` para recibir `games: Game[]` como parámetro. El módulo compila pero rompe temporalmente a sus consumidores (se arreglan en los pasos siguientes).
3. **`app/games/[id]/page.tsx`** y **`app/games/[id]/play/page.tsx`**: reemplazar `GAMES.find(...)` por `await getGameById(id)`. Ambas rutas vuelven a funcionar, mostrando el detalle y el juego real de Asteroids desde Supabase.
4. **`app/games/page.tsx`**: convertir a Server Component que hace `getGames()` y renderiza un nuevo client component (extraído del contenido actual) con buscador, chips y toggle grid/tabla recibiendo la lista por props. La Biblioteca vuelve a funcionar, mostrando solo los juegos sembrados en Supabase.
5. **`app/hall-of-fame/page.tsx`**: reemplazar el import de `GAMES` por un fetch a `getGames()` (con estado de carga) para poblar los tabs y el juego activo. El Salón de la Fama vuelve a funcionar con el catálogo real.
6. **`app/page.tsx`**: dividir en un Server Component que hace `getGames()` y un client component hijo (recibe la lista por props) que conserva el carrusel, `activityFeed`, el contador "X JUEGOS" y la animación reveal/IntersectionObserver existentes. El home vuelve a funcionar mostrando el catálogo real.
7. **Repaso final**: navegar `/`, `/games`, `/games/asteroids`, `/games/asteroids/play` y `/hall-of-fame`, confirmar que todas muestran a Asteroids como único juego sin errores ni referencias al array `GAMES` eliminado; confirmar que no hay ninguna ruta rota (404 inesperado) para ids de juego que ya no existen en Supabase.

## Criterios de aceptación

- [ ] Existe la tabla `games` en Supabase con RLS habilitado, permitiendo solo `SELECT` público (`anon` + `authenticated`), sin `INSERT`/`UPDATE`/`DELETE` públicos.
- [ ] La tabla `games` contiene exactamente una fila, la de `asteroids`, con los mismos valores que tenía en `lib/games.ts` antes de este spec.
- [ ] `lib/games.ts` ya no exporta `GAMES`; exporta `getGames()` y `getGameById(id)` que consultan Supabase, y `activityFeed(games)` recibe la lista como parámetro.
- [ ] `/games` (Biblioteca) es un Server Component que obtiene los juegos de Supabase, muestra solo Asteroids, y el buscador/chips/toggle grid-tabla siguen funcionando sobre esa lista.
- [ ] `/games/asteroids` muestra el detalle real obtenido de Supabase (no del array local).
- [ ] `/games/asteroids/play` sigue siendo jugable, resolviendo el juego vía `getGameById`.
- [ ] `/games/no-existe` (id inexistente en la tabla) devuelve 404 (`notFound()`), tanto en detalle como en `/play`.
- [ ] `/hall-of-fame` muestra un único tab ("ASTEROIDS") poblado con `getGames()`, sin errores ni referencias a juegos que ya no existen.
- [ ] `/` (home) muestra el carrusel, el feed de actividad y el contador "X JUEGOS" (mostrando "1") usando los juegos reales de Supabase, sin romper la animación reveal existente.
- [ ] No queda ninguna referencia a `GAMES` (el array local) en el proyecto tras este spec.
- [ ] No hay ninguna ruta rota (404 inesperado) al navegar `/`, `/games`, `/games/asteroids`, `/games/asteroids/play` y `/hall-of-fame` tras los cambios.

## Decisiones tomadas y descartadas

- **Tabla `games` con seed manual (solo `asteroids`) en vez de migrar las 8 entradas actuales** (tomada): decisión explícita del usuario — solo Asteroids es un juego real jugable hoy; el resto son simulaciones falsas que no deben aparecer como catálogo "real" en Supabase. Nuevos juegos se agregarán a la tabla a mano conforme se implementen.
- **Incluir `app/page.tsx` y `app/games/[id]/play/page.tsx` en este spec** (tomada): decisión explícita del usuario tras señalar que ambos dependían de `GAMES`; dejarlos fuera habría roto esas rutas o generado dos fuentes de verdad del catálogo (una en Supabase, otra local) al mismo tiempo.
- **`app/games/page.tsx` como Server Component + client hijo** (tomada): decisión explícita del usuario, siguiendo el mismo patrón ya usado en `app/games/[id]/page.tsx` (SPEC 05) para mantener consistencia en cómo se consulta Supabase desde rutas del catálogo.
- **Solo `SELECT` público en `games`, sin `INSERT` público** (tomada): decisión explícita del usuario — no hay formulario de alta de juegos en el sitio; las altas futuras se hacen por migración o dashboard, evitando que cualquiera pueda insertar juegos falsos en el catálogo.
- **`CATS`/`GameCategory` se mantienen como enum fijo en TypeScript, no como tabla o columna dinámica** (tomada): las categorías son un conjunto cerrado y estable (`ARCADE`/`PUZZLE`/`SHOOTER`/`VERSUS`), no un dato que necesite persistencia propia.
- **`activityFeed` pasa a recibir `games` por parámetro en vez de importar `GAMES`** (tomada): consecuencia directa de eliminar el array del módulo; evita que la función dependa de un fetch propio y mantiene su firma pura/testeable.

## Riesgos identificados

- **Catálogo reducido a un solo juego afecta la percepción del sitio**: home, biblioteca y salón de la fama mostrarán un único juego hasta que se agreguen más filas manualmente a la tabla. Aceptado como consecuencia directa de la decisión de solo sembrar juegos reales.
- **Altas de juegos 100% manuales**: sin UI de administración, cada nuevo juego requiere una migración SQL o edición directa en el dashboard de Supabase. Aceptado por ahora; una UI de administración queda fuera de alcance de este spec.
- **Fetch adicional por request en rutas que antes leían un array en memoria**: `getGames()`/`getGameById()` agregan una consulta a Supabase donde antes había una búsqueda instantánea en un array local, con la latencia de red correspondiente. No se agrega caché en este spec.
