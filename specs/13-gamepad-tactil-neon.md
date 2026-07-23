# 13 — Rediseño visual del gamepad táctil (estilo neón)

- **Estado:** Implementado
- **Dependencias:** SPEC 11 (controles táctiles — `touch-controls.tsx`, `TOUCH_LAYOUTS`, `touchInputRef`), SPEC 12 (layout táctil del pad — `.touch-bottom-bar`, reubicación de PAUSA/skin)
- **Fecha:** 2026-07-23

## Objetivo

Rediseñar visualmente los controles táctiles del reproductor (D-pad, botones de acción y la barra inferior de pausa/skin) para que repliquen la estética del gamepad neón de `references/gamepad-assets/` — panel con borde/glow, D-pad cuadrado con flechas SVG y hub central pulsante, botones de acción circulares cyan/magenta, y botón de pausa circular — sin cambiar la lógica de input, el mapeo de teclas ni el layout de SPEC 11/12.

## Alcance

**Incluido:**

- Rediseño del componente `components/games/touch-controls.tsx`: envolver D-pad + botones de acción en un panel contenedor (`.touch-controls-panel`) con gradiente oscuro, borde cyan tenue, esquinas redondeadas y textura de puntos, análogo a `.gp` del asset.
- D-pad: los 4 botones de dirección pasan a ser cuadrados redondeados (10px) con las flechas SVG exactas de `gamepad.html` (los `<path>` de `dp-arrow`) en vez de los glifos Unicode actuales (◄▲►▼). Se agrega el hub central decorativo (`dp-hub` + `dp-hub-gem`, rombo cyan con animación `pulse-led`).
- Botones de acción: pasan a ser círculos glow con color fijo por posición de definición en `TOUCH_LAYOUTS` — el 1º de cada juego cyan, el 2º magenta (Asteroids: ▲=cyan, ●=magenta; Tetris: ROTAR=cyan, CAER=magenta). Snake no tiene botones de acción, no cambia.
- Animación de estado presionado en D-pad y botones de acción: `translateY` + aumento de glow/box-shadow + `drop-shadow` en el ícono, igual al asset (clase equivalente a `.on`/`:active`), reemplazando el feedback actual (solo cambio de color de fondo).
- Botón PAUSA/REANUDAR de `.touch-bottom-bar` (SPEC 12): rediseño completo a botón circular glow (mismo lenguaje visual que los botones de acción), conservando su `onClick`/estado.
- Selector de skin (`<select>`) de `.touch-bottom-bar`: restyle con panel oscuro + borde cyan consistente con el resto del gamepad, mismo `value`/`onChange`.
- CSS nuevo/actualizado en `app/globals.css` para todo lo anterior; ajuste del breakpoint `@media (max-width: 480px)` existente para los nuevos tamaños.

**Explícitamente fuera de alcance:**

- Cambios a `TOUCH_LAYOUTS`, al mapeo de `code` por juego, o a cualquier lógica de `pointerdown`/`pointerup`/tracking de `pointerId` — es puramente CSS/markup decorativo sobre el mismo componente.
- Cambios al drag táctil de Arkanoid (sin D-pad/botones, no tiene overlay).
- Variar la paleta según la skin activa del juego (neon/retro/clasico) — el estilo del gamepad es fijo, igual en las 3 skins.
- Cambios a FIN/SALIR del HUD superior, ni a las stats (Jugador/Puntuación/Vidas/Nivel).
- Cambios al HUD/layout en desktop (`pointer: fine`) — sigue igual que hoy.
- Tests automatizados.

## Modelo de datos

No se introduce ningún modelo de datos nuevo — es un rediseño de CSS/markup sobre el componente y las clases ya existentes. La única adición estructural es un mapeo de color por índice dentro de `touch-controls.tsx` (p. ej. `ACTION_COLOR_BY_INDEX = ["cyan", "magenta"]` usado como `ACTION_COLOR_BY_INDEX[i % 2]` al renderizar `actionButtons`), sin persistencia ni cambios a `TouchButtonDef`, `GameCanvasProps` o `EngineSnapshot`.

## Plan de implementación

