---
name: game-impl
description: Diseña una especificación (siguiendo la skill /spec) y luego porta o crea un juego real (canvas + motor) integrándolo end-to-end en Arcade Vault — spec en specs/, motor, componente canvas, registro de juegos, cover, fila en la tabla `games` de Supabase (vía MCP) y leaderboard. El juego puede venir de references/started-games o ser totalmente nuevo. Úsalo cuando quieras convertir un juego en jugable dentro de la plataforma.
disable-model-invocation: true
argument-hint: "<juego o carpeta de referencia, ej. 03-tetris o nombre nuevo>"
allowed-tools: Bash(git status:*), Bash(git branch:*), Bash(git checkout:*), Bash(ls:*)
---

# /game-impl — Especificar e integrar un juego real en Arcade Vault

Este skill toma un juego —de `references/started-games/` o inventado—, **primero redacta su especificación** en `specs/` (siguiendo la skill `/spec` y los specs existentes como referencia) y luego lo deja **jugable e integrado** en la plataforma: motor en canvas, HUD, catálogo, detalle, reproductor, home, salón de la fama y leaderboard real. Codifica el patrón ya establecido para Asteroids en las specs 04, 05 y 06.

**Escribes un spec y código real aquí.** El leaderboard (tabla `scores`) ya es genérico: se indexa por `game.id` mediante `saveScore`/`getScoresForGame` en `lib/storage.ts`, así que **no necesita código nuevo por juego** — basta con que el juego exista en la tabla `games` y esté registrado como jugable.

## Contexto de sesión

Estado del repo:
!`git status --short`

Rama actual:
!`git branch --show-current`

Juegos de referencia disponibles:
!`ls references/started-games 2>/dev/null || echo "No existe references/started-games"`

Specs existentes (referencia de formato y numeración):
!`ls specs 2>/dev/null || echo "No existe specs/"`

Skill /spec disponible (referencia del método para redactar el spec):
!`ls .claude/skills/spec/SKILL.md .agents/skills/spec/SKILL.md references/started-games/04-arkanoid/.agents/skills/spec/SKILL.md 2>/dev/null || echo "No encontrada — usar el fallback documentado en la Fase 2"`

Motores de juego ya portados:
!`ls components/games 2>/dev/null || echo "Aún no hay components/games"`

¿Existe ya el registro de juegos?
!`ls components/games/registry.ts 2>/dev/null && echo "REGISTRO EXISTE" || echo "REGISTRO NO EXISTE (se crea en Fase 5)"`

---

## Antes de empezar — lee esto

1. **Lee el archivo de plantillas** `game-integration.md` (en esta misma carpeta): trae el contrato del motor, el código completo del componente canvas, el snippet del registro y la plantilla de migración. Apóyate en él en cada fase de implementación.
2. **Este skill es spec-first.** No escribas código de juego hasta haber redactado y confirmado la especificación en la Fase 2.
3. **Este NO es el Next.js que conoces.** Antes de tocar cualquier cosa de App Router, consulta los docs empaquetados en `node_modules/next/dist/docs/01-app/`. No asumas convenciones de Next 13/14.
4. **Regla del proyecto:** usa `/frontend-design` para diseñar interfaz o arte de cover nuevo.
5. El motor de referencia canónico es `components/games/asteroids/engine.ts` + `components/games/asteroids/asteroids-canvas.tsx`. Cópialos como plantilla; no reinventes el contrato.

Sigue las fases **en orden** y **pausa después de cada fase** para que el usuario revise el diff. No avances si la fase anterior no quedó bien.

Tus respuestas van en el idioma del prompt inicial (por defecto, español).

---

## Fase 1 — Identificar el juego y sus metadatos

El argumento recibido es: `$ARGUMENTS`

1. **Resolver el origen:**
   - Si `$ARGUMENTS` corresponde a una carpeta de `references/started-games/` (ej. `03-tetris`, `04-arkanoid`), **lee su `game.js`, `README.md` y `CLAUDE.md`** para entender mecánica, controles, estado, HUD y condición de game over. Ahí está la lógica a portar.
   - Si es un juego nuevo (no hay carpeta), **pregunta la mecánica**: objetivo, controles, cómo se pierde/gana, qué muestra el HUD (score/vidas/nivel), si hay niveles.
   - Si `$ARGUMENTS` viene vacío, muestra los juegos de referencia disponibles (arriba) y pide al usuario que elija uno o describa uno nuevo. Detente hasta tener respuesta.

