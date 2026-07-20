# 07 — Juego real de Tetris

- **Estado:** Implementado
- **Dependencias:** SPEC 04 (Asteroids real — define el contrato de motor `<Id>Engine`/`EngineSnapshot` y el patrón canvas), SPEC 06 (catálogo vía Supabase — `games` ya es data-driven)
- **Fecha:** 2026-07-20

## Objetivo

Agregar "TETRIS" (id `tetris`) como juego real y jugable al catálogo de Arcade Vault, portando la lógica de `references/started-games/03-tetris/game.js` a un motor TypeScript en canvas registrado en `components/games/registry.ts`, con leaderboard funcionando automáticamente vía la tabla `scores` ya genérica.

## Alcance

**Incluido:**

- Fila nueva en `public.games` (no existe hoy `tetris`): `id: "tetris"`, `title: "TETRIS"`, `cat: "PUZZLE"`, `cover: "cover-tetro"` (clase ya existente en `app/globals.css`), `color: "cyan"`, `best: 28500`, `plays: "12.4K"`, `short`/`long` descriptivos.
- Motor puro `components/games/tetris/engine.ts` (`TetrisEngine`), portando de `game.js`: tablero `10×20`, las 7 piezas estándar (I/O/T/S/Z/J/L, se omite la pieza "N/tuerca" del original por no ser Tetris estándar), rotación con wall kicks `[0,±1,±2]`, soft drop, hard drop, pieza fantasma, vista previa de la siguiente pieza, limpieza de líneas, puntuación `LINE_SCORES = [0,100,300,500,800] × nivel`, y nivel/velocidad `dropInterval = max(100, 1000 − (nivel−1)×90)` cada 10 líneas.
- Dimensiones de canvas dinámicas: el tamaño de celda (`BLOCK`) se calcula en cada `resize`/`init` a partir del ancho/alto reales del canvas (no fijo en 30px/300×600), manteniendo el tablero centrado y la proporción `10:20`.
- El motor dibuja su propio HUD (SCORE, LINES, LEVEL, vista previa de la siguiente pieza) y su propio overlay de "GAME OVER" dentro de `draw()`, igual que el original, y expone `getSnapshot()` (`EngineSnapshot`) para el HUD externo de React.
- Componente `components/games/tetris/tetris-canvas.tsx`, estructuralmente idéntico a `asteroids-canvas.tsx`: monta el canvas, mide con `ResizeObserver`, captura teclado (`ArrowLeft`, `ArrowRight`, `ArrowDown`, `ArrowUp`, `KeyX`, `Space`), corre el loop respetando `paused`, reenvía `onSnapshot` cada frame y expone `forceGameOver` vía `forceEndRef`.
- **Primer alta de** `components/games/registry.ts`: mapa `id → componente canvas` (`{ asteroids: AsteroidsCanvas, tetris: TetrisCanvas }`) y refactor único de `components/game-player.tsx` para reemplazar `isAsteroids = game.id === "asteroids"` por `Canvas = GAME_CANVASES[game.id]` / `isReal = Boolean(Canvas)`, sin cambiar el comportamiento visible de Asteroids ni de los juegos falsos.
- Migración SQL `supabase/migrations/<timestamp>_tetris.sql` con el insert de la fila `tetris`, aplicada vía `mcp__supabase__apply_migration`.

**Explícitamente fuera de alcance:**

- Controles táctiles/on-screen — solo teclado, como el original.
- Pausa por tecla `P` dentro del motor: la pausa la controla exclusivamente el botón "PAUSA" de React (prop `paused`), igual que en Asteroids. No se porta el listener de `KeyP`.
- La pieza "N" (tuerca) del original, decorativa y no estándar — se implementan solo las 7 piezas clásicas (I, O, T, S, Z, J, L).
- Modo "hold piece" o "T-spin" u otras mecánicas modernas de Tetris no presentes en `game.js`.
- Sonido/efectos de audio.
- Tests automatizados.
- Cambios a `lib/games.ts`, `lib/storage.ts`, `lib/supabase/*` o páginas `app/*` más allá de que sigan funcionando data-driven con la nueva fila.

## Modelo de datos

No se introduce persistencia nueva (`saveScore`/`getScoresForGame` de `lib/storage.ts` no cambian; indexan por `game.id` y `tetris` ya funciona en cuanto exista la fila).

### `public.games` (insert nuevo, sin cambio de esquema)

```sql
insert into public.games (id, title, short, long, cat, cover, color, best, plays) values (
  'tetris',
  'TETRIS',
  'Encaja piezas y despeja líneas antes de que se acumulen.',
  'El clásico rompecabezas de piezas que caen. Rota, desliza y deja caer las siete piezas estándar para completar líneas horizontales antes de que el tablero se desborde.',
  'PUZZLE',
  'cover-tetro',
  'cyan',
  28500,
  '12.4K'
);
```

