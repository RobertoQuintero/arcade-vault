// Tipo de skin compartido por los motores que implementan la convención
// SKINS map + setSkin (ver references/games-with-themes.md).

export type SkinName = "clasico" | "neon" | "retro";

export const SKIN_OPTIONS: { value: SkinName; label: string }[] = [
  { value: "clasico", label: "CLÁSICO" },
  { value: "neon", label: "NEÓN" },
  { value: "retro", label: "RETRO" },
];

// ids de `games` cuyo motor soporta setSkin(); mantener en sync con
// references/games-with-themes.md.
export const GAMES_WITH_SKINS = new Set(["snake", "arkanoid", "asteroids"]);
