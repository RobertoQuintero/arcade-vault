# 10 — Juego real de Snake

- **Estado:** Implementado
- **Dependencias:** SPEC 04 (Asteroids real — define el contrato de motor `<Id>Engine`/`EngineSnapshot` y el patrón canvas), SPEC 06 (catálogo vía Supabase — `games` ya es data-driven), SPEC 07 (Tetris real — primera alta de `components/games/registry.ts`, ya existente)
- **Fecha:** 2026-07-20

## Objetivo

Agregar "SNAKE" (id `snake`) como juego real y jugable al catálogo de Arcade Vault: un motor de Snake clásico en cuadrícula, creado desde cero (no hay `game.js` de referencia) y dibujado con los sprites de frutas de `references/source-assets/snake-assets/`, registrado en `components/games/registry.ts`, con leaderboard funcionando automáticamente vía la tabla `scores` ya genérica.

## Alcance

**Incluido:**

- Fila nueva en `public.games` (no existe hoy `snake`): `id: "snake"`, `title: "SNAKE"`, `cat: "ARCADE"`, `cover: "cover-snake"` (clase CSS ya existente en `app/globals.css`, sin usar por ningún juego actual), `color: "green"`, `best: 4200`, `plays: "9.8K"`, `short`/`long` descriptivos.
- Copiar `references/source-assets/snake-assets/fruits.png` a `public/games/snake/fruits.png` (única imagen que necesita servirse en runtime; `sprites.js` no se usa tal cual — sus coordenadas se portan como una constante TypeScript `FRUIT_ATLAS` dentro del motor).
- Motor puro `components/games/snake/engine.ts` (`SnakeEngine`), diseñado desde cero como Snake clásico en cuadrícula:
  - Tablero de cuadrícula (`COLS × ROWS`, celdas cuadradas calculadas dinámicamente a partir del tamaño real del canvas, sin constantes fijas de píxeles).
  - Serpiente representada como lista de segmentos `{x, y}` en coordenadas de celda; se mueve un paso por tick de juego (no por frame) en la dirección actual.
  - Cambio de dirección con flechas o WASD; no se permite invertir 180° sobre sí misma en el mismo tick (ej. no puedes ir de derecha a izquierda directamente).
  - Comida: una fruta aparece en una celda libre aleatoria, dibujada con un sprite aleatorio del atlas `fruits.png` (21 frutas) en cada aparición.
  - Comer la fruta: la serpiente crece un segmento, suma puntos (`10 × nivel`), y aparece una nueva fruta con sprite aleatorio.
  - Nivel: sube cada 5 frutas comidas, lo que reduce el intervalo entre ticks (velocidad de la serpiente aumenta), similar en espíritu al escalado de velocidad de `TetrisEngine`.
  - Game over: la cabeza choca contra un borde del tablero o contra su propio cuerpo.
  - El motor dibuja su propio HUD (SCORE, LARGO/longitud de la serpiente, NIVEL) y su propio overlay de "GAME OVER" dentro de `draw()`, y expone `getSnapshot()` (`EngineSnapshot`) para el HUD externo de React.
- Componente `components/games/snake/snake-canvas.tsx`, estructuralmente idéntico a `asteroids-canvas.tsx`: monta el canvas, mide con `ResizeObserver`, precarga la imagen `fruits.png`, captura teclado (`ArrowLeft`, `ArrowRight`, `ArrowUp`, `ArrowDown`, `KeyW`, `KeyA`, `KeyS`, `KeyD`), corre el loop respetando `paused`, reenvía `onSnapshot` cada frame y expone `forceGameOver` vía `forceEndRef`.
- Alta en `components/games/registry.ts`: se agrega `snake: SnakeCanvas` al mapa `GAME_CANVASES` (el registro ya existe desde SPEC 07; no se toca `components/game-player.tsx`).
- Migración SQL `supabase/migrations/<timestamp>_snake.sql` con el insert de la fila `snake`, aplicada vía `mcp__supabase__apply_migration`.

**Explícitamente fuera de alcance:**