### `components/games/tetris/engine.ts`

```ts
export type EngineState = "playing" | "dead" | "gameover";

export interface EngineSnapshot {
  score: number;
  lives: number;
  level: number;
  state: EngineState;
}

export class TetrisEngine {
  constructor(width: number, height: number);
  resize(width: number, height: number): void;
  update(dt: number): void;
  draw(ctx: CanvasRenderingContext2D): void; // tablero + ghost + pieza actual + HUD + overlay propios
  setKey(code: string, down: boolean): void;
  forceGameOver(): void;
  getSnapshot(): EngineSnapshot;
}
```

Tetris no tiene el concepto de "vidas" de Asteroids: `lives` se mapea a un valor fijo (`1` mientras `state === "playing"`, `0` al llegar a `"gameover"`), solo para que el HUD externo de React (que muestra corazones/vidas de forma genérica) tenga un valor coherente. `level` es el nivel de velocidad real del juego (`floor(lines/10)+1`), igual que en el original. El estado `"dead"` del enum queda sin uso en este motor (Tetris no tiene respawn transitorio); solo se usan `"playing"` y `"gameover"`.

El tamaño de celda (`blockSize`) es una propiedad de instancia recalculada en `resize()` como `Math.floor(Math.min(width / COLS, (height - HUD_MARGIN) / ROWS))`, y el tablero se dibuja centrado horizontalmente dentro del canvas.

### `components/games/tetris/tetris-canvas.tsx`

Mismo contrato `GameCanvasProps` de `components/games/registry.ts` (`{ paused, onSnapshot, forceEndRef }`), sin props nuevas.

### `components/games/registry.ts` (nuevo)

```ts
export interface GameCanvasProps {
  paused: boolean;
  onSnapshot: (s: EngineSnapshot) => void;
  forceEndRef?: RefObject<(() => void) | null>;
}

export const GAME_CANVASES: Record<string, ComponentType<GameCanvasProps>> = {
  asteroids: AsteroidsCanvas,
  tetris: TetrisCanvas,
};
```

## Plan de implementación

1. **Motor puro — tablero, piezas y colisión**: crear `components/games/tetris/engine.ts` portando `createBoard`, `randomPiece`, `collide`, `rotateCW`, `tryRotate` (wall kicks), `merge`, `clearLines`, `ghostY` desde `game.js`, adaptadas a TypeScript con tipos explícitos y sin el tipo de pieza "N". Sin uso todavía, no hay cambio visible.
2. **Motor puro — `TetrisEngine` completo**: ensamblar la clase con estado interno (`board`, `current`, `next`, `score`, `lines`, `level`, `dropInterval`, `dropAccum`, `state`), `update(dt)` (auto-drop por tiempo, usando `dt` en segundos en vez de `ts` en ms como el original), `setKey` (mapeo de `ArrowLeft/Right/Down/Up`, `KeyX`, `Space` a movimiento/rotación/soft/hard drop, sin `KeyP`), `draw(ctx)` con tablero + ghost + pieza actual + HUD propio (SCORE/LINES/LEVEL + vista previa de siguiente pieza) + overlay de game over, `resize`, `forceGameOver`, `getSnapshot`. Motor completo y jugable en aislamiento.
3. **`components/games/tetris/tetris-canvas.tsx`**: copiar la estructura de `asteroids-canvas.tsx` cambiando el motor importado y el `Set` de teclas capturadas (`ArrowLeft`, `ArrowRight`, `ArrowDown`, `ArrowUp`, `KeyX`, `Space`).
4. **Crear `components/games/registry.ts`** con `GAME_CANVASES = { asteroids: AsteroidsCanvas, tetris: TetrisCanvas }` y refactorizar `components/game-player.tsx`: reemplazar `isAsteroids` por `Canvas = GAME_CANVASES[game.id]` / `isReal = Boolean(Canvas)` en los `useEffect` de simulación falsa, `endGame`, `restart` y el render (`{isReal ? <Canvas .../> : <div className="game-arena">...}`). Verificar que Asteroids sigue jugándose igual.
5. **Migración Supabase**: crear `supabase/migrations/<timestamp>_tetris.sql` con el insert de la Fase de modelo de datos y aplicarla vía `mcp__supabase__apply_migration`.
6. **Verificación end-to-end**: `npm run dev`, navegar `/`, `/games`, `/games/tetris`, `/games/tetris/play`, `/hall-of-fame`; `npx tsc --noEmit` sin errores; jugar una partida completa (mover, rotar, soft/hard drop, limpiar líneas, game over al desbordar el tablero), guardar puntuación y confirmar que aparece en el leaderboard.

## Criterios de aceptación