2. **Recolectar los campos de la fila `games`** (pregunta en bloques de 3–5, no asumas). Son las columnas de la tabla — mira `supabase/migrations/20260719000001_games.sql` para la forma exacta:
   - `id` (text, slug en minúsculas, ej. `tetris`) — será la URL `/games/<id>`.
   - `title` (mayúsculas, ej. `TETRIS`).
   - `short` (una frase para la tarjeta).
   - `long` (descripción para el detalle).
   - `cat`: uno de `ARCADE` | `PUZZLE` | `SHOOTER` | `VERSUS`.
   - `cover`: clase CSS de cover (ver Fase 6).
   - `color`: uno de `cyan` | `magenta` | `yellow` | `green`.
   - `best` (integer) y `plays` (text, ej. `"8.2K"`) — valores decorativos, como el resto del catálogo.
   - **Controles del juego**: qué teclas usa (para el `Set` de teclas capturadas del canvas).

3. Confirma con el usuario el resumen de metadatos antes de continuar.

---

## Fase 2 — Diseñar y crear la especificación

**Antes de escribir cualquier archivo de spec, lee la skill `/spec` y los specs existentes como referencia.** Esta fase produce el contrato que guía toda la implementación posterior.

1. **Lee la skill `/spec` (método spec-driven).** Búscala en este orden y usa la primera que exista (ver la detección en el contexto de sesión):
   1. `.claude/skills/spec/SKILL.md`
   2. `.agents/skills/spec/SKILL.md`
   3. **Fallback (bundle de referencia):** `references/started-games/04-arkanoid/.agents/skills/spec/SKILL.md` y su `template.md` (en la misma carpeta).

   Lee su `SKILL.md` (y `template.md` si existe) para seguir su método: fases de clarificación, estructura de secciones y reglas de redacción. **No dupliques su flujo de preguntas si ya recolectaste lo necesario en la Fase 1**, pero respeta su estructura de secciones y su tono.

2. **Lee los specs existentes como referencia de formato y numeración.** Lista `specs/` (arriba) y **lee los más recientes, en especial `04-asteroids-real.md`, `05-leaderboard-supabase.md` y `06-games-catalog-supabase.md`**: son el patrón exacto de "juego real + leaderboard + catálogo" que este spec debe reproducir. Copia de ahí el estilo de encabezado, las etiquetas en español (`**Estado:**`, `**Dependencias:**`, `**Fecha:**`, `## Objetivo`, `## Alcance`, `## Modelo de datos`, `## Plan de implementación`, `## Criterios de aceptación`, `## Decisiones tomadas y descartadas`, `## Riesgos identificados`) y el nivel de detalle.

3. **Determina el número secuencial** `NN` (el siguiente al último archivo de `specs/`) y un `slug` corto a partir del juego (ej. `07-tetris-real`).

4. **Redacta el spec** para este juego, siguiendo el método de `/spec` y el formato de los specs 04–06, poblándolo con los metadatos de la Fase 1 y el patrón de implementación de este skill:
   - **Objetivo** en una sola frase.
   - **Alcance** (incluido / explícitamente fuera de alcance).
   - **Modelo de datos**: la fila de `games`, el contrato `<Id>Engine`/`EngineSnapshot`, el componente canvas y la entrada en el registro. Aclara que `scores` no cambia (leaderboard ya genérico).
   - **Plan de implementación**: numerado, reflejando las Fases 3–8 de este skill (motor → canvas → registro → cover → migración Supabase → verificación).
   - **Criterios de aceptación**: checklist booleano y verificable.
   - **Decisiones** y **Riesgos** relevantes.

5. **Guarda el spec** en `specs/NN-slug.md`. Sigue lo que indique la skill `/spec` sobre el estado inicial (por defecto `Draft`/`Borrador`; **no** lo marques como `Aprobado` automáticamente — eso lo hace el usuario tras releerlo). Confirma con el usuario el nombre del archivo antes de escribirlo.

6. **Pausa.** Muestra al usuario el spec creado y su ruta. Pregúntale si quiere ajustarlo antes de pasar a implementación. No empieces a escribir código de juego hasta que confirme.

---

## Fase 3 — Portar/crear el motor

Crea `components/games/<id>/engine.ts` — motor **puro** (sin JSX, sin React), portando la lógica de `game.js` a clases TypeScript con tipos explícitos.

