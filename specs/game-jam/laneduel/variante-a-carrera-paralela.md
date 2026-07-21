# LANE DUEL — Variante A: Carrera paralela clásica

- **Estado:** Borrador
- **Dependencias:** SPEC 04 (Asteroids real — contrato de motor `<Id>Engine`/`EngineSnapshot` y patrón canvas), SPEC 06 (catálogo vía Supabase — `games` ya es data-driven), SPEC 07 (Tetris real — registro `components/games/registry.ts` ya existente)
- **Fecha:** 2026-07-21

## Objetivo

Agregar "LANE DUEL" (id `laneduel`) como primer juego real de la categoría VERSUS: dos jugadores en el mismo teclado cruzan simultáneamente el mismo patrón de carriles con obstáculos en movimiento (coches y troncos, mecánica Frogger), cada uno en su propia mitad del tablero, compitiendo por llegar primero a la meta en cada ronda de un enfrentamiento al mejor de 5. No existe una carpeta `references/started-games/` para este juego: el motor se diseña desde cero, reutilizando conceptualmente la mecánica de cruce de carriles de `hopper` pero adaptada a dos jugadores simultáneos. No reutiliza el cover `cover-duelo` (ya asociado al juego decorativo `duelo-pixel`, un Pong de 2 paletas conceptualmente distinto) — se propone una clase nueva `cover-laneduel`.

## Alcance

**Incluido:**

- Fila nueva en `public.games` (no existe hoy `laneduel`): `id: "laneduel"`, `title: "LANE DUEL"`, `cat: "VERSUS"`, `cover: "cover-laneduel"` (clase **nueva**, a crear en `app/globals.css` durante la implementación siguiendo el patrón de las demás `.cover-*` — dos siluetas verdes/cian avanzando en carriles paralelos con coches magenta cruzando), `color: "magenta"`, `best: 5`, `plays: "2.1K"` (`best` representa el marcador de rondas ganadas por el jugador dominante en la mejor partida registrada, igual de escala que `duelo-pixel` en el catálogo decorativo, cuyo `best: 24` también representa rondas).
- Motor puro `components/games/laneduel/engine.ts` (`LaneDuelEngine`) con:
  - Dos tableros idénticos de cuadrícula (`7 columnas × 11 filas` cada uno), dibujados lado a lado en el mismo canvas (mitad izquierda para P1, mitad derecha para P2), **sin interacción física entre jugadores** — cada uno solo puede colisionar con sus propios obstáculos.
  - Ambos tableros generan **el mismo patrón de carriles** en cada ronda (misma semilla aleatoria compartida), garantizando que la ronda sea justa: ningún jugador enfrenta obstáculos más fáciles que el otro.
  - Movimiento discreto por celda (una celda por pulsación, cooldown ~130ms): P1 controla con flechas (`ArrowUp/Down/Left/Right`), P2 controla con WASD (`KeyW/A/S/D`).
  - Ronda: ambos jugadores parten de la fila 0 de su mitad; el primero en alcanzar la fila superior (meta) gana la ronda. Al terminar la ronda (por victoria de cualquiera o por doble muerte simultánea, que se cuenta como ronda nula y se repite), ambos jugadores se reposicionan en el inicio y se genera un nuevo patrón de carriles (misma semilla para ambas mitades) ligeramente más veloz.
  - Partida al mejor de 5 rondas: el primer jugador en ganar 3 rondas gana el enfrentamiento y termina la partida.
  - El motor dibuja su propio HUD (marcador P1/P2, ronda actual) y su propio overlay de fin de partida ("P1 GANA EL DUELO" / "P2 GANA EL DUELO") dentro de `draw()`, y expone `getSnapshot()` (`EngineSnapshot`).
