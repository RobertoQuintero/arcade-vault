"use client";

import { useEffect, useRef } from "react";
import { ArkanoidEngine, type EngineSnapshot } from "./engine";

const CAPTURED_KEYS = new Set(["ArrowLeft", "ArrowRight"]);

export interface ArkanoidCanvasProps {
  paused: boolean;
  onSnapshot: (snapshot: EngineSnapshot) => void;
  forceEndRef?: React.RefObject<(() => void) | null>;
}

export function ArkanoidCanvas({
  paused,
  onSnapshot,
  forceEndRef,
}: ArkanoidCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pausedRef = useRef(paused);
  const onSnapshotRef = useRef(onSnapshot);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  useEffect(() => {
    onSnapshotRef.current = onSnapshot;
  }, [onSnapshot]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const width = canvas.clientWidth || 800;
    const height = canvas.clientHeight || 600;
    canvas.width = width;
    canvas.height = height;
    const engine = new ArkanoidEngine(width, height);

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

    const handleMouseMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect();
      const fraction = (e.clientX - rect.left) / rect.width;
      engine.setPaddleX(fraction);
    };
    canvas.addEventListener("mousemove", handleMouseMove);

    if (forceEndRef) forceEndRef.current = () => engine.forceGameOver();

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
      canvas.removeEventListener("mousemove", handleMouseMove);
      if (forceEndRef) forceEndRef.current = null;
    };
  }, [forceEndRef]);

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
