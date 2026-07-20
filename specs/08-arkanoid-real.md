# 08 — Juego real de Arkanoid

- **Estado:** Implementado
- **Dependencias:** SPEC 04 (Asteroids real — define el contrato de motor `<Id>Engine`/`EngineSnapshot`, el patrón canvas y el registro `components/games/registry.ts`), SPEC 07 (Tetris real — segundo juego portado, confirma que agregar un motor nuevo solo toca una línea del registro), SPEC 06 (catálogo vía Supabase — `games` ya es data-driven)
- **Fecha:** 2026-07-20

## Objetivo

Agregar "ARKANOID" (id `arkanoid`) como juego real y jugable al catálogo de Arcade Vault, portando la lógica de `references/started-games/04-arkanoid/game.js` y `levels.js` a un motor TypeScript en canvas registrado en `components/games/registry.ts`, con leaderboard funcionando automáticamente vía la tabla `scores` ya genérica.

## Alcance

**Incluido:**

- Fila nueva en `public.games` (no existe hoy `arkanoid`): `id: "arkanoid"`, `title: "ARKANOID"`, `cat: "ARCADE"`, `cover: "cover-bricks"` (clase ya existente en `app/globals.css`), `color: "magenta"`, `best: 34800`, `plays: "10.7K"`, `short`/`long` descriptivos.
- Motor puro `components/games/arkanoid/engine.ts` (`ArkanoidEngine`), portando de `game.js`/`levels.js`: paddle, pelota con física de rebote (paredes, paddle, bloques), los 5 niveles con sus patrones de bloques (`LEVELS` — parrilla completa, pirámide, tablero de ajedrez, filas con huecos, marco + cruz) y sus multiplicadores de velocidad de pelota (`×1.00` a `×1.46`), 3 vidas, puntuación `+10` por bloque destruido, y progreso automático al siguiente nivel al vaciar el tablero.
- Renderizado **vectorial** (rectángulos/arcos de canvas), no basado en el spritesheet del original (`assets/spritesheet-breakout.png`): bloques, paddle y pelota se dibujan con colores sólidos equivalentes a `BLOCK_COLORS` (`red`, `yellow`, `cyan`, `magenta`, `hotpink`, `green`, `gray`), evitando portar assets de imagen que no existen en el proyecto Next.js.
- Dimensiones de canvas dinámicas: el tamaño de bloque, paddle y pelota se calculan proporcionalmente al ancho/alto reales del canvas en `init()`/`resize()` (no fijos en 800×600), manteniendo la parrilla de bloques `10×6` centrada.
- El motor dibuja su propio HUD (Score, Nivel, iconos de vidas) y su propio overlay de "GAME OVER" (y de victoria al completar el nivel 5) dentro de `draw()`, igual que el original, y expone `getSnapshot()` (`EngineSnapshot`) para el HUD externo de React.
- Componente `components/games/arkanoid/arkanoid-canvas.tsx`, estructuralmente idéntico a `asteroids-canvas.tsx`/`tetris-canvas.tsx`: monta el canvas, mide con `ResizeObserver`, captura teclado (`ArrowLeft`, `ArrowRight`) **y además** `mousemove` sobre el propio `<canvas>` para mover el paddle (fiel al control por mouse del original), corre el loop respetando `paused`, reenvía `onSnapshot` cada frame y expone `forceGameOver` vía `forceEndRef`.
- Alta de una línea en `components/games/registry.ts` (`arkanoid: ArkanoidCanvas`). El registro ya existe (creado en SPEC 07); no se toca `game-player.tsx`.
- Migración SQL `supabase/migrations/<timestamp>_arkanoid.sql` con el insert de la fila `arkanoid`, aplicada vía `mcp__supabase__apply_migration`.

**Explícitamente fuera de alcance:**