1. **SVG de flechas D-pad**: en `touch-controls.tsx`, reemplazar el `label` de texto de los botones `kind: "dpad"` por los 4 `<path>` SVG del asset (`gamepad.html` líneas 191-194), envueltos en un `<svg className="touch-dpad-arrow" viewBox="0 0 24 24">`. Sin cambios de comportamiento, solo el contenido visual del botón.
2. **Hub central del D-pad**: agregar un `<div className="touch-dpad-hub"><span className="touch-dpad-hub-gem" /></div>` dentro de `.touch-controls-dpad`, posicionado en el centro de la grilla vía `grid-area` (área `.` central). Puramente decorativo, `aria-hidden`.
3. **Color por posición en botones de acción**: en `TouchControls`, al mapear `actionButtons`, calcular el color (`cyan` | `magenta`) por índice y pasarlo como prop/clase (`touch-controls-button--cyan` / `--magenta`) a `TouchButton`.
4. **Panel contenedor**: envolver el `return` de `TouchControls` en un `<div className="touch-controls-panel">` (borde, gradiente, textura de puntos) que a su vez contiene `.touch-controls-dpad` y `.touch-controls-actions` (reemplaza el `<div className="touch-controls">` actual, o lo anida — a definir en código sin romper la estructura que ya consume `game-player.tsx`).
5. **CSS — D-pad y hub**: en `app/globals.css`, reescribir `.touch-controls-button--dpad` a cuadrado redondeado (10px) con el `box-shadow`/gradiente del asset; agregar `.touch-dpad-hub` y `.touch-dpad-hub-gem` con la animación `pulse-led` (`@keyframes`).
6. **CSS — botones de acción circulares**: reescribir `.touch-controls-button--action` a círculo con `border`, gradiente radial y `box-shadow` glow; agregar variantes `--cyan`/`--magenta` (colores/`--ab-glow` del asset).
7. **CSS — estado presionado**: agregar clase de estado (aplicada vía `data-pressed` o clase condicional en `TouchButton` cuando `pointersRef.current.size > 0`) que dispare `transform: translateY(...)`, `box-shadow` intenso y `filter: drop-shadow(...)` en el SVG/label interno, para D-pad y botones de acción.
8. **CSS — panel contenedor**: agregar `.touch-controls-panel` (gradiente `#1c1c28`→`#0c0c14`, borde `rgba(0,245,255,.18)`, `border-radius`, pseudo-elementos `::before`/`::after` para el borde interior y la textura de puntos, igual a `.gp`/`.gp::before`/`.gp::after` del asset).
9. **Botón PAUSA circular en `.touch-bottom-bar`**: en `game-player.tsx`, agregar una clase nueva (`touch-pause-circle`) al botón de PAUSA/REANUDAR dentro de `.touch-bottom-bar` (sin tocar el de arriba en desktop, que ya está oculto en touch); en `globals.css`, estilarlo como círculo glow (mismo lenguaje que los botones de acción, color amarillo/dorado propio para no confundir con cyan/magenta del D-pad).
10. **Select de skin restyle**: ajustar el estilo inline del `<select>` dentro de `.touch-bottom-bar` (o mover a una clase `.touch-skin-select` en `globals.css`) para fondo oscuro + borde cyan tenue, consistente con el panel del gamepad.
11. **Ajuste de breakpoint `@media (max-width: 480px)`**: revisar los tamaños ya existentes (`.touch-controls-dpad`, `.touch-controls-button`) contra los nuevos estilos cuadrado/circular y el panel, ajustando `padding`/`gap`/tamaños del hub y círculos de acción para que seguir cabiendo en viewports 360–420px.
12. **Verificación end-to-end**: `npx tsc --noEmit` sin errores; con Chrome DevTools en emulación táctil (viewport ~360–420px), verificar en Asteroids, Tetris y Snake que el D-pad y botones de acción se ven con el nuevo estilo (panel, flechas SVG, hub pulsante, círculos cyan/magenta) y responden igual al tacto (multi-touch, sin teclas pegadas); verificar en los 4 juegos reales que `.touch-bottom-bar` muestra el botón de pausa circular y el select restyled, funcionales; confirmar que Arkanoid (sin `TouchControls`) solo recibe el cambio de `.touch-bottom-bar`; confirmar que en desktop (`pointer: fine`) nada cambia visualmente.

## Criterios de aceptación

- [ ] En emulación/dispositivo con `pointer: coarse`, el D-pad de Asteroids/Tetris/Snake se ve como panel oscuro con borde/glow cyan, 4 botones cuadrados redondeados con flechas SVG triangulares (no glifos Unicode) y un hub central con rombo cyan pulsante.
- [ ] Los botones de acción de Asteroids (▲, ●) y Tetris (ROTAR, CAER) se ven como círculos glow: el 1º cyan, el 2º magenta, replicando el estilo B/A de `gamepad-neon.png`.
- [ ] Al mantener presionado un botón (D-pad o acción), este baja ligeramente (`translateY`), su glow/`box-shadow` se intensifica y el ícono/label brilla (`drop-shadow`), igual al comportamiento `.on`/`:active` de `gamepad.html`.
- [ ] El comportamiento funcional del D-pad y los botones de acción (multi-touch por `pointerId`, sin teclas pegadas, `setKey` correcto) no cambia respecto a SPEC 11 — solo cambia el estilo visual.
- [ ] En los 4 juegos reales, `.touch-bottom-bar` muestra el botón PAUSA/REANUDAR como círculo glow funcional (pausa/reanuda igual que antes).
- [ ] En Asteroids, Snake y Arkanoid (con skins), el selector de skin de `.touch-bottom-bar` se ve con el nuevo estilo (panel oscuro, borde cyan) y sigue cambiando la skin correctamente; Tetris no muestra selector (sin cambios).
- [ ] Arkanoid no muestra D-pad/panel de `TouchControls` (sigue usando drag sobre el canvas), pero sí recibe el rediseño de `.touch-bottom-bar`.
- [ ] La paleta y el estilo del gamepad se ven igual sin importar la skin activa del juego (`neon`, `retro`, `clasico`).
- [ ] En viewport angosto (~360–420px), el panel del D-pad, los círculos de acción y `.touch-bottom-bar` caben en pantalla y son legibles/utilizables sin overlap roto.
- [ ] En desktop (`pointer: fine`), no aparece ningún elemento nuevo — el HUD y el reproductor se ven exactamente igual que antes de esta spec.
- [ ] `npx tsc --noEmit` no reporta errores.

