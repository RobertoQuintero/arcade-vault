# 05 — Leaderboard real con Supabase y vista de tabla del catálogo

- **Estado:** Aprobado
- **Dependencias:** SPEC 01 (MVP visual — define `GAMES`, `seededScores`, `lib/storage.ts`), SPEC 04 (Asteroids real — único juego con `saveScore` conectado a lógica real de juego); usa el cliente/servidor de Supabase ya configurado en `lib/supabase/` (sin tablas creadas aún — este spec crea la primera)
- **Fecha:** 2026-07-19

## Objetivo

Migrar las puntuaciones de `localStorage` a una tabla real en Supabase (leaderboard global, entre dispositivos, con inserción pública para invitados y usuarios autenticados), reemplazar el leaderboard falso (`seededScores`) por esas puntuaciones reales en `/games/[id]` y `/hall-of-fame`, y agregar una vista de tabla alternable junto al grid de tarjetas existente en la Biblioteca (`/games`).

## Alcance

**Incluido:**

- Nueva tabla `scores` en Supabase vía migración SQL (`supabase/migrations/`): columnas `id` (uuid, pk), `game` (text), `score` (integer), `name` (text), `user_id` (uuid, nullable, referencia a `auth.users`), `created_at` (timestamptz, default `now()`).
- Políticas RLS en `scores`: `SELECT` público (cualquiera puede leer el leaderboard) e `INSERT` público para roles `anon` y `authenticated` (invitados y usuarios logueados pueden guardar). Sin `UPDATE`/`DELETE` públicos.
- `lib/storage.ts`: `saveScore` pasa de escribir en `localStorage` a insertar en Supabase (async), usando `user_id: auth.uid()` si hay sesión real de Supabase o `null` si es invitado. Se agrega `getScoresForGame(gameId): Promise<ScoreRow[]>` que trae las puntuaciones reales de un juego ordenadas por `score` descendente. `getUser`/`setUser` (sesión de invitado en `av_user`) no cambian — siguen en `localStorage`, es un mecanismo distinto al de puntuaciones.
- `components/game-player.tsx`: el botón "GUARDAR PUNTUACIÓN" pasa a estado async: `GUARDANDO...` mientras la inserción está pendiente; si falla, muestra mensaje de error y vuelve a estar disponible para reintentar (mismo patrón que el formulario de contacto de SPEC 03).
- `app/games/[id]/page.tsx`: sigue siendo Server Component (Supabase es consultable desde el servidor); reemplaza `seededScores` por `getScoresForGame(id)` real. Si no hay puntuaciones guardadas para ese juego, muestra un estado vacío ("AÚN NO HAY PUNTUACIONES GUARDADAS").
- `app/hall-of-fame/page.tsx`: reemplaza `seededScores` por puntuaciones reales por juego (uno de los tabs). El podio muestra solo los puestos que existan (si hay 1 o 2 puntuaciones, solo esos lugares se llenan). La fila "TU MEJOR MARCA" se resalta comparando el `name` de sesión (`av_user`/Supabase) contra el `name` de las filas reales, case-insensitive; si no hay coincidencia, no se muestra la fila.
- `app/games/page.tsx` (Biblioteca): se agrega un toggle (grid/tabla) que alterna entre el grid de `GameCard` actual y una vista de tabla nueva, ambas filtradas por el mismo buscador y chips de categoría ya existentes. Columnas de la tabla: título, categoría, mejor puntuación (`game.best`, valor fake existente), partidas (`game.plays`, valor fake existente). Cada fila enlaza a `/games/[id]`, igual que las tarjetas.
- Se elimina `seededScores` de `lib/games.ts` (queda sin ningún uso en el proyecto tras este spec).

**Explícitamente fuera de alcance:**

- Anti-cheat o validación de puntuación en servidor (cualquier `score` enviado por el cliente se acepta tal cual, igual que hoy).
- Migrar puntuaciones ya guardadas en `localStorage` (`av_scores`) hacia Supabase — quedan huérfanas en el navegador del usuario, sin importarlas.
- Autenticación anónima de Supabase para invitados — los invitados siguen sin sesión de Supabase, solo con `av_user` local; su `user_id` en `scores` queda `null`.
- Paginación del leaderboard — se trae un top N fijo (igual cantidad que hoy: 10 en detalle, 12 en hall of fame), sin "cargar más".
- Ordenar por columna (click en encabezado) en la vista de tabla del catálogo — mismo orden que el grid, solo cambia la presentación visual.
- Cambios a la lógica de juego real de los demás juegos (`caída`, `serpentina`, etc.) más allá de que su guardado de puntuación pase a Supabase.
- Tests automatizados.

