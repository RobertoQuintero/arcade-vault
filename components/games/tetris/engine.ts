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
