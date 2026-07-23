"use client";

import { useEffect, useRef } from "react";
import { SnakeEngine, type EngineSnapshot, type SkinName } from "./engine";

const CAPTURED_KEYS = new Set([
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "KeyW",
  "KeyA",
  "KeyS",
  "KeyD",
]);

export interface SnakeCanvasProps {
  paused: boolean;
  onSnapshot: (snapshot: EngineSnapshot) => void;
  forceEndRef?: React.RefObject<(() => void) | null>;
  skin?: SkinName;
  touchInputRef?: React.RefObject<
    ((code: string, down: boolean) => void) | null
  >;
}

export function SnakeCanvas({
  paused,
  onSnapshot,
  forceEndRef,
  skin = "clasico",
  touchInputRef,
}: SnakeCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pausedRef = useRef(paused);
  const onSnapshotRef = useRef(onSnapshot);
  const skinRef = useRef(skin);
  const engineRef = useRef<SnakeEngine | null>(null);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    onSnapshotRef.current = onSnapshot;
  }, [onSnapshot]);

  useEffect(() => {
    skinRef.current = skin;
    engineRef.current?.setSkin(skin);
  }, [skin]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.clientWidth || 800;
    const height = canvas.clientHeight || 600;
    canvas.width = width;
    canvas.height = height;
    const engine = new SnakeEngine(width, height);
    engine.setSkin(skinRef.current);
    engineRef.current = engine;

    const fruitImage = new Image();
    fruitImage.src = "/games/snake/fruits.png";
    fruitImage.onload = () => engine.setFruitImage(fruitImage);

    const resizeObserver = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const { width: w, height: h } = entry.contentRect;
      if (w <= 0 || h <= 0) return;
      canvas.width = w;
      canvas.height = h;
      engine.resize(w, h);
    });
    resizeObserver.observe(canvas);

    const handleKeyDown = (e: KeyboardEvent) => {
      if (CAPTURED_KEYS.has(e.code)) e.preventDefault();
      engine.setKey(e.code, true);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      engine.setKey(e.code, false);
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    if (forceEndRef) forceEndRef.current = () => engine.forceGameOver();
    if (touchInputRef)
      touchInputRef.current = (code, down) => engine.setKey(code, down);

    let lastTime: number | null = null;
    let raf = 0;

    const loop = (ts: number) => {
      const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
      lastTime = ts;
      if (!pausedRef.current) engine.update(dt);
      engine.draw(ctx);
      onSnapshotRef.current(engine.getSnapshot());
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      if (forceEndRef) forceEndRef.current = null;
      if (touchInputRef) touchInputRef.current = null;
      engineRef.current = null;
    };
  }, [forceEndRef, touchInputRef]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        inset: 0,
        width: "100%",
        height: "100%",
        display: "block",
      }}
    />
  );
}

export type { EngineSnapshot };