## Modelo de datos

### Tabla `scores` (Supabase, migración nueva)

```sql
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
```

No hay `UPDATE`/`DELETE` habilitados públicamente (no hay política para esas operaciones, quedan bloqueadas por RLS por defecto).

### `lib/storage.ts` (modificación)

```ts
export interface ScoreEntry {
  game: string;
  score: number;
  name: string;
}

export interface ScoreRow {
  rank: number;
  name: string;
  score: number;
  date: string; // dd/mm/yyyy, derivado de created_at
}

// invitados: sigue en localStorage, sin cambios
export function getUser(): StoredUser | null;
export function setUser(user: StoredUser | null): void;

// ahora async — inserta en Supabase (tabla `scores`)
export async function saveScore(entry: ScoreEntry): Promise<void>;

// trae el top de puntuaciones reales de un juego, ordenado desc
export async function getScoresForGame(
  gameId: string,
  limit?: number,
): Promise<ScoreRow[]>;
```

`saveScore` obtiene la sesión actual de Supabase (`lib/supabase/client.ts` en el cliente o `lib/supabase/server.ts` según el llamador) para resolver `user_id` (`auth.uid()` si hay sesión real, `null` si es invitado) y lanza si la inserción falla, para que el llamador (`game-player.tsx`) muestre el estado de error. `getScoresForGame` mapea filas de `scores` (filtradas por `game = gameId`, ordenadas por `score desc`, limitadas) a `ScoreRow`, calculando `rank` por posición y `date` formateando `created_at` como `dd/mm/yyyy`.

### `components/game-player.tsx` (modificación)

No se agregan tipos nuevos. El estado local de guardado pasa de un booleano `saved` a un estado `"idle" | "pending" | "saved" | "error"` para reflejar la llamada async a `saveScore`.

### `app/games/[id]/page.tsx` y `app/hall-of-fame/page.tsx` (modificación)

Ambos reemplazan su llamada a `seededScores(seed, count)` por `await getScoresForGame(game.id, count)` (detalle: 10; hall of fame: 12), manteniendo el mismo tipo `ScoreRow` que ya consumen hoy.

## Plan de implementación

1. **Migración de Supabase**: crear `supabase/migrations/XXXXXXXX_scores.sql` con la tabla `scores` y las políticas RLS (`select` y `insert` públicos). Aplicar la migración al proyecto de Supabase. El proyecto sigue compilando, sin cambios visibles todavía.
2. **`lib/storage.ts`**: reemplazar la implementación de `saveScore` (Supabase insert async, resolviendo `user_id` desde la sesión actual) y agregar `getScoresForGame`. Ajustar el único llamador existente (`game-player.tsx`) al nuevo signature async sin agregar todavía manejo de error/loading. Las puntuaciones ahora se guardan en Supabase en vez de `localStorage`.
3. **`components/game-player.tsx` — estados de guardado**: agregar el estado `"idle" | "pending" | "saved" | "error"` al botón "GUARDAR PUNTUACIÓN" (texto "GUARDANDO...", mensaje de error reintentable). El flujo de guardado de puntuación queda completo y real contra Supabase, con feedback de carga/error.
4. **`app/games/[id]/page.tsx`**: reemplazar `seededScores` por `getScoresForGame(game.id, 10)` y agregar el estado vacío "AÚN NO HAY PUNTUACIONES GUARDADAS". El detalle de cada juego muestra su leaderboard real.
5. **`app/hall-of-fame/page.tsx`**: reemplazar `seededScores` por `getScoresForGame` por tab, ajustar el podio para mostrar solo los puestos que existan, y ajustar la fila "TU MEJOR MARCA" para compararse por nombre de sesión contra las filas reales. El Salón de la Fama queda completo con datos reales.
6. **Limpieza**: eliminar `seededScores` de `lib/games.ts` (sin usos restantes en el proyecto).
7. **`app/games/page.tsx` — vista de tabla**: agregar el control de toggle grid/tabla y el componente de tabla del catálogo (mismas columnas: título, categoría, mejor puntuación, partidas), filtrado por el buscador/chips ya existentes. La Biblioteca ofrece ambas vistas del catálogo.
8. **Repaso final**: jugar una partida y guardar la puntuación (como invitado y con sesión de Supabase iniciada), confirmar que aparece en `/games/[id]` y `/hall-of-fame` reales; probar el toggle de vista en la Biblioteca con distintos filtros activos; simular un fallo de red al guardar para verificar el estado de error reintentable.

## Criterios de aceptación