## Decisiones tomadas y descartadas

- **Estilo fijo del gamepad, igual en las 3 skins del juego (`neon`/`retro`/`clasico`)** (tomada, confirmada con el usuario): SPEC 11/12 ya tratan los controles táctiles como una capa de input/HUD independiente de la skin visual del canvas; introducir 3 paletas del gamepad duplicaría trabajo sin un pedido claro de que "combine" con cada skin.
- **Color por posición de definición en `TOUCH_LAYOUTS` (1º cyan, 2º magenta) en vez de semántica por acción** (tomada, confirmada con el usuario): evita tener que clasificar manualmente qué acción es "fuerte" por juego; es determinístico y ya sigue el mismo orden en que estos juegos definen sus botones hoy.
- **Flechas SVG idénticas al asset en vez de glifos Unicode** (tomada, confirmada con el usuario): los glifos ◄▲►▼ dependen del renderizado de fuente del navegador/SO y no son pixel-perfect entre sí; los `<path>` del asset son consistentes en cualquier navegador y ya están definidos en `gamepad.html`.
- **Hub central decorativo con rombo pulsante SÍ se replica** (tomada, confirmada con el usuario): es parte de la identidad visual central del asset; omitirlo dejaría un hueco vacío notorio en el centro de la cruceta.
- **Panel contenedor (`.gp` equivalente) SÍ se agrega alrededor de D-pad+botones** (tomada, confirmada con el usuario): sin él, el D-pad y los botones quedarían flotando sueltos sobre el CRT sin el marco que da identidad al asset de referencia.
- **Animación de press (`translateY` + glow + `drop-shadow`) SÍ se replica** en vez de solo cambio de color de fondo (tomada, confirmada con el usuario): es la señal visual central de "botón presionado" en el asset; sin ella el rediseño se vería estático comparado con la referencia.
- **Botón PAUSA de `.touch-bottom-bar` se rediseña por completo a círculo glow** en vez de solo agregar borde/glow sutil manteniendo su forma rectangular (tomada, confirmada con el usuario): unifica el lenguaje visual circular del gamepad en todos los controles interactivos táctiles del reproductor, aunque diverja de la forma rectangular que mantienen FIN/SALIR en el HUD superior (que quedan fuera de alcance).
- **Sin cambios a `TOUCH_LAYOUTS`, al mapeo de `code`, ni a la lógica de `pointerId`/multi-touch** (tomada): esta spec es puramente visual; la lógica de input ya fue resuelta y verificada en SPEC 11, reabrirla no aporta al objetivo de esta spec.

## Riesgos identificados

- **`box-shadow`/`filter: drop-shadow` en estado presionado puede generar jank en dispositivos móviles de gama baja**, especialmente al sostener un botón mientras el juego renderiza a 60fps (Asteroids/Tetris). Se mitiga evitando animar propiedades costosas en cada frame (solo se activan/desactivan clases en `pointerdown`/`pointerup`, no hay animación continua), y si aparece jank real en pruebas, reducir el radio de blur del glow antes de eliminar la animación.
- **El botón PAUSA/REANUDAR circular no tiene espacio para el texto "REANUDAR" (9 caracteres)** que sí cabía en el botón rectangular actual. Se mitiga usando un ícono (▶/⏸) dentro del círculo en vez de texto, con el estado (pausado/no) reflejado por el ícono en lugar de la palabra completa — a definir el ícono exacto durante la implementación si no se detalla más en esta spec.
- **Los colores fijos cyan/magenta por posición pueden chocar con el significado ya asociado a esos colores en el HUD** (p. ej. `btn magenta` ya se usa para la acción "FIN", que es destructiva) — un jugador podría asociar erróneamente el botón magenta del D-pad con "terminar partida". Riesgo menor y solo estético, no funcional; no bloqueante para esta spec.
- **No hay dispositivo físico real disponible para probar** (mismo riesgo ya documentado en SPEC 11) — la verificación se hace con emulación de touch en Chrome DevTools, que puede no capturar diferencias reales de renderizado de `filter`/`box-shadow` en Safari iOS (peor soporte de GPU compositing en algunos casos).
