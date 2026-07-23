// Motor puro de Arkanoid, portado de references/started-games/04-arkanoid/game.js y levels.js

import type { SkinName } from "@/components/games/skins";

export type { SkinName };

export interface LevelBlock {
  col: number;
  row: number;
  color: string;
}

export interface Level {
  speed: number;
  blocks: LevelBlock[];
}

export const BLOCK_COLS = 10;
export const BLOCK_ROWS = 6;

const rowColors1 = ["red", "yellow", "cyan", "magenta", "hotpink", "green"];
const rowColors2 = ["gray", "cyan", "hotpink", "yellow", "magenta", "green"];
const rowColors4 = ["cyan", "magenta", "green", "yellow", "hotpink", "red"];

function buildLevels(): Level[] {
  const l1: LevelBlock[] = [];
  for (let row = 0; row < 6; row++)
    for (let col = 0; col < 10; col++)
      l1.push({ col, row, color: rowColors1[row] });

  const l2: LevelBlock[] = [];
  const pyStart = [4, 3, 2, 1, 0, 0];
  const pyEnd = [5, 6, 7, 8, 9, 9];
  for (let row = 0; row < 6; row++)
    for (let col = pyStart[row]; col <= pyEnd[row]; col++)
      l2.push({ col, row, color: rowColors2[row] });

  const l3: LevelBlock[] = [];
  for (let row = 0; row < 6; row++)
    for (let col = 0; col < 10; col++)
      if ((col + row) % 2 === 0)
        l3.push({ col, row, color: row < 3 ? "yellow" : "magenta" });

  const gaps4 = [
    [2, 5, 8],
    [0, 4, 7, 9],
    [1, 3, 6],
    [2, 5, 8, 9],
    [0, 4, 7],
    [1, 3, 6, 9],
  ];
  const l4: LevelBlock[] = [];
  for (let row = 0; row < 6; row++)
    for (let col = 0; col < 10; col++)
      if (!gaps4[row].includes(col))
        l4.push({ col, row, color: rowColors4[row] });

  const l5: LevelBlock[] = [];
  for (let row = 0; row < 6; row++)
    for (let col = 0; col < 10; col++) {
      const isFrame = col === 0 || col === 9 || row === 0 || row === 5;
      const isCross = col === 4 || row === 2;
      if (isFrame || isCross)
        l5.push({ col, row, color: isCross && !isFrame ? "hotpink" : "cyan" });
    }

  return [
    { speed: 1.0, blocks: l1 },
    { speed: 1.1, blocks: l2 },
    { speed: 1.21, blocks: l3 },
    { speed: 1.33, blocks: l4 },
    { speed: 1.46, blocks: l5 },
  ];
}

export const LEVELS: Level[] = buildLevels();

export const BLOCK_COLOR_HEX: Record<string, string> = {
  red: "#e63946",
  yellow: "#f0c040",
  cyan: "#22d3ee",
  magenta: "#d946ef",
  hotpink: "#ec4899",
  green: "#4ade80",
  gray: "#9ca3af",
};

// ── Skins ────────────────────────────────────────────────────────────────────
interface Glow {
  blur: number;
  color: string;
}

interface Skin {
  background: string;
  blockColors: Record<string, string>;
  paddleColor: string;
  paddleGlow: Glow | null;
  ballColor: string;
  ballGlow: Glow | null;
  hudTextColor: string;
  overlayBg: string;
  overlayTextColor: string;
}

const SKINS: Record<SkinName, Skin> = {
  clasico: {
    background: "#000000",
    blockColors: BLOCK_COLOR_HEX,
    paddleColor: "#ffffff",
    paddleGlow: null,
    ballColor: "#ffffff",
    ballGlow: null,
    hudTextColor: "#ffffff",
    overlayBg: "rgba(0, 0, 0, 0.6)",
    overlayTextColor: "#ffffff",
  },
  neon: {
    background: "#05050a",
    blockColors: {
      red: "#ff2d6a",
      yellow: "#f5ff00",
      cyan: "#00f5ff",
      magenta: "#ff006e",
      hotpink: "#ff5fd8",
      green: "#00ff88",
      gray: "#7dd3fc",
    },
    paddleColor: "#00f5ff",
    paddleGlow: { blur: 16, color: "#00f5ff" },
    ballColor: "#f5ff00",
    ballGlow: { blur: 12, color: "#f5ff00" },
    hudTextColor: "#e6e9ff",
    overlayBg: "rgba(5, 5, 10, 0.75)",
    overlayTextColor: "#ff006e",
  },
  retro: {
    background: "#0b1a0f",
    blockColors: {
      red: "#33ff66",
      yellow: "#22cc4d",
      cyan: "#1a9938",
      magenta: "#33ff66",
      hotpink: "#22cc4d",
      green: "#66ff99",
      gray: "#1a7a3d",
    },
    paddleColor: "#33ff66",
    paddleGlow: null,
    ballColor: "#66ff99",
    ballGlow: null,
    hudTextColor: "#33ff66",
    overlayBg: "rgba(11, 26, 15, 0.85)",
    overlayTextColor: "#66ff99",
  },
};

