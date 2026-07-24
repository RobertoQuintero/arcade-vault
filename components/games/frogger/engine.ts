// Motor puro de Frogger, diseñado desde cero (sin sprites bitmap).

import type { SkinName } from "@/components/games/skins";

export type { SkinName };

export const COLS = 16;
export const ROWS = 14;
export const CELL = 40; // px

// Zonas (índice de fila, 0 = arriba)
export const ROW_GOALS = 0;
export const ROW_RIVER_TOP = 1;
export const ROW_RIVER_BOT = 6;
export const ROW_SAFE_MID = 7;
export const ROW_ROAD_TOP = 8;
export const ROW_ROAD_BOT = 12;
export const ROW_START = 13;

const HUD_MARGIN = 40;
const JUMP_MS = 120;
const LIVES_START = 3;
const ROUND_TIME_S = 15;
const ROUND_TIME_DECREASE_PER_LEVEL = 1;
const MIN_ROUND_TIME_S = 6;
const POINTS_PER_ADVANCE = 10;
const POINTS_PER_GOAL = 50;
const POINTS_PER_ROUND = 200;
const TIME_BONUS_MULTIPLIER = 10;
const LEVEL_SPEED_MULTIPLIER = 1.15;
const GOAL_COUNT = 5;
const TURTLE_VISIBLE_MS = 3000;
const TURTLE_SUBMERGED_MS = 1500;

export type Direction = "up" | "down" | "left" | "right";

export interface Lane {
  row: number;
  speed: number; // px/frame @ 60fps referencia, escalado por dt
  dir: 1 | -1;
  entities: Entity[];
  kind: "road" | "river";
}

export interface Entity {
  col: number; // en celdas (puede ser fraccional)
  width: number; // en celdas
  type: "car" | "truck" | "log" | "turtle";
  submerged?: boolean;
  submergeT?: number; // acumulador ms para ciclo de inmersión
  variant?: number; // para variar color de coches/camiones
}

export interface Frog {
  col: number;
  row: number;
  animating: boolean;
  animT: number;
  fromCol: number;
  fromRow: number;
  targetCol: number;
  targetRow: number;
}

export type EngineState = "playing" | "dead" | "gameover";

export interface EngineSnapshot {
  score: number;
  lives: number;
  level: number;
  state: EngineState;
}

// ── Skins ────────────────────────────────────────────────────────────────────
interface Skin {
  roadBg: string;
  riverBg: string;
  safeBg: string;
  goalBg: string;
  goalFilledBg: string;
  goalBorder: string;
  carColors: string[];
  truckColor: string;
  logColor: string;
  turtleColor: string;
  turtleSubmergedColor: string;
  frogColor: string;
  hudText: string;
  timeBarGood: string;
  timeBarWarn: string;
  timeBarBad: string;
  overlayTitle: string;
  overlaySubtitle: string;
  glow: boolean;
  glowBlur: number;
}

const SKINS: Record<SkinName, Skin> = {
  clasico: {
    roadBg: "#0a0a0a",
    riverBg: "#0a2a5a",
    safeBg: "#0a3a1a",
    goalBg: "#0a3a1a",
    goalFilledBg: "#145a2a",
    goalBorder: "#ffcf3a",
    carColors: ["#ff3b3b", "#f5ff00", "#3b7bff"],
    truckColor: "#9aa0a6",
    logColor: "#7a4a20",
    turtleColor: "#2fbf5a",
    turtleSubmergedColor: "rgba(47, 191, 90, 0.25)",
    frogColor: "#3dff6e",
    hudText: "#ffffff",
    timeBarGood: "#3dff6e",
    timeBarWarn: "#f5ff00",
    timeBarBad: "#ff3b3b",
    overlayTitle: "#ffffff",
    overlaySubtitle: "rgba(255,255,255,0.7)",
    glow: false,
    glowBlur: 0,
  },
  neon: {
    roadBg: "#05050a",
    riverBg: "#00113a",
    safeBg: "#032a1a",
    goalBg: "#032a1a",
    goalFilledBg: "#0a4a2a",
    goalBorder: "#00f5ff",
    carColors: ["#ff006e", "#f5ff00", "#00f5ff"],
    truckColor: "#aa00ff",
    logColor: "#ff7700",
    turtleColor: "#aef22c",
    turtleSubmergedColor: "rgba(174, 242, 44, 0.2)",
    frogColor: "#aef22c",
    hudText: "#00f5ff",
    timeBarGood: "#aef22c",
    timeBarWarn: "#f5ff00",
    timeBarBad: "#ff006e",
    overlayTitle: "#ff006e",
    overlaySubtitle: "#00f5ff",
    glow: true,
    glowBlur: 12,
  },
  retro: {
    roadBg: "#0b0b0b",
    riverBg: "#00131a",
    safeBg: "#0b1f0b",
    goalBg: "#0b1f0b",
    goalFilledBg: "#173a17",
    goalBorder: "#33ff33",
    carColors: ["#ffb000", "#33ff33", "#ff5555"],
    truckColor: "#8a8a8a",
    logColor: "#a0641e",
    turtleColor: "#33ff33",
    turtleSubmergedColor: "rgba(51, 255, 51, 0.2)",
    frogColor: "#33ff33",
    hudText: "#33ff33",
    timeBarGood: "#33ff33",
    timeBarWarn: "#ffb000",
    timeBarBad: "#ff5555",
    overlayTitle: "#33ff33",
    overlaySubtitle: "rgba(51, 255, 51, 0.75)",
    glow: false,
    glowBlur: 0,
  },
};