- Sprites/spritesheet e imágenes del original — se reemplazan por formas vectoriales de color sólido.
- Animación de explosión al romper bloques (requiere los frames del spritesheet) — se omite; el bloque simplemente desaparece al ser golpeado.
- Sonido/efectos de audio (`ball-bounce.mp3`, `break-sound.mp3`).
- **Selector de nivel en overlay de pausa** (botones 1–5 del original): el original permite saltar de nivel con click durante la pausa; en Arcade Vault la pausa la controla exclusivamente el botón "PAUSA" de React (igual que Asteroids y Tetris), sin overlay ni tecla propia (`P`/`Escape`) dentro del motor. Los niveles se juegan en progresión lineal 1→5.
- Controles táctiles on-screen (más allá del `mousemove` ya incluido, que es el control nativo del original).
- Tests automatizados.
- Cambios a `lib/games.ts`, `lib/storage.ts`, `lib/supabase/*` o páginas `app/*` más allá de que sigan funcionando data-driven con la nueva fila.

## Modelo de datos

No se introduce persistencia nueva (`saveScore`/`getScoresForGame` de `lib/storage.ts` no cambian; indexan por `game.id` y `arkanoid` ya funciona en cuanto exista la fila).

### `public.games` (insert nuevo, sin cambio de esquema)

```sql
insert into public.games (id, title, short, long, cat, cover, color, best, plays) values (
  'arkanoid',
  'ARKANOID',
  'Destruye bloques con tu paddle y una pelota implacable.',
  'El clásico rompe-bloques. Controla el paddle con mouse o flechas para rebotar la pelota y despejar 5 niveles de bloques cada vez más veloces antes de quedarte sin vidas.',
  'ARCADE',
  'cover-bricks',
  'magenta',
  34800,
  '10.7K'
);
```

### `components/games/arkanoid/engine.ts`

```ts
export type EngineState = "playing" | "dead" | "gameover";

export interface EngineSnapshot {
  score: number;
  lives: number;
  level: number;
  state: EngineState;
}

export class ArkanoidEngine {
  constructor(width: number, height: number);
  resize(width: number, height: number): void;
  update(dt: number): void;
  draw(ctx: CanvasRenderingContext2D): void; // bloques + paddle + pelota + HUD + overlay propios
  setKey(code: string, down: boolean): void;
  setPaddleX(clientFraction: number): void; // 0..1 relativo al ancho del canvas, para mousemove
  forceGameOver(): void;
  getSnapshot(): EngineSnapshot;
}
```

`lives` inicia en `3` y baja cada vez que la pelota cae por debajo del paddle, igual que el original; en `0` el motor pasa a `state: "gameover"`. `level` es el nivel actual `1..5` (`currentLevel` del original). Al completar el nivel 5 (todos los bloques destruidos), el motor entra en `state: "gameover"` también (el enum compartido no distingue victoria), pero dibuja internamente un mensaje distinto ("¡Completaste el juego!" vs "GAME OVER") según un flag interno `won: boolean` — el HUD externo de React no necesita distinguir el caso, solo detecta fin de partida vía `state === "gameover"`. El estado `"dead"` del enum queda sin uso (no hay respawn transitorio, igual que en Tetris).

`setPaddleX` es un método adicional al contrato base (no rompe compatibilidad con `AsteroidsEngine`/`TetrisEngine`, que simplemente no lo exponen) para que `arkanoid-canvas.tsx` traduzca la posición del mouse sobre el canvas al paddle, replicando el control por mouse del original.

### `components/games/arkanoid/arkanoid-canvas.tsx`

Mismo contrato `GameCanvasProps` de `components/games/registry.ts` (`{ paused, onSnapshot, forceEndRef }`), sin props nuevas. Internamente agrega un listener `mousemove` sobre el `<canvas>` (además de `keydown`/`keyup` en `window`) que llama a `engine.setPaddleX(fracción)`.

### `components/games/registry.ts` (alta de una línea)

```ts
import { ArkanoidCanvas } from "@/components/games/arkanoid/arkanoid-canvas";

export const GAME_CANVASES: Record<string, ComponentType<GameCanvasProps>> = {
  asteroids: AsteroidsCanvas,
  tetris: TetrisCanvas,
  arkanoid: ArkanoidCanvas,
};
```

