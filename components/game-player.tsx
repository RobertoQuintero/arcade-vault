"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useRef, useState } from "react";
import type { Game } from "@/lib/games";
import { saveScore } from "@/lib/storage";
import { useSessionUser } from "@/lib/session-user";
import { GAME_CANVASES } from "@/components/games/registry";
import type { EngineSnapshot } from "@/components/games/registry";
import {
  GAMES_WITH_SKINS,
  SKIN_OPTIONS,
  type SkinName,
} from "@/components/games/skins";
import { TouchControls } from "@/components/games/touch-controls";

export function GamePlayer({ game }: { game: Game }) {
  const router = useRouter();
  const sessionUser = useSessionUser();
  const Canvas = GAME_CANVASES[game.id];
  const isReal = Boolean(Canvas);
  const [score, setScore] = useState(0);
  const [lives, setLives] = useState(3);
  const [level, setLevel] = useState(1);
  const [paused, setPaused] = useState(false);
  const [over, setOver] = useState(false);
  const [name, setName] = useState("INVITADO");
  const [saveState, setSaveState] = useState<
    "idle" | "pending" | "saved" | "error"
  >("idle");
  const [restartKey, setRestartKey] = useState(0);
  const [skin, setSkin] = useState<SkinName>("clasico");
  const [isTouchDevice, setIsTouchDevice] = useState(false);
  const forceEndRef = useRef<(() => void) | null>(null);
  const touchInputRef = useRef<((code: string, down: boolean) => void) | null>(
    null,
  );
  const hasSkins = GAMES_WITH_SKINS.has(game.id);

  useEffect(() => {
    if (sessionUser) setName(sessionUser.name);
  }, [sessionUser]);

  useEffect(() => {
    const mql = window.matchMedia("(pointer: coarse)");
    setIsTouchDevice(mql.matches);
    const handleChange = (e: MediaQueryListEvent) =>
      setIsTouchDevice(e.matches);
    mql.addEventListener("change", handleChange);
    return () => mql.removeEventListener("change", handleChange);
  }, []);

  useEffect(() => {
    if (isReal) return;
    if (over || paused) return;
    const t = setInterval(
      () => setScore((s) => s + Math.floor(10 + Math.random() * 90)),
      220,
    );
    return () => clearInterval(t);
  }, [isReal, over, paused]);

  useEffect(() => {
    if (isReal) return;
    if (score > 0 && score % 2500 < 100) setLevel((l) => l + 1);
  }, [isReal, score]);

  const handleSnapshot = useCallback((snapshot: EngineSnapshot) => {
    setScore(snapshot.score);
    setLives(snapshot.lives);
    setLevel(snapshot.level);
    if (snapshot.state === "gameover") setOver(true);
  }, []);

  const endGame = () => {
    if (isReal) {
      forceEndRef.current?.();
    } else {
      setOver(true);
    }
  };
  const restart = () => {
    setScore(0);
    setLevel(1);
    setLives(3);
    setPaused(false);
    setOver(false);
    setSaveState("idle");
    if (isReal) setRestartKey((k) => k + 1);
  };

  return (
    <div className="av-player fade-in">
      <div className="player-hud">
        <div style={{ display: "flex", gap: 24, flexWrap: "wrap" }}>
          <div className="hud-stat">
            <div className="l">Jugador</div>
            <div className="v" style={{ color: "var(--ink)" }}>
              {name}
            </div>
          </div>
          <div className="hud-stat">
            <div className="l">Puntuación</div>
            <div className="v">{score.toLocaleString("es-ES")}</div>
          </div>
          <div className="hud-stat lives">
            <div className="l">Vidas</div>
            <div className="v">{"♥ ".repeat(lives).trim() || "—"}</div>
          </div>
          <div className="hud-stat level">
            <div className="l">Nivel</div>
            <div className="v">{String(level).padStart(2, "0")}</div>
          </div>
          {hasSkins && !isTouchDevice && (
            <div className="hud-stat">
              <div className="l">Skin</div>
              <select
                className="mono"
                value={skin}
                onChange={(e) => setSkin(e.target.value as SkinName)}
                style={{
                  background: "transparent",
                  color: "var(--ink)",
                  border: "1px solid var(--ink-dim)",
                  borderRadius: 4,
                  padding: "2px 6px",
                  fontSize: 12,
                }}
              >
                {SKIN_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <div className="hud-actions">
          {!isTouchDevice && (
            <button className="btn yellow" onClick={() => setPaused((p) => !p)}>
              {paused ? "REANUDAR" : "PAUSA"}
            </button>
          )}
          <button className="btn magenta" onClick={endGame}>
            FIN
          </button>
          <button
            className="btn ghost"
            onClick={() => router.push(`/games/${game.id}`)}
          >
            SALIR
          </button>
        </div>
      </div>

      <div className="crt">
        <div className="crt-screen">
          {isReal && Canvas ? (
            <Canvas
              key={restartKey}
              paused={paused}
              onSnapshot={handleSnapshot}
              forceEndRef={forceEndRef}
              skin={skin}
              touchInputRef={touchInputRef}
            />
          ) : (
            <div className="game-arena">
              <div className="grid-floor"></div>
              <div className="enemy e1"></div>
              <div className="enemy e2"></div>
              <div className="enemy e3"></div>
              <div className="player-ship"></div>
            </div>
          )}
          {paused && (
            <div
              className="crt-content"
              style={{ background: "rgba(0,0,0,0.6)", zIndex: 5 }}
            >
              <div>
                <div className="pixel neon-yellow" style={{ fontSize: 22 }}>
                  EN PAUSA
                </div>
                <div
                  className="mono"
                  style={{
                    fontSize: 11,
                    color: "var(--ink-dim)",
                    marginTop: 10,
                    letterSpacing: "0.16em",
                  }}
                >
                  PULSA REANUDAR PARA CONTINUAR
                </div>
              </div>
            </div>
          )}
        </div>
        {isReal && isTouchDevice && game.id !== "arkanoid" && (
          <TouchControls gameId={game.id} touchInputRef={touchInputRef} />
        )}
        {isReal && isTouchDevice && (
          <div className="touch-bottom-bar">
            <button
              className="touch-pause-circle"
              aria-label={paused ? "Reanudar" : "Pausa"}
              onClick={() => setPaused((p) => !p)}
            >
              {paused ? "▶" : "⏸"}
            </button>
            {hasSkins && (
              <select
                className="mono"
                value={skin}
                onChange={(e) => setSkin(e.target.value as SkinName)}
                style={{
                  background: "transparent",
                  color: "var(--ink)",
                  border: "1px solid var(--ink-dim)",
                  borderRadius: 4,
                  padding: "2px 6px",
                  fontSize: 12,
                }}
              >
                {SKIN_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            )}
          </div>
        )}
        {!isTouchDevice && (
          <div className="crt-bottom">
            <span className="led">SEÑAL OK</span>
            <span>{game.title} · CRT-83 · 60 HZ</span>
            <span>CARGA · 1MB</span>
          </div>
        )}
      </div>

      {over && (
        <div className="modal-bd">
          <div className="modal">
            <h2>FIN DEL JUEGO</h2>
            <div className="final-label">PUNTUACIÓN FINAL</div>
            <div className="final">{score.toLocaleString("es-ES")}</div>
            {saveState !== "saved" ? (
              <div className="input-row">
                <input
                  value={name}
                  onChange={(e) =>
                    setName(e.target.value.toUpperCase().slice(0, 10))
                  }
                  placeholder="TUS INICIALES"
                  disabled={saveState === "pending"}
                />
                <button
                  className="btn yellow"
                  disabled={saveState === "pending"}
                  onClick={async () => {
                    setSaveState("pending");
                    try {
                      await saveScore({ game: game.id, score, name });
                      setSaveState("saved");
                    } catch {
                      setSaveState("error");
                    }
                  }}
                >
                  {saveState === "pending"
                    ? "GUARDANDO..."
                    : "GUARDAR PUNTUACIÓN"}
                </button>
                {saveState === "error" && (
                  <div
                    className="mono"
                    style={{ color: "var(--magenta)", fontSize: 12 }}
                  >
                    No se pudo guardar la puntuación. Inténtalo de nuevo.
                  </div>
                )}
              </div>
            ) : (
              <div className="toast-saved">▸ PUNTUACIÓN GUARDADA_</div>
            )}
            <div className="actions">
              <button className="btn" onClick={restart}>
                JUGAR DE NUEVO
              </button>
              <Link href="/" className="btn magenta">
                VOLVER AL VAULT
              </Link>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
