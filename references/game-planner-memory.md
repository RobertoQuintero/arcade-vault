# Memoria del agente game-planner

Registro de juegos sugeridos, aceptados, descartados e implementados para Arcade Vault.
Lo mantiene el agente `game-planner` (`.claude/agents/game-planner.md`) — no editar el formato de la tabla a mano.

Estados: `propuesto` | `aceptado` | `descartado` | `implementado`

## Historial de sugerencias

| Fecha      | Juego                                | Categoría | Estado       | Motivo / Notas                                                                                                                |
| ---------- | ------------------------------------ | --------- | ------------ | ----------------------------------------------------------------------------------------------------------------------------- |
| 2026-07-21 | Asteroids                            | SHOOTER   | implementado | Ya jugable (spec 04). Registrado como base.                                                                                   |
| 2026-07-21 | Tetris                               | PUZZLE    | implementado | Ya jugable (spec 07). Registrado como base.                                                                                   |
| 2026-07-21 | Arkanoid                             | ARCADE    | implementado | Ya jugable (specs 08-09, con sonido). Base.                                                                                   |
| 2026-07-21 | Snake                                | ARCADE    | implementado | Ya jugable (spec 10). Registrado como base.                                                                                   |
| 2026-07-21 | Pong                                 | VERSUS    | propuesto    | Categoría VERSUS vacía; encaje perfecto con el contrato del engine (2 jugadores mismo teclado); esfuerzo bajo. Candidato #1.  |
| 2026-07-21 | Space Invaders                       | SHOOTER   | propuesto    | Diversifica el único SHOOTER existente (Asteroids); esfuerzo medio; score por oleadas muy competitivo. Candidato #2.          |
| 2026-07-21 | Pac-Man (versión mini)               | ARCADE    | propuesto    | Alternativa de mayor riesgo/esfuerzo (IA de fantasmas, laberinto); ARCADE ya tiene 2 juegos. Candidato #3, especulativo.      |
| 2026-07-21 | Air Hockey                           | VERSUS    | propuesto    | Sesión de lista de 20: VERSUS vacío. Físicas simples (rebote elástico), 2 jugadores mismo teclado. Esfuerzo bajo-medio.       |
| 2026-07-21 | Tron / Duelo de Motos (Light Cycles) | VERSUS    | propuesto    | Lista de 20: snake-trail 2P, colisión con estelas. Muy afín al engine (grid + colisión). Esfuerzo medio.                      |
| 2026-07-21 | Combate de Tanques (Combat)          | VERSUS    | propuesto    | Lista de 20: tanques 2P con proyectiles y obstáculos destructibles. Reutiliza física de disparo de Asteroids. Esfuerzo medio. |
| 2026-07-21 | Warlords / Duelo de Fortalezas       | VERSUS    | propuesto    | Lista de 20: paddles en esquinas defendiendo un núcleo, pelota rebotando (variante 2-4P de Arkanoid). Esfuerzo medio.         |
| 2026-07-21 | Centipede                            | SHOOTER   | propuesto    | Lista de 20: diversifica SHOOTER (solo Asteroids). Oleadas de segmentos + hongos, spawn dinámico. Esfuerzo medio.             |
| 2026-07-21 | Missile Command                      | SHOOTER   | propuesto    | Lista de 20: apuntar con mouse/teclado y defender ciudades; score por oleadas. Esfuerzo medio.                                |
| 2026-07-21 | Galaga / Galaxian                    | SHOOTER   | propuesto    | Lista de 20: oleadas en picado con formaciones, más complejo de IA que Space Invaders. Esfuerzo medio-alto.                   |
| 2026-07-21 | 2048                                 | PUZZLE    | propuesto    | Lista de 20: PUZZLE infrarrepresentado (solo Tetris). Grid deslizante, muy bajo esfuerzo, score natural por fusiones.         |
| 2026-07-21 | Columns                              | PUZZLE    | propuesto    | Lista de 20: variante de piezas cayendo tipo match-3 vertical, cercano al engine de Tetris ya existente. Esfuerzo medio.      |
| 2026-07-21 | Joya Swap (Match-3 tipo Bejeweled)   | PUZZLE    | propuesto    | Lista de 20: swap adyacente + detección de líneas de 3+. Lógica de grid nueva pero acotada. Esfuerzo medio.                   |
| 2026-07-21 | Dr. Mario                            | PUZZLE    | propuesto    | Lista de 20: pastillas cayendo + eliminación por color, similar a Tetris pero con reglas de "virus". Esfuerzo medio-alto.     |
| 2026-07-21 | Flappy Bird (clon)                   | ARCADE    | propuesto    | Lista de 20: mecánica de un solo botón, huecos procedurales, muy bajo esfuerzo, score por obstáculos superados.               |
| 2026-07-21 | Golpea al Topo (Whack-a-Mole)        | ARCADE    | propuesto    | Lista de 20: grid de agujeros + timers de aparición, sin física compleja. Esfuerzo bajo.                                      |
| 2026-07-21 | Frogger                              | ARCADE    | propuesto    | Lista de 20: cruce de carriles con obstáculos en movimiento; score por avance y rondas. Esfuerzo bajo-medio.                  |
| 2026-07-21 | Doodle Jump (clon)                   | ARCADE    | propuesto    | Lista de 20: scroll vertical infinito con plataformas, cámara que sigue al jugador. Esfuerzo medio.                           |
| 2026-07-21 | Dig Dug                              | ARCADE    | propuesto    | Lista de 20: excavación de túneles + enemigos con IA de persecución/inflado. Esfuerzo alto.                                   |
| 2026-07-21 | Q*bert                               | ARCADE    | propuesto    | Lista de 20: movimiento isométrico en pirámide de cubos + enemigos con IA. Esfuerzo alto, riesgo de render isométrico.        |

## Descartados

(Juegos rechazados y por qué, para no re-proponerlos sin motivo.)
