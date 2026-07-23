# HOPPER — Variante A: Clásica de rondas fijas

- **Estado:** Borrador
- **Dependencias:** SPEC 04 (Asteroids real — contrato de motor `<Id>Engine`/`EngineSnapshot` y patrón canvas), SPEC 06 (catálogo vía Supabase — `games` ya es data-driven), SPEC 07 (Tetris real — registro `components/games/registry.ts` ya existente)
- **Fecha:** 2026-07-21

## Objetivo

Agregar "HOPPER" (id `hopper`) como juego real y jugable al catálogo de Arcade Vault: un cruce de carriles al estilo Frogger clásico — tablero fijo de carretera + río, movimiento discreto en cuadrícula, 3 vidas, rondas que se completan llenando los 5 "nenúfares" de la fila superior antes de avanzar a una ronda más veloz. No existe una carpeta `references/started-games/` para este juego (igual que Snake en SPEC 10): el motor se diseña desde cero, tomando como referencia conceptual el juego decorativo `ranaria` ya presente en el catálogo simulado (`references/templates/data.jsx`, cover `cover-rana`, categoría ARCADE, color green).

## Alcance

**Incluido:**

- Fila nueva en `public.games` (no existe hoy `hopper`): `id: "hopper"`, `title: "HOPPER"`, `cat: "ARCADE"`, `cover: "cover-rana"` (clase ya existente en `app/globals.css`, hoy sin usar por ningún juego real — solo por el decorativo `ranaria`), `color: "green"`, `best: 18900`, `plays: "6.4K"`, `short`/`long` descriptivos.
- Motor puro `components/games/hopper/engine.ts` (`HopperEngine`) con:
  - Tablero de cuadrícula fijo `9 columnas × 13 filas`: fila 0 = inicio (abajo), filas 1–5 = carretera (carriles con coches que se mueven horizontalmente, cada carril con su propia velocidad/dirección/densidad), fila 6 = mediana segura, filas 7–11 = río (carriles con troncos/tortugas que flotan horizontalmente; el jugador debe ir montado en uno para no ahogarse), fila 12 = meta con 5 "nenúfares" (slots de destino).
  - Movimiento del jugador **discreto por celda**: cada pulsación de flecha/WASD mueve al jugador exactamente una celda, con un cooldown de entrada (~130ms) para evitar saltos dobles por auto-repeat del teclado.
  - Colisión: pisar un coche = muerte; estar en un carril de río sin tronco debajo = muerte (caída al agua); salir del tablero por los lados = muerte.
  - Puntuación: `+10` por cada fila nueva alcanzada (solo la primera vez que se supera el máximo de esa vida), `+50` por cada nenúfar ocupado, `+200` más un bono de tiempo (`segundos restantes × 10`) al completar una ronda (los 5 nenúfares ocupados), lo que hace avanzar de ronda.
  - Cada ronda incrementa velocidad y densidad de obstáculos en ~12% respecto a la anterior, con un tope de escalado a partir de la ronda 8 (evita velocidades injugables).
  - 3 vidas y un temporizador de 25s por vida (visible en el HUD); agotar el tiempo cuenta como muerte. Al morir con vidas restantes, el jugador reaparece en la fila de inicio conservando los nenúfares ya ocupados en la ronda actual.
  - El motor dibuja su propio HUD (SCORE, RONDA, VIDAS, tiempo restante) y su propio overlay de "GAME OVER" dentro de `draw()`, y expone `getSnapshot()` (`EngineSnapshot`).
- Componente `components/games/hopper/hopper-canvas.tsx`, estructuralmente idéntico a `asteroids-canvas.tsx`: monta el canvas, mide con `ResizeObserver`, captura teclado (`ArrowLeft`, `ArrowRight`, `ArrowUp`, `ArrowDown`, `KeyW`, `KeyA`, `KeyS`, `KeyD`), corre el loop respetando `paused`, reenvía `onSnapshot` y expone `forceGameOver` vía `forceEndRef`.
- Alta de una línea en `components/games/registry.ts` (`hopper: HopperCanvas`). El registro ya existe (creado en SPEC 07); no se toca `game-player.tsx`.
- Migración SQL `supabase/migrations/<timestamp>_hopper.sql` con el insert de la fila `hopper`, aplicada vía `mcp__supabase__apply_migration`.

**Explícitamente fuera de alcance:**

- Controles táctiles/on-screen — solo teclado.
- Power-ups, obstáculos especiales (serpientes, cocodrilos disfrazados de tronco) u otros modos — Frogger clásico de un jugador.
- Sonido/efectos de audio.
- Tests automatizados.
- Cambios a `lib/games.ts`, `lib/storage.ts`, `lib/supabase/*` o páginas `app/*` más allá de que sigan funcionando data-driven con la nueva fila.
- Reemplazar o eliminar el juego decorativo `ranaria` del catálogo simulado de referencia (`references/templates/`) — es solo material de referencia visual, no forma parte del proyecto Next.js real.

## Modelo de datos

