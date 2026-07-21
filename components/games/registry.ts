import type { ComponentType, RefObject } from "react";
import { ArkanoidCanvas } from "@/components/games/arkanoid/arkanoid-canvas";
import { AsteroidsCanvas } from "@/components/games/asteroids/asteroids-canvas";
import type { EngineSnapshot } from "@/components/games/asteroids/engine";
import type { SkinName } from "@/components/games/skins";
import { SnakeCanvas } from "@/components/games/snake/snake-canvas";
import { TetrisCanvas } from "@/components/games/tetris/tetris-canvas";

export interface GameCanvasProps {
  paused: boolean;
  onSnapshot: (snapshot: EngineSnapshot) => void;
  forceEndRef?: RefObject<(() => void) | null>;
  skin?: SkinName;
}

export const GAME_CANVASES: Record<string, ComponentType<GameCanvasProps>> = {
  asteroids: AsteroidsCanvas,
  tetris: TetrisCanvas,
  arkanoid: ArkanoidCanvas,
  snake: SnakeCanvas,
};

export type { EngineSnapshot };
