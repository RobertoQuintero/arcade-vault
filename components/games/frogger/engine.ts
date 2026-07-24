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
