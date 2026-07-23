# HOPPER — Variante B: Ascenso infinito procedural

- **Estado:** Borrador
- **Dependencias:** SPEC 04 (Asteroids real — contrato de motor `<Id>Engine`/`EngineSnapshot` y patrón canvas), SPEC 06 (catálogo vía Supabase — `games` ya es data-driven), SPEC 07 (Tetris real — registro `components/games/registry.ts` ya existente)
- **Fecha:** 2026-07-21

## Objetivo

Agregar "HOPPER" (id `hopper`) como juego real y jugable al catálogo de Arcade Vault, en esta variante como un **escalador infinito de carriles**: sin rondas fijas ni meta, el jugador asciende para siempre por carriles de carretera y río generados proceduralmente por delante de su posición, con la cámara siguiendo su altura máxima alcanzada (en el espíritu de un endless climber tipo Doodle Jump, pero con la mecánica de esquivar/montar obstáculos de Frogger). No existe una carpeta `references/started-games/` para este juego (igual que Snake en SPEC 10): el motor se diseña desde cero, tomando como referencia conceptual el juego decorativo `ranaria` ya presente en el catálogo simulado (`references/templates/data.jsx`, cover `cover-rana`, categoría ARCADE, color green).

## Alcance

**Incluido:**

- Fila nueva en `public.games` (misma fila que la variante A, no existe hoy `hopper`): `id: "hopper"`, `title: "HOPPER"`, `cat: "ARCADE"`, `cover: "cover-rana"`, `color: "green"`, `best: 18900`, `plays: "6.4K"`, `short`/`long` descriptivos (ajustados al modo infinito).
- Motor puro `components/games/hopper/engine.ts` (`HopperEngine`) con:
  - Tablero de cuadrícula de ancho fijo (`9` columnas) y alto dinámico según el canvas; las filas visibles se desplazan hacia abajo conforme el jugador asciende (scroll vertical continuo con la cámara centrada en la posición del jugador, no en un tope fijo del tablero).
  - Generación **procedural** de carriles: cada vez que el jugador se acerca al borde superior visible, el motor genera una nueva fila por delante con un tipo aleatorio ponderado (carretera o río, alternando con probabilidad de tramos seguros intercalados), velocidad y densidad de obstáculos crecientes según la banda de dificultad actual.
  - Movimiento del jugador **discreto por celda** (igual que la variante A: una celda por pulsación, cooldown ~130ms de flechas/WASD), pero sin fila de meta ni nenúfares — el objetivo es puramente ascender lo más alto posible.
  - Colisión: pisar un coche, caer al agua sin tronco debajo, o salir del tablero por los lados = fin de la partida inmediato (sin vidas de repuesto).
  - Puntuación: `maxRow` (la fila más alta alcanzada en toda la partida, que **no baja** aunque el jugador retroceda o caiga a una fila inferior) multiplicada por `15`, más un pequeño incremento (`+2`) por cada celda avanzada en vivo para que el score se sienta responsivo mientras se juega, aunque el valor final relevante es el de altura máxima.
  - Bandas de dificultad: cada `8` filas de `maxRow` sube una banda, incrementando velocidad y densidad de obstáculos de los carriles generados de ahí en adelante, sin techo (dificultad creciente indefinida, como un endless runner).
  - El motor dibuja su propio HUD (SCORE, ALTURA/fila máxima, BANDA) y su propio overlay de "GAME OVER" dentro de `draw()`, y expone `getSnapshot()` (`EngineSnapshot`).
- Componente `components/games/hopper/hopper-canvas.tsx`, estructuralmente idéntico a `asteroids-canvas.tsx`: monta el canvas, mide con `ResizeObserver`, captura teclado (`ArrowLeft`, `ArrowRight`, `ArrowUp`, `ArrowDown`, `KeyW`, `KeyA`, `KeyS`, `KeyD`), corre el loop respetando `paused`, reenvía `onSnapshot` y expone `forceGameOver` vía `forceEndRef`.
- Alta de una línea en `components/games/registry.ts` (`hopper: HopperCanvas`). El registro ya existe (creado en SPEC 07); no se toca `game-player.tsx`.
- Migración SQL `supabase/migrations/<timestamp>_hopper.sql` con el insert de la fila `hopper`, aplicada vía `mcp__supabase__apply_migration`.

**Explícitamente fuera de alcance:**