No se introduce persistencia nueva (`saveScore`/`getScoresForGame` de `lib/storage.ts` no cambian; indexan por `game.id` y `hopper` ya funciona en cuanto exista la fila).

### `public.games` (insert nuevo, sin cambio de esquema)

```sql
insert into public.games (id, title, short, long, cat, cover, color, best, plays) values (
  'hopper',
  'HOPPER',
  'Cruza la autopista de pixeles.',
  'Salta entre carriles de coches a toda velocidad y troncos a la deriva en el río. Llena los cinco nenúfares antes de que se acabe el tiempo y sube de ronda para enfrentar carriles cada vez más veloces.',
  'ARCADE',
  'cover-rana',
  'green',
  18900,
  '6.4K'
);
```

### `components/games/hopper/engine.ts`

```ts
export type EngineState = "playing" | "dead" | "gameover";

export interface EngineSnapshot {
  score: number;
  lives: number;
  level: number;
  state: EngineState;
}

export class HopperEngine {
  constructor(width: number, height: number);
  resize(width: number, height: number): void;
  update(dt: number): void;
  draw(ctx: CanvasRenderingContext2D): void; // tablero + carriles + jugador + HUD + overlay propios
  setKey(code: string, down: boolean): void;
  forceGameOver(): void;
  getSnapshot(): EngineSnapshot;
}
```

`lives` es el número real de vidas (`3 → 0`), igual de literal que en Asteroids. `level` es el número de ronda actual (`1..8+`, con el tope de escalado de dificultad a partir de 8). A diferencia de `TetrisEngine`/`SnakeEngine`, este motor **sí usa el estado `"dead"`** del enum compartido: al morir con vidas restantes, el motor entra brevemente en `state: "dead"` durante ~500ms (animación de "splash"/atropello, sin aceptar input) antes de volver a `"playing"` con el jugador reposicionado en la fila de inicio; solo al perder la última vida pasa a `"gameover"`.

El tamaño de celda (`cellSize`) se recalcula en `resize()` como `Math.floor(Math.min(width / COLS, (height - HUD_MARGIN) / ROWS))` con `COLS = 9`, `ROWS = 13`, siguiendo el mismo patrón que `blockSize` en `TetrisEngine` y `cellSize` en `SnakeEngine`.

### `components/games/hopper/hopper-canvas.tsx`

Mismo contrato `GameCanvasProps` de `components/games/registry.ts` (`{ paused, onSnapshot, forceEndRef }`), sin props nuevas.

### `components/games/registry.ts` (alta de una línea)

```ts
import { HopperCanvas } from "@/components/games/hopper/hopper-canvas";

export const GAME_CANVASES: Record<string, ComponentType<GameCanvasProps>> = {
  asteroids: AsteroidsCanvas,
  tetris: TetrisCanvas,
  arkanoid: ArkanoidCanvas,
  snake: SnakeCanvas,
  hopper: HopperCanvas, // ← línea nueva
};
```

No se modifica `components/game-player.tsx`.

## Plan de implementación

1. **Motor puro — tablero y carriles**: crear `components/games/hopper/engine.ts` con la generación del tablero fijo `9×13`, los datos de carriles (tipo, velocidad, dirección, densidad por fila) y su avance continuo (`update(dt)`), sin jugador todavía. Sin uso visible aún.
2. **Motor puro — jugador y colisión**: agregar el jugador como posición de celda (`{col, row}`), movimiento discreto por tecla con cooldown, detección de colisión con coches/agua/bordes, transición a `"dead"` transitorio y respawn.
3. **Motor puro — nenúfares, puntuación y rondas**: agregar los 5 slots de meta, la puntuación (`+10`/`+50`/`+200`+bono de tiempo), el avance de ronda al llenar los 5 slots (reset de posición + reescalado de velocidad/densidad de carriles), el temporizador por vida, `draw()` con HUD propio (SCORE, RONDA, VIDAS, tiempo) y overlay de game over, `resize`, `setKey`, `forceGameOver`, `getSnapshot`. Motor completo y jugable en aislamiento.
4. **`components/games/hopper/hopper-canvas.tsx`**: copiar la estructura de `snake-canvas.tsx` (más cercano por ser también un juego de cuadrícula), cambiando el motor importado y el `Set` de teclas capturadas.
5. **Alta en `components/games/registry.ts`**: agregar el import de `HopperCanvas` y la entrada `hopper: HopperCanvas`. No se toca `game-player.tsx`.
6. **Migración Supabase**: crear `supabase/migrations/<timestamp>_hopper.sql` con el insert de la sección de modelo de datos y aplicarla vía `mcp__supabase__apply_migration`.
7. **Verificación end-to-end**: `npm run dev`, navegar `/`, `/games`, `/games/hopper`, `/games/hopper/play`, `/hall-of-fame`; `npx tsc --noEmit` sin errores; jugar una partida completa (cruzar carretera y río, llenar los 5 nenúfares, subir de ronda, morir por coche/agua/tiempo, agotar las 3 vidas), guardar puntuación y confirmar que aparece en el leaderboard.

