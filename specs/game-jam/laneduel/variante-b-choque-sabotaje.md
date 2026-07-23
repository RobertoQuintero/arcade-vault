# LANE DUEL — Variante B: Choque y sabotaje en tablero compartido

- **Estado:** Borrador
- **Dependencias:** SPEC 04 (Asteroids real — contrato de motor `<Id>Engine`/`EngineSnapshot` y patrón canvas), SPEC 06 (catálogo vía Supabase — `games` ya es data-driven), SPEC 07 (Tetris real — registro `components/games/registry.ts` ya existente)
- **Fecha:** 2026-07-21

## Objetivo

Agregar "LANE DUEL" (id `laneduel`) como primer juego real de la categoría VERSUS, en esta variante como un cruce de carriles **agresivo**: dos jugadores comparten un único tablero (no dos mitades independientes) y, además de esquivar coches y montar troncos, pueden **empujarse físicamente entre sí** para sabotear el avance del rival, en un enfrentamiento al mejor de 5 rondas. No existe una carpeta `references/started-games/` para este juego: el motor se diseña desde cero. No reutiliza el cover `cover-duelo` (ya asociado al decorativo `duelo-pixel`, un Pong de 2 paletas conceptualmente distinto) — se propone una clase nueva `cover-laneduel`.

## Alcance

**Incluido:**

- Fila nueva en `public.games` (misma fila que la variante A, no existe hoy `laneduel`): `id: "laneduel"`, `title: "LANE DUEL"`, `cat: "VERSUS"`, `cover: "cover-laneduel"` (clase **nueva**, a crear en `app/globals.css` durante la implementación), `color: "magenta"`, `best: 5`, `plays: "2.1K"` (mismos valores que la variante A, mismo criterio de escala que `duelo-pixel`).
- Motor puro `components/games/laneduel/engine.ts` (`LaneDuelEngine`) con:
  - **Un solo tablero compartido** de cuadrícula (`9 columnas × 11 filas`), con carriles de coches y troncos que ambos jugadores deben cruzar, partiendo cada uno de una columna distinta de la fila 0.
  - Movimiento discreto por celda (una celda por pulsación, cooldown ~130ms): P1 con flechas (`ArrowUp/Down/Left/Right`), P2 con WASD (`KeyW/A/S/D`).
  - **Colisión jugador-contra-jugador**: si un jugador se mueve hacia la celda ocupada por el otro, el movimiento se convierte en un "empujón" — el jugador empujado retrocede una fila (si hay espacio) en vez de moverse el que empuja; si el jugador empujado es forzado a retroceder sobre una celda de carretera con un coche en tránsito o al agua sin tronco, muere igual que por colisión normal con un obstáculo. Esto convierte el posicionamiento relativo entre jugadores en una herramienta táctica de sabotaje.
  - El resto de reglas de ronda son las de un cruce de carriles estándar: pisar un coche o caer al agua sin tronco (por cuenta propia o por ser empujado) = esa ronda se pierde para ese jugador (el rival la gana automáticamente si sigue con vida; si ambos mueren en el mismo tick, la ronda es nula y se repite).
  - Partida al mejor de 5 rondas: el primer jugador en ganar 3 rondas gana el enfrentamiento y termina la partida. Cada ronda nueva reposiciona a ambos jugadores en columnas de inicio distintas y regenera el patrón de carriles (más veloz que la ronda anterior).
  - El motor dibuja su propio HUD (marcador P1/P2, ronda actual) y su propio overlay de fin de partida dentro de `draw()`, y expone `getSnapshot()` (`EngineSnapshot`).
- Componente `components/games/laneduel/laneduel-canvas.tsx`, estructuralmente idéntico a `asteroids-canvas.tsx`: monta el canvas, mide con `ResizeObserver`, captura teclado (flechas + WASD combinados), corre el loop respetando `paused`, reenvía `onSnapshot` y expone `forceGameOver` vía `forceEndRef`.
- Alta de una línea en `components/games/registry.ts` (`laneduel: LaneDuelCanvas`). El registro ya existe (creado en SPEC 07); no se toca `game-player.tsx`.
- Migración SQL `supabase/migrations/<timestamp>_laneduel.sql` con el insert de la fila `laneduel`, aplicada vía `mcp__supabase__apply_migration`.

**Explícitamente fuera de alcance:**