- Controles táctiles/on-screen — solo teclado.
- Rondas, meta, nenúfares o cualquier condición de "victoria" — es un juego de puntuación pura sin final más allá de morir.
- Power-ups, obstáculos especiales o modos alternativos.
- Sonido/efectos de audio.
- Tests automatizados.
- Cambios a `lib/games.ts`, `lib/storage.ts`, `lib/supabase/*` o páginas `app/*` más allá de que sigan funcionando data-driven con la nueva fila.
- Reemplazar o eliminar el juego decorativo `ranaria` del catálogo simulado de referencia (`references/templates/`).

## Modelo de datos

No se introduce persistencia nueva (`saveScore`/`getScoresForGame` de `lib/storage.ts` no cambian; indexan por `game.id` y `hopper` ya funciona en cuanto exista la fila).

### `public.games` (insert nuevo, sin cambio de esquema)

```sql
insert into public.games (id, title, short, long, cat, cover, color, best, plays) values (
  'hopper',
  'HOPPER',
  'Sube sin parar por una autopista infinita de pixeles.',
  'Un ascenso sin fin entre coches y troncos a la deriva. No hay meta: solo tu altura máxima antes de resbalar al agua o ser atropellado. Cada tramo es más rápido que el anterior.',
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
  draw(ctx: CanvasRenderingContext2D): void; // carriles generados + jugador + HUD + overlay propios
  setKey(code: string, down: boolean): void;
  forceGameOver(): void;
  getSnapshot(): EngineSnapshot;
}
```

Hopper (modo infinito) no tiene el concepto de "vidas" de Asteroids ni el ciclo de respawn de la variante A: `lives` se mapea a un valor fijo (`1` mientras `state === "playing"`, `0` al llegar a `"gameover"`), igual que la decisión ya tomada en `TetrisEngine`/`SnakeEngine`, solo para que el HUD externo de React tenga un valor coherente. `level` es la banda de dificultad actual (`floor(maxRow / 8) + 1`), creciente sin techo. El estado `"dead"` del enum queda **sin uso** (un choque o caída termina la partida directamente, sin respawn transitorio) — a diferencia explícita de la variante A, que sí lo usa.

El tamaño de celda (`cellSize`) se recalcula en `resize()` igual que en la variante A, pero el número de filas visibles depende del alto real del canvas en vez de un total fijo de 13 filas; el motor mantiene una ventana deslizante de filas generadas alrededor de la posición actual de la cámara (que sigue a `maxRow`), descartando filas muy por debajo de la vista para no acumular memoria indefinidamente.

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

1. **Motor puro — ventana de carriles y cámara**: crear `components/games/hopper/engine.ts` con la ventana deslizante de filas (generadas por delante, descartadas por detrás), la cámara siguiendo `maxRow`, y el jugador como posición de celda sin fila de meta. Sin generación procedural real todavía (filas fijas de prueba). Sin uso visible aún.
2. **Motor puro — generación procedural y bandas de dificultad**: implementar el generador ponderado de tipo de carril (carretera/río/tramo seguro), velocidad/densidad creciente por banda (`floor(maxRow/8)+1`), y el avance continuo de obstáculos (`update(dt)`).
3. **Motor puro — jugador, colisión y puntuación**: movimiento discreto por celda con cooldown (igual criterio que variante A), colisión con coche/agua/bordes → `state: "gameover"` inmediato (sin `"dead"` transitorio), cálculo de `maxRow` monotónico y `score = maxRow * 15 + incrementos en vivo`, `draw()` con HUD propio (SCORE, ALTURA, BANDA) y overlay de game over, `resize`, `setKey`, `forceGameOver`, `getSnapshot`. Motor completo y jugable en aislamiento.
4. **`components/games/hopper/hopper-canvas.tsx`**: copiar la estructura de `asteroids-canvas.tsx`, cambiando el motor importado y el `Set` de teclas capturadas.
5. **Alta en `components/games/registry.ts`**: agregar el import de `HopperCanvas` y la entrada `hopper: HopperCanvas`. No se toca `game-player.tsx`.
6. **Migración Supabase**: crear `supabase/migrations/<timestamp>_hopper.sql` con el insert de la sección de modelo de datos y aplicarla vía `mcp__supabase__apply_migration`.
7. **Verificación end-to-end**: `npm run dev`, navegar `/`, `/games`, `/games/hopper`, `/games/hopper/play`, `/hall-of-fame`; `npx tsc --noEmit` sin errores; jugar una partida completa (ascender varias bandas de dificultad, morir por coche/agua/borde), guardar puntuación y confirmar que aparece en el leaderboard.

## Criterios de aceptación

