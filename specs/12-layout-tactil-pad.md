# 12 — Layout táctil del reproductor (pad inferior)

- **Estado:** Implementado
- **Dependencias:** SPEC 11 (controles táctiles — overlay de D-pad/botones, detección `isTouchDevice` vía `matchMedia("(pointer: coarse)")`, `GAMES_WITH_SKINS`/selector de skin)
- **Fecha:** 2026-07-23

## Objetivo

En dispositivos táctiles, mover el botón PAUSA/REANUDAR y el selector de skin (si el juego tiene skins) del HUD superior a una barra nueva debajo del overlay de controles/CRT, y ocultar la línea decorativa inferior del CRT, replicando el layout de `references/controls/pad.png` (pantalla → D-pad/botones → barra de reanudar+skin) sin afectar el HUD ni el layout en desktop.

## Alcance

**Incluido:**

- En `components/game-player.tsx`, cuando `isTouchDevice` es `true`: el botón PAUSA/REANUDAR (`hud-actions`) se retira del `.player-hud` superior — FIN y SALIR se quedan ahí igual que hoy.
- Si además `hasSkins` es `true`, el `<select>` de skin también se retira del `.player-hud` superior en touch.
- Nueva barra `.touch-bottom-bar` (nuevo elemento en el JSX, dentro de `.crt`, debajo del bloque de `TouchControls` — o debajo de `.crt-screen` directamente en Arkanoid, que no tiene `TouchControls`) que renderiza, solo cuando `isReal && isTouchDevice`: el botón PAUSA/REANUDAR (mismo `onClick`/estado que antes, solo que reubicado) y, si `hasSkins`, el `<select>` de skin (mismo estado `skin`/`onChange`, reubicado).
- Ocultar `.crt-bottom` (línea "SEÑAL OK · <juego> · CRT-83 · 60HZ · CARGA 1MB") cuando `isTouchDevice` es `true`, en los 4 juegos reales.
- Aplica a los 4 juegos reales (Asteroids, Tetris, Snake, Arkanoid) por igual — Arkanoid obtiene la barra inferior nueva aunque no tenga `TouchControls`.
- CSS nuevo en `app/globals.css` para `.touch-bottom-bar` (fila: botón grande a la izquierda, selector de skin a la derecha, estilo acorde a `pad.png`) y ajuste para ocultar `.crt-bottom` en touch.

**Explícitamente fuera de alcance:**

- Cambios al HUD/layout en desktop (`pointer: fine`) — se queda exactamente igual que hoy.
- Mover FIN o SALIR de posición — permanecen en el `.player-hud` superior en touch y desktop.
- Cambios al comportamiento de `TouchControls` (D-pad/botones), al drag de Arkanoid, o a cualquier lógica de motor — es puramente reorganización visual del HUD/skin/pausa.
- Rediseño visual del `.crt`, del botón PAUSA/REANUDAR o del `<select>` de skin más allá de su reubicación (se reutilizan las mismas clases/estilos existentes).
- Ajustes a `TOUCH_LAYOUTS` o al mapeo de botones por juego (ya definidos en SPEC 11).
- Tests automatizados.

## Modelo de datos

No se introduce ningún modelo de datos nuevo — es una reorganización de JSX/CSS existente en `game-player.tsx`. No hay nuevos tipos, ni persistencia, ni cambios al contrato de motor o a `GameCanvasProps`.

## Plan de implementación

1. **Ocultar PAUSA/skin del HUD superior en touch**: en `components/game-player.tsx`, condicionar el render del botón PAUSA/REANUDAR dentro de `.hud-actions` a `!isTouchDevice` (FIN y SALIR quedan sin condición, igual que hoy). Condicionar el bloque del `<select>` de skin (dentro de `.hud-stat` en el HUD superior) a `!(isTouchDevice && hasSkins)` — en touch sin skins no cambia nada porque ese bloque ya no se renderizaba. El sistema queda funcional: en touch momentáneamente no hay forma de pausar hasta el paso 2, pero desktop no se toca.
2. **Nueva barra `.touch-bottom-bar`**: agregar en el JSX de `game-player.tsx`, dentro de `.crt`, después del bloque `{isReal && isTouchDevice && game.id !== "arkanoid" && <TouchControls .../>}` (para Arkanoid, directamente después de `.crt-screen` ya que no tiene `TouchControls`) un nuevo bloque `{isReal && isTouchDevice && (<div className="touch-bottom-bar">...)}` con: el botón PAUSA/REANUDAR (mismo `onClick={() => setPaused((p) => !p)}`, misma clase `btn yellow`) y, si `hasSkins`, el `<select>` de skin (mismo estado/`onChange` que el de arriba). Sistema funcional: pausar/reanudar y cambiar skin ya vuelven a funcionar, ahora desde la barra inferior en touch.
3. **Ocultar `.crt-bottom` en touch**: condicionar el render de `.crt-bottom` a `!isTouchDevice` (o vía CSS `display: none` vía una clase modificadora) en los 4 juegos reales.
4. **CSS — `.touch-bottom-bar`**: en `app/globals.css`, agregar estilos para la nueva barra (`display: flex`, `justify-content: space-between`, `align-items: center`, `margin-top: 14px`, botón de pausa ocupando el espacio disponible a la izquierda con estilo consistente a `.btn.yellow` ya existente, `<select>` de skin a la derecha reutilizando el estilo inline actual). Ajustar `gap`/`padding` en el breakpoint `@media (max-width: 480px)` ya existente si hace falta.
5. **Verificación end-to-end**: `npx tsc --noEmit` sin errores; con Chrome DevTools en emulación táctil (viewport ~360–420px), verificar en los 4 juegos reales que el orden visual es pantalla → D-pad/botones (excepto Arkanoid) → barra inferior (PAUSA/REANUDAR + skin si aplica) → sin línea `.crt-bottom`; verificar que PAUSA/REANUDAR y el cambio de skin siguen funcionando igual que antes; verificar que en desktop (`pointer: fine`) el HUD y `.crt-bottom` no cambiaron respecto a antes de esta spec.