- Modo un jugador contra CPU — es estrictamente 2 jugadores locales en el mismo teclado.
- Dos tableros independientes con mismo patrón de carriles — eso es exactamente lo que propone la **variante A**; aquí es un único tablero compartido con colisión física entre jugadores.
- Power-ups de sabotaje adicionales (proyectiles, trampas) más allá del empujón físico por ocupar la misma celda.
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
  'Cruza los carriles y empuja a tu rival al asfalto.',
  'Un solo tablero, dos jugadores, cero tregua: además de esquivar coches y montar troncos, puedes empujar a tu rival hacia atrás para sabotear su cruce. El primero en ganar tres rondas se lleva el duelo.',
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
  draw(ctx: CanvasRenderingContext2D): void; // tablero compartido + ambos jugadores + HUD + overlay propios
  setKey(code: string, down: boolean): void;
  forceGameOver(): void;
  getSnapshot(): EngineSnapshot;
}
```

Mismo mapeo de `EngineSnapshot` que la variante A (primer juego VERSUS del catálogo, mismo criterio de repurposing):

- `score`: `ganadorRondas × 1000 + perdedorRondas`.
- `lives`: rondas restantes en la partida al mejor de 5 (empieza en `5`, decrece 1 por ronda resuelta).
- `level`: número de ronda en curso (`1..5`).
- `state`: `"playing"` durante una ronda, `"dead"` brevemente (~500ms) tras resolver cada ronda (incluye el caso especial de que un empujón cause la muerte del jugador empujado, mostrando claramente en el overlay transitorio "P2 EMPUJÓ A P1 AL AGUA" o equivalente), `"gameover"` cuando un jugador alcanza 3 victorias.

El tamaño de celda se calcula igual que en `HopperEngine`, sobre el ancho completo del canvas (no dividido en mitades, a diferencia de la variante A) entre `COLS = 9`.

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

1. **Motor puro — tablero compartido**: crear `components/games/laneduel/engine.ts` con un único tablero de carriles (`9×11`), generación de coches/troncos, sin jugadores todavía.
2. **Motor puro — jugadores y colisión jugador-contra-jugador**: agregar los dos jugadores (posición de celda + controles propios), la lógica de "empujón" cuando un jugador intenta moverse a la celda del otro (retroceso de una fila del jugador empujado, con verificación de si esa celda de retroceso es letal), y la colisión normal contra obstáculos.
3. **Motor puro — rondas y marcador**: resolución de ronda (victoria/ronda nula por doble muerte), reposicionamiento en columnas de inicio distintas, incremento de velocidad por ronda, marcador `ganadorRondas`/`perdedorRondas`, fin de partida a 3 victorias, `draw()` con HUD propio y overlay de resultado (incluyendo el mensaje especial de muerte por empujón), `resize`, `setKey`, `forceGameOver`, `getSnapshot`. Motor completo y jugable en aislamiento.
4. **`components/games/laneduel/laneduel-canvas.tsx`**: copiar la estructura de `hopper-canvas.tsx`, capturando ambos esquemas de teclas simultáneamente.
5. **Cover art**: diseñar `.cover-laneduel` en `app/globals.css` con `/frontend-design` (dos siluetas encontrándose en el mismo carril, un ícono de empujón/colisión entre ellas).
6. **Alta en `components/games/registry.ts`**: agregar el import de `LaneDuelCanvas` y la entrada `laneduel: LaneDuelCanvas`. No se toca `game-player.tsx`.
7. **Migración Supabase**: crear `supabase/migrations/<timestamp>_laneduel.sql` con el insert de la sección de modelo de datos y aplicarla vía `mcp__supabase__apply_migration`.
8. **Verificación end-to-end**: `npm run dev`, navegar `/`, `/games`, `/games/laneduel`, `/games/laneduel/play`, `/hall-of-fame`; `npx tsc --noEmit` sin errores; jugar un duelo completo provocando al menos un empujón letal y ganando 3 rondas, guardar puntuación y confirmar que aparece en el leaderboard.

## Criterios de aceptación

- [ ] `/games` y `/` muestran la tarjeta "LANE DUEL" (cover `cover-laneduel`, categoría VERSUS) sin tocar el resto del catálogo.
- [ ] `/games/laneduel` muestra el detalle del juego con su descripción y leaderboard (vacío o con scores existentes).
- [ ] `/games/laneduel/play` renderiza el juego real dentro del `.crt-screen` en vez del `.game-arena` decorativo.
- [ ] Flechas mueven a P1 y WASD mueve a P2 en el mismo tablero compartido.
- [ ] Intentar moverse a la celda ocupada por el rival lo empuja una fila hacia atrás en vez de completar el movimiento propio.
- [ ] Un empujón que fuerza al jugador empujado a una celda letal (coche en tránsito o agua sin tronco) cuenta como su muerte y termina la ronda a favor del otro jugador.
- [ ] El primer jugador en alcanzar la fila de meta gana la ronda si sigue con vida; el marcador sube para ese jugador.
- [ ] Cada nueva ronda reposiciona a ambos jugadores en columnas de inicio distintas y regenera el tablero con velocidad ligeramente mayor.
- [ ] El primer jugador en llegar a 3 rondas ganadas termina la partida, mostrando el overlay de resultado del canvas y abriendo el modal de fin de partida de React.
- [ ] "PAUSA" detiene realmente el juego (tablero y ambos jugadores se congelan) y "REANUDAR" continúa exactamente donde quedó.
- [ ] "FIN" termina la partida de inmediato con el marcador acumulado hasta ese momento.
- [ ] Guardar la puntuación invoca `saveScore({ game: "laneduel", score, name })` codificando el marcador según `ganadorRondas × 1000 + perdedorRondas`; el score aparece en `/games/laneduel` y `/hall-of-fame`.
- [ ] "JUGAR DE NUEVO" reinicia el motor completo (marcador en 0-0, ronda 1).
- [ ] Redimensionar la ventana ajusta el tamaño de celda del tablero compartido sin romper el layout ni la playabilidad.
- [ ] Asteroids, Tetris, Arkanoid y Snake no cambian de comportamiento tras agregar Lane Duel al registro.
- [ ] `npx tsc --noEmit` no reporta errores.

## Decisiones tomadas y descartadas

- **Tablero único compartido con colisión jugador-contra-jugador (empujón)** (tomada): esta es la diferencia central frente a la **variante A** (carrera paralela sin interacción), que usa dos mitades completamente independientes. Esta variante B se prefiere cuando se busca un VERSUS con más tensión directa entre los jugadores (interacción táctica activa) en vez de una comparación pura de habilidad individual — más cercano en espíritu a juegos de "sabotaje" tipo Mario Kart que a una carrera de tiempos.
- **Empujón como único mecanismo de sabotaje, sin proyectiles ni power-ups** (tomada): mantiene el alcance acotado (esfuerzo bajo-medio pedido para el tema) y reutiliza directamente la mecánica de colisión de celda que ya debe implementarse para coches/troncos, en vez de introducir sistemas nuevos (proyectiles, inventario de power-ups).
- **El empujón solo retrocede una fila, nunca lateralmente** (tomada): simplifica la lógica de colisión (una sola dirección de resolución) y mantiene el sabotaje legible — el jugador ve claramente que perdió una fila de avance, sin ambigüedad de hacia qué columna fue empujado.
- **Ronda nula en doble muerte simultánea** (tomada, igual que variante A): si ambos jugadores mueren en el mismo tick (por ejemplo, un empujón mutuo simultáneo que termina matando a ambos), la ronda se repite sin penalizar a ninguno, evitando resultados injustos por casualidad de timing.
- **Mismo esquema de marcador/reparto de `EngineSnapshot` que la variante A** (tomada): al ser dos variantes del mismo `game_id`/fila de `games`, mantener el mismo contrato de mapeo simplifica la elección entre variantes en implementación — cambia la mecánica interna, no la interfaz expuesta a React.

## Riesgos identificados

- **El empujón puede sentirse injusto si ocurre por un movimiento accidental** (el jugador no quería empujar, solo se topó con el rival al esquivar un coche); se mitiga haciendo el empujón una consecuencia clara y visualmente evidente de cualquier intento de movimiento hacia la celda ocupada, sin distinguir intención — es una regla simple y predecible, aceptada como parte del riesgo/recompensa del modo.
- **Bloqueo mutuo cerca de la meta** (ambos jugadores empujándose repetidamente en la última fila) podría alargar la ronda indefinidamente; se mitiga con el cooldown de movimiento ya existente (~130ms), que limita la frecuencia de empujones por segundo, y opcionalmente un límite de tiempo por ronda que la declara nula si se excede (a definir en implementación si el playtesting lo amerita).
- **Ventaja posicional de columnas de inicio** si no se alternan de forma justa entre rondas; se mitiga alternando las columnas de inicio asignadas a P1/P2 en cada ronda nueva.
- **Redimensionar el canvas en pleno juego** recalcula el tamaño de celda del tablero compartido y puede desplazar visualmente ambos jugadores por un frame; mismo criterio aceptado en SPEC 04/07/10.
