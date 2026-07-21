# CONVOY — Variante B: Defensa estacionaria de carriles

- **Estado:** Borrador
- **Dependencias:** SPEC 04 (Asteroids real — contrato de motor `<Id>Engine`/`EngineSnapshot` y patrón canvas), SPEC 06 (catálogo vía Supabase — `games` ya es data-driven), SPEC 07 (Tetris real — registro `components/games/registry.ts` ya existente), SPEC 08 (Arkanoid real — precedente de renderizado vectorial sin sprites/spritesheet)
- **Fecha:** 2026-07-21

## Objetivo

Agregar "CONVOY" (id `convoy`) como juego real y jugable de la categoría SHOOTER, en esta variante como una **defensa estacionaria de carriles** (tower-defense ligero): el jugador permanece fijo en una base al pie de la autopista y debe disparar hacia los carriles para destruir camiones/vehículos que avanzan hacia él en oleadas, antes de que alcancen la base. Diversifica la única categoría SHOOTER existente hoy (Asteroids). No existe una carpeta `references/started-games/` para este juego: el motor se diseña desde cero, con renderizado vectorial, mismo criterio que SPEC 08 (Arkanoid).

## Alcance

**Incluido:**

- Fila nueva en `public.games` (misma fila que la variante A, no existe hoy `convoy`): `id: "convoy"`, `title: "CONVOY"`, `cat: "SHOOTER"`, `cover: "cover-convoy"` (clase **nueva**, a crear en `app/globals.css` durante la implementación), `color: "cyan"`, `best: 52000`, `plays: "8.9K"`, `short`/`long` descriptivos (ajustados al modo de defensa).
- Motor puro `components/games/convoy/engine.ts` (`ConvoyEngine`) con:
  - Tablero de `9` carriles verticales (columnas) por los que descienden vehículos hostiles desde arriba hacia la base del jugador, ubicada en una fila fija al pie del tablero (sin movimiento vertical del jugador — es una defensa estacionaria).
  - El jugador controla una torreta horizontal en la fila de la base, moviéndose lateralmente entre carriles con `ArrowLeft`/`ArrowRight` (movimiento discreto de carril en carril, cooldown ~130ms) y disparando verticalmente hacia arriba con `Space` (cooldown de disparo ~250ms) para destruir vehículos antes de que lleguen a la base.
  - Oleadas: cada oleada genera un número creciente de vehículos distribuidos en los 9 carriles, con velocidad de descenso y densidad crecientes; una oleada termina cuando todos sus vehículos fueron destruidos o alcanzaron la base. Al completar una oleada, comienza la siguiente (más difícil).
  - Vehículos: la mayoría son destructibles de un disparo (suman puntos); una fracción (creciente con las oleadas) son blindados que requieren 2 impactos, sin volverse indestructibles del todo (a diferencia de la variante A, que sí tiene vehículos permanentemente indestructibles) — esto mantiene siempre una vía de defensa activa disponible para el jugador.
  - Vida de la base: la base tiene `3` puntos de resistencia (no vidas del jugador propiamente); cada vehículo que llega a la base sin ser destruido resta 1 punto de resistencia. Llegar a 0 termina la partida.
  - Puntuación: `+15` por vehículo destructible destruido, `+30` por blindado destruido, `+100` de bono por oleada completada sin perder puntos de resistencia (oleada "perfecta"), `+40` de bono por oleada completada de cualquier forma.
  - El motor dibuja su propio HUD (SCORE, OLEADA, RESISTENCIA DE LA BASE) y su propio overlay de "GAME OVER" dentro de `draw()`, con renderizado 100% vectorial, y expone `getSnapshot()` (`EngineSnapshot`).
- Componente `components/games/convoy/convoy-canvas.tsx`, estructuralmente idéntico a `asteroids-canvas.tsx`: monta el canvas, mide con `ResizeObserver`, captura teclado (`ArrowLeft`, `ArrowRight`, `Space`), corre el loop respetando `paused`, reenvía `onSnapshot` y expone `forceGameOver` vía `forceEndRef`.
- Alta de una línea en `components/games/registry.ts` (`convoy: ConvoyCanvas`). El registro ya existe (creado en SPEC 07); no se toca `game-player.tsx`.
- Migración SQL `supabase/migrations/<timestamp>_convoy.sql` con el insert de la fila `convoy`, aplicada vía `mcp__supabase__apply_migration`.

**Explícitamente fuera de alcance:**