## Plan de implementación

1. **Motor puro — niveles y bloques**: crear `components/games/arkanoid/engine.ts` portando la generación de los 5 patrones de `levels.js` (parrilla, pirámide, tablero de ajedrez, filas con huecos, marco+cruz) como datos internos, con colores mapeados a valores hex/CSS en vez de nombres de sprite. Sin uso todavía, no hay cambio visible.
2. **Motor puro — `ArkanoidEngine` completo**: ensamblar la clase con estado interno (`paddle`, `ball`, `blocks`, `score`, `lives`, `level`, `state`, `won`), `update(dt)` (movimiento de paddle por teclado, movimiento de pelota, rebotes en paredes/paddle/bloques con AABB, pérdida de vida, avance de nivel, victoria en nivel 5), `setKey`, `setPaddleX`, `draw(ctx)` (bloques + paddle + pelota vectoriales + HUD propio + overlay de game over/victoria), `resize` (recalcula tamaño de bloque/paddle/pelota proporcional al canvas), `forceGameOver`, `getSnapshot`. Motor completo y jugable en aislamiento.
3. **`components/games/arkanoid/arkanoid-canvas.tsx`**: copiar la estructura de `tetris-canvas.tsx` cambiando el motor importado, el `Set` de teclas capturadas (`ArrowLeft`, `ArrowRight`) y agregando el listener `mousemove` sobre el canvas que traduce la posición X a `engine.setPaddleX`.
4. **Alta en `components/games/registry.ts`**: agregar el import de `ArkanoidCanvas` y la entrada `arkanoid: ArkanoidCanvas` al mapa `GAME_CANVASES`. No se toca `game-player.tsx` (el registro ya existe desde SPEC 07).
5. **Migración Supabase**: crear `supabase/migrations/<timestamp>_arkanoid.sql` con el insert de la sección de modelo de datos y aplicarla vía `mcp__supabase__apply_migration`.
6. **Verificación end-to-end**: `npm run dev`, navegar `/`, `/games`, `/games/arkanoid`, `/games/arkanoid/play`, `/hall-of-fame`; `npx tsc --noEmit` sin errores; jugar una partida completa (mover con teclado y mouse, romper bloques, perder una vida, pasar de nivel, game over al quedarse sin vidas), guardar puntuación y confirmar que aparece en el leaderboard.

## Criterios de aceptación

- [ ] `/games` y `/` muestran la tarjeta "ARKANOID" (cover `cover-bricks`, categoría ARCADE) sin tocar el resto del catálogo.
- [ ] `/games/arkanoid` muestra el detalle del juego con su descripción y leaderboard (vacío o con scores existentes).
- [ ] `/games/arkanoid/play` renderiza el juego real de Arkanoid dentro del `.crt-screen` en vez del `.game-arena` decorativo.
- [ ] Flechas ←/→ y el movimiento del mouse sobre el canvas mueven el paddle.
- [ ] La pelota rebota correctamente en paredes, paddle y bloques; cada bloque destruido suma 10 puntos.
- [ ] Se juegan los 5 niveles en orden, cada uno con su patrón de bloques y velocidad de pelota (`×1.00` a `×1.46`) crecientes; vaciar el tablero avanza automáticamente al siguiente nivel.
- [ ] El canvas dibuja su propio HUD (Score, Nivel, vidas) y en paralelo el HUD externo de React muestra score/nivel sincronizados vía `onSnapshot`.
- [ ] Perder la pelota descuenta una vida y reposiciona pelota/paddle; al llegar a 0 vidas, el canvas muestra su overlay "GAME OVER" y se abre el modal de fin de partida de React con la puntuación final real.
- [ ] Completar el nivel 5 también termina la partida (mismo `state: "gameover"` del contrato) mostrando el mensaje de victoria propio del canvas.
- [ ] "PAUSA" detiene realmente el juego (pelota y paddle dejan de moverse) y "REANUDAR" continúa exactamente donde quedó; no hay overlay ni tecla de pausa propios del canvas.
- [ ] "FIN" termina la partida de inmediato con la puntuación acumulada, mostrando ambos overlays de fin de partida.
- [ ] Guardar la puntuación invoca `saveScore({ game: "arkanoid", score, name })`; el score aparece en `/games/arkanoid` y `/hall-of-fame`.
- [ ] "JUGAR DE NUEVO" reinicia el motor completo (nivel 1, score/vidas en su estado inicial).
- [ ] Redimensionar la ventana ajusta el tamaño de bloques/paddle/pelota sin romper el layout ni la playabilidad.
- [ ] Asteroids y Tetris no cambian de comportamiento tras agregar la línea nueva al registro.
- [ ] `npx tsc --noEmit` no reporta errores.