export {
  HUD_MARGIN,
  JUMP_MS,
  LIVES_START,
  ROUND_TIME_S,
  ROUND_TIME_DECREASE_PER_LEVEL,
  MIN_ROUND_TIME_S,
  POINTS_PER_ADVANCE,
  POINTS_PER_GOAL,
  POINTS_PER_ROUND,
  TIME_BONUS_MULTIPLIER,
  LEVEL_SPEED_MULTIPLIER,
  GOAL_COUNT,
  TURTLE_VISIBLE_MS,
  TURTLE_SUBMERGED_MS,
  SKINS,
};

// ── Construcción de carriles ─────────────────────────────────────────────────

const ROAD_ROWS = [
  ROW_ROAD_TOP,
  ROW_ROAD_TOP + 1,
  ROW_ROAD_TOP + 2,
  ROW_ROAD_TOP + 3,
  ROW_ROAD_BOT,
];
const RIVER_ROWS = [
  ROW_RIVER_TOP,
  ROW_RIVER_TOP + 1,
  ROW_RIVER_TOP + 2,
  ROW_RIVER_TOP + 3,
  ROW_RIVER_TOP + 4,
  ROW_RIVER_BOT,
];

const ROAD_BASE_SPEEDS = [1.5, 2, 2.6, 3.3, 4];
const RIVER_BASE_SPEEDS = [1, 1.4, 1.8, 2.2, 2.6, 3];

function fillRoadEntities(dir: 1 | -1): Entity[] {
  const entities: Entity[] = [];
  let col = Math.random() * 3;
  let variant = 0;
  while (col < COLS + 3) {
    const isTruck = Math.random() < 0.35;
    const width = isTruck ? 2 + Math.floor(Math.random() * 2) : 1;
    entities.push({
      col: dir === 1 ? col : COLS - col - width,
      width,
      type: isTruck ? "truck" : "car",
      variant: variant++,
    });
    col += width + 1.5 + Math.random() * 2;
  }
  return entities;
}

function fillRiverEntities(type: "log" | "turtle"): Entity[] {
  const entities: Entity[] = [];
  let col = Math.random() * 3;
  while (col < COLS + 4) {
    if (type === "log") {
      const width = 2 + Math.floor(Math.random() * 3);
      entities.push({ col, width, type: "log" });
      col += width + 1 + Math.random() * 2;
    } else {
      const groupSize = 2 + Math.floor(Math.random() * 2);
      const submergeOffset = Math.random() * TURTLE_VISIBLE_MS;
      for (let i = 0; i < groupSize; i++) {
        entities.push({
          col: col + i,
          width: 1,
          type: "turtle",
          submerged: false,
          submergeT: submergeOffset,
        });
      }
      col += groupSize + 1 + Math.random() * 2;
    }
  }
  return entities;
}

export function buildLanes(level: number): Lane[] {
  const speedMultiplier = LEVEL_SPEED_MULTIPLIER ** (level - 1);
  const lanes: Lane[] = [];

  ROAD_ROWS.forEach((row, i) => {
    const dir: 1 | -1 = i % 2 === 0 ? 1 : -1;
    lanes.push({
      row,
      speed: ROAD_BASE_SPEEDS[i] * speedMultiplier,
      dir,
      kind: "road",
      entities: fillRoadEntities(dir),
    });
  });

  RIVER_ROWS.forEach((row, i) => {
    const dir: 1 | -1 = i % 2 === 0 ? -1 : 1;
    const isTurtleLane = i % 3 === 2;
    lanes.push({
      row,
      speed: RIVER_BASE_SPEEDS[i] * speedMultiplier,
      dir,
      kind: "river",
      entities: fillRiverEntities(isTurtleLane ? "turtle" : "log"),
    });
  });

  return lanes;
}