- Movimiento vertical del jugador o cruce de carriles activo — es defensa estacionaria pura; eso es lo que ofrece la **variante A** en su lugar.
- Vehículos permanentemente indestructibles — aquí todo puede destruirse con suficientes impactos, a diferencia de los blindados de la variante A.
- Power-ups, armas alternativas o modos cooperativos/versus.
- Sprites/imágenes — renderizado vectorial únicamente.
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
  'Defiende tu base de oleadas de camiones a tiros.',
  'Una torreta fija al pie de nueve carriles debe derribar camiones y blindados antes de que lleguen a la base. Cada oleada trae más vehículos y más velocidad: sobrevive todo lo que puedas.',
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
  draw(ctx: CanvasRenderingContext2D): void; // carriles + vehículos + torreta + proyectiles + HUD + overlay propios
  setKey(code: string, down: boolean): void;
  forceGameOver(): void;
  getSnapshot(): EngineSnapshot;
}
```

`lives` se repurposa como los **puntos de resistencia de la base** (`3 → 0`), no vidas del jugador en el sentido literal (la torreta nunca "muere" ni reaparece; lo que se agota es la resistencia de lo que defiende) — documentado explícitamente, mismo criterio de repurposing ya usado por Tetris/Snake para `lives`. `level` es el número de oleada actual, creciente sin techo definido (la partida termina por agotamiento de resistencia, no por completar un número fijo de oleadas). El estado `"dead"` del enum queda **sin uso** (no hay respawn transitorio del jugador: perder un punto de resistencia de la base no interrumpe el control de la torreta, solo se refleja en el contador de resistencia) — diferencia explícita frente a la variante A, que sí usa `"dead"` para el respawn del jugador.

El tamaño de celda/carril se calcula igual que en `HopperEngine`/variante A de Convoy, pero con la fila de la torreta siempre fija en la base del canvas.

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

1. **Motor puro — carriles y generación de oleadas**: crear `components/games/convoy/engine.ts` con los 9 carriles verticales, la generación de oleadas (cantidad, velocidad, densidad, proporción de blindados crecientes), y el descenso continuo de vehículos. Sin torreta ni disparo todavía.
2. **Motor puro — torreta, disparo y colisión proyectil-vehículo**: agregar la torreta (movimiento discreto lateral entre carriles con cooldown), el proyectil vertical con su propio cooldown de disparo, la colisión proyectil-vehículo (1 impacto para destructibles, 2 para blindados), y la eliminación de vehículos al ser destruidos.
3. **Motor puro — resistencia de base, puntuación y oleadas**: colisión vehículo-base (vehículo llega al fondo sin ser destruido → resta resistencia y se elimina), puntuación (`+15`/`+30`/`+100`/`+40`), transición entre oleadas, fin de partida al agotar la resistencia, `draw()` con HUD propio (SCORE, OLEADA, RESISTENCIA) y overlay de game over, `resize`, `setKey`, `forceGameOver`, `getSnapshot` (con el mapeo de `lives` descrito arriba). Motor completo y jugable en aislamiento.
4. **`components/games/convoy/convoy-canvas.tsx`**: copiar la estructura de `arkanoid-canvas.tsx` (más cercano por ser también un shooter de posición fija con movimiento lateral), cambiando el motor importado y el `Set` de teclas capturadas.
5. **Cover art**: diseñar `.cover-convoy` en `app/globals.css` con `/frontend-design` (carriles verticales convergiendo hacia una torreta en la base, vehículos cian/gris descendiendo).
6. **Alta en `components/games/registry.ts`**: agregar el import de `ConvoyCanvas` y la entrada `convoy: ConvoyCanvas`. No se toca `game-player.tsx`.
7. **Migración Supabase**: crear `supabase/migrations/<timestamp>_convoy.sql` con el insert de la sección de modelo de datos y aplicarla vía `mcp__supabase__apply_migration`.
8. **Verificación end-to-end**: `npm run dev`, navegar `/`, `/games`, `/games/convoy`, `/games/convoy/play`, `/hall-of-fame`; `npx tsc --noEmit` sin errores; jugar una partida completa (destruir varios tipos de vehículo, completar al menos una oleada perfecta, dejar pasar algún vehículo, agotar la resistencia de la base), guardar puntuación y confirmar que aparece en el leaderboard.

## Criterios de aceptación

- [ ] `/games` y `/` muestran la tarjeta "CONVOY" (cover `cover-convoy`, categoría SHOOTER) sin tocar el resto del catálogo.
- [ ] `/games/convoy` muestra el detalle del juego con su descripción y leaderboard (vacío o con scores existentes).
- [ ] `/games/convoy/play` renderiza el juego real dentro del `.crt-screen` en vez del `.game-arena` decorativo.
- [ ] Flechas ←/→ mueven la torreta lateralmente entre carriles; `Space` dispara un proyectil vertical con cadencia limitada.
- [ ] Los vehículos destructibles caen con 1 impacto y los blindados requieren 2, sumando puntos distintos cada uno.
- [ ] Un vehículo que llega a la fila de la base sin ser destruido resta un punto de resistencia y desaparece.
- [ ] Completar una oleada sin perder resistencia otorga el bono de oleada "perfecta"; completarla de cualquier otra forma otorga el bono normal, y comienza la siguiente oleada más difícil.
- [ ] El canvas dibuja su propio HUD (SCORE, OLEADA, RESISTENCIA) y en paralelo el HUD externo de React muestra score/nivel sincronizados vía `onSnapshot` (con `lives` reflejando la resistencia de la base).
- [ ] Agotar la resistencia de la base (llegar a 0) muestra el overlay "GAME OVER" del canvas y abre el modal de fin de partida de React con la puntuación final real.
- [ ] "PAUSA" detiene realmente el juego (vehículos y proyectiles se congelan) y "REANUDAR" continúa exactamente donde quedó.
- [ ] "FIN" termina la partida de inmediato con la puntuación acumulada.
- [ ] Guardar la puntuación invoca `saveScore({ game: "convoy", score, name })`; el score aparece en `/games/convoy` y `/hall-of-fame`.
- [ ] "JUGAR DE NUEVO" reinicia el motor completo (oleada 1, resistencia/score en su estado inicial).
- [ ] Redimensionar la ventana ajusta el tamaño de los carriles sin romper el layout ni la playabilidad.
- [ ] Asteroids, Tetris, Arkanoid y Snake no cambian de comportamiento tras agregar Convoy al registro.
- [ ] `npx tsc --noEmit` no reporta errores.

## Decisiones tomadas y descartadas

- **Defensa estacionaria (tower-defense ligero) en vez de avance activo** (tomada): esta es la diferencia central frente a la **variante A** (avance con disparo), que mueve al jugador por el tablero. Esta variante B se prefiere cuando se busca un shooter más puro (apuntar y disparar, sin gestión de movimiento en cuadrícula hacia adelante), con la progresión expresada en oleadas sobrevividas en vez de filas cruzadas — mecánicamente más cercana a Missile Command/Space Invaders que a Frogger, aunque conserva el concepto de "carriles con obstáculos en movimiento" pedido por el tema.
- **`lives` repurposeado como resistencia de la base, sin estado `"dead"` transitorio** (tomada): a diferencia de la variante A (que sí usa `"dead"` para el respawn del jugador), aquí la torreta nunca "muere" — lo que se agota es lo que defiende. Mantener `lives` como resistencia preserva la compatibilidad estructural del contrato sin forzar un ciclo de respawn que no tiene sentido en esta mecánica.
- **Blindados que requieren 2 impactos en vez de ser indestructibles** (tomada, distinta de la variante A): en una defensa estacionaria sin vía de escape (el jugador no puede "esquivar" un vehículo que ya está en su carril, solo destruirlo o dejarlo pasar), un vehículo permanentemente indestructible garantizaría pérdida de resistencia inevitable; se prefiere que todo sea destructible con suficiente esfuerzo, manteniendo la agencia del jugador.
- **Oleadas sin techo de dificultad, terminando solo por agotamiento de resistencia** (tomada): consistente con el criterio de "sobrevive todo lo que puedas" de un shooter de oleadas, en vez de un final fijo tipo Arkanoid (5 niveles) — prioriza la rejugabilidad y el score attack sobre una narrativa de "victoria" cerrada.
- **SHOOTER en vez de ARCADE** (tomada, mismo motivo que variante A): diversifica la categoría SHOOTER, hoy solo representada por Asteroids.

## Riesgos identificados

- **Sin movimiento de avance, la variedad de gameplay depende enteramente del diseño de oleadas** (patrones de carriles, mezcla de blindados/destructibles); si las oleadas se sienten repetitivas, el juego pierde interés más rápido que un cruce de carriles con progresión espacial. Se acepta como riesgo de diseño, mitigable en implementación ajustando la variedad de patrones de oleada.
- **Cadencia de disparo limitada frente a alta densidad de carriles simultáneos** puede generar situaciones donde es matemáticamente imposible cubrir los 9 carriles a tiempo en oleadas avanzadas; se acepta como el techo natural de dificultad del modo (define el score máximo alcanzable por la mayoría de jugadores), igual criterio que la aceleración de Tetris/Arkanoid.
- **Confusión entre "vidas" del HUD externo de React y "resistencia de la base"** al no ser literalmente vidas del jugador; se mitiga con el propio HUD del canvas usando la etiqueta "RESISTENCIA" en vez de "VIDAS", aunque el HUD genérico de React (si usa una etiqueta fija de "vidas") pueda leerse distinto — mismo trade-off ya aceptado en Tetris/Snake al repurposear el campo.
- **Redimensionar el canvas en pleno juego** recalcula el ancho de carril y puede desplazar visualmente la torreta y los vehículos por un frame; mismo criterio aceptado en SPEC 04/07/08/10.