Respeta **exactamente** el contrato (ver esqueleto en `game-integration.md`):

```ts
export type EngineState = "playing" | "dead" | "gameover";
export interface EngineSnapshot { score: number; lives: number; level: number; state: EngineState; }

export class <Id>Engine {
  constructor(width: number, height: number);
  resize(width: number, height: number): void;
  update(dt: number): void;                 // avanza la simulación
  draw(ctx: CanvasRenderingContext2D): void; // dibuja campo + su propio HUD y overlay de game over
  setKey(code: string, down: boolean): void;
  forceGameOver(): void;                     // usado por el botón "FIN"
  getSnapshot(): EngineSnapshot;             // reenviado a React cada frame
}
```

Reglas al portar:

- Encapsula en propiedades de instancia lo que en `game.js` son variables globales (estado, entidades, score, vidas, nivel).
- **Dimensiones dinámicas**: usa el `width`/`height` reales del canvas, no constantes fijas (ej. no 800×600).
- El motor dibuja **su propio HUD y overlay de GAME OVER** dentro de `draw()`, igual que el original, **además** de exponer `getSnapshot()` para el HUD de React.
- **Sin reinicio por tecla** en game over: el reinicio lo dispara el modal "JUGAR DE NUEVO" de React remontando el canvas. No portes el listener de Space/Enter para reiniciar.
- Si el juego no tiene "vidas" o "nivel" en el sentido de Asteroids, mapea a algo coherente (ej. Tetris: `lives` puede ser fijo o representar algo; `level` es el nivel de velocidad). Deja `EngineSnapshot` completo de todas formas.

Pausa: el motor debe quedar completo y jugable en aislamiento (aunque aún no montado en la UI).

---

## Fase 4 — Componente canvas

Crea `components/games/<id>/<id>-canvas.tsx` (`"use client"`) a partir de la plantilla en `game-integration.md` (estructuralmente idéntica a `asteroids-canvas.tsx`):

- Props `{ paused, onSnapshot, forceEndRef }` (deben coincidir con `GameCanvasProps` del registro).
- Monta un `<canvas>` absoluto al 100%, mide con `clientWidth/clientHeight`, instancia `<Id>Engine`.
- `ResizeObserver` → `engine.resize`.
- Captura de teclado en `window` (`keydown`/`keyup` → `engine.setKey`); `preventDefault` sobre el `Set` de teclas del juego (ajústalo a los controles reales de este juego).
- Loop `requestAnimationFrame`: calcula `dt` (cap 0.05), `if (!paused) engine.update(dt)`, `engine.draw(ctx)`, `onSnapshot(engine.getSnapshot())` cada frame.
- `forceEndRef.current = () => engine.forceGameOver()`.
- Limpieza completa en el return del efecto.

---

## Fase 5 — Registrar el juego

El registro es lo que reemplaza el `if (game.id === "asteroids")` hardcodeado por un mapa `id → componente canvas`, para que agregar un juego **no vuelva a tocar `game-player.tsx`**.

**Si el registro NO existe todavía** (primera vez — ver contexto de sesión arriba), créalo y refactoriza `game-player.tsx` una sola vez:

1. Crea `components/games/registry.ts`:
   ```ts
   import type { ComponentType, RefObject } from "react";
   import type { EngineSnapshot } from "./asteroids/engine";
   import { AsteroidsCanvas } from "./asteroids/asteroids-canvas";

   export type { EngineSnapshot };

   export interface GameCanvasProps {
     paused: boolean;
     onSnapshot: (s: EngineSnapshot) => void;
     forceEndRef?: RefObject<(() => void) | null>;
   }

   // Cada juego real registra aquí su componente Canvas.
   // Un id ausente cae en la simulación falsa (`.game-arena`) de game-player.
   export const GAME_CANVASES: Record<
     string,
     ComponentType<GameCanvasProps>
   > = {
     asteroids: AsteroidsCanvas,
   };
   ```