## Criterios de aceptación

- [ ] `/games` y `/` muestran la tarjeta "HOPPER" (cover `cover-rana`, categoría ARCADE) sin tocar el resto del catálogo.
- [ ] `/games/hopper` muestra el detalle del juego con su descripción y leaderboard (vacío o con scores existentes).
- [ ] `/games/hopper/play` renderiza el juego real dentro del `.crt-screen` en vez del `.game-arena` decorativo.
- [ ] Flechas y WASD mueven al jugador exactamente una celda por pulsación, sin saltos dobles por auto-repeat.
- [ ] Los coches se mueven por sus carriles y pisarlos mata al jugador; los troncos flotan por el río y el jugador debe montarse en ellos para no ahogarse.
- [ ] Llenar los 5 nenúfares suma el bono de ronda y avanza a una ronda más veloz; el nivel mostrado en el HUD sube en consecuencia.
- [ ] Morir con vidas restantes muestra brevemente el estado `"dead"` (splash/atropello) y reaparece al jugador en la fila de inicio conservando los nenúfares ya ocupados en la ronda.
- [ ] Agotar el temporizador de una vida cuenta como muerte igual que una colisión.
- [ ] Perder la tercera vida muestra el overlay "GAME OVER" del canvas y abre el modal de fin de partida de React con la puntuación final real.
- [ ] "PAUSA" detiene realmente el juego (coches, troncos y temporizador se congelan) y "REANUDAR" continúa exactamente donde quedó.
- [ ] "FIN" termina la partida de inmediato con la puntuación acumulada.
- [ ] Guardar la puntuación invoca `saveScore({ game: "hopper", score, name })`; el score aparece en `/games/hopper` y `/hall-of-fame`.
- [ ] "JUGAR DE NUEVO" reinicia el motor completo (ronda 1, vidas/score en su estado inicial).
- [ ] Redimensionar la ventana ajusta el tamaño de celda sin romper el layout ni la playabilidad.
- [ ] Asteroids, Tetris, Arkanoid y Snake no cambian de comportamiento tras agregar Hopper al registro.
- [ ] `npx tsc --noEmit` no reporta errores.

## Decisiones tomadas y descartadas

- **Tablero fijo de rondas (`9×13`, 5 nenúfares) en vez de generación procedural infinita** (tomada): reproduce fielmente el bucle de juego del Frogger clásico y del propio decorativo `ranaria` ("Llega a los nenúfares antes de que se acabe el tiempo"), con una escalada de dificultad clara por rondas — esto es lo que **distingue a esta variante A de la variante B** (infinito procedural), que en cambio descarta rondas/nenúfares por un ascenso continuo sin techo. Se prefiere esta variante cuando se quiere un Frogger "reconocible" con victorias parciales claras (llenar los 5 slots) en vez de una experiencia de puntuación pura tipo endless runner.
- **Uso explícito del estado `"dead"` del enum compartido** (tomada): a diferencia de Tetris/Snake (que lo dejan sin uso porque un choque termina la partida directamente), Hopper tiene un ciclo natural de "muerte con respawn mientras queden vidas", que es exactamente el caso de uso para el que se diseñó `"dead"` en el contrato original de Asteroids. Se reutiliza en vez de inventar un campo nuevo.
- **Movimiento discreto por celda con cooldown, no movimiento continuo tipo Asteroids** (tomada): Frogger es un juego de cuadrícula; el movimiento continuo rompería la lectura del tablero y la colisión "por celda" que define el género.
- **Reutilizar `cover-rana` ya existente** (tomada): la clase ya existe en `app/globals.css`, thematically calza (verde con nenúfar y carriles), y ya fue usada por el decorativo `ranaria` — mismo criterio que Tetris/Snake reutilizando `cover-tetro`/`cover-snake` para su versión real.
- **Sin power-ups ni obstáculos especiales** (tomada): fuera de alcance explícito; prioriza un Frogger clásico reconocible sobre variantes modernas no pedidas, consistente con el esfuerzo bajo-medio solicitado para el tema.

## Riesgos identificados

- **Colisión "montado en tronco" mal calibrada** puede sentirse injusta si el margen de tolerancia entre el sprite del jugador y el borde del tronco es demasiado estricto; se mitiga con una tolerancia de medio-celda en la detección, ajustable en implementación.
- **Escalado de dificultad por ronda sin techo real** podría volverse injugable pasado cierto punto; se mitiga con el tope de escalado a partir de la ronda 8 mencionado en el alcance.
- **Temporizador por vida combinado con respawn conservando nenúfares** puede generar confusión sobre qué progreso se pierde al morir (se pierde el temporizador, no los nenúfares); se mitiga mostrando claramente en el HUD "RONDA" y "NENÚFARES X/5" por separado del tiempo.
- **Redimensionar el canvas en pleno juego recalcula `cellSize` y puede desplazar visualmente el tablero por un frame**, mismo criterio aceptado en SPEC 04/07/10.
