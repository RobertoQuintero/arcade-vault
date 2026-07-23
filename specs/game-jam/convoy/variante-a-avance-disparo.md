# CONVOY — Variante A: Avance con disparo frontal

- **Estado:** Borrador
- **Dependencias:** SPEC 04 (Asteroids real — contrato de motor `<Id>Engine`/`EngineSnapshot` y patrón canvas), SPEC 06 (catálogo vía Supabase — `games` ya es data-driven), SPEC 07 (Tetris real — registro `components/games/registry.ts` ya existente), SPEC 08 (Arkanoid real — precedente de renderizado vectorial sin sprites/spritesheet)
- **Fecha:** 2026-07-21

## Objetivo

Agregar "CONVOY" (id `convoy`) como juego real y jugable de la categoría SHOOTER: un híbrido de cruce de carriles y disparo — el jugador avanza fila por fila por una autopista de camiones y vehículos hostiles, pudiendo esquivarlos o destruir a los destructibles con un disparo frontal, sumando puntos por avance y por bajas mientras completa rondas cada vez más densas. Diversifica la única categoría SHOOTER existente hoy (Asteroids). No existe una carpeta `references/started-games/` para este juego: el motor se diseña desde cero, con renderizado vectorial (rectángulos/triángulos de color sólido), siguiendo el mismo criterio ya usado en SPEC 08 para Arkanoid (sin assets de imagen).

## Alcance

**Incluido:**

- Fila nueva en `public.games` (no existe hoy `convoy`): `id: "convoy"`, `title: "CONVOY"`, `cat: "SHOOTER"`, `cover: "cover-convoy"` (clase **nueva**, a crear en `app/globals.css` durante la implementación), `color: "cyan"`, `best: 52000`, `plays: "8.9K"`, `short`/`long` descriptivos.
- Motor puro `components/games/convoy/engine.ts` (`ConvoyEngine`) con:
  - Tablero de cuadrícula (`9 columnas × 13 filas`, mismas proporciones que `hopper`): el jugador avanza fila por fila con movimiento discreto (una celda por pulsación, `ArrowLeft/Right` para cambiar de columna, `ArrowUp` para avanzar de fila, `ArrowDown` para retroceder), con cooldown ~130ms.
  - Disparo frontal: `Space` dispara un proyectil vertical hacia arriba desde la posición actual del jugador, con cadencia limitada (cooldown de disparo ~250ms).
  - Carriles de convoy: cada fila de carretera tiene vehículos moviéndose horizontalmente, de dos tipos — **destructibles** (camiones ligeros, mueren de un disparo y suman puntos) e **indestructibles** (blindados, deben esquivarse; un disparo los golpea sin efecto). Pisar cualquier vehículo (destructible o no) al intentar avanzar sin dispararlo antes cuenta como colisión y resta una vida.
  - Puntuación: `+10` por fila nueva alcanzada (igual criterio que `hopper`), `+25` por cada vehículo destructible destruido, `+150` de bono al completar una ronda (llegar a la fila superior), avanzando a una ronda con más densidad y velocidad de convoy.
  - 3 vidas; al perder una, el jugador reaparece en la fila de inicio de la ronda actual conservando el progreso de ronda ya alcanzado (igual criterio que Arkanoid al perder la pelota).
  - El motor dibuja su propio HUD (SCORE, RONDA, VIDAS) y su propio overlay de "GAME OVER" dentro de `draw()`, con renderizado 100% vectorial (sin spritesheet), y expone `getSnapshot()` (`EngineSnapshot`).
- Componente `components/games/convoy/convoy-canvas.tsx`, estructuralmente idéntico a `asteroids-canvas.tsx`: monta el canvas, mide con `ResizeObserver`, captura teclado (`ArrowLeft`, `ArrowRight`, `ArrowUp`, `ArrowDown`, `Space`), corre el loop respetando `paused`, reenvía `onSnapshot` y expone `forceGameOver` vía `forceEndRef`.
- Alta de una línea en `components/games/registry.ts` (`convoy: ConvoyCanvas`). El registro ya existe (creado en SPEC 07); no se toca `game-player.tsx`.
- Migración SQL `supabase/migrations/<timestamp>_convoy.sql` con el insert de la fila `convoy`, aplicada vía `mcp__supabase__apply_migration`.

**Explícitamente fuera de alcance:**

- Controles táctiles/on-screen.
- Power-ups, armas alternativas o modos cooperativos/versus.
- Sprites/imágenes — renderizado vectorial únicamente, mismo criterio que Arkanoid (SPEC 08).
- Sonido/efectos de audio.
- Tests automatizados.
- Cambios a `lib/games.ts`, `lib/storage.ts`, `lib/supabase/*` o páginas `app/*` más allá de que sigan funcionando data-driven con la nueva fila.

## Modelo de datos

No se introduce persistencia nueva (`saveScore`/`getScoresForGame` de `lib/storage.ts` no cambian; indexan por `game.id` y `convoy` ya funciona en cuanto exista la fila).