- Controles táctiles/on-screen — solo teclado.
- Obstáculos, comida especial/venenosa, modos de juego alternativos o multijugador — Snake clásico de un jugador.
- Uso de `sprites.js` como archivo cargado en runtime; sus coordenadas se transcriben como constante TypeScript dentro del motor.
- Sonido/efectos de audio (a diferencia de SPEC 09 para Arkanoid, no se pide aquí).
- Tests automatizados.
- Cambios a `lib/games.ts`, `lib/storage.ts`, `lib/supabase/*`, `components/game-player.tsx` o páginas `app/*` más allá de que sigan funcionando data-driven con la nueva fila.

## Modelo de datos

No se introduce persistencia nueva (`saveScore`/`getScoresForGame` de `lib/storage.ts` no cambian; indexan por `game.id` y `snake` ya funciona en cuanto exista la fila).

### `public.games` (insert nuevo, sin cambio de esquema)

```sql
insert into public.games (id, title, short, long, cat, cover, color, best, plays) values (
  'snake',
  'SNAKE',
  'Come, crece y no te muerdas la cola.',
  'El clásico de la serpiente en cuadrícula. Guíala con las flechas o WASD para comer frutas, crecer segmento a segmento y esquivar los bordes y tu propia cola mientras la velocidad aumenta con cada nivel.',
  'ARCADE',
  'cover-snake',
  'green',
  4200,
  '9.8K'
);
```

### `components/games/snake/engine.ts`

```ts
export type EngineState = "playing" | "dead" | "gameover";

export interface EngineSnapshot {
  score: number;
  lives: number;
  level: number;
  state: EngineState;
}

export class SnakeEngine {
  constructor(width: number, height: number);
  resize(width: number, height: number): void;
  update(dt: number): void; // acumula dt y avanza la serpiente un paso por tick
  draw(ctx: CanvasRenderingContext2D): void; // tablero + serpiente + fruta + HUD + overlay propios
  setKey(code: string, down: boolean): void;
  forceGameOver(): void;
  getSnapshot(): EngineSnapshot;
}
```

Snake no tiene el concepto de "vidas" de Asteroids: `lives` se mapea a un valor fijo (`1` mientras `state === "playing"`, `0` al llegar a `"gameover"`), igual que la decisión ya tomada en `TetrisEngine` (SPEC 07), solo para que el HUD externo de React tenga un valor coherente. `level` es el nivel de velocidad real (`floor(frutasComidas / 5) + 1`). El estado `"dead"` del enum queda sin uso (sin respawn transitorio: un choque termina la partida directamente, como en el Snake original).

El tamaño de celda (`cellSize`) es una propiedad de instancia recalculada en `resize()` como `Math.floor(Math.min(width / COLS, (height - HUD_MARGIN) / ROWS))`, con `COLS`/`ROWS` fijos (ej. `20 × 20`) y el tablero centrado dentro del canvas, siguiendo el mismo patrón que `blockSize` en `TetrisEngine`.

El movimiento avanza por **tick lógico**, no por frame: el motor acumula `dt` en un contador interno y da un paso de cuadrícula cuando el contador supera `tickInterval` (que decrece con el nivel), en vez de mover la serpiente en cada llamada a `update()`.

Los sprites de frutas se portan desde `references/source-assets/snake-assets/sprites.js` como una constante `FRUIT_ATLAS: Record<string, {x: number; y: number; w: number; h: number}>` dentro del motor o el componente canvas, con las mismas 21 entradas y coordenadas del atlas original. El motor no carga la imagen directamente (es puro, sin DOM); recibe el `HTMLImageElement` ya cargado como parámetro de `draw()` o lo mantiene el propio componente canvas y lo pasa en cada llamada — se decide en implementación cuál mantiene la paridad más simple con el contrato existente sin romperlo (ver Decisiones).

### `components/games/snake/snake-canvas.tsx`

Mismo contrato `GameCanvasProps` de `components/games/registry.ts` (`{ paused, onSnapshot, forceEndRef }`), sin props nuevas. Precarga `public/games/snake/fruits.png` en un `useEffect` antes de arrancar el loop (o dibuja el tablero sin fruta hasta que la imagen cargue, para no bloquear el montaje).

### `components/games/registry.ts` (modificación, una línea)

