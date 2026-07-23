"use client";

import { useCallback, useRef, type RefObject } from "react";

export type TouchButtonKind = "dpad" | "action";

export interface TouchButtonDef {
  code: string;
  label: string;
  kind: TouchButtonKind;
}

const DPAD_ARROW_PATH: Record<string, string> = {
  ArrowUp: "M12 4 L20 16 L4 16 Z",
  ArrowRight: "M8 4 L20 12 L8 20 Z",
  ArrowDown: "M4 8 L20 8 L12 20 Z",
  ArrowLeft: "M16 4 L16 20 L4 12 Z",
};

export const TOUCH_LAYOUTS: Record<string, TouchButtonDef[]> = {
  asteroids: [
    { code: "ArrowLeft", label: "◄", kind: "dpad" },
    { code: "ArrowRight", label: "►", kind: "dpad" },
    { code: "ArrowUp", label: "▲", kind: "action" },
    { code: "Space", label: "●", kind: "action" },
  ],
  tetris: [
    { code: "ArrowLeft", label: "◄", kind: "dpad" },
    { code: "ArrowRight", label: "►", kind: "dpad" },
    { code: "ArrowDown", label: "▼", kind: "dpad" },
    { code: "ArrowUp", label: "ROTAR", kind: "action" },
    { code: "Space", label: "CAER", kind: "action" },
  ],
  snake: [
    { code: "ArrowLeft", label: "◄", kind: "dpad" },
    { code: "ArrowRight", label: "►", kind: "dpad" },
    { code: "ArrowUp", label: "▲", kind: "dpad" },
    { code: "ArrowDown", label: "▼", kind: "dpad" },
  ],
};

const DPAD_GRID_AREA: Record<string, string> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
};

const ACTION_COLOR_BY_INDEX = ["cyan", "magenta"] as const;

export interface TouchControlsProps {
  gameId: string;
  touchInputRef: RefObject<((code: string, down: boolean) => void) | null>;
}

interface TouchButtonProps {
  def: TouchButtonDef;
  onInput: (code: string, down: boolean) => void;
  actionColor?: (typeof ACTION_COLOR_BY_INDEX)[number];
}

function TouchButton({ def, onInput, actionColor }: TouchButtonProps) {
  const pointersRef = useRef<Set<number>>(new Set());

  const handlePress = (e: React.PointerEvent<HTMLButtonElement>) => {
    e.preventDefault();
    if (pointersRef.current.size === 0) onInput(def.code, true);
    pointersRef.current.add(e.pointerId);
  };

  const handleRelease = (e: React.PointerEvent<HTMLButtonElement>) => {
    if (!pointersRef.current.delete(e.pointerId)) return;
    if (pointersRef.current.size === 0) onInput(def.code, false);
  };

  const gridArea = DPAD_GRID_AREA[def.code];
  const colorClass = actionColor
    ? ` touch-controls-button--${actionColor}`
    : "";

  return (
    <button
      type="button"
      className={`touch-controls-button touch-controls-button--${def.kind}${colorClass}`}
      style={gridArea ? { gridArea } : undefined}
      onPointerDown={handlePress}
      onPointerUp={handleRelease}
      onPointerCancel={handleRelease}
      onPointerLeave={handleRelease}
      onContextMenu={(e) => e.preventDefault()}
    >
      {def.kind === "dpad" && DPAD_ARROW_PATH[def.code] ? (
        <svg
          className="touch-dpad-arrow"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path d={DPAD_ARROW_PATH[def.code]} fill="currentColor" />
        </svg>
      ) : (
        def.label
      )}
    </button>
  );
}

export function TouchControls({ gameId, touchInputRef }: TouchControlsProps) {
  const onInput = useCallback(
    (code: string, down: boolean) => {
      touchInputRef.current?.(code, down);
    },
    [touchInputRef],
  );

  const layout = TOUCH_LAYOUTS[gameId];
  if (!layout) return null;

  const dpadButtons = layout.filter((b) => b.kind === "dpad");
  const actionButtons = layout.filter((b) => b.kind === "action");

  return (
    <div className="touch-controls">
      <div className="touch-controls-dpad">
        {dpadButtons.map((def) => (
          <TouchButton key={def.code} def={def} onInput={onInput} />
        ))}
        <div className="touch-dpad-hub" aria-hidden="true">
          <span className="touch-dpad-hub-gem" />
        </div>
      </div>
      {actionButtons.length > 0 && (
        <div className="touch-controls-actions">
          {actionButtons.map((def, i) => (
            <TouchButton
              key={def.code}
              def={def}
              onInput={onInput}
              actionColor={ACTION_COLOR_BY_INDEX[i % 2]}
            />
          ))}
        </div>
      )}
    </div>
  );
}
