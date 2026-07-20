// Motor puro de Tetris, portado de references/started-games/03-tetris/game.js

export const COLS = 10;
export const ROWS = 20;

export const COLORS: (string | null)[] = [
  null,
  "#4dd0e1", // I - cyan
  "#ffd54f", // O - yellow
  "#ba68c8", // T - purple
  "#81c784", // S - green
  "#e57373", // Z - red
  "#90caf9", // J - pale blue
  "#ffb74d", // L - orange
];

export const PIECES: number[][][] = [
  [],
  [
    [0, 0, 0, 0],
    [1, 1, 1, 1],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ], // I
  [
    [2, 2],
    [2, 2],
  ], // O
  [
    [0, 3, 0],
    [3, 3, 3],
    [0, 0, 0],
  ], // T
  [
    [0, 4, 4],
    [4, 4, 0],
    [0, 0, 0],
  ], // S
  [
    [5, 5, 0],
    [0, 5, 5],
    [0, 0, 0],
  ], // Z
  [
    [6, 0, 0],
    [6, 6, 6],
    [0, 0, 0],
  ], // J
  [
    [0, 0, 7],
    [7, 7, 7],
    [0, 0, 0],
  ], // L
];

export const LINE_SCORES = [0, 100, 300, 500, 800];

export type Board = number[][];

export interface Piece {
  type: number;
  shape: number[][];
  x: number;
  y: number;
}

export function createBoard(): Board {
  return Array.from({ length: ROWS }, () => new Array(COLS).fill(0));
}

export function randomPiece(): Piece {
  const type = Math.floor(Math.random() * 7) + 1;
  const shape = PIECES[type].map((row) => [...row]);
  return {
    type,
    shape,
    x: Math.floor(COLS / 2) - Math.floor(shape[0].length / 2),
    y: 0,
  };
}

export function collide(
  board: Board,
  shape: number[][],
  ox: number,
  oy: number,
): boolean {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const nx = ox + c;
      const ny = oy + r;
      if (nx < 0 || nx >= COLS || ny >= ROWS) return true;
      if (ny >= 0 && board[ny][nx]) return true;
    }
  }
  return false;
}

export function rotateCW(shape: number[][]): number[][] {
  const rows = shape.length;
  const cols = shape[0].length;
  const result: number[][] = Array.from({ length: cols }, () =>
    new Array(rows).fill(0),
  );
  for (let r = 0; r < rows; r++)
    for (let c = 0; c < cols; c++) result[c][rows - 1 - r] = shape[r][c];
  return result;
}

export function tryRotate(board: Board, piece: Piece): Piece {
  const rotated = rotateCW(piece.shape);
  const kicks = [0, -1, 1, -2, 2];
  for (const kick of kicks) {
    if (!collide(board, rotated, piece.x + kick, piece.y)) {
      return { ...piece, shape: rotated, x: piece.x + kick };
    }
  }
  return piece;
}

export function merge(board: Board, piece: Piece): void {
  for (let r = 0; r < piece.shape.length; r++)
    for (let c = 0; c < piece.shape[r].length; c++)
      if (piece.shape[r][c])
        board[piece.y + r][piece.x + c] = piece.shape[r][c];
}

export function clearLines(board: Board): number {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every((v) => v !== 0)) {
      board.splice(r, 1);
      board.unshift(new Array(COLS).fill(0));
      cleared++;
      r++;
    }
  }
  return cleared;
}

export function ghostY(board: Board, piece: Piece): number {
  let gy = piece.y;
  while (!collide(board, piece.shape, piece.x, gy + 1)) gy++;
  return gy;
}

// ── Motor del juego ──────────────────────────────────────────────────────────
export type EngineState = "playing" | "dead" | "gameover";

export interface EngineSnapshot {
  score: number;
  lives: number;
  level: number;
  state: EngineState;
}

const HUD_MARGIN = 90;
const PREVIEW_BLOCK = 14;
const MOVE_KEYS = [
  "ArrowLeft",
  "ArrowRight",
  "ArrowDown",
  "ArrowUp",
  "KeyX",
  "Space",
];