- [ ] `/games` y `/` muestran la tarjeta "TETRIS" (cover `cover-tetro`, categoría PUZZLE) sin tocar el resto del catálogo.
- [ ] `/games/tetris` muestra el detalle del juego con su descripción y leaderboard (vacío o con scores existentes).
- [ ] `/games/tetris/play` renderiza el juego real de Tetris dentro del `.crt-screen` en vez del `.game-arena` decorativo.
- [ ] Flechas ←/→ mueven la pieza, ↓ hace soft drop, ↑ o `X` rotan con wall kicks, Espacio hace hard drop instantáneo.
- [ ] Se ve la pieza fantasma (ghost) proyectando dónde caerá la pieza actual, y una vista previa de la siguiente pieza, dibujadas por el propio canvas.
- [ ] Completar una línea horizontal la elimina y baja el resto del tablero; el puntaje sube según `[0,100,300,500,800] × nivel` y el nivel sube cada 10 líneas, acelerando la caída.
- [ ] El canvas dibuja su propio HUD (SCORE, LINES, LEVEL) y en paralelo el HUD externo de React muestra score/nivel sincronizados vía `onSnapshot`.
- [ ] Cuando una pieza nueva no puede spawnear (tablero desbordado), el canvas muestra su overlay "GAME OVER" y se abre el modal de fin de partida de React con la puntuación final real.
- [ ] "PAUSA" detiene realmente el juego (piezas dejan de caer) y "REANUDAR" continúa exactamente donde quedó.
- [ ] "FIN" termina la partida de inmediato con la puntuación acumulada, mostrando ambos overlays de fin de partida.
- [ ] Guardar la puntuación invoca `saveScore({ game: "tetris", score, name })`; el score aparece en `/games/tetris` y `/hall-of-fame`.
- [ ] "JUGAR DE NUEVO" reinicia el motor completo (tablero vacío, score/líneas/nivel en su estado inicial).
- [ ] Redimensionar la ventana ajusta el tamaño de celda del tablero sin romper el layout ni la playabilidad.
- [ ] Asteroids y el resto de juegos falsos del catálogo no cambian de comportamiento tras el refactor de `game-player.tsx` a `components/games/registry.ts`.
- [ ] `npx tsc --noEmit` no reporta errores.

## Decisiones tomadas y descartadas

- **Crear el registro `components/games/registry.ts` en este spec, no en uno aparte** (tomada): es el segundo juego real portado; el propio SKILL `/game-impl` documenta que la primera vez que se agrega un segundo motor es cuando se introduce el registro, reemplazando el `if (game.id === "asteroids")` hardcodeado. Se hace como parte del plan de implementación de Tetris, no como spec independiente, porque es un refactor mecánico acoplado a la integración de este juego.
- **Omitir la pieza "N" (tuerca) no estándar del original** (tomada): el README del propio `03-tetris` la documenta como una pieza extra de 8vo tipo, gris, no parte del set clásico de Tetris; incluirla no aporta al objetivo de tener un Tetris reconocible y añade una pieza rara al `randomPiece()`.
- **Pausa solo por prop `paused` de React, sin tecla `P` interna** (tomada): igual que Asteroids, evita dos fuentes de verdad para el estado de pausa; el HUD externo de React ya controla el flujo de Pausa/Fin/Reinicio para todos los juegos reales.
- **`lives` fijo (1 → 0 en game over) en vez de omitir el campo** (tomada): el contrato `EngineSnapshot` es compartido entre todos los motores; se mantiene el campo completo con un valor coherente en vez de forzar un cambio de tipo que rompería la compatibilidad con `AsteroidsEngine`.
- **Tamaño de celda dinámico en vez de canvas fijo 300×600 escalado por CSS** (tomada): consistente con la decisión ya tomada en SPEC 04 para Asteroids; mantiene nitidez de renderizado en cualquier tamaño de `.crt-screen`.
- **Sin controles táctiles ni mecánicas modernas (hold, T-spin)** (tomada): fuera de alcance explícito; el original no las tenía y no fueron pedidas para este spec.

## Riesgos identificados

- **Wall kicks simplificados (`[0,±1,±2]`) pueden fallar en configuraciones específicas de pared** (heredado del original): es el mismo comportamiento que `references/started-games/03-tetris/game.js`; no se mejora el algoritmo de rotación en este spec.
- **Redimensionar el canvas en pleno juego recalcula `blockSize` y puede desplazar visualmente el tablero por un frame** hasta el siguiente `draw()`; efecto menor y transitorio, sin lógica especial de reposicionamiento (mismo criterio que SPEC 04 para Asteroids).
- **Dos HUD (canvas + React) pueden desincronizarse visualmente por un frame** por la naturaleza asíncrona de `setState` en React vs. el loop síncrono del canvas; se acepta el mismo criterio que SPEC 04 (no se requiere sincronización estricta a nivel de frame).
