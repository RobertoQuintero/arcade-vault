# 11 — Controles táctiles para móvil

- **Estado:** Implementado
- **Dependencias:** SPEC 04 (Asteroids real — contrato de motor `setKey`/`EngineSnapshot`), SPEC 07 (Tetris real), SPEC 08 (Arkanoid real — control por mouse a portar a touch), SPEC 10 (Snake real); además el sistema de skins (`components/games/skins.ts`, sin spec numerado) que ya extiende `GameCanvasProps`
- **Fecha:** 2026-07-21

## Objetivo

Hacer jugables los 4 juegos reales (Asteroids, Tetris, Arkanoid, Snake) en dispositivos móviles táctiles agregando un overlay de controles en pantalla (D-pad + botones de acción) que reutiliza el `setKey(code, down)` ya existente de cada motor sin modificar su contrato, más drag directo sobre el canvas para el paddle de Arkanoid, detección automática de touch, y los ajustes de CSS necesarios para que el reproductor sea usable y sin gestos molestos del navegador en pantallas angostas.

## Alcance

**Incluido:**

- Detección automática de dispositivo táctil en `components/game-player.tsx` vía `matchMedia("(pointer: coarse)")` (hook `useIsTouchDevice` o lógica inline con `useEffect` + `useState`, sin depender de ancho de viewport).
- Componente nuevo `components/games/touch-controls.tsx`: overlay de D-pad + botones de acción, configurado por juego mediante un mapa `TOUCH_LAYOUTS: Record<string, TouchButtonDef[]>` (D-pad izquierda / botones de acción derecha, ver Modelo de datos). Traduce cada botón a llamadas `touchInput(code, true)` / `touchInput(code, false)` usando **Pointer Events** (`pointerdown`/`pointerup`/`pointercancel`/`pointerleave`) para trackear cada dedo por `pointerId` y evitar teclas "pegadas" si el usuario desliza el dedo fuera del botón.
- Extensión de `GameCanvasProps` (`components/games/registry.ts`) con un prop opcional `touchInputRef?: RefObject<((code: string, down: boolean) => void) | null>`, siguiendo el mismo patrón ya establecido por `forceEndRef`. Se implementa en `asteroids-canvas.tsx`, `tetris-canvas.tsx` y `snake-canvas.tsx` (poblando el ref con `(code, down) => engine.setKey(code, down)`), **no** en Arkanoid.
- `arkanoid-canvas.tsx`: se agregan listeners `touchstart`/`touchmove` sobre el `<canvas>` que calculan la misma fracción horizontal que ya usa `handleMouseMove` y llaman `engine.setPaddleX(fraction)` — drag directo, sin botones ni D-pad para este juego. `touch-action: none` en el canvas para que el drag no dispare scroll.
- Render condicional en `game-player.tsx`: `<TouchControls gameId={game.id} touchInputRef={touchInputRef} />` solo cuando `isReal && isTouchDevice && game.id !== "arkanoid"`.
- CSS nuevo para `.touch-controls` (overlay posicionado sobre/bajo `.crt-screen`, botones con área de toque mínima 44×44px) y `touch-action: none` aplicado al área de juego (`.crt-screen`, `.touch-controls`) para evitar pull-to-refresh, pinch-zoom y scroll accidental mientras se juega.
- Revisión y ajuste (si hace falta) del layout responsive existente de `/games/[id]/play` en viewports angostos (~360–420px): `.player-hud`, `.hud-actions`, `.crt`/`.crt-screen` — que ya son fluidos (`max-width`, `flex-wrap`, `aspect-ratio`) pero no han sido verificados con el nuevo overlay de controles ocupando espacio debajo del `.crt`.
- Mapeo de botones por juego (mismos `code` que ya consume cada motor, sin nuevas teclas):
  - **Asteroids:** D-pad (`ArrowLeft`/`ArrowRight` rotar) + botones `▲` (`ArrowUp`, empuje) y `●` (`Space`, disparo).
  - **Tetris:** D-pad (`ArrowLeft`/`ArrowRight` mover, `ArrowDown` soft drop) + botones `ROTAR` (`ArrowUp`) y `CAER` (`Space`, hard drop). (`KeyX` del teclado no se mapea a botón — es alterno a `ArrowUp`.)
  - **Snake:** solo D-pad de 4 direcciones (`ArrowLeft/Right/Up/Down`), sin botones de acción.
  - **Arkanoid:** sin D-pad ni botones — drag sobre el canvas.

**Explícitamente fuera de alcance:**

