# Plantillas de integración de un juego

Referencia copiable para `/game-impl`. El patrón canónico son
`components/games/asteroids/engine.ts` y
`components/games/asteroids/asteroids-canvas.tsx` — cuando dudes, míralos.

Reemplaza `<id>` por el slug del juego (ej. `tetris`) y `<Id>` por su forma
capitalizada (ej. `Tetris`).

---

## 1. Contrato del motor — `components/games/<id>/engine.ts`

Motor **puro**: sin `import` de React, sin JSX. Todo el estado del juego vive
como propiedades de instancia (en `game.js` eran variables globales).

```ts
// Motor puro de <Id>, portado de references/started-games/<carpeta>/game.js

export type EngineState = "playing" | "dead" | "gameover";

export interface EngineSnapshot {
  score: number;
  lives: number;
  level: number;
  state: EngineState;
}

export class <Id>Engine {
  private width: number;
  private height: number;
  private score = 0;
  private lives = 3;
  private level = 1;
  private state: EngineState = "playing";
  // ...entidades del juego (paddle, piezas, bolas, etc.) como propiedades...

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.init();
  }

  private init(): void {
    // spawnea el estado inicial usando this.width / this.height
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    // reposiciona lo que dependa del tamaño, si aplica
  }

  setKey(code: string, down: boolean): void {
    // guarda el estado de teclas (ej. this.keys[code] = down)
  }

  forceGameOver(): void {
    this.state = "gameover";
  }

  getSnapshot(): EngineSnapshot {
    return {
      score: this.score,
      lives: this.lives,
      level: this.level,
      state: this.state,
    };
  }

  update(dt: number): void {
    if (this.state === "gameover") return;
    // avanza física, colisiones, spawns, nivel, pérdida de vida, game over...
    // usa dt (segundos) para movimiento independiente de framerate
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.clearRect(0, 0, this.width, this.height);
    // dibuja el campo de juego...
    this.drawHUD(ctx);
    if (this.state === "gameover") this.drawOverlay(ctx);
  }

  private drawHUD(ctx: CanvasRenderingContext2D): void {
    // score, nivel, iconos de vidas, indicadores — como en game.js
  }

  private drawOverlay(ctx: CanvasRenderingContext2D): void {
    // "GAME OVER" propio del canvas. NO reinicia por tecla — lo hace React.
  }
}
```

Notas de portado:

- **Dimensiones dinámicas**: nunca constantes fijas de canvas; usa
  `this.width`/`this.height`.
- **Sin reinicio por Space/Enter** en `gameover`: el reinicio lo dispara el
  botón "JUGAR DE NUEVO" del modal de React remontando el canvas.
- Mapea `lives`/`level` a algo coherente con el juego aunque no sean literales
  (ej. en Tetris `level` = velocidad). `EngineSnapshot` siempre completo.
- Si el juego usa asteroides que se dividen, partículas, power-ups, etc.,
  pórtalos como clases separadas (`Bullet`, `Asteroid`, `Particle`, `PowerUp`)
  igual que en `asteroids/engine.ts`.

---

## 2. Componente canvas — `components/games/<id>/<id>-canvas.tsx`

Plantilla; sólo cambian el motor importado y el `Set` de teclas capturadas.

```tsx
"use client";

import { useEffect, useRef } from "react";
import { <Id>Engine, type EngineSnapshot } from "./engine";
import type { GameCanvasProps } from "../registry";

// Ajusta a los controles reales de ESTE juego:
const CAPTURED_KEYS = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "Space",
]);

export function <Id>Canvas({ paused, onSnapshot, forceEndRef }: GameCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pausedRef = useRef(paused);
  const onSnapshotRef = useRef(onSnapshot);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    onSnapshotRef.current = onSnapshot;
  }, [onSnapshot]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.clientWidth || 800;
    const height = canvas.clientHeight || 600;
    canvas.width = width;
    canvas.height = height;
    const engine = new <Id>Engine(width, height);

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width: w, height: h } = entry.contentRect;
      if (w <= 0 || h <= 0) return;
      canvas.width = w;
      canvas.height = h;
      engine.resize(w, h);
    });
    resizeObserver.observe(canvas);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (CAPTURED_KEYS.has(e.code)) e.preventDefault();
      engine.setKey(e.code, true);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      engine.setKey(e.code, false);
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    if (forceEndRef) forceEndRef.current = () => engine.forceGameOver();

    let lastTime: number | null = null;
    let raf = 0;

    const loop = (ts: number) => {
      const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
      lastTime = ts;
      if (!pausedRef.current) engine.update(dt);
      engine.draw(ctx);
      onSnapshotRef.current(engine.getSnapshot());
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      if (forceEndRef) forceEndRef.current = null;
    };
  }, [forceEndRef]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        display: "block",
      }}
    />
  );
}

export type { EngineSnapshot };
```

---

## 3. Registro — `components/games/registry.ts`

Se crea la primera vez (junto al refactor de `game-player.tsx`, ver la fase
"Registrar el juego" del SKILL). Después, cada juego nuevo agrega una línea:

```ts
import { <Id>Canvas } from "./<id>/<id>-canvas";

export const GAME_CANVASES: Record<string, ComponentType<GameCanvasProps>> = {
  asteroids: AsteroidsCanvas,
  <id>: <Id>Canvas, // ← línea nueva
};
```

---

## 4. Migración de Supabase — `supabase/migrations/<timestamp>_<id>.sql`

Solo un insert; sin cambios de esquema, sin tocar `scores`.

```sql
insert into public.games (id, title, short, long, cat, cover, color, best, plays) values (
  '<id>',
  '<TITLE>',
  '<short — una frase>',
  '<long — descripción del detalle>',
  '<ARCADE | PUZZLE | SHOOTER | VERSUS>',
  '<cover-clase-css>',
  '<cyan | magenta | yellow | green>',
  <best-integer>,
  '<plays-texto, ej. 8.2K>'
);
```

Aplícala con `mcp__supabase__apply_migration`. El leaderboard (tabla `scores`)
no necesita nada: `saveScore({ game: "<id>", ... })` y
`getScoresForGame("<id>")` ya funcionan por el `game.id`.
