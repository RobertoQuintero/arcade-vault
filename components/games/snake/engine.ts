// Motor puro de Snake, diseñado desde cero (sin game.js de referencia).

import { FRUIT_ATLAS, FRUIT_KEYS } from "./fruit-atlas";
import type { SkinName } from "@/components/games/skins";

export type { SkinName };

export const COLS = 20;
export const ROWS = 20;

const HUD_MARGIN = 90;
const INITIAL_TICK_INTERVAL = 140; // ms por paso de cuadrícula
const MIN_TICK_INTERVAL = 60;
const TICK_DECREASE_PER_LEVEL = 8;
const FRUITS_PER_LEVEL = 5;
const POINTS_PER_FRUIT = 10;

export interface Segment {
  x: number;
  y: number;
}

interface Fruit extends Segment {
  spriteKey: string;
}

interface Direction {
  x: number;
  y: number;
}

const DIRECTIONS: Record<string, Direction> = {
  ArrowUp: { x: 0, y: -1 },
  KeyW: { x: 0, y: -1 },
  ArrowDown: { x: 0, y: 1 },
  KeyS: { x: 0, y: 1 },
  ArrowLeft: { x: -1, y: 0 },
  KeyA: { x: -1, y: 0 },
  ArrowRight: { x: 1, y: 0 },
  KeyD: { x: 1, y: 0 },
};

const isOpposite = (a: Direction, b: Direction): boolean =>
  a.x === -b.x && a.y === -b.y;

// ── Skins ────────────────────────────────────────────────────────────────────
interface Skin {
  background: string;
  grid: string;
  snake: string;
  fruitFallback: string;
  hudText: string;
  hudTextDim: string;
  overlayTitle: string;
  overlaySubtitle: string;
  glow: boolean;
  glowBlur: number;
}

const SKINS: Record<SkinName, Skin> = {
  clasico: {
    background: "#000000",
    grid: "rgba(255,255,255,0.08)",
    snake: "#7ee787",
    fruitFallback: "#ff5252",
    hudText: "#ffffff",
    hudTextDim: "rgba(255,255,255,0.65)",
    overlayTitle: "#ffffff",
    overlaySubtitle: "rgba(255,255,255,0.65)",
    glow: false,
    glowBlur: 0,
  },
  neon: {
    background: "#05050a",
    grid: "rgba(0, 245, 255, 0.06)",
    snake: "#00ff88",
    fruitFallback: "#ff006e",
    hudText: "#00f5ff",
    hudTextDim: "rgba(0, 245, 255, 0.6)",
    overlayTitle: "#ff006e",
    overlaySubtitle: "#00f5ff",
    glow: true,
    glowBlur: 12,
  },
  retro: {
    background: "#0b0f0a",
    grid: "rgba(51, 255, 51, 0.12)",
    snake: "#33ff33",
    fruitFallback: "#ffb000",
    hudText: "#33ff33",
    hudTextDim: "rgba(51, 255, 51, 0.7)",
    overlayTitle: "#33ff33",
    overlaySubtitle: "rgba(51, 255, 51, 0.75)",
    glow: false,
    glowBlur: 0,
  },
};

// ── Motor del juego ──────────────────────────────────────────────────────────
export type EngineState = "playing" | "dead" | "gameover";

export interface EngineSnapshot {
  score: number;
  lives: number;
  level: number;
  state: EngineState;
}

export class SnakeEngine {
  private width: number;
  private height: number;
  private cellSize = 1;
  private boardWidth = 0;
  private boardHeight = 0;
  private offsetX = 0;
  private offsetY = HUD_MARGIN;

