"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { setUser } from "@/lib/storage";
import { createClient } from "@/lib/supabase/client";
import { resetPassword, signIn, signUp, type AuthResult } from "./actions";

export default function AuthPage() {
  const router = useRouter();
  const [tab, setTab] = useState<"in" | "up">("in");
  const [user, setUserField] = useState("");
  const [pass, setPass] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [showReset, setShowReset] = useState(false);
  const [resetEmail, setResetEmail] = useState("");
  const [resetMessage, setResetMessage] = useState<AuthResult | null>(null);
  const [isResetPending, startResetTransition] = useTransition();

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    startTransition(async () => {
      const result =
        tab === "in"
          ? await signIn(email, pass)
          : await signUp(user || "PLAYER1", email, pass);

      if (result.status === "error") {
        setError(result.message);
        return;
      }

      router.push("/");
      router.refresh();
    });
  };

  const playAsGuest = () => {
    setUser({ name: "INVITADO" });
    router.push("/");
  };

  const submitReset = (e: React.FormEvent) => {
    e.preventDefault();
    setResetMessage(null);

    startResetTransition(async () => {
      const result = await resetPassword(resetEmail);
      setResetMessage(result);
    });
  };

  const signInWithOAuth = (provider: "google" | "github") => {
    const supabase = createClient();
    supabase.auth.signInWithOAuth({
      provider,
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  return (
    <div className="av-auth-wrap fade-in">
      <div className="auth-card">
        <div className="auth-header">
          <div className="mark"></div>
          <h2 className="neon-cyan">ARCADE VAULT</h2>
          <div
            className="mono"
            style={{
              fontSize: 11,
              color: "var(--ink-faint)",
              letterSpacing: "0.16em",
              marginTop: 6,
            }}
          >
            ACCESO AL SISTEMA · v2.6
          </div>
        </div>

        <div className="auth-tabs">
          <button
            className={tab === "in" ? "on" : ""}
            onClick={() => setTab("in")}
          >
            INICIAR SESIÓN
          </button>
          <button
            className={tab === "up" ? "on" : ""}
            onClick={() => setTab("up")}
          >
            CREAR CUENTA
          </button>
        </div>

        <form onSubmit={submit}>
          {tab === "up" && (
            <div className="field slide-in">
              <label>Usuario</label>
              <input
                value={user}
                onChange={(e) => setUserField(e.target.value)}
                placeholder="px_kai"
              />
            </div>
          )}
          <div className="field">
            <label>Correo electrónico</label>
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="jugador@vault.gg"
            />
          </div>
          <div className="field">
            <label>Contraseña</label>
            <input
              type="password"
              required
              minLength={6}
              value={pass}
              onChange={(e) => setPass(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div
              className="mono"
              style={{ color: "var(--magenta)", fontSize: 12, marginTop: 4 }}
            >
              {error}
            </div>
          )}

          <button
            className="btn lg"
            type="submit"
            disabled={isPending}
            style={{ width: "100%", marginTop: 8 }}
          >
            {isPending
              ? "CONECTANDO…"
              : tab === "in"
                ? "ENTRAR AL VAULT"
                : "CREAR Y JUGAR"}
          </button>
        </form>

        {tab === "in" && !showReset && (
          <button
            type="button"
            className="mono"
            onClick={() => {
              setShowReset(true);
              setResetMessage(null);
            }}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: "var(--ink-faint)",
              fontSize: 11,
              letterSpacing: "0.08em",
              marginTop: 10,
              textAlign: "center",
              width: "100%",
            }}
          >
            ¿OLVIDASTE TU CONTRASEÑA?
          </button>
        )}

        {tab === "in" && showReset && (
          <form onSubmit={submitReset} className="slide-in">
            <div className="field" style={{ marginTop: 10 }}>
              <label>Correo electrónico</label>
              <input
                type="email"
                required
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder="jugador@vault.gg"
              />
            </div>

            {resetMessage && (
              <div
                className="mono"
                style={{
                  color:
                    resetMessage.status === "error"
                      ? "var(--magenta)"
                      : "var(--cyan)",
                  fontSize: 12,
                  marginTop: 4,
                }}
              >
                {resetMessage.message}
              </div>
            )}

            <button
              className="btn ghost"
              type="submit"
              disabled={isResetPending}
              style={{ width: "100%", marginTop: 8 }}
            >
              {isResetPending ? "ENVIANDO…" : "ENVIAR ENLACE"}
            </button>
          </form>
        )}

        <button
          className="btn ghost"
          style={{ width: "100%", marginTop: 10 }}
          onClick={playAsGuest}
        >
          JUGAR COMO INVITADO
        </button>

        <div className="auth-divider">O CONTINÚA CON</div>
        <div className="social">
          <button
            className="btn ghost"
            type="button"
            onClick={() => signInWithOAuth("google")}
          >
            ◆ GOOGLE
          </button>
          <button
            className="btn ghost"
            type="button"
            onClick={() => signInWithOAuth("github")}
          >
            ▣ GITHUB
          </button>
        </div>

        <div
          style={{
            marginTop: 18,
            textAlign: "center",
            fontSize: 11,
            color: "var(--ink-faint)",
            letterSpacing: "0.1em",
          }}
        >
          AL ENTRAR ACEPTAS LOS TÉRMINOS DEL SALÓN ARCADE
        </div>
      </div>
    </div>
  );
}
