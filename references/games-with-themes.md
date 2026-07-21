# Juegos con sistema de skins

Juegos que implementan la convención `SKINS` map + `setSkin` (motor) / prop `skin?` (canvas), con las 3 skins mínimas: `clasico` (default), `neon`, `retro`.

| Juego     | Archivo del motor                      | Skins implementadas        | Notas                                                                                                                                                                                                                                                                                                    |
| --------- | -------------------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Snake     | `components/games/snake/engine.ts`     | `clasico`, `neon`, `retro` | `neon` aplica glow (`shadowBlur`) a snake y fruta fallback; el sprite de fruta (atlas) no se recolorea, solo su fallback de color plano.                                                                                                                                                                 |
| Arkanoid  | `components/games/arkanoid/engine.ts`  | `clasico`, `neon`, `retro` | `neon` aplica glow a paddle y bola; `blockColors` remapea los 7 ids de color existentes (`red`/`yellow`/`cyan`/`magenta`/`hotpink`/`green`/`gray`) sin tocar el layout de niveles.                                                                                                                       |
| Asteroids | `components/games/asteroids/engine.ts` | `clasico`, `neon`, `retro` | `clasico` formaliza el look monocromo original; `neon` aplica glow a nave/asteroides/balas/power-up con paleta cian-magenta-verde; `retro` es un CRT vectorial monocromo ámbar (nave/asteroides/balas comparten color, se distinguen por grosor de trazo), con el power-up en verde fósforo como acento. |

## Juegos pendientes (sin sistema de skins)

| Juego  | Motivo                     |
| ------ | -------------------------- |
| Tetris | No auditado en esta ronda. |