// ── Motor del juego ──────────────────────────────────────────────────────────

const TIME_BAR_HEIGHT = 6;
const TOP_OFFSET = HUD_MARGIN + TIME_BAR_HEIGHT;

interface GoalSlot {
  startCol: number;
  width: number;
}

const GOAL_SLOTS: GoalSlot[] = [1, 4, 7, 10, 13].map((startCol) => ({
  startCol,
  width: 2,
}));

const DIRECTIONS: Record<string, Direction> = {
  ArrowUp: "up",
  KeyW: "up",
  ArrowDown: "down",
  KeyS: "down",
  ArrowLeft: "left",
  KeyA: "left",
  ArrowRight: "right",
  KeyD: "right",
};

const isRoadRow = (row: number): boolean =>
  row >= ROW_ROAD_TOP && row <= ROW_ROAD_BOT;
const isRiverRow = (row: number): boolean =>
  row >= ROW_RIVER_TOP && row <= ROW_RIVER_BOT;

export class FroggerEngine {
  private width: number;
  private height: number;
  private cellSize = 1;
  private boardWidth = 0;
  private boardHeight = 0;
  private offsetX = 0;
  private offsetY = TOP_OFFSET;

  private frog: Frog = {
    col: 0,
    row: ROW_START,
    animating: false,
    animT: 0,
    fromCol: 0,
    fromRow: ROW_START,
    targetCol: 0,
    targetRow: ROW_START,
  };
  private lanes: Lane[] = [];
  private goals: boolean[] = new Array(GOAL_COUNT).fill(false);
  private minRowReached = ROW_START;
  private roundTimeMax = ROUND_TIME_S;
  private roundTime = ROUND_TIME_S;
  private score = 0;
  private lives = LIVES_START;
  private level = 1;
  private state: EngineState = "playing";
  private keys: Record<string, boolean> = {};
  private justPressed: Record<string, boolean> = {};
  private skin: Skin = SKINS.clasico;