- Componente `components/games/laneduel/laneduel-canvas.tsx`, estructuralmente idéntico a `asteroids-canvas.tsx`: monta el canvas, mide con `ResizeObserver`, captura teclado (flechas + WASD combinados), corre el loop respetando `paused`, reenvía `onSnapshot` y expone `forceGameOver` vía `forceEndRef`.
- Alta de una línea en `components/games/registry.ts` (`laneduel: LaneDuelCanvas`). El registro ya existe (creado en SPEC 07); no se toca `game-player.tsx`.
- Migración SQL `supabase/migrations/<timestamp>_laneduel.sql` con el insert de la fila `laneduel`, aplicada vía `mcp__supabase__apply_migration`.

**Explícitamente fuera de alcance:**

- Modo un jugador contra CPU — es estrictamente 2 jugadores locales en el mismo teclado, como el resto de juegos VERSUS previstos para el catálogo.
- Interacción física entre los dos frogs (colisión entre jugadores) — eso es exactamente lo que agrega la **variante B**; aquí las mitades son completamente independientes salvo por compartir el mismo patrón de carriles.
- Controles táctiles/on-screen.
- Sonido/efectos de audio.
- Tests automatizados.
- Cambios a `lib/games.ts`, `lib/storage.ts`, `lib/supabase/*` o páginas `app/*` más allá de que sigan funcionando data-driven con la nueva fila.

## Modelo de datos

No se introduce persistencia nueva (`saveScore`/`getScoresForGame` de `lib/storage.ts` no cambian; indexan por `game.id` y `laneduel` ya funciona en cuanto exista la fila).

### `public.games` (insert nuevo, sin cambio de esquema)

```sql
insert into public.games (id, title, short, long, cat, cover, color, best, plays) values (
  'laneduel',
  'LANE DUEL',
  'Dos jugadores, los mismos carriles, una sola meta.',
  'Comparte el teclado y cruza en paralelo la misma autopista de coches y ríos de troncos que tu rival. Gana rondas llegando primero a la meta; el primero en ganar tres se lleva el duelo.',
  'VERSUS',
  'cover-laneduel',
  'magenta',
  5,
  '2.1K'
);
```

### `components/games/laneduel/engine.ts`

```ts
export type EngineState = "playing" | "dead" | "gameover";

export interface EngineSnapshot {
  score: number;
  lives: number;
  level: number;
  state: EngineState;
}

export class LaneDuelEngine {
  constructor(width: number, height: number);
  resize(width: number, height: number): void;
  update(dt: number): void;
  draw(ctx: CanvasRenderingContext2D): void; // dos tableros + HUD + overlay de resultado propios
  setKey(code: string, down: boolean): void;
  forceGameOver(): void;
  getSnapshot(): EngineSnapshot;
}
```

Al ser el primer juego VERSUS real del catálogo, el mapeo de `EngineSnapshot` a un marcador de dos jugadores se resuelve así (documentado explícitamente, siguiendo el precedente de Tetris/Arkanoid repurposeando `lives`/`level`):

- `score`: codifica el resultado del enfrentamiento como `ganadorRondas × 1000 + perdedorRondas` (ej. `3002` = el jugador dominante ganó 3 rondas contra 2), un único número que preserva tanto quién domina como qué tan reñido estuvo el duelo, útil para ordenar el Hall of Fame de más a menos dominante.
- `lives`: repurpuesto como **rondas restantes en la partida al mejor de 5** (empieza en `5`, decrece en 1 cada vez que se resuelve una ronda —gane quien gane—, llegando a `0` como mucho cuando se agotan las 5 rondas posibles, aunque normalmente la partida termina antes al alcanzar 3 victorias de un jugador).
- `level`: número de ronda en curso (`1..5`).
- `state`: `"playing"` durante una ronda en curso, `"dead"` brevemente (~500ms) tras resolver cada ronda mientras se muestra qué jugador la ganó y se reposicionan ambos, `"gameover"` cuando un jugador alcanza 3 victorias.

El tamaño de celda se calcula igual que en `HopperEngine`, pero dividiendo el ancho del canvas entre 2 (una mitad por jugador) antes de dividir entre `COLS = 7`.

### `components/games/laneduel/laneduel-canvas.tsx`