2. En `components/game-player.tsx`:
   - Reemplaza el import de `AsteroidsCanvas`/`EngineSnapshot` por `import { GAME_CANVASES, type EngineSnapshot } from "@/components/games/registry";`.
   - Sustituye `const isAsteroids = game.id === "asteroids";` por `const Canvas = GAME_CANVASES[game.id]; const isReal = Boolean(Canvas);`.
   - Cambia todas las condiciones `isAsteroids` → `isReal` (los dos `useEffect` de la simulación falsa, `endGame`, `restart`).
   - En el render: `{isReal ? <Canvas key={restartKey} paused={paused} onSnapshot={handleSnapshot} forceEndRef={forceEndRef} /> : <div className="game-arena">…}`.
   - Verifica que Asteroids siga jugándose igual antes de continuar.

**Si el registro YA existe**, agrega solo una línea a `GAME_CANVASES`:

```ts
<id>: <Id>Canvas,
```

(con su import). No toques `game-player.tsx`.

El motor nuevo debe exponer un `EngineSnapshot` estructuralmente compatible (`{ score, lives, level, state }`).

---

## Fase 6 — Cover

`game.cover` es una clase CSS. Las clases viven en `app/globals.css` (base `.cover-bg` + `.cover-<name>` con `::after`/`::before`).

- **Reusa** una clase existente si encaja (ej. `cover-tetro` para Tetris, `cover-bricks` para Arkanoid). Lista rápida: mira los `.cover-*` en `app/globals.css`.
- **O crea** un `.cover-<name>` nuevo. Si diseñas arte nuevo, usa `/frontend-design`.

El valor elegido va en el campo `cover` de la fila `games` (Fase 7) y en `GameCard`/`MiniGameCard`/detalle no requiere cambios (ya leen `game.cover`).

---

## Fase 7 — Supabase (tabla `games`)

1. Crea `supabase/migrations/<timestamp>_<id>.sql` con **solo** un insert (sin cambios de esquema, sin tocar `scores`), con la forma de `20260719000001_games.sql`:
   ```sql
   insert into public.games (id, title, short, long, cat, cover, color, best, plays) values (
     '<id>', '<TITLE>', '<short>', '<long>', '<CAT>', '<cover>', '<color>', <best>, '<plays>'
   );
   ```
   Usa timestamp mayor al del último archivo en `supabase/migrations/`.
2. **Aplica la migración vía MCP de Supabase** con `mcp__supabase__apply_migration` (name = el nombre del archivo, query = el SQL). Antes, si hace falta, usa `mcp__supabase__list_tables` para confirmar el esquema.
3. Con la fila insertada, el juego aparece en catálogo/home/detalle/hall-of-fame y el leaderboard queda operativo automáticamente (`saveScore`/`getScoresForGame` ya lo manejan por `game.id`).

---

## Fase 8 — Verificación

1. Corre la app (`npm run dev`) y navega: `/`, `/games`, `/games/<id>`, `/games/<id>/play`, `/hall-of-fame`. Ninguna ruta rota.
2. `npx tsc --noEmit` sin errores.
3. Juega una partida: controles responden, HUD del canvas y HUD de React coinciden, PAUSA detiene de verdad, FIN termina con el score acumulado.
4. En el modal de fin, guarda la puntuación y confirma que aparece en el leaderboard de `/games/<id>` y `/hall-of-fame`.
5. "JUGAR DE NUEVO" reinicia limpio; los demás juegos falsos del catálogo siguen mostrando `.game-arena` sin cambios.
6. Repasa el spec de la Fase 2 y verifica sus **criterios de aceptación** uno por uno. Si el usuario lo confirma, sugiere actualizar el estado del spec a `Implementado`.

Al terminar, resume qué archivos se crearon/modificaron y recuerda al usuario revisar el diff antes de commitear.

---

## Reglas duras

- **Spec-first.** No escribas código de juego antes de crear y confirmar el spec de la Fase 2, redactado leyendo la skill `/spec` y los specs `04`–`06` como referencia.
- **Sigue el contrato del motor exactamente** (`constructor/resize/update/draw/setKey/forceGameOver/getSnapshot`). No inventes una API distinta.
- **Nunca reintroduzcas un `if (game.id === …)` por juego en `game-player.tsx`.** La selección de motor vive en el registro.
- **No toques** `lib/games.ts`, `lib/storage.ts`, `lib/supabase/*` ni las páginas `app/*`: ya son data-driven y funcionan para cualquier juego de la tabla.
- **Consulta los docs de Next.js 16** antes de cualquier cosa de App Router.
- **Una fase a la vez**, con pausa para revisar el diff. Si hay ambigüedad que el usuario no resolvió, detente y pregunta con 2–3 opciones concretas.