  constructor(width: number, height: number) {
    this.width = width;
    this.height = height;
    this.initGame();
    this.recalcLayout();
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
      lives: this.lives,
      level: this.level,
      state: this.state,
    };
  }

  private recalcLayout(): void {
    this.cellSize = Math.max(
      1,
      Math.floor(
        Math.min(this.width / COLS, (this.height - TOP_OFFSET) / ROWS),
      ),
    );
    this.boardWidth = COLS * this.cellSize;
    this.boardHeight = ROWS * this.cellSize;
    this.offsetX = Math.floor((this.width - this.boardWidth) / 2);
    this.offsetY = TOP_OFFSET;
  }

  private consumePressed(code: string): boolean {
    const val = !!this.justPressed[code];
    this.justPressed[code] = false;
    return val;
  }

  private initGame(): void {
    this.lives = LIVES_START;
    this.score = 0;
    this.level = 1;
    this.state = "playing";
    this.goals = new Array(GOAL_COUNT).fill(false);
    this.roundTimeMax = ROUND_TIME_S;
    this.roundTime = this.roundTimeMax;
    this.lanes = buildLanes(this.level);
    this.resetFrogPosition();
  }

  private resetFrogPosition(): void {
    const col = Math.floor(COLS / 2);
    this.frog = {
      col,
      row: ROW_START,
      animating: false,
      animT: 0,
      fromCol: col,
      fromRow: ROW_START,
      targetCol: col,
      targetRow: ROW_START,
    };
    this.minRowReached = ROW_START;
  }

  private laneForRow(row: number): Lane | undefined {
    return this.lanes.find((l) => l.row === row);
  }

  private tryStartJump(dir: Direction): void {
    if (this.frog.animating) return;
    let dCol = 0;
    let dRow = 0;
    if (dir === "up") dRow = -1;
    else if (dir === "down") dRow = 1;
    else if (dir === "left") dCol = -1;
    else dCol = 1;

    const targetCol = this.frog.col + dCol;
    const targetRow = this.frog.row + dRow;
    if (targetCol < 0 || targetCol >= COLS) return;
    if (targetRow < ROW_GOALS || targetRow > ROW_START) return;

    this.frog.animating = true;
    this.frog.animT = 0;
    this.frog.fromCol = this.frog.col;
    this.frog.fromRow = this.frog.row;
    this.frog.targetCol = targetCol;
    this.frog.targetRow = targetRow;
  }

  private readInput(): void {
    for (const code of Object.keys(DIRECTIONS)) {
      if (!this.consumePressed(code)) continue;
      this.tryStartJump(DIRECTIONS[code]);
    }
  }

  private checkRoadCollision(): boolean {
    const lane = this.laneForRow(this.frog.row);
    if (!lane) return false;
    return lane.entities.some(
      (e) => this.frog.col >= e.col && this.frog.col < e.col + e.width,
    );
  }

  private getSupport(): Entity | null {
    const lane = this.laneForRow(this.frog.row);
    if (!lane || lane.kind !== "river") return null;
    const entity = lane.entities.find(
      (e) => this.frog.col >= e.col && this.frog.col < e.col + e.width,
    );
    if (!entity) return null;
    if (entity.type === "turtle" && entity.submerged) return null;
    return entity;
  }

  private checkGoal(): void {
    const slotIndex = GOAL_SLOTS.findIndex(
      (slot) =>
        this.frog.col >= slot.startCol &&
        this.frog.col < slot.startCol + slot.width,
    );
    if (slotIndex === -1 || this.goals[slotIndex]) {
      this.killFrog();
      return;
    }
    this.goals[slotIndex] = true;
    this.score +=
      POINTS_PER_GOAL + Math.floor(this.roundTime) * TIME_BONUS_MULTIPLIER;
    if (this.goals.every(Boolean)) {
      this.completeRound();
    } else {
      this.resetFrogPosition();
      this.roundTime = this.roundTimeMax;
    }
  }

  private completeRound(): void {
    this.score += POINTS_PER_ROUND;
    this.level += 1;
    this.goals = new Array(GOAL_COUNT).fill(false);
    this.lanes = buildLanes(this.level);
    this.roundTimeMax = Math.max(
      MIN_ROUND_TIME_S,
      ROUND_TIME_S - (this.level - 1) * ROUND_TIME_DECREASE_PER_LEVEL,
    );
    this.roundTime = this.roundTimeMax;
    this.resetFrogPosition();
  }

  private killFrog(): void {
    this.lives -= 1;
    if (this.lives <= 0) {
      this.lives = 0;
      this.state = "gameover";
      return;
    }
    this.resetFrogPosition();
    this.roundTime = this.roundTimeMax;
  }

  private resolveLanding(): void {
    if (this.frog.row < this.minRowReached) {
      this.score += POINTS_PER_ADVANCE;
      this.minRowReached = this.frog.row;
    }
    if (this.frog.row === ROW_GOALS) {
      this.checkGoal();
      return;
    }
    if (isRoadRow(this.frog.row) && this.checkRoadCollision()) {
      this.killFrog();
      return;
    }
    if (isRiverRow(this.frog.row) && !this.getSupport()) {
      this.killFrog();
    }
  }

  private updateLanes(dt: number): void {
    for (const lane of this.lanes) {
      for (const e of lane.entities) {
        e.col += lane.dir * lane.speed * dt;
        if (lane.dir === 1 && e.col > COLS) e.col = -e.width;
        if (lane.dir === -1 && e.col + e.width < 0) e.col = COLS;
      }
    }
  }

  private updateTurtles(dtMs: number): void {
    const cycle = TURTLE_VISIBLE_MS + TURTLE_SUBMERGED_MS;
    for (const lane of this.lanes) {
      if (lane.kind !== "river") continue;
      for (const e of lane.entities) {
        if (e.type !== "turtle") continue;
        e.submergeT = ((e.submergeT ?? 0) + dtMs) % cycle;
        e.submerged = e.submergeT >= TURTLE_VISIBLE_MS;
      }
    }
  }

  update(dt: number): void {
    if (this.state !== "playing") return;
    const dtMs = dt * 1000;

    this.readInput();
    this.updateLanes(dt);
    this.updateTurtles(dtMs);

    if (this.frog.animating) {
      this.frog.animT += dtMs;
      if (this.frog.animT >= JUMP_MS) {
        this.frog.animating = false;
        this.frog.col = this.frog.targetCol;
        this.frog.row = this.frog.targetRow;
        this.resolveLanding();
      }
    } else if (isRiverRow(this.frog.row)) {
      const support = this.getSupport();
      if (!support) {
        this.killFrog();
      } else {
        const lane = this.laneForRow(this.frog.row)!;
        this.frog.col += lane.dir * lane.speed * dt;
        if (this.frog.col < 0 || this.frog.col >= COLS) {
          this.killFrog();
        }
      }
    } else if (isRoadRow(this.frog.row) && this.checkRoadCollision()) {
      this.killFrog();
    }

    if (this.state !== "playing") return;

    this.roundTime -= dt;
    if (this.roundTime <= 0) {
      this.roundTime = 0;
      this.killFrog();
    }
  }

  // ── Dibujo ────────────────────────────────────────────────────────────────

  private zoneColor(row: number): string {
    if (row === ROW_GOALS) return this.skin.goalBg;
    if (isRiverRow(row)) return this.skin.riverBg;
    if (row === ROW_SAFE_MID || row === ROW_START) return this.skin.safeBg;
    return this.skin.roadBg;
  }

  private drawZones(ctx: CanvasRenderingContext2D): void {
    for (let row = 0; row < ROWS; row++) {
      ctx.fillStyle = this.zoneColor(row);
      ctx.fillRect(0, row * this.cellSize, this.boardWidth, this.cellSize);
    }
  }

  private drawGoals(ctx: CanvasRenderingContext2D): void {
    GOAL_SLOTS.forEach((slot, i) => {
      const x = slot.startCol * this.cellSize;
      const y = ROW_GOALS * this.cellSize;
      const w = slot.width * this.cellSize;
      ctx.fillStyle = this.goals[i] ? this.skin.goalFilledBg : this.skin.goalBg;
      ctx.fillRect(x, y, w, this.cellSize);
      ctx.strokeStyle = this.skin.goalBorder;
      ctx.lineWidth = 2;
      ctx.strokeRect(x + 1, y + 1, w - 2, this.cellSize - 2);
      if (this.goals[i]) {
        ctx.fillStyle = this.skin.frogColor;
        ctx.beginPath();
        ctx.ellipse(
          x + w / 2,
          y + this.cellSize / 2,
          w * 0.22,
          this.cellSize * 0.28,
          0,
          0,
          Math.PI * 2,
        );
        ctx.fill();
      }
    });
  }

  private drawEntity(
    ctx: CanvasRenderingContext2D,
    lane: Lane,
    e: Entity,
  ): void {
    const x = e.col * this.cellSize;
    const y = lane.row * this.cellSize;
    const w = e.width * this.cellSize;
    const h = this.cellSize;

    if (this.skin.glow) {
      ctx.shadowBlur = this.skin.glowBlur;
    }

    if (e.type === "car") {
      ctx.shadowColor =
        this.skin.carColors[(e.variant ?? 0) % this.skin.carColors.length];
      ctx.fillStyle = ctx.shadowColor;
      ctx.fillRect(x + 2, y + 6, w - 4, h - 12);
      ctx.fillStyle = "#111";
      ctx.beginPath();
      ctx.arc(x + 8, y + h - 6, 4, 0, Math.PI * 2);
      ctx.arc(x + w - 8, y + h - 6, 4, 0, Math.PI * 2);
      ctx.fill();
    } else if (e.type === "truck") {
      ctx.shadowColor = this.skin.truckColor;
      ctx.fillStyle = this.skin.truckColor;
      ctx.fillRect(x + 2, y + 4, w - 4, h - 8);
      ctx.fillStyle = "#333";
      ctx.fillRect(x + 2, y + 4, this.cellSize * 0.6, h - 8);
    } else if (e.type === "log") {
      ctx.shadowColor = this.skin.logColor;
      ctx.fillStyle = this.skin.logColor;
      ctx.fillRect(x, y + 6, w, h - 12);
      ctx.strokeStyle = "rgba(0,0,0,0.35)";
      ctx.lineWidth = 1;
      for (let lx = x + 6; lx < x + w; lx += 10) {
        ctx.beginPath();
        ctx.moveTo(lx, y + 6);
        ctx.lineTo(lx, y + h - 6);
        ctx.stroke();
      }
    } else {
      const color = e.submerged
        ? this.skin.turtleSubmergedColor
        : this.skin.turtleColor;
      ctx.shadowColor = color;
      ctx.fillStyle = color;
      ctx.beginPath();
      ctx.arc(x + w / 2, y + h / 2, this.cellSize * 0.38, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.shadowBlur = 0;
  }

  private drawLanes(ctx: CanvasRenderingContext2D): void {
    for (const lane of this.lanes) {
      for (const e of lane.entities) this.drawEntity(ctx, lane, e);
    }
  }

  private drawFrog(ctx: CanvasRenderingContext2D): void {
    let col = this.frog.col;
    let row = this.frog.row;
    if (this.frog.animating) {
      const t = Math.min(1, this.frog.animT / JUMP_MS);
      col = this.frog.fromCol + (this.frog.targetCol - this.frog.fromCol) * t;
      row = this.frog.fromRow + (this.frog.targetRow - this.frog.fromRow) * t;
    }
    const cx = col * this.cellSize + this.cellSize / 2;
    const cy = row * this.cellSize + this.cellSize / 2;
    const jumpLift = this.frog.animating
      ? Math.sin(Math.min(1, this.frog.animT / JUMP_MS) * Math.PI) * 6
      : 0;

    if (this.skin.glow) {
      ctx.shadowBlur = this.skin.glowBlur;
      ctx.shadowColor = this.skin.frogColor;
    }
    ctx.fillStyle = this.skin.frogColor;
    ctx.beginPath();
    ctx.ellipse(
      cx,
      cy - jumpLift,
      this.cellSize * 0.35,
      this.cellSize * 0.3,
      0,
      0,
      Math.PI * 2,
    );
    ctx.fill();
    ctx.shadowBlur = 0;

    ctx.fillStyle = "#ffffff";
    ctx.beginPath();
    ctx.arc(cx - 6, cy - jumpLift - 6, 3, 0, Math.PI * 2);
    ctx.arc(cx + 6, cy - jumpLift - 6, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = "#111";
    ctx.beginPath();
    ctx.arc(cx - 6, cy - jumpLift - 6, 1.4, 0, Math.PI * 2);
    ctx.arc(cx + 6, cy - jumpLift - 6, 1.4, 0, Math.PI * 2);
    ctx.fill();
  }

  private drawHUD(ctx: CanvasRenderingContext2D): void {
    ctx.textAlign = "left";
    ctx.fillStyle = this.skin.hudText;
    ctx.font = "bold 14px monospace";
    ctx.fillText(`SCORE ${this.score.toLocaleString()}`, this.offsetX, 20);

    ctx.textAlign = "center";
    ctx.fillText(`NIVEL ${this.level}`, this.width / 2, 20);

    ctx.textAlign = "right";
    const rightX = this.offsetX + this.boardWidth;
    for (let i = 0; i < LIVES_START; i++) {
      ctx.fillStyle =
        i < this.lives ? this.skin.frogColor : "rgba(255,255,255,0.2)";
      ctx.beginPath();
      ctx.arc(rightX - i * 18, 16, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    const timeRatio =
      this.roundTimeMax > 0 ? this.roundTime / this.roundTimeMax : 0;
    const barColor =
      timeRatio > 0.5
        ? this.skin.timeBarGood
        : timeRatio > 0.2
          ? this.skin.timeBarWarn
          : this.skin.timeBarBad;
    ctx.fillStyle = "rgba(255,255,255,0.1)";
    ctx.fillRect(this.offsetX, HUD_MARGIN, this.boardWidth, TIME_BAR_HEIGHT);
    ctx.fillStyle = barColor;
    ctx.fillRect(
      this.offsetX,
      HUD_MARGIN,
      this.boardWidth * Math.max(0, timeRatio),
      TIME_BAR_HEIGHT,
    );
  }

  private drawOverlay(ctx: CanvasRenderingContext2D): void {
    ctx.textAlign = "center";
    ctx.fillStyle = this.skin.overlayTitle;
    ctx.font = "bold 42px monospace";
    ctx.fillText("GAME OVER", this.width / 2, this.height / 2 - 16);
    ctx.font = "18px monospace";
    ctx.fillStyle = this.skin.overlaySubtitle;
    ctx.fillText(
      `PUNTUACIÓN: ${this.score.toLocaleString()}`,
      this.width / 2,
      this.height / 2 + 20,
    );
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.fillStyle = this.skin.roadBg;
    ctx.fillRect(0, 0, this.width, this.height);

    this.drawHUD(ctx);

    ctx.save();
    ctx.translate(this.offsetX, this.offsetY);
    this.drawZones(ctx);
    this.drawGoals(ctx);
    this.drawLanes(ctx);
    this.drawFrog(ctx);
    ctx.restore();

    if (this.state === "gameover") {
      this.drawOverlay(ctx);
    }
  }
}
