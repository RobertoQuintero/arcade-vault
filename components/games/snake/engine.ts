// Motor puro de Snake, diseñado desde cero (sin game.js de referencia).

export const COLS = 20;
export const ROWS = 20;

const HUD_MARGIN = 90;
const INITIAL_TICK_INTERVAL = 140; // ms por paso de cuadrícula

export interface Segment {
  x: number;
  y: number;
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

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.initGame();
    this.recalcLayout();
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
      score: 0,
      lives: this.state === "playing" ? 1 : 0,
      level: 1,
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
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
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
    ctx.fillStyle = "#7ee787";
    this.segments.forEach((s) => {
      ctx.fillRect(
        s.x * this.cellSize + 1,
        s.y * this.cellSize + 1,
        this.cellSize - 2,
        this.cellSize - 2,
      );
    });
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, this.width, this.height);

    ctx.save();
    ctx.translate(this.offsetX, this.offsetY);
    this.drawGrid(ctx);
    this.drawSnake(ctx);
    ctx.restore();
  }
}