```ts
import { SnakeCanvas } from "@/components/games/snake/snake-canvas";

export const GAME_CANVASES: Record<string, ComponentType<GameCanvasProps>> = {
  asteroids: AsteroidsCanvas,
  tetris: TetrisCanvas,
  arkanoid: ArkanoidCanvas,
  snake: SnakeCanvas, // ← línea nueva
};
```

## Plan de implementación

1. **Assets**: copiar `references/source-assets/snake-assets/fruits.png` a `public/games/snake/fruits.png`; transcribir las coordenadas de `sprites.js` como constante TypeScript `FRUIT_ATLAS` (21 frutas, mismas coordenadas).
2. **Motor puro — tablero y serpiente**: crear `components/games/snake/engine.ts` con el tablero de cuadrícula, la serpiente como lista de segmentos, el tick lógico de movimiento, cambio de dirección (bloqueando reversa de 180°), colisión contra bordes y contra el propio cuerpo. Sin fruta todavía, sin HUD. No hay uso todavía, no hay cambio visible.
3. **Motor puro — fruta, crecimiento, puntuación y nivel**: agregar spawn de fruta en celda libre aleatoria con sprite aleatorio de `FRUIT_ATLAS`, crecimiento de la serpiente al comer, `score += 10 × nivel`, incremento de nivel cada 5 frutas con reducción de `tickInterval`, `draw()` con HUD propio (SCORE, LARGO, NIVEL) y overlay de "GAME OVER", `resize`, `setKey`, `forceGameOver`, `getSnapshot`. Motor completo y jugable en aislamiento (usando un `HTMLImageElement` de prueba o un rectángulo de color como fallback si la imagen aún no cargó).
4. **`components/games/snake/snake-canvas.tsx`**: copiar la estructura de `asteroids-canvas.tsx`, precargar `fruits.png`, cambiar el motor importado y el `Set` de teclas capturadas (`ArrowLeft`, `ArrowRight`, `ArrowUp`, `ArrowDown`, `KeyW`, `KeyA`, `KeyS`, `KeyD`).
5. **Alta en `components/games/registry.ts`**: agregar `snake: SnakeCanvas` al mapa `GAME_CANVASES` con su import. No se toca `components/game-player.tsx`.
6. **Migración Supabase**: crear `supabase/migrations/<timestamp>_snake.sql` con el insert de la sección de modelo de datos y aplicarla vía `mcp__supabase__apply_migration`.
7. **Verificación end-to-end**: `npm run dev`, navegar `/`, `/games`, `/games/snake`, `/games/snake/play`, `/hall-of-fame`; `npx tsc --noEmit` sin errores; jugar una partida completa (crecer comiendo varias frutas, subir de nivel, chocar contra un borde y contra el propio cuerpo), guardar puntuación y confirmar que aparece en el leaderboard.

## Criterios de aceptación

- [ ] `/games` y `/` muestran la tarjeta "SNAKE" (cover `cover-snake`, categoría ARCADE) sin tocar el resto del catálogo.
- [ ] `/games/snake` muestra el detalle del juego con su descripción y leaderboard (vacío o con scores existentes).
- [ ] `/games/snake/play` renderiza el juego real de Snake dentro del `.crt-screen` en vez del `.game-arena` decorativo.
- [ ] Flechas y WASD mueven la serpiente en las 4 direcciones; no es posible invertir 180° directamente sobre el propio cuerpo.
- [ ] Las frutas se dibujan con sprites aleatorios del atlas de `fruits.png` (no siempre la misma fruta) en una celda libre del tablero.
- [ ] Comer una fruta hace crecer la serpiente un segmento, suma puntos y hace aparecer una nueva fruta con sprite distinto.
- [ ] Cada 5 frutas comidas sube el nivel y la serpiente se mueve visiblemente más rápido.
- [ ] El canvas dibuja su propio HUD (SCORE, LARGO, NIVEL) y en paralelo el HUD externo de React muestra score/nivel sincronizados vía `onSnapshot`.
- [ ] Chocar contra un borde del tablero o contra el propio cuerpo muestra el overlay "GAME OVER" del canvas y abre el modal de fin de partida de React con la puntuación final real.
- [ ] "PAUSA" detiene realmente el juego (la serpiente deja de moverse) y "REANUDAR" continúa exactamente donde quedó.
- [ ] "FIN" termina la partida de inmediato con la puntuación acumulada, mostrando ambos overlays de fin de partida.
- [ ] Guardar la puntuación invoca `saveScore({ game: "snake", score, name })`; el score aparece en `/games/snake` y `/hall-of-fame`.
- [ ] "JUGAR DE NUEVO" reinicia el motor completo (serpiente en su posición y largo inicial, score/nivel en su estado inicial, tablero limpio).
- [ ] Redimensionar la ventana ajusta el tamaño de celda del tablero sin romper el layout ni la playabilidad.
- [ ] Asteroids, Tetris, Arkanoid y el resto de juegos falsos del catálogo no cambian de comportamiento tras agregar Snake al registro.
- [ ] `npx tsc --noEmit` no reporta errores.