Mismo contrato `GameCanvasProps` de `components/games/registry.ts` (`{ paused, onSnapshot, forceEndRef }`), sin props nuevas. Captura ambos esquemas de teclas (flechas + WASD) en el mismo listener de `window`.

### `components/games/registry.ts` (alta de una línea)

```ts
import { LaneDuelCanvas } from "@/components/games/laneduel/laneduel-canvas";

export const GAME_CANVASES: Record<string, ComponentType<GameCanvasProps>> = {
  asteroids: AsteroidsCanvas,
  tetris: TetrisCanvas,
  arkanoid: ArkanoidCanvas,
  snake: SnakeCanvas,
  laneduel: LaneDuelCanvas, // ← línea nueva
};
```

No se modifica `components/game-player.tsx`.

## Plan de implementación

1. **Motor puro — dos tableros espejados**: crear `components/games/laneduel/engine.ts` con dos instancias internas de tablero de carriles (`7×11` cada una), generadas con la misma semilla por ronda, dibujadas en las dos mitades del canvas. Sin jugadores todavía.
2. **Motor puro — jugadores y colisión independiente**: agregar los dos jugadores (posición de celda + controles propios), colisión contra los obstáculos de su propia mitad únicamente, detección de "llegó a la meta" por jugador.
3. **Motor puro — rondas y marcador**: implementar la resolución de ronda (victoria/ronda nula), el reposicionamiento tras cada ronda, el incremento de velocidad por ronda, el marcador `ganadorRondas`/`perdedorRondas`, el fin de partida al llegar a 3 victorias, `draw()` con HUD propio (marcador, ronda) y overlay de resultado, `resize`, `setKey`, `forceGameOver`, `getSnapshot` (con el mapeo de `score`/`lives`/`level`/`state` descrito arriba). Motor completo y jugable en aislamiento.
4. **`components/games/laneduel/laneduel-canvas.tsx`**: copiar la estructura de `hopper-canvas.tsx` (más cercano por compartir la mecánica de cuadrícula), capturando ambos esquemas de teclas simultáneamente.
5. **Cover art**: diseñar `.cover-laneduel` en `app/globals.css` con `/frontend-design` (dos siluetas en carriles paralelos, colores magenta/verde), siguiendo el patrón de las demás clases `.cover-*` puramente CSS.
6. **Alta en `components/games/registry.ts`**: agregar el import de `LaneDuelCanvas` y la entrada `laneduel: LaneDuelCanvas`. No se toca `game-player.tsx`.
7. **Migración Supabase**: crear `supabase/migrations/<timestamp>_laneduel.sql` con el insert de la sección de modelo de datos y aplicarla vía `mcp__supabase__apply_migration`.
8. **Verificación end-to-end**: `npm run dev`, navegar `/`, `/games`, `/games/laneduel`, `/games/laneduel/play`, `/hall-of-fame`; `npx tsc --noEmit` sin errores; jugar un duelo completo (varias rondas, un jugador gana 3), guardar puntuación y confirmar que aparece en el leaderboard.

## Criterios de aceptación

- [ ] `/games` y `/` muestran la tarjeta "LANE DUEL" (cover `cover-laneduel`, categoría VERSUS) sin tocar el resto del catálogo.
- [ ] `/games/laneduel` muestra el detalle del juego con su descripción y leaderboard (vacío o con scores existentes).
- [ ] `/games/laneduel/play` renderiza el juego real dentro del `.crt-screen` en vez del `.game-arena` decorativo.
- [ ] Flechas mueven a P1 y WASD mueve a P2 de forma independiente, cada uno en su propia mitad del canvas.
- [ ] Ambas mitades generan exactamente el mismo patrón de carriles (misma semilla) en cada ronda, verificable visualmente.
- [ ] El primer jugador en alcanzar la fila de meta gana la ronda; el marcador (visible en el HUD) sube para ese jugador.
- [ ] Cada nueva ronda reposiciona a ambos jugadores y aumenta ligeramente la velocidad de los carriles respecto a la ronda anterior.
- [ ] El primer jugador en llegar a 3 rondas ganadas termina la partida, mostrando el overlay de resultado ("P1/P2 GANA EL DUELO") del canvas y abriendo el modal de fin de partida de React.
- [ ] "PAUSA" detiene realmente el juego (ambos tableros se congelan) y "REANUDAR" continúa exactamente donde quedó.
- [ ] "FIN" termina la partida de inmediato con el marcador acumulado hasta ese momento.
- [ ] Guardar la puntuación invoca `saveScore({ game: "laneduel", score, name })` codificando el marcador según `ganadorRondas × 1000 + perdedorRondas`; el score aparece en `/games/laneduel` y `/hall-of-fame`.
- [ ] "JUGAR DE NUEVO" reinicia el motor completo (marcador en 0-0, ronda 1).
- [ ] Redimensionar la ventana ajusta el tamaño de celda de ambas mitades sin romper el layout ni la playabilidad.
- [ ] Asteroids, Tetris, Arkanoid y Snake no cambian de comportamiento tras agregar Lane Duel al registro.
- [ ] `npx tsc --noEmit` no reporta errores.