### `public.games` (insert nuevo, sin cambio de esquema)

```sql
insert into public.games (id, title, short, long, cat, cover, color, best, plays) values (
  'convoy',
  'CONVOY',
  'Avanza, esquiva y despeja el convoy a tiros.',
  'Cruza una autopista de camiones hostiles disparando a los destructibles y esquivando a los blindados. Cada fila superada suma puntos, y completar el convoy te lanza a una ronda más densa y veloz.',
  'SHOOTER',
  'cover-convoy',
  'cyan',
  52000,
  '8.9K'
);
```

### `components/games/convoy/engine.ts`

```ts
export type EngineState = "playing" | "dead" | "gameover";

export interface EngineSnapshot {
  score: number;
  lives: number;
  level: number;
  state: EngineState;
}

export class ConvoyEngine {
  constructor(width: number, height: number);
  resize(width: number, height: number): void;
  update(dt: number): void;
  draw(ctx: CanvasRenderingContext2D): void; // carriles + vehículos + jugador + proyectiles + HUD + overlay propios
  setKey(code: string, down: boolean): void;
  forceGameOver(): void;
  getSnapshot(): EngineSnapshot;
}
```

`lives` es literal (`3 → 0`), igual que Asteroids/Arkanoid. `level` es el número de ronda de convoy actual. Igual que `HopperEngine` variante A, este motor **usa el estado `"dead"` transitorio** (~500ms) al perder una vida antes de reaparecer, dejando `"gameover"` solo para la pérdida de la última vida.

El tamaño de celda se calcula igual que en `HopperEngine`: `Math.floor(Math.min(width / COLS, (height - HUD_MARGIN) / ROWS))` con `COLS = 9`, `ROWS = 13`.

### `components/games/convoy/convoy-canvas.tsx`

Mismo contrato `GameCanvasProps` de `components/games/registry.ts` (`{ paused, onSnapshot, forceEndRef }`), sin props nuevas.

### `components/games/registry.ts` (alta de una línea)

```ts
import { ConvoyCanvas } from "@/components/games/convoy/convoy-canvas";

export const GAME_CANVASES: Record<string, ComponentType<GameCanvasProps>> = {
  asteroids: AsteroidsCanvas,
  tetris: TetrisCanvas,
  arkanoid: ArkanoidCanvas,
  snake: SnakeCanvas,
  convoy: ConvoyCanvas, // ← línea nueva
};
```

No se modifica `components/game-player.tsx`.

## Plan de implementación

1. **Motor puro — tablero y carriles de convoy**: crear `components/games/convoy/engine.ts` con el tablero `9×13`, los carriles de vehículos (destructibles/indestructibles, velocidad y densidad por fila), y su movimiento continuo horizontal. Sin jugador ni disparo todavía.
2. **Motor puro — jugador, movimiento y disparo**: agregar el jugador (posición de celda + movimiento discreto con cooldown), el proyectil vertical con su propio cooldown de disparo, y la colisión proyectil-vehículo (destruye destructibles, rebota sin efecto en blindados).
3. **Motor puro — colisión, vidas, puntuación y rondas**: colisión jugador-vehículo (resta vida, estado `"dead"` transitorio y respawn), puntuación (`+10`/`+25`/`+150`), avance de ronda al llegar a la fila superior con reescalado de densidad/velocidad, `draw()` con HUD propio (SCORE, RONDA, VIDAS) y overlay de game over, `resize`, `setKey`, `forceGameOver`, `getSnapshot`. Motor completo y jugable en aislamiento.
4. **`components/games/convoy/convoy-canvas.tsx`**: copiar la estructura de `hopper-canvas.tsx`, cambiando el motor importado y el `Set` de teclas capturadas (agregando `Space` para disparo).
5. **Cover art**: diseñar `.cover-convoy` en `app/globals.css` con `/frontend-design` (carriles horizontales con siluetas de camiones cian/rojo y un cañón apuntando hacia arriba).
6. **Alta en `components/games/registry.ts`**: agregar el import de `ConvoyCanvas` y la entrada `convoy: ConvoyCanvas`. No se toca `game-player.tsx`.
7. **Migración Supabase**: crear `supabase/migrations/<timestamp>_convoy.sql` con el insert de la sección de modelo de datos y aplicarla vía `mcp__supabase__apply_migration`.
8. **Verificación end-to-end**: `npm run dev`, navegar `/`, `/games`, `/games/convoy`, `/games/convoy/play`, `/hall-of-fame`; `npx tsc --noEmit` sin errores; jugar una partida completa (destruir vehículos, esquivar blindados, completar una ronda, perder una vida y reaparecer, agotar las 3 vidas), guardar puntuación y confirmar que aparece en el leaderboard.

## Criterios de aceptación