- [ ] Existe la tabla `scores` en Supabase con RLS habilitado, permitiendo `SELECT` e `INSERT` público (`anon` + `authenticated`).
- [ ] Guardar una puntuación desde el modal de fin de partida como invitado (sin sesión de Supabase) inserta una fila en `scores` con `user_id: null`.
- [ ] Guardar una puntuación con sesión de Supabase iniciada inserta una fila en `scores` con el `user_id` del usuario autenticado.
- [ ] Mientras se guarda la puntuación, el botón muestra "GUARDANDO..." y está deshabilitado.
- [ ] Si la inserción falla (ej. sin conexión), se muestra un mensaje de error y el botón vuelve a estar disponible para reintentar.
- [ ] `/games/[id]` muestra el top 10 de puntuaciones reales guardadas para ese juego, ordenadas de mayor a menor.
- [ ] `/games/[id]` de un juego sin ninguna puntuación guardada muestra el estado vacío "AÚN NO HAY PUNTUACIONES GUARDADAS" en vez de una tabla vacía o datos falsos.
- [ ] `/hall-of-fame` muestra, para cada tab de juego, el top 12 de puntuaciones reales de ese juego.
- [ ] En `/hall-of-fame`, un juego con menos de 3 puntuaciones guardadas muestra el podio solo con los puestos existentes (ej. solo oro si hay 1 puntuación).
- [ ] En `/hall-of-fame`, con sesión iniciada y una puntuación real guardada con el mismo nombre, se muestra la fila "TU MEJOR MARCA"; sin coincidencia de nombre, no se muestra.
- [ ] La Biblioteca (`/games`) tiene un control para alternar entre vista de grid (tarjetas) y vista de tabla, sin perder el filtro de buscador/categoría activo al cambiar de vista.
- [ ] La vista de tabla de la Biblioteca muestra título, categoría, mejor puntuación y partidas por cada juego, filtrada igual que el grid.
- [ ] `seededScores` ya no existe en `lib/games.ts` ni se usa en ningún archivo del proyecto.
- [ ] No hay ninguna ruta rota (404 inesperado) al navegar `/games`, `/games/[id]`, `/games/[id]/play` y `/hall-of-fame` tras los cambios.

## Decisiones tomadas y descartadas

- **Tabla `scores` global con `user_id` nullable en vez de exigir cuenta** (tomada): mantiene el guardado de invitados sin cuenta, comportamiento ya existente que no se quiso remover.
- **`INSERT` público (`anon` + `authenticated`) sin anti-cheat** (tomada): decisión explícita del usuario; cualquier validación de puntuación en servidor queda fuera de alcance de este spec.
- **`/games/[id]` se mantiene como Server Component** (tomada), revirtiendo la conversión a Client Component que se había considerado antes de decidir usar Supabase: al mover la fuente de datos de `localStorage` (solo cliente) a Supabase (consultable desde el servidor), ya no hace falta convertirlo.
- **Eliminar `seededScores` en vez de dejarlo sin usar** (tomada): ningún lugar del proyecto lo llama tras este spec; mantenerlo sería código muerto.
- **Vista de tabla del catálogo con los mismos valores fake de `best`/`plays` que el grid** (tomada): decisión explícita del usuario, evita mezclar fuentes de datos (real para leaderboards, fake para el catálogo) en este spec.
- **Toggle grid/tabla en la misma ruta `/games` en vez de una ruta separada** (tomada): decisión explícita del usuario, mantiene un único punto de entrada a la Biblioteca.
- **Sin políticas de `UPDATE`/`DELETE` en `scores`** (tomada): no hay caso de uso para editar o borrar puntuaciones guardadas en este spec.

## Riesgos identificados

- **Inserción de puntuaciones falsas**: al ser `INSERT` público sin validación de servidor, cualquiera puede llamar a la API de Supabase directamente e insertar una puntuación arbitrariamente alta. No se agrega mitigación en este spec; queda documentado como riesgo aceptado para resolver en un spec futuro si se vuelve un problema real.
- **Costos/límites del plan gratuito de Supabase**: cada partida guardada genera un insert sin límite de frecuencia; un volumen alto de partidas podría acercarse a los límites del plan. No se agrega rate limiting en este spec.
- **`user_id` nullable limita el historial por usuario**: las filas de invitados no podrán atribuirse a una cuenta si en el futuro se quiere mostrar "mis puntuaciones" de un usuario autenticado. Aceptado porque el guardado sin cuenta es un requisito ya existente del proyecto.
- **Sesión de Supabase expirada o ausente al guardar**: `saveScore` inserta con `user_id: null` en ese caso, tratándose igual que un invitado real, sin distinguir ambos casos.