## Decisiones tomadas y descartadas

- **Motor diseñado desde cero en vez de portado de un `game.js` de referencia** (tomada): a diferencia de Asteroids/Tetris/Arkanoid, no existe una carpeta `references/started-games/` para Snake — solo un asset pack visual (`fruits.png` + `sprites.js`). El usuario pidió explícitamente crearlo "desde cero" usando esos assets como referencia visual, así que el motor implementa Snake clásico estándar (cuadrícula, crecimiento, colisión) en vez de traducir código existente.
- **Movimiento por tick lógico acumulado en `update(dt)`, no por frame** (tomada): Snake es un juego de pasos discretos en cuadrícula; mover un segmento por frame lo haría injugablemente rápido a 60fps. Se acumula `dt` hasta superar `tickInterval` (que decrece con el nivel), igual en espíritu al `dropInterval` de `TetrisEngine`.
- **Fruta con sprite aleatorio del atlas en cada aparición, no una fruta fija** (tomada): decisión explícita del usuario al confirmar los metadatos — aprovecha las 21 variantes del asset pack en vez de limitarse a una sola fruta, sin cambiar la mecánica (cualquier fruta vale los mismos puntos).
- **Reusar la clase `.cover-snake` ya existente en `app/globals.css` en vez de diseñar un cover nuevo con `/frontend-design`** (tomada): decisión explícita del usuario — la clase ya existe (verde, con segmentos de serpiente y punto de comida), no está en uso por ningún juego actual del catálogo, y encaja temáticamente sin trabajo de diseño adicional.
- **`lives` fijo (1 → 0 en game over) en vez de omitir el campo** (tomada): mismo criterio que SPEC 07 para Tetris — el contrato `EngineSnapshot` es compartido entre todos los motores; se mantiene completo con un valor coherente en vez de romper compatibilidad.
- **Controles Flechas + WASD simultáneos** (tomada): decisión explícita del usuario al confirmar los metadatos, igual de accesible para distintas preferencias de teclado.
- **Sin controles táctiles, obstáculos ni modos alternativos** (tomada): fuera de alcance explícito; se prioriza un Snake clásico reconocible sobre variantes modernas no pedidas.

## Riesgos identificados

- **Carga asíncrona de `fruits.png`**: a diferencia de un motor 100% procedural, este juego depende de una imagen externa. Si el componente canvas no maneja bien el estado "imagen aún no cargada" al montar, la primera fruta podría no dibujarse o el juego podría arrancar antes de tener el sprite listo. Mitigación: el motor dibuja un fallback simple (rectángulo de color) si la imagen no está lista, sin bloquear el arranque del loop.
- **Redimensionar el canvas en pleno juego recalcula `cellSize` y puede desalinear momentáneamente la cuadrícula** hasta el siguiente `draw()`; efecto menor y transitorio, mismo criterio que SPEC 04/07 (sin lógica especial de reposicionamiento).
- **Colisión por reversa de dirección en el mismo tick**: si el jugador presiona la tecla opuesta muy rápido entre dos ticks, existe el riesgo clásico de Snake de "morder" el segundo segmento sin que se sienta como una colisión válida. Se mitiga bloqueando el cambio de dirección a 180° mientras el tick no haya avanzado (buffer de una sola dirección pendiente por tick), comportamiento estándar del juego original.
- **Dos HUD (canvas + React) pueden desincronizarse visualmente por un frame**, mismo criterio ya aceptado en SPEC 04/07: no se requiere sincronización estricta a nivel de frame.