- Soporte de gamepad/mando físico Bluetooth.
- Controles por gestos de swipe (solo botones tap-and-hold).
- Bloqueo de orientación de pantalla o layout específico "landscape-only".
- Vibración/haptics al tocar los botones.
- Juegos falsos/decorativos del catálogo (sin motor real, no hay `setKey` que mapear) y los juegos de `specs/game-jam/` (Hopper, Lane Duel — aún no implementados, no están en `GAME_CANVASES`).
- Cambios al contrato del motor (`setKey`, `EngineSnapshot`, etc.) — la integración es puramente aditiva vía el nuevo `touchInputRef`.
- Rediseño visual del HUD o del `.crt` más allá de los ajustes mínimos de espacio/tamaño necesarios para que el overlay de controles quepa.
- Tests automatizados.

## Modelo de datos

No se introduce persistencia nueva (no hay tabla ni localStorage nuevos). Se agregan tipos en memoria para la configuración del overlay y la comunicación canvas↔controles.

### `components/games/registry.ts` (extensión del contrato existente)

```ts
export interface GameCanvasProps {
  paused: boolean;
  onSnapshot: (snapshot: EngineSnapshot) => void;
  forceEndRef?: RefObject<(() => void) | null>;
  skin?: SkinName;
  touchInputRef?: RefObject<((code: string, down: boolean) => void) | null>; // ← nuevo, opcional
}
```

`touchInputRef` sigue el mismo patrón que `forceEndRef`: el componente canvas, dentro de su `useEffect` de montaje, hace `if (touchInputRef) touchInputRef.current = (code, down) => engine.setKey(code, down);` y lo limpia (`= null`) en el cleanup. Arkanoid no lo implementa (usa drag directo, sin botones).

### `components/games/touch-controls.tsx` (componente nuevo)

```ts
export type TouchButtonKind = "dpad" | "action";

export interface TouchButtonDef {
  code: string; // mismo `code` que ya consume engine.setKey (ej. "ArrowLeft", "Space")
  label: string; // glifo/texto del botón (ej. "▲", "●", "ROTAR", "CAER")
  kind: TouchButtonKind; // "dpad" → agrupado en la cruceta izquierda; "action" → botón suelto a la derecha
}

export const TOUCH_LAYOUTS: Record<string, TouchButtonDef[]> = {
  asteroids: [
    { code: "ArrowLeft", label: "◄", kind: "dpad" },
    { code: "ArrowRight", label: "►", kind: "dpad" },
    { code: "ArrowUp", label: "▲", kind: "action" },
    { code: "Space", label: "●", kind: "action" },
  ],
  tetris: [
    { code: "ArrowLeft", label: "◄", kind: "dpad" },
    { code: "ArrowRight", label: "►", kind: "dpad" },
    { code: "ArrowDown", label: "▼", kind: "dpad" },
    { code: "ArrowUp", label: "ROTAR", kind: "action" },
    { code: "Space", label: "CAER", kind: "action" },
  ],
  snake: [
    { code: "ArrowLeft", label: "◄", kind: "dpad" },
    { code: "ArrowRight", label: "►", kind: "dpad" },
    { code: "ArrowUp", label: "▲", kind: "dpad" },
    { code: "ArrowDown", label: "▼", kind: "dpad" },
  ],
  // "arkanoid" no tiene entrada — sin overlay, drag directo en el canvas.
};

export interface TouchControlsProps {
  gameId: string;
  touchInputRef: RefObject<((code: string, down: boolean) => void) | null>;
}
export function TouchControls(props: TouchControlsProps): JSX.Element | null; // null si gameId no está en TOUCH_LAYOUTS
```

Cada botón trackea sus propios `pointerId` activos (`Set<number>` en un `useRef` dentro de `TouchControls`) para soportar multi-touch (ej. sostener `ArrowLeft` con un dedo y `Space` con otro en Asteroids) sin que un `pointerup` de un dedo distinto libere la tecla de otro.

### `components/game-player.tsx` (estado nuevo, no persistido)

```ts
const [isTouchDevice, setIsTouchDevice] = useState(false); // matchMedia("(pointer: coarse)") en useEffect
const touchInputRef = useRef<((code: string, down: boolean) => void) | null>(
  null,
);
```

No se agrega ningún campo a `public.games`, `lib/storage.ts` ni a `EngineSnapshot` — es exclusivamente input, sin efecto en el modelo de puntuación/leaderboard.

## Plan de implementación