export class TetrisEngine {
  private width: number;
  private height: number;
  private blockSize = 1;
  private boardWidth = 0;
  private boardHeight = 0;
  private offsetX = 0;
  private offsetY = HUD_MARGIN;

  private board: Board = createBoard();
  private current: Piece;
  private next: Piece;
  private score = 0;
  private lines = 0;
  private level = 1;
  private dropInterval = 1000;
  private dropAccum = 0;
  private state: EngineState = "playing";
  private keys: Record<string, boolean> = {};
  private justPressed: Record<string, boolean> = {};

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.next = randomPiece();
    this.current = randomPiece();
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
      score: this.score,
      lives: this.state === "playing" ? 1 : 0,
      level: this.level,
      state: this.state,
    };
  }

  private recalcLayout(): void {
    this.blockSize = Math.max(
      1,
      Math.floor(
        Math.min(this.width / COLS, (this.height - HUD_MARGIN) / ROWS),
      ),
    );
    this.boardWidth = COLS * this.blockSize;
    this.boardHeight = ROWS * this.blockSize;
    this.offsetX = Math.floor((this.width - this.boardWidth) / 2);
    this.offsetY = HUD_MARGIN;
  }

  private consumePressed(code: string): boolean {
    const val = !!this.justPressed[code];
    this.justPressed[code] = false;
    return val;
  }

  private initGame(): void {
    this.board = createBoard();
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.dropInterval = 1000;
    this.dropAccum = 0;
    this.state = "playing";
    this.next = randomPiece();
    this.spawn();
  }

  private spawn(): void {
    this.current = this.next;
    this.next = randomPiece();
    if (
      collide(this.board, this.current.shape, this.current.x, this.current.y)
    ) {
      this.state = "gameover";
    }
  }

  private lockPiece(): void {
    merge(this.board, this.current);
    const cleared = clearLines(this.board);
    if (cleared) {
      this.lines += cleared;
      this.score += (LINE_SCORES[cleared] || 0) * this.level;
      this.level = Math.floor(this.lines / 10) + 1;
      this.dropInterval = Math.max(100, 1000 - (this.level - 1) * 90);
    }
    this.spawn();
  }

  private hardDrop(): void {
    const gy = ghostY(this.board, this.current);
    this.score += (gy - this.current.y) * 2;
    this.current = { ...this.current, y: gy };
    this.lockPiece();
  }

  private softDrop(): void {
    if (
      !collide(
        this.board,
        this.current.shape,
        this.current.x,
        this.current.y + 1,
      )
    ) {
      this.current = { ...this.current, y: this.current.y + 1 };
      this.score += 1;
    } else {
      this.lockPiece();
    }
  }

  update(dt: number): void {
    if (this.state !== "playing") {
      for (const code of MOVE_KEYS) this.justPressed[code] = false;
      return;
    }

    if (this.consumePressed("ArrowLeft")) {
      if (
        !collide(
          this.board,
          this.current.shape,
          this.current.x - 1,
          this.current.y,
        )
      )
        this.current = { ...this.current, x: this.current.x - 1 };
    }
    if (this.consumePressed("ArrowRight")) {
      if (
        !collide(
          this.board,
          this.current.shape,
          this.current.x + 1,
          this.current.y,
        )
      )
        this.current = { ...this.current, x: this.current.x + 1 };
    }
    if (this.consumePressed("ArrowDown")) {
      this.softDrop();
    }
    const rotate =
      this.consumePressed("ArrowUp") || this.consumePressed("KeyX");
    if (rotate) {
      this.current = tryRotate(this.board, this.current);
    }
    if (this.consumePressed("Space")) {
      this.hardDrop();
    }

    if (this.state !== "playing") return;

    this.dropAccum += dt * 1000;
    if (this.dropAccum >= this.dropInterval) {
      this.dropAccum = 0;
      if (
        !collide(
          this.board,
          this.current.shape,
          this.current.x,
          this.current.y + 1,
        )
      ) {
        this.current = { ...this.current, y: this.current.y + 1 };
      } else {
        this.lockPiece();
      }
    }
  }

  private drawBlock(
    ctx: CanvasRenderingContext2D,
    x: number,
    y: number,
    colorIndex: number,
    size: number,
    alpha = 1,
  ): void {
    if (!colorIndex) return;
    const color = COLORS[colorIndex];
    if (!color) return;
    ctx.globalAlpha = alpha;
    ctx.fillStyle = color;
    ctx.fillRect(x * size + 1, y * size + 1, size - 2, size - 2);
    ctx.fillStyle = "rgba(255,255,255,0.12)";
    ctx.fillRect(x * size + 1, y * size + 1, size - 2, 4);
    ctx.globalAlpha = 1;
  }

  private drawGrid(ctx: CanvasRenderingContext2D): void {
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 0.5;
    for (let c = 1; c < COLS; c++) {
      ctx.beginPath();
      ctx.moveTo(c * this.blockSize, 0);
      ctx.lineTo(c * this.blockSize, this.boardHeight);
      ctx.stroke();
    }
    for (let r = 1; r < ROWS; r++) {
      ctx.beginPath();
      ctx.moveTo(0, r * this.blockSize);
      ctx.lineTo(this.boardWidth, r * this.blockSize);
      ctx.stroke();
    }
  }

  private drawHUD(ctx: CanvasRenderingContext2D): void {
    ctx.textAlign = "left";
    ctx.fillStyle = "#fff";
    ctx.font = "bold 15px monospace";
    ctx.fillText(`SCORE ${this.score.toLocaleString()}`, this.offsetX, 22);
    ctx.fillText(`LINES ${this.lines}`, this.offsetX, 42);
    ctx.fillText(`LEVEL ${this.level}`, this.offsetX, 62);

    const previewOriginX = this.offsetX + this.boardWidth - 4 * PREVIEW_BLOCK;
    ctx.fillStyle = "rgba(255,255,255,0.65)";
    ctx.font = "12px monospace";
    ctx.fillText("NEXT", previewOriginX, 14);

    const shape = this.next.shape;
    const offX = Math.floor((4 - shape[0].length) / 2);
    const offY = Math.floor((4 - shape.length) / 2);
    ctx.save();
    ctx.translate(previewOriginX, 20);
    for (let r = 0; r < shape.length; r++)
      for (let c = 0; c < shape[r].length; c++)
        this.drawBlock(ctx, offX + c, offY + r, shape[r][c], PREVIEW_BLOCK);
    ctx.restore();
  }

  private drawOverlay(ctx: CanvasRenderingContext2D): void {
    ctx.textAlign = "center";
    ctx.fillStyle = "#fff";
    ctx.font = "bold 46px monospace";
    ctx.fillText("GAME OVER", this.width / 2, this.height / 2 - 18);
    ctx.font = "18px monospace";
    ctx.fillStyle = "rgba(255,255,255,0.65)";
    ctx.fillText(
      `PUNTUACIÓN: ${this.score.toLocaleString()}`,
      this.width / 2,
      this.height / 2 + 22,
    );
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = "#000";
    ctx.fillRect(0, 0, this.width, this.height);

    this.drawHUD(ctx);

    ctx.save();
    ctx.translate(this.offsetX, this.offsetY);
    this.drawGrid(ctx);

    for (let r = 0; r < ROWS; r++)
      for (let c = 0; c < COLS; c++)
        this.drawBlock(ctx, c, r, this.board[r][c], this.blockSize);

    const gy = ghostY(this.board, this.current);
    for (let r = 0; r < this.current.shape.length; r++)
      for (let c = 0; c < this.current.shape[r].length; c++)
        if (this.current.shape[r][c])
          this.drawBlock(
            ctx,
            this.current.x + c,
            gy + r,
            this.current.shape[r][c],
            this.blockSize,
            0.2,
          );

    for (let r = 0; r < this.current.shape.length; r++)
      for (let c = 0; c < this.current.shape[r].length; c++)
        this.drawBlock(
          ctx,
          this.current.x + c,
          this.current.y + r,
          this.current.shape[r][c],
          this.blockSize,
        );

    ctx.restore();

    if (this.state === "gameover") {
      this.drawOverlay(ctx);
    }
  }
}
