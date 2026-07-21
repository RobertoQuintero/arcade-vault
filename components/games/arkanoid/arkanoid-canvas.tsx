"use client";

import { useEffect, useRef } from "react";
import {
  ArkanoidEngine,
  type EngineSnapshot,
  type SkinName,
  type SoundEvent,
} from "./engine";

const CAPTURED_KEYS = new Set(["ArrowLeft", "ArrowRight"]);

const SOUND_URLS: Record<SoundEvent, string> = {
  "paddle-hit": "/sounds/arkanoid/ball-bounce.mp3",
  "block-break": "/sounds/arkanoid/break-sound.mp3",
};

export interface ArkanoidCanvasProps {
  paused: boolean;
  onSnapshot: (snapshot: EngineSnapshot) => void;
  forceEndRef?: React.RefObject<(() => void) | null>;
  skin?: SkinName;
}

export function ArkanoidCanvas({
  paused,
  onSnapshot,
  forceEndRef,
  skin = "clasico",
}: ArkanoidCanvasProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const pausedRef = useRef(paused);
  const onSnapshotRef = useRef(onSnapshot);
  const skinRef = useRef(skin);
  const engineRef = useRef<ArkanoidEngine | null>(null);

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
    const engine = new ArkanoidEngine(width, height);
    engine.setSkin(skinRef.current);
    engineRef.current = engine;

    const AudioContextCtor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    const audioCtx = AudioContextCtor ? new AudioContextCtor() : null;
    const buffers: Partial<Record<SoundEvent, AudioBuffer>> = {};

    if (audioCtx) {
      for (const [event, url] of Object.entries(SOUND_URLS) as [
        SoundEvent,
        string,
      ][]) {
        fetch(url)
          .then((res) => res.arrayBuffer())
          .then((data) => audioCtx.decodeAudioData(data))
          .then((buffer) => {
            buffers[event] = buffer;
          })
          .catch(() => {
            // sonido no disponible: el juego sigue funcionando sin ese efecto
          });
      }
    }

    const playSound = (event: SoundEvent) => {
      const buffer = buffers[event];
      if (!audioCtx || !buffer) return;
      try {
        const source = audioCtx.createBufferSource();
        source.buffer = buffer;
        source.connect(audioCtx.destination);
        source.start();
      } catch {
        // reproducción fallida: el juego continúa sin ese efecto
      }
    };

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

    const handleTouchMove = (e: TouchEvent) => {
      e.preventDefault();
      const touch = e.touches[0];
      if (!touch) return;
      const rect = canvas.getBoundingClientRect();
      const fraction = (touch.clientX - rect.left) / rect.width;
      engine.setPaddleX(fraction);
    };
    canvas.addEventListener("touchstart", handleTouchMove, { passive: false });
    canvas.addEventListener("touchmove", handleTouchMove, { passive: false });

    if (forceEndRef) forceEndRef.current = () => engine.forceGameOver();

    let lastTime: number | null = null;
    let raf = 0;

    const loop = (ts: number) => {
      const dt = lastTime === null ? 0 : Math.min((ts - lastTime) / 1000, 0.05);
      lastTime = ts;
      if (!pausedRef.current) engine.update(dt);
      engine.draw(ctx);
      const snapshot = engine.getSnapshot();
      for (const event of snapshot.sounds) playSound(event);
      onSnapshotRef.current(snapshot);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(raf);
      resizeObserver.disconnect();
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
      canvas.removeEventListener("mousemove", handleMouseMove);
      canvas.removeEventListener("touchstart", handleTouchMove);
      canvas.removeEventListener("touchmove", handleTouchMove);
      if (forceEndRef) forceEndRef.current = null;
      if (audioCtx) audioCtx.close().catch(() => {});
      engineRef.current = null;
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
        touchAction: "none",
      }}
    />
  );
}

export type { EngineSnapshot };