  private segments: Segment[] = [];
  private direction: Direction = { x: 1, y: 0 };
  private pendingDirection: Direction | null = null;
  private growPending = 0;
  private tickInterval = INITIAL_TICK_INTERVAL;
  private tickAccum = 0;
  private state: EngineState = "playing";
  private keys: Record<string, boolean> = {};
  private justPressed: Record<string, boolean> = {};
  private fruit: Fruit | null = null;
  private fruitImage: HTMLImageElement | null = null;
  private score = 0;
  private fruitsEaten = 0;
  private level = 1;
  private skin: Skin = SKINS.clasico;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.initGame();
    this.recalcLayout();
  }

  setFruitImage(img: HTMLImageElement): void {
    this.fruitImage = img;
  }

  setSkin(name: SkinName): void {
    this.skin = SKINS[name];
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.recalcLayout();
  }

  setKey(code: string, down: boolean): void {
    if (down && !this.keys[code]) this.justPressed[code] = true;
    this.keys[code] = down;
  }

  forceGameOver(): void {
    this.state = "gameover";
  }

  getSnapshot(): EngineSnapshot {
    return {
      score: this.score,
      lives: this.state === "playing" ? 1 : 0,
      level: this.level,
      state: this.state,
    };
  }

  private recalcLayout(): void {
    this.cellSize = Math.max(
      1,
      Math.floor(
        Math.min(this.width / COLS, (this.height - HUD_MARGIN) / ROWS),
      ),
    );
    this.boardWidth = COLS * this.cellSize;
    this.boardHeight = ROWS * this.cellSize;
    this.offsetX = Math.floor((this.width - this.boardWidth) / 2);
    this.offsetY = HUD_MARGIN;
  }

  private consumePressed(code: string): boolean {
    const val = !!this.justPressed[code];
    this.justPressed[code] = false;
    return val;
  }

  private initGame(): void {
    const startX = Math.floor(COLS / 2);
    const startY = Math.floor(ROWS / 2);
    this.segments = [
      { x: startX, y: startY },
      { x: startX - 1, y: startY },
      { x: startX - 2, y: startY },
    ];
    this.direction = { x: 1, y: 0 };
    this.pendingDirection = null;
    this.growPending = 0;
    this.tickInterval = INITIAL_TICK_INTERVAL;
    this.tickAccum = 0;
    this.state = "playing";
    this.score = 0;
    this.fruitsEaten = 0;
    this.level = 1;
    this.fruit = null;
    this.spawnFruit();
  }

  private spawnFruit(): void {
    const freeCells: Segment[] = [];
    for (let x = 0; x < COLS; x++) {
      for (let y = 0; y < ROWS; y++) {
        if (!this.segments.some((s) => s.x === x && s.y === y)) {
          freeCells.push({ x, y });
        }
      }
    }
    if (freeCells.length === 0) return;
    const cell = freeCells[Math.floor(Math.random() * freeCells.length)];
    const spriteKey = FRUIT_KEYS[Math.floor(Math.random() * FRUIT_KEYS.length)];
    this.fruit = { x: cell.x, y: cell.y, spriteKey };
  }

  private readDirectionInput(): void {
    for (const code of Object.keys(DIRECTIONS)) {
      if (!this.consumePressed(code)) continue;
      const candidate = DIRECTIONS[code];
      if (!isOpposite(candidate, this.direction)) {
        this.pendingDirection = candidate;
      }
    }
  }

  private step(): void {
    if (this.pendingDirection) {
      this.direction = this.pendingDirection;
      this.pendingDirection = null;
    }

    const head = this.segments[0];
    const newHead: Segment = {
      x: head.x + this.direction.x,
      y: head.y + this.direction.y,
    };

    if (
      newHead.x < 0 ||
      newHead.x >= COLS ||
      newHead.y < 0 ||
      newHead.y >= ROWS
    ) {
      this.state = "gameover";
      return;
    }

    const willGrow = this.growPending > 0;
    const bodyToCheck = willGrow
      ? this.segments
      : this.segments.slice(0, this.segments.length - 1);
    if (bodyToCheck.some((s) => s.x === newHead.x && s.y === newHead.y)) {
      this.state = "gameover";
      return;
    }

    this.segments.unshift(newHead);
    if (willGrow) {
      this.growPending--;
    } else {
      this.segments.pop();
    }

    if (
      this.fruit &&
      newHead.x === this.fruit.x &&
      newHead.y === this.fruit.y
    ) {
      this.growPending++;
      this.score += POINTS_PER_FRUIT * this.level;
      this.fruitsEaten++;
      this.level = Math.floor(this.fruitsEaten / FRUITS_PER_LEVEL) + 1;
      this.tickInterval = Math.max(
        MIN_TICK_INTERVAL,
        INITIAL_TICK_INTERVAL - (this.level - 1) * TICK_DECREASE_PER_LEVEL,
      );
      this.spawnFruit();
    }
  }

  update(dt: number): void {
    if (this.state !== "playing") return;

    this.readDirectionInput();

    this.tickAccum += dt * 1000;
    while (this.tickAccum >= this.tickInterval && this.state === "playing") {
      this.tickAccum -= this.tickInterval;
      this.step();
    }
  }

  private drawGrid(ctx: CanvasRenderingContext2D): void {
    ctx.strokeStyle = this.skin.grid;
    ctx.lineWidth = 0.5;
    for (let c = 1; c < COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(c * this.cellSize, 0);
      ctx.lineTo(c * this.cellSize, this.boardHeight);
      ctx.stroke();
    }
    for (let r = 1; r < ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * this.cellSize);
      ctx.lineTo(this.boardWidth, r * this.cellSize);
      ctx.stroke();
    }
  }

  private drawSnake(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = this.skin.snake;
    if (this.skin.glow) {
      ctx.shadowBlur = this.skin.glowBlur;
      ctx.shadowColor = this.skin.snake;
    }
    this.segments.forEach((s) => {
      ctx.fillRect(
        s.x * this.cellSize + 1,
        s.y * this.cellSize + 1,
        this.cellSize - 2,
        this.cellSize - 2,
      );
    });
    ctx.shadowBlur = 0;
  }

  private drawFruit(ctx: CanvasRenderingContext2D): void {
    if (!this.fruit) return;
    const cx = this.fruit.x * this.cellSize + this.cellSize / 2;
    const cy = this.fruit.y * this.cellSize + this.cellSize / 2;

    const sprite = FRUIT_ATLAS[this.fruit.spriteKey];
    if (this.fruitImage && sprite) {
      const scale = Math.min(
        (this.cellSize * 1.4) / sprite.w,
        (this.cellSize * 1.4) / sprite.h,
      );
      const dw = sprite.w * scale;
      const dh = sprite.h * scale;
      ctx.drawImage(
        this.fruitImage,
        sprite.x,
        sprite.y,
        sprite.w,
        sprite.h,
        cx - dw / 2,
        cy - dh / 2,
        dw,
        dh,
      );
    } else {
      ctx.fillStyle = this.skin.fruitFallback;
      if (this.skin.glow) {
        ctx.shadowBlur = this.skin.glowBlur;
        ctx.shadowColor = this.skin.fruitFallback;
      }
      const r = this.cellSize * 0.4;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.shadowBlur = 0;
    }
  }

  private drawHUD(ctx: CanvasRenderingContext2D): void {
    ctx.textAlign = "left";
    ctx.fillStyle = this.skin.hudText;
    ctx.font = "bold 15px monospace";
    ctx.fillText(`SCORE ${this.score.toLocaleString()}`, this.offsetX, 22);
    ctx.fillText(`LARGO ${this.segments.length}`, this.offsetX, 42);
    ctx.fillText(`NIVEL ${this.level}`, this.offsetX, 62);
  }

  private drawOverlay(ctx: CanvasRenderingContext2D): void {
    ctx.textAlign = "center";
    ctx.fillStyle = this.skin.overlayTitle;
    ctx.font = "bold 46px monospace";
    ctx.fillText("GAME OVER", this.width / 2, this.height / 2 - 18);
    ctx.font = "18px monospace";
    ctx.fillStyle = this.skin.overlaySubtitle;
    ctx.fillText(
      `PUNTUACIÓN: ${this.score.toLocaleString()}`,
      this.width / 2,
      this.height / 2 + 22,
    );
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = this.skin.background;
    ctx.fillRect(0, 0, this.width, this.height);

    this.drawHUD(ctx);

    ctx.save();
    ctx.translate(this.offsetX, this.offsetY);
    this.drawGrid(ctx);
    this.drawFruit(ctx);
    this.drawSnake(ctx);
    ctx.restore();

    if (this.state === "gameover") {
      this.drawOverlay(ctx);
    }
  }
}