- [ ] `/games` y `/` muestran la tarjeta "HOPPER" (cover `cover-rana`, categoría ARCADE) sin tocar el resto del catálogo.
- [ ] `/games/hopper` muestra el detalle del juego con su descripción y leaderboard (vacío o con scores existentes).
- [ ] `/games/hopper/play` renderiza el juego real dentro del `.crt-screen` en vez del `.game-arena` decorativo.
- [ ] Flechas y WASD mueven al jugador exactamente una celda por pulsación, sin saltos dobles por auto-repeat.
- [ ] El tablero genera nuevos carriles proceduralmente conforme el jugador asciende, sin agotarse nunca (no hay un "final" de contenido).
- [ ] La cámara sigue la altura máxima alcanzada; el jugador puede retroceder o caer sin que el score baje.
- [ ] Cada 8 filas de altura máxima sube la banda de dificultad, visible en el HUD, y los carriles nuevos son perceptiblemente más rápidos/densos.
- [ ] Cualquier colisión (coche, agua sin tronco, borde) termina la partida de inmediato mostrando el overlay "GAME OVER" del canvas y abriendo el modal de fin de partida de React con la puntuación final real.
- [ ] "PAUSA" detiene realmente el juego (obstáculos y cámara se congelan) y "REANUDAR" continúa exactamente donde quedó.
- [ ] "FIN" termina la partida de inmediato con la puntuación acumulada.
- [ ] Guardar la puntuación invoca `saveScore({ game: "hopper", score, name })`; el score aparece en `/games/hopper` y `/hall-of-fame`.
- [ ] "JUGAR DE NUEVO" reinicia el motor completo (altura/banda/score en su estado inicial, tablero regenerado desde cero).
- [ ] Redimensionar la ventana ajusta el tamaño de celda y la cantidad de filas visibles sin romper el layout ni la playabilidad.
- [ ] Asteroids, Tetris, Arkanoid y Snake no cambian de comportamiento tras agregar Hopper al registro.
- [ ] `npx tsc --noEmit` no reporta errores.

## Decisiones tomadas y descartadas

- **Ascenso infinito procedural en vez de rondas fijas con meta** (tomada): esta es la diferencia central frente a la **variante A** (clásica de rondas): aquí no hay nenúfares ni "victoria parcial" — el juego es puntuación pura tipo endless runner/climber, priorizando rejugabilidad y sesiones cortas repetibles sobre la fidelidad estricta al bucle de rondas del Frogger original. Se prefiere esta variante cuando se busca un gameplay más "score attack" y menos estructurado, con menor necesidad de balancear una progresión de rondas discretas.
- **Sin `state: "dead"` transitorio, fin de partida inmediato** (tomada): al no existir vidas de repuesto, no hay ciclo de respawn que justifique un estado de muerte transitorio (a diferencia explícita de la variante A); se sigue el mismo criterio ya usado en `TetrisEngine`/`SnakeEngine` para juegos de "un solo intento continuo".
- **Score basado en altura máxima monotónica (`maxRow`), no en progreso instantáneo** (tomada): evita que retroceder o caer penalice el score ya ganado, siguiendo el mismo criterio de juegos tipo Doodle Jump/endless climbers, y hace que la puntuación final sea fácil de entender ("qué tan alto llegaste") para el Hall of Fame.
- **Ventana deslizante de filas con descarte de las muy por debajo de la cámara** (tomada): evita crecimiento de memoria indefinido en partidas largas, consistente con el requisito de que el motor sea liviano y sin dependencias externas.
- **Mismos controles y cooldown de movimiento que la variante A** (tomada): mantiene la sensación táctil de "salto por celda" reconocible como Frogger, cambiando solo la estructura de objetivos (rondas vs. altura), no la mecánica base de movimiento.

## Riesgos identificados

- **Generación procedural sin techo de dificultad** puede volverse injugable en sesiones muy largas; se acepta como parte del diseño de endless runner (el objetivo es justamente ver hasta dónde llega el jugador antes de que la dificultad lo supere), sin límite artificial de banda.
- **Cámara siguiendo `maxRow` en vez de la posición actual del jugador** puede sentirse desorientador si el jugador retrocede mucho tras un avance rápido (la vista no "baja" con él); se mitiga manteniendo siempre visible la fila donde está parado el jugador dentro de la ventana, aunque el score no lo refleje.
- **Descartar filas por debajo de la cámara** podría eliminar un tronco justo cuando el jugador todavía depende de él si el margen de descarte es demasiado agresivo; se mitiga con un margen de filas de seguridad antes de eliminarlas de memoria.
- **Redimensionar el canvas en pleno juego** recalcula `cellSize` y la cantidad de filas visibles, pudiendo desplazar momentáneamente el tablero; mismo criterio aceptado en SPEC 04/07/10 (sin lógica especial de reposicionamiento).