## Decisiones tomadas y descartadas

- **Renderizado vectorial en vez de portar el spritesheet** (tomada): el original depende de `assets/spritesheet-breakout.png`, un asset de imagen que no existe en el proyecto Next.js. Portarlo agregaría manejo de carga de imágenes asíncrono al motor, rompiendo la sincronía "motor puro, sin I/O externo" del contrato. Se usan rectángulos/arcos de color sólido, consistente con el nivel de fidelidad visual de Asteroids/Tetris.
- **Sin selector de nivel en pausa, progresión lineal 1→5** (tomada, confirmada con el usuario): el patrón unificado de pausa vía prop `paused` de React (sin tecla ni overlay propios del motor) ya se estableció en Asteroids y se reafirmó en Tetris; agregar un overlay de selección de nivel controlado por click reintroduce una fuente de verdad de pausa distinta a la de React.
- **Controles de teclado + mouse** (tomada, confirmada con el usuario): a diferencia de Asteroids/Tetris (solo teclado), Arkanoid en el original usa mouse como control primario del paddle. Se porta también el `mousemove`, agregando `setPaddleX` como método adicional del motor (no rompe el contrato base compartido).
- **`won` como flag interno en vez de un tercer valor en `EngineState`** (tomada): mantener `EngineState` (`"playing" | "dead" | "gameover"`) sin cambios preserva la compatibilidad estructural con `AsteroidsEngine`/`TetrisEngine`, que consumen el mismo tipo desde `registry.ts`. La distinción victoria/derrota es solo cosmética dentro del overlay que dibuja el propio canvas.
- **Sin animación de explosión ni sonido** (tomada): dependen de los mismos assets de imagen/audio fuera de alcance; el bloque simplemente desaparece al ser destruido, igual de legible sin el detalle de la animación.
- **ARCADE + magenta** (tomada, confirmada con el usuario): magenta no está en uso por Asteroids (yellow) ni Tetris (cyan); ARCADE agrupa a Arkanoid con el género de rompe-bloques clásico en vez de con Tetris (PUZZLE).

## Riesgos identificados

- **Rebote de pelota en bloques simplista (un bloque por frame, `ball.vy = -ball.vy` sin distinguir cara)** (heredado del original): es el mismo comportamiento que `references/started-games/04-arkanoid/game.js`; no se mejora la física de colisión en este spec.
- **Redimensionar el canvas en pleno juego recalcula tamaños proporcionales y puede desplazar visualmente bloques/paddle/pelota por un frame** hasta el siguiente `draw()`; mismo criterio aceptado en SPEC 04 y SPEC 07.
- **Doble control (teclado + mouse) puede pelear entre sí** si el usuario mueve el mouse y presiona flechas simultáneamente — el último evento procesado en el frame gana, igual que cualquier juego con inputs combinados; no se prioriza uno sobre otro explícitamente.
- **Sin sprites, la lectura visual de qué bloque es de qué "material"** (el original diferenciaba colores pero todos eran igual de resistentes — 1 hit) se mantiene igual, solo cambia de sprite a color sólido; no hay pérdida funcional.