## Decisiones tomadas y descartadas

- **Sin interacción física entre jugadores (mitades completamente independientes)** (tomada): esta es la diferencia central frente a la **variante B** (choque/sabotaje), que sí introduce colisión entre los dos frogs en un tablero compartido. Esta variante A se prefiere cuando se busca un duelo "limpio" centrado puramente en habilidad de cruce individual y comparación directa de tiempos/rondas, sin el factor de agresión física de la variante B.
- **Misma semilla de generación para ambas mitades en cada ronda** (tomada): es la única forma de que la competencia sea justa en un juego con obstáculos aleatorios; sin esto, un jugador podría ganar simplemente por tener un patrón de carriles más favorable, no por mejor juego.
- **Marcador codificado en un solo `score` (`ganadorRondas × 1000 + perdedorRondas`)** (tomada): el contrato `EngineSnapshot` es compartido entre todos los motores y solo expone un `score` numérico; esta codificación preserva tanto el resultado final como el margen de victoria en un único valor ordenable para el Hall of Fame, evitando cambios al esquema de `scores`.
- **`lives` repurpuesto como "rondas restantes de la partida al mejor de 5"** (tomada): mantiene el campo con un valor coherente y decreciente (como en cualquier otro juego), en vez de forzar un cambio de tipo que rompería la compatibilidad estructural con los demás motores del registro.
- **Cover nuevo (`cover-laneduel`) en vez de reutilizar `cover-duelo`** (tomada): `cover-duelo` ya está asociado semánticamente al decorativo `duelo-pixel` (un Pong de dos paletas), un concepto visual distinto (paletas verticales + pelota) al de dos frogs cruzando carriles; reutilizarlo generaría una cover art incoherente con la mecánica real del juego.

## Riesgos identificados

- **"Ronda nula" por doble muerte simultánea** puede ocurrir con más frecuencia de la esperada si ambos jugadores cometen errores al mismo tiempo por presión competitiva; se mitiga simplemente repitiendo la ronda con una nueva semilla, sin penalizar a ninguno.
- **Split-screen en un canvas angosto** (pantallas muy estrechas) puede dejar muy poco ancho por mitad para que el tablero de `7` columnas se lea con claridad; se mitiga con un ancho mínimo de celda razonable y, si no alcanza, aceptando scroll horizontal del contenedor `.crt-screen` como último recurso (mismo criterio de tolerancia visual que otros motores ante redimensionados extremos).
- **Ventaja de "home row advantage" por posición de teclado** (WASD vs flechas) es un desbalance percibido común en juegos de 2 jugadores en un teclado; se acepta como parte del género (mismo trade-off que cualquier juego local de 2 jugadores en teclado único) y no se compensa artificialmente.
- **Sincronización de los dos temporizadores de ronda internos** (uno por mitad) podría desalinearse por un frame si el `update(dt)` no procesa ambas mitades en el mismo tick; se mitiga procesando ambas mitades secuencialmente dentro del mismo `update(dt)`, nunca en llamadas separadas.