## Criterios de aceptación

- [ ] En emulación/dispositivo con `pointer: coarse`, el `.player-hud` superior de los 4 juegos reales ya no muestra el botón PAUSA/REANUDAR ni (cuando el juego tiene skins) el selector de skin; FIN y SALIR siguen visibles ahí.
- [ ] En touch, debajo del CRT (y del overlay de D-pad/botones cuando exista) aparece una barra nueva con el botón PAUSA/REANUDAR, funcional (pausa y reanuda el juego igual que antes).
- [ ] En touch, para Asteroids, Snake y Arkanoid (los 3 en `GAMES_WITH_SKINS`), esa misma barra inferior también muestra el selector de skin, funcional (cambia la skin igual que antes); Tetris (sin skins) muestra solo el botón de pausa en esa barra.
- [ ] Arkanoid muestra la barra inferior nueva en touch aunque no tenga overlay de D-pad/botones (sigue usando drag sobre el canvas para el paddle).
- [ ] En touch, la línea `.crt-bottom` ("SEÑAL OK · ... · CARGA 1MB") no se muestra en ninguno de los 4 juegos reales.
- [ ] En desktop (`pointer: fine`), el `.player-hud` (con PAUSA/FIN/SALIR y selector de skin donde corresponda) y `.crt-bottom` se ven exactamente igual que antes de esta spec — sin barra inferior nueva.
- [ ] El D-pad/botones táctiles (SPEC 11) y el drag de Arkanoid siguen funcionando sin cambios.
- [ ] `npx tsc --noEmit` no reporta errores.

## Decisiones tomadas y descartadas

- **Las stats (Jugador/Puntuación/Vidas/Nivel) se quedan en el `.player-hud` superior, sin bajar a ninguna barra nueva** (tomada, confirmada con el usuario): `pad.png` no las muestra en la barra inferior; solo se reubican los controles interactivos (pausa, skin).
- **PAUSA/REANUDAR se mueve (no se duplica) a la barra inferior en touch** (tomada, confirmada con el usuario): evita tener la misma acción disponible en dos lugares distintos de la pantalla, que sería confuso y redundante en un viewport angosto.
- **FIN y SALIR permanecen en el HUD superior, no bajan a la barra inferior** (tomada, confirmada con el usuario): son acciones de navegación/salida de la partida, distintas semánticamente del control de pausa en curso; mantenerlas arriba evita sobrecargar la barra inferior nueva.
- **El selector de skin en la barra inferior solo aparece si `hasSkins`** (tomada, confirmada con el usuario): mantiene la misma condición (`GAMES_WITH_SKINS`) ya usada hoy en el HUD superior, sin inventar una regla nueva.
- **Arkanoid también recibe la barra inferior nueva (PAUSA + skin) pese a no tener `TouchControls`** (tomada, confirmada con el usuario): Arkanoid sí está en `GAMES_WITH_SKINS` y sí se pausa/reanuda igual que los demás; la ausencia de D-pad/botones es solo por su control de drag (SPEC 11), no un motivo para excluirlo de esta reorganización de HUD.
- **`.crt-bottom` se oculta por completo en touch, en vez de reducirse/reacomodarse** (tomada, confirmada con el usuario): es puramente decorativa, no aporta información funcional, y liberar ese espacio vertical es más simple que intentar encajarla junto a la nueva barra.
- **Reutilizar las mismas clases/estado existentes (`btn yellow`, `skin`/`setSkin`, `paused`/`setPaused`) en la barra inferior, sin crear componentes ni estados nuevos** (tomada): es una reubicación de JSX, no una funcionalidad nueva; evita duplicar lógica de estado entre el HUD superior y la barra inferior.