1. **Extender `GameCanvasProps`**: agregar `touchInputRef` opcional en `components/games/registry.ts` (tipo en Modelo de datos). Sin uso todavía, no hay cambio visible.
2. **Poblar `touchInputRef` en los 3 canvases con botones**: en `asteroids-canvas.tsx`, `tetris-canvas.tsx` y `snake-canvas.tsx`, dentro del `useEffect` de montaje (junto a donde ya se asigna `forceEndRef.current`), agregar `if (touchInputRef) touchInputRef.current = (code, down) => engine.setKey(code, down);` y limpiarlo en el cleanup. Mismo patrón ya usado por `forceEndRef`, sin tocar la lógica de teclado existente.
3. **Drag táctil en Arkanoid**: en `arkanoid-canvas.tsx`, agregar `touchstart`/`touchmove` sobre el `<canvas>` que reutilizan el cálculo de fracción de `handleMouseMove` y llaman `engine.setPaddleX(fraction)`; `preventDefault()` en esos handlers y `touch-action: none` en el estilo del canvas para que el drag no dispare scroll de la página.
4. **Componente `components/games/touch-controls.tsx`**: crear `TOUCH_LAYOUTS`, `TouchButtonDef`, y el componente `TouchControls` que renderiza la cruceta (`kind: "dpad"`) agrupada a la izquierda y los botones de acción (`kind: "action"`) a la derecha, usando Pointer Events con tracking de `pointerId` por botón (ver Modelo de datos). Devuelve `null` si `TOUCH_LAYOUTS[gameId]` no existe (caso Arkanoid). Sin integrar todavía en `game-player.tsx`.
5. **Detección de touch e integración en `game-player.tsx`**: agregar `isTouchDevice` (vía `matchMedia("(pointer: coarse)")` en un `useEffect`) y `touchInputRef`; pasar `touchInputRef` como prop a `<Canvas>`; renderizar `<TouchControls gameId={game.id} touchInputRef={touchInputRef} />` dentro de `.crt` (debajo o superpuesto a `.crt-screen`, ver paso 6) solo cuando `isReal && isTouchDevice`.
6. **CSS — overlay y prevención de gestos**: en `app/globals.css`, agregar estilos `.touch-controls` (posicionamiento, tamaño mínimo de toque 44×44px, D-pad izquierda / acciones derecha) y `touch-action: none` en `.crt-screen` y `.touch-controls`. Revisar en DevTools (emulación de viewport 360–420px de ancho) que `.player-hud`, `.hud-actions` y `.crt` sigan siendo legibles y utilizables con el overlay presente; ajustar `gap`/`padding`/tamaño de fuente en esos breakpoints solo si es necesario (no rediseño completo).
7. **Verificación end-to-end**: `npx tsc --noEmit` sin errores; con Chrome DevTools en modo dispositivo móvil (touch emulation), jugar una partida completa de cada uno de los 4 juegos comprobando: los botones táctiles mueven/disparan/rotan correctamente, el drag mueve el paddle en Arkanoid, no hay scroll/zoom accidental de la página durante el juego, el teclado físico sigue funcionando igual que antes en desktop (sin regresión), y que el overlay no aparece en desktop con mouse (sin `pointer: coarse`).

## Criterios de aceptación

- [ ] En un dispositivo/emulación con `pointer: coarse`, `/games/asteroids/play`, `/games/tetris/play` y `/games/snake/play` muestran un overlay de controles táctiles (D-pad + botones de acción según corresponda); en desktop con mouse (`pointer: fine`) el overlay no aparece.
- [ ] `/games/arkanoid/play` no muestra D-pad ni botones, pero arrastrar el dedo sobre el canvas mueve el paddle igual que el mouse.
- [ ] Los botones táctiles de Asteroids rotan la nave, la empujan hacia adelante y disparan, reproduciendo exactamente el comportamiento de `ArrowLeft`/`ArrowRight`/`ArrowUp`/`Space` del teclado.
- [ ] Los botones táctiles de Tetris mueven la pieza, hacen soft drop, rotan y hacen hard drop, reproduciendo el comportamiento de `ArrowLeft`/`ArrowRight`/`ArrowDown`/`ArrowUp`/`Space`.
- [ ] El D-pad táctil de Snake mueve la serpiente en las 4 direcciones sin permitir inversión de 180°, igual que el teclado.
- [ ] Sostener dos botones táctiles a la vez con dos dedos (ej. `ArrowLeft` + `Space` en Asteroids) mantiene ambas teclas activas simultáneamente sin que soltar un dedo afecte al otro botón.
- [ ] Levantar el dedo de un botón (`pointerup`/`pointercancel`/`pointerleave`) libera esa tecla (`setKey(code, false)`) de forma confiable, sin teclas que queden "pegadas".
- [ ] Mientras se juega (drag en Arkanoid o toques en los botones/D-pad), no se dispara scroll de la página, pull-to-refresh ni pinch-zoom.
- [ ] En viewport angosto (~360–420px), el HUD (`player-hud`), los botones PAUSA/FIN/SALIR y el `.crt` con el overlay de controles caben en pantalla y son legibles/utilizables sin overlap roto.
- [ ] El comportamiento por teclado en desktop (todos los juegos) no cambia respecto a antes de esta spec.
- [ ] PAUSA/REANUDAR/FIN siguen funcionando igual con controles táctiles activos (pausar detiene el juego aunque se mantenga un botón táctil presionado).
- [ ] `npx tsc --noEmit` no reporta errores.