// ── Motor del juego ──────────────────────────────────────────────────────────
export type EngineState = "playing" | "dead" | "gameover";

export type SoundEvent = "paddle-hit" | "block-break";

export interface EngineSnapshot {
  score: number;
  lives: number;
  level: number;
  state: EngineState;
  sounds: SoundEvent[];
}

interface Block {
  x: number;
  y: number;
  w: number;
  h: number;
  color: string;
  alive: boolean;
}

interface Paddle {
  x: number;
  y: number;
  w: number;
  h: number;
}

interface Ball {
  x: number;
  y: number;
  w: number;
  h: number;
  vx: number;
  vy: number;
}

const BASE_BALL_VX = 200;
const BASE_BALL_VY = -300;
const PADDLE_SPEED = 400;

export class ArkanoidEngine {
  private width: number;
  private height: number;

  private paddle: Paddle;
  private ball: Ball;
  private blocks: Block[] = [];

  private blockW = 0;
  private blockH = 0;
  private blocksOriginX = 0;
  private blocksOriginY = 0;

  private score = 0;
  private lives = 3;
  private level = 1;
  private state: EngineState = "playing";
  private won = false;

  private keys: Record<string, boolean> = {};
  private soundEvents: SoundEvent[] = [];
  private skin: Skin = SKINS.clasico;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.paddle = { x: 0, y: 0, w: 0, h: 0 };
    this.ball = { x: 0, y: 0, w: 0, h: 0, vx: 0, vy: 0 };
    this.computeSizes();
    this.initGame();
  }

  private computeSizes(): void {
    this.blockW = this.width / BLOCK_COLS;
    this.blockH = this.height * 0.04;
    this.blocksOriginX = 0;
    this.blocksOriginY = this.height * 0.13;
    this.paddle.w = this.width * 0.1;
    this.paddle.h = this.height * 0.023;
    this.paddle.y = this.height * 0.933;
    this.ball.w = this.width * 0.02;
    this.ball.h = this.ball.w;
  }

  resize(width: number, height: number): void {
    this.width = width;
    this.height = height;
    this.computeSizes();
    this.paddle.x = Math.min(
      Math.max(this.paddle.x, 0),
      this.width - this.paddle.w,
    );
    this.layoutLevel(this.level);
  }

  setKey(code: string, down: boolean): void {
    this.keys[code] = down;
  }

  setSkin(name: SkinName): void {
    this.skin = SKINS[name];
  }

  setPaddleX(clientFraction: number): void {
    if (this.state !== "playing") return;
    const px = clientFraction * this.width - this.paddle.w / 2;
    this.paddle.x = Math.max(0, Math.min(this.width - this.paddle.w, px));
  }

  forceGameOver(): void {
    this.state = "gameover";
  }

  getSnapshot(): EngineSnapshot {
    const sounds = this.soundEvents;
    this.soundEvents = [];
    return {
      score: this.score,
      lives: this.lives,
      level: this.level,
      state: this.state,
      sounds,
    };
  }

  private initPaddle(): void {
    this.paddle.x = (this.width - this.paddle.w) / 2;
  }

  private initBall(): void {
    const speed = LEVELS[this.level - 1].speed;
    this.ball.x = this.paddle.x + (this.paddle.w - this.ball.w) / 2;
    this.ball.y = this.paddle.y - this.ball.h;
    this.ball.vx = BASE_BALL_VX * speed;
    this.ball.vy = BASE_BALL_VY * speed;
  }

  private layoutLevel(n: number): void {
    const levelDef = LEVELS[n - 1];
    this.blocks = levelDef.blocks.map((b) => ({
      x: this.blocksOriginX + b.col * this.blockW,
      y: this.blocksOriginY + b.row * this.blockH,
      w: this.blockW,
      h: this.blockH,
      color: b.color,
      alive: true,
    }));
  }

  private loadLevel(n: number): void {
    this.level = n;
    this.layoutLevel(n);
    this.initBall();
  }

  private initGame(): void {
    this.score = 0;
    this.lives = 3;
    this.state = "playing";
    this.won = false;
    this.initPaddle();
    this.loadLevel(1);
  }

  private collideAABB(block: Block): boolean {
    const b = this.ball;
    return (
      b.x < block.x + block.w &&
      b.x + b.w > block.x &&
      b.y < block.y + block.h &&
      b.y + b.h > block.y
    );
  }

  update(dt: number): void {
    if (this.state !== "playing") return;

    const paddle = this.paddle;
    const ball = this.ball;

    if (this.keys["ArrowLeft"])
      paddle.x = Math.max(0, paddle.x - PADDLE_SPEED * dt);
    if (this.keys["ArrowRight"])
      paddle.x = Math.min(this.width - paddle.w, paddle.x + PADDLE_SPEED * dt);

    ball.x += ball.vx * dt;
    ball.y += ball.vy * dt;

    if (ball.x <= 0) {
      ball.x = 0;
      ball.vx = Math.abs(ball.vx);
    }
    if (ball.x + ball.w >= this.width) {
      ball.x = this.width - ball.w;
      ball.vx = -Math.abs(ball.vx);
    }
    if (ball.y <= 0) {
      ball.y = 0;
      ball.vy = Math.abs(ball.vy);
    }

    if (
      ball.vy > 0 &&
      ball.x + ball.w > paddle.x &&
      ball.x < paddle.x + paddle.w &&
      ball.y + ball.h >= paddle.y &&
      ball.y + ball.h <= paddle.y + paddle.h + 8
    ) {
      ball.y = paddle.y - ball.h;
      ball.vy = -Math.abs(ball.vy);
      this.soundEvents.push("paddle-hit");
    }

    for (const block of this.blocks) {
      if (!block.alive) continue;
      if (this.collideAABB(block)) {
        block.alive = false;
        this.score += 10;
        ball.vy = -ball.vy;
        this.soundEvents.push("block-break");
        if (this.blocks.every((b) => !b.alive)) {
          if (this.level < 5) {
            this.loadLevel(this.level + 1);
          } else {
            this.won = true;
            this.state = "gameover";
          }
        }
        break;
      }
    }

    if (ball.y > this.height) {
      this.lives--;
      if (this.lives <= 0) {
        this.lives = 0;
        this.state = "gameover";
      } else {
        this.initBall();
      }
    }
  }

  private drawOverlay(ctx: CanvasRenderingContext2D, message: string): void {
    ctx.fillStyle = this.skin.overlayBg;
    ctx.fillRect(0, 0, this.width, this.height);
    ctx.fillStyle = this.skin.overlayTextColor;
    ctx.font = `bold ${Math.round(this.width * 0.06)}px monospace`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(message, this.width / 2, this.height / 2);
  }

  private drawHUD(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = this.skin.hudTextColor;
    ctx.font = "bold 16px monospace";
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillText(`Score: ${this.score}`, 10, 10);
    ctx.textAlign = "center";
    ctx.fillText(`Nivel: ${this.level}`, this.width / 2, 10);

    const ballSize = 14;
    const ballSpacing = 4;
    ctx.fillStyle = this.skin.hudTextColor;
    for (let i = 0; i < this.lives; i++) {
      const bx = this.width - 10 - (this.lives - i) * (ballSize + ballSpacing);
      ctx.beginPath();
      ctx.arc(
        bx + ballSize / 2,
        10 + ballSize / 2,
        ballSize / 2,
        0,
        Math.PI * 2,
      );
      ctx.fill();
    }
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = this.skin.background;
    ctx.fillRect(0, 0, this.width, this.height);

    for (const block of this.blocks) {
      if (!block.alive) continue;
      ctx.fillStyle = this.skin.blockColors[block.color] ?? "#fff";
      ctx.fillRect(block.x, block.y, block.w - 2, block.h - 2);
    }

    ctx.fillStyle = this.skin.paddleColor;
    if (this.skin.paddleGlow) {
      ctx.shadowBlur = this.skin.paddleGlow.blur;
      ctx.shadowColor = this.skin.paddleGlow.color;
    }
    ctx.fillRect(this.paddle.x, this.paddle.y, this.paddle.w, this.paddle.h);
    ctx.shadowBlur = 0;

    ctx.fillStyle = this.skin.ballColor;
    if (this.skin.ballGlow) {
      ctx.shadowBlur = this.skin.ballGlow.blur;
      ctx.shadowColor = this.skin.ballGlow.color;
    }
    ctx.beginPath();
    ctx.arc(
      this.ball.x + this.ball.w / 2,
      this.ball.y + this.ball.h / 2,
      this.ball.w / 2,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.shadowBlur = 0;

    if (this.state === "playing") this.drawHUD(ctx);

    if (this.state === "gameover") {
      this.drawOverlay(ctx, this.won ? "¡Completaste el juego!" : "GAME OVER");
    }
  }
}