- [ ] `/games` y `/` muestran la tarjeta "CONVOY" (cover `cover-convoy`, categoría SHOOTER) sin tocar el resto del catálogo.
- [ ] `/games/convoy` muestra el detalle del juego con su descripción y leaderboard (vacío o con scores existentes).
- [ ] `/games/convoy/play` renderiza el juego real dentro del `.crt-screen` en vez del `.game-arena` decorativo.
- [ ] Flechas mueven al jugador por fila/columna en cuadrícula, `Space` dispara un proyectil frontal con cadencia limitada.
- [ ] Los proyectiles destruyen vehículos destructibles (sumando puntos) y no tienen efecto en los blindados indestructibles.
- [ ] Pisar cualquier vehículo sin haberlo destruido antes resta una vida y hace reaparecer al jugador en el inicio de la ronda, conservando el avance de fila ya logrado en esa ronda.
- [ ] Completar una ronda (llegar a la fila superior) suma el bono correspondiente y avanza a una ronda más densa/veloz, reflejado en el HUD de nivel.
- [ ] El canvas dibuja su propio HUD (SCORE, RONDA, VIDAS) y en paralelo el HUD externo de React muestra score/vidas/nivel sincronizados vía `onSnapshot`.
- [ ] Perder la tercera vida muestra el overlay "GAME OVER" del canvas y abre el modal de fin de partida de React con la puntuación final real.
- [ ] "PAUSA" detiene realmente el juego (vehículos y proyectiles se congelan) y "REANUDAR" continúa exactamente donde quedó.
- [ ] "FIN" termina la partida de inmediato con la puntuación acumulada.
- [ ] Guardar la puntuación invoca `saveScore({ game: "convoy", score, name })`; el score aparece en `/games/convoy` y `/hall-of-fame`.
- [ ] "JUGAR DE NUEVO" reinicia el motor completo (ronda 1, vidas/score en su estado inicial).
- [ ] Redimensionar la ventana ajusta el tamaño de celda sin romper el layout ni la playabilidad.
- [ ] Asteroids, Tetris, Arkanoid y Snake no cambian de comportamiento tras agregar Convoy al registro.
- [ ] `npx tsc --noEmit` no reporta errores.

## Decisiones tomadas y descartadas

- **Avance activo con disparo frontal, en vez de defensa estacionaria** (tomada): esta es la diferencia central frente a la **variante B** (defensa estacionaria), que invierte la mecánica: aquí el jugador se mueve por el tablero y el "convoy" es el obstáculo a cruzar/despejar; en la variante B el jugador permanece fijo defendiendo una base de vehículos que avanzan hacia él. Se prefiere esta variante A cuando se busca mantener la fidelidad de "cruce de carriles con avance" del tema de la jam, con el disparo como herramienta adicional en vez de mecánica central.
- **Renderizado 100% vectorial, sin spritesheet** (tomada): mismo criterio ya establecido en SPEC 08 para Arkanoid — no hay assets de imagen de convoy/camiones en el proyecto, y portar uno nuevo rompería la sincronía "motor puro, sin I/O externo".
- **Vehículos indestructibles además de destructibles** (tomada): agrega variedad táctica (elegir cuándo disparar vs. cuándo esquivar) sin introducir sistemas nuevos de armas o power-ups, manteniendo el esfuerzo bajo-medio pedido para el tema.
- **Uso del estado `"dead"` transitorio al perder una vida** (tomada, igual criterio que `hopper` variante A): el ciclo de "muerte con respawn mientras queden vidas" es exactamente el caso de uso para el que se diseñó `"dead"` en el contrato compartido; se reutiliza en vez de mapear todo a `"gameover"` directo.
- **SHOOTER en vez de ARCADE** (tomada): el disparo frontal es mecánica central (no un extra cosmético), y la categoría SHOOTER hoy solo tiene a Asteroids — Convoy la diversifica, consistente con la nota de la memoria del `game-planner` sobre priorizar diversificar categorías infrarrepresentadas.

## Riesgos identificados

- **Distinguir visualmente destructibles de indestructibles sin sprites** depende enteramente del color/forma vectorial elegidos; se mitiga con una paleta de color consistente (ej. destructibles en un tono, blindados en gris/plateado) documentada como convención fija del motor.
- **Colisión "disparo justo a tiempo" antes de pisar el vehículo** puede sentirse ambigua en el frame exacto del impacto si el proyectil y el jugador se mueven en el mismo tick; se mitiga resolviendo primero todos los impactos de proyectiles del frame y luego la colisión de movimiento del jugador, en ese orden fijo dentro de `update(dt)`.
- **Cadencia de disparo limitada podría sentirse insuficiente en rondas de alta densidad** (rondas avanzadas); se acepta como parte de la curva de dificultad ascendente, igual criterio que la aceleración de caída en Tetris o la velocidad creciente de pelota en Arkanoid.
- **Redimensionar el canvas en pleno juego** recalcula el tamaño de celda y puede desplazar visualmente el tablero por un frame; mismo criterio aceptado en SPEC 04/07/08/10.