## Decisiones tomadas y descartadas

- **Overlay genérico en `game-player.tsx` reutilizando `setKey` vía `touchInputRef`, en vez de que cada motor exponga métodos táctiles nuevos** (tomada, confirmada con el usuario): mantiene el contrato de motor (`constructor`, `resize`, `update`, `draw`, `setKey`, `forceGameOver`, `getSnapshot`) intacto en los 4 juegos — el mismo criterio de "motor puro" ya aplicado en SPEC 09 para no acoplar los motores a APIs de UI/DOM. El overlay es puramente un traductor de gestos táctiles a los mismos `code` que ya entiende `setKey`.
- **Patrón `touchInputRef` calcado de `forceEndRef`** (tomada): `forceEndRef` ya establece el precedente de un `RefObject` opcional que el canvas popula con una función imperativa hacia el motor; reutilizar el mismo patrón evita introducir un mecanismo de comunicación nuevo (ej. context, event bus) para un caso ya resuelto.
- **Detección por `matchMedia("(pointer: coarse)")` en vez de breakpoint de ancho de viewport** (tomada, confirmada con el usuario): identifica capacidad táctil real (incluye tablets en modo split-screen o laptops sin touch con ventana angosta se excluyen correctamente), más preciso que inferir touch a partir del ancho de pantalla.
- **Arkanoid usa drag directo sobre el canvas en vez de D-pad de botones** (tomada, confirmada con el usuario): el control ya es analógico (mousemove → `setPaddleX(fraction)`), y un dedo arrastrando reproduce esa misma precisión; agregar botones izquierda/derecha sería un paso atrás respecto al control por mouse ya implementado en SPEC 08.
- **Pointer Events con tracking de `pointerId` en vez de Touch Events crudos (`touchstart`/`touchend`)** (tomada): los botones necesitan soportar multi-touch de forma robusta (dos dedos en dos botones distintos); Pointer Events unifican mouse/touch/pen y traen `pointerId` nativo para asociar cada contacto a su botón, evitando bugs de "tecla pegada" al usar `TouchList` manualmente.
- **Sin soporte de gamepad físico ni gestos de swipe** (tomada, confirmada con el usuario): acota el alcance a botones táctiles tap-and-hold, que es lo pedido; swipe y gamepad quedan para una spec futura si se necesitan.
- **Ajustes de CSS responsive mínimos (no rediseño) en vez de una spec separada de "mobile layout"** (tomada, confirmada con el usuario): el layout de `.av-player`/`.crt`/`.player-hud` ya es mayormente fluido (`max-width`, `flex-wrap`, `aspect-ratio`); esta spec solo corrige lo que el nuevo overlay de controles rompa o haga ilegible, sin rehacer el diseño visual del reproductor.

## Riesgos identificados

- **Falsos positivos de `pointer: coarse`**: algunas laptops híbridas/2-en-1 con pantalla táctil y teclado físico reportarán `pointer: coarse` y mostrarán el overlay aunque el usuario prefiera jugar con teclado. No es bloqueante — el overlay coexiste con el teclado (ambos llaman al mismo `setKey`), así que el usuario puede simplemente ignorar los botones en pantalla.
- **`preventDefault()` en `touchmove` de Arkanoid puede chocar con el `ResizeObserver`/scroll del contenedor** si el canvas no ocupa el 100% del área táctil esperada; se mitiga con `touch-action: none` en el propio canvas en vez de depender solo de `preventDefault()` en JS, que en algunos navegadores (Safari iOS) requiere el listener registrado como `{ passive: false }`.
- **Multi-touch con más dedos que botones definidos** (ej. un dedo extra apoyado accidentalmente en el borde de la pantalla) podría registrar un `pointerId` que no corresponde a ningún botón; al no estar asociado a ningún `TouchButtonDef`, simplemente no dispara ningún `setKey` — sin efecto funcional, pero no se filtra explícitamente por precisión del toque (fuera de alcance un sistema de hit-testing más robusto).
- **No hay dispositivo físico real disponible para probar** — la verificación se hace con emulación de touch en Chrome DevTools (que sí simula Pointer/Touch Events y `matchMedia`), pero puede no capturar diferencias reales de Safari iOS (políticas de `touch-action`, `-webkit-touch-callout`, elastic scroll de iOS) que solo aparecerían en un dispositivo físico.
- **Overlay de controles superpuesto al `.crt-screen` puede tapar parte del área jugable** si no se deja suficiente margen inferior/lateral en el canvas; se mitiga verificando visualmente en el paso 6 del plan de implementación que el D-pad y los botones de acción no cubran zonas críticas del juego (ej. la parte baja del tablero de Tetris).
