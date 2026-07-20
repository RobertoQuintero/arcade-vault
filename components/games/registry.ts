import type { ComponentType, RefObject } from "react";
import { AsteroidsCanvas } from "@/components/games/asteroids/asteroids-canvas";
import type { EngineSnapshot } from "@/components/games/asteroids/engine";
import { TetrisCanvas } from "@/components/games/tetris/tetris-canvas";

export interface GameCanvasProps {
  paused: boolean;
  onSnapshot: (snapshot: EngineSnapshot) => void;
  forceEndRef?: RefObject<(() => void) | null>;
}

export const GAME_CANVASES: Record<string, ComponentType<GameCanvasProps>> = {
  asteroids: AsteroidsCanvas,
  tetris: TetrisCanvas,
};

export type { EngineSnapshot };
