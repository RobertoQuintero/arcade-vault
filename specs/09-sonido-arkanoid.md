# 09 — Sonido en Arkanoid (paddle y bloques)

- **Estado:** Implementado
- **Dependencias:** SPEC 08 (Arkanoid real — define `ArkanoidEngine`, `EngineSnapshot` y `arkanoid-canvas.tsx`; esta spec extiende ambos sin tocar su contrato base de gameplay)
- **Fecha:** 2026-07-20

## Objetivo

Agregar efectos de sonido al golpear la pelota contra el paddle y al destruir un bloque en el motor de Arkanoid, portando `ball-bounce.mp3` y `break-sound.mp3` desde `references/started-games/04-arkanoid/assets/sounds/` y reproduciéndolos vía Web Audio API desde `arkanoid-canvas.tsx` en respuesta a eventos que el motor puro expone en su snapshot.

## Alcance

**Incluido:**

- Copiar `references/started-games/04-arkanoid/assets/sounds/ball-bounce.mp3` y `break-sound.mp3` tal cual (sin recomprimir) a `public/sounds/arkanoid/ball-bounce.mp3` y `public/sounds/arkanoid/break-sound.mp3`.
- `components/games/arkanoid/engine.ts`: el motor sigue siendo puro (sin `Audio`/`AudioContext`/DOM), pero acumula internamente los eventos de sonido ocurridos durante `update(dt)` (golpe de pelota contra el paddle, bloque destruido) y los expone en `getSnapshot()` a través de un campo nuevo `sounds: SoundEvent[]`. El buffer interno se vacía cada vez que `getSnapshot()` es leído (consumo de una sola vez por frame), consistente con que `arkanoid-canvas.tsx` llama `getSnapshot()` exactamente una vez por frame de `requestAnimationFrame`.
- `components/games/arkanoid/arkanoid-canvas.tsx`: crea un `AudioContext` al montar el componente (mismo `useEffect` que arma el loop del juego), decodifica ambos mp3 a `AudioBuffer` una sola vez, y reproduce el buffer correspondiente cada vez que `sounds` trae un evento nuevo en el snapshot del frame.
- Manejo de errores silencioso: si falla el `fetch`/`decodeAudioData` de algún mp3, o si `AudioContext` no está disponible en el navegador, el juego continúa funcionando normalmente sin ese sonido (sin excepciones no capturadas, sin romper el loop ni el render).

**Explícitamente fuera de alcance:**

- Sonido en rebote de pared, pérdida de vida, avance de nivel, o game over/victoria — solo los dos eventos pedidos (paddle-hit, block-break).
- Control de mute/volumen visible para el usuario, y cualquier persistencia de preferencia de sonido.
- Reintentos explícitos de `resume()` del `AudioContext` ante políticas de autoplay — se asume que el click previo en "JUGAR" ya cuenta como gesto de usuario válido.
- Sonido en Asteroids o Tetris, o cualquier infraestructura de audio compartida/reusable entre juegos (esto es específico de Arkanoid; una posible utilidad compartida de audio queda para una spec futura si se repite el patrón en otro juego).
- Recompresión, edición o normalización de volumen de los mp3 originales.
- Tests automatizados.

## Modelo de datos

No se introduce persistencia nueva. Se agrega un tipo de dato nuevo (no persistido, solo en memoria/snapshot) para comunicar eventos de sonido del motor al canvas.

### `components/games/arkanoid/engine.ts` (extensión del contrato existente)

```ts
export type SoundEvent = "paddle-hit" | "block-break";

export interface EngineSnapshot {
  score: number;
  lives: number;
  level: number;
  state: EngineState;
  sounds: SoundEvent[]; // eventos ocurridos en el último update(dt), vaciados al leer el snapshot
}
```

`sounds` normalmente tendrá 0, 1 o 2 elementos por frame (un `update(dt)` puede generar como máximo un `"paddle-hit"` y un `"block-break"` en el mismo frame, ya que la colisión con bloques rompe el loop tras el primer bloque golpeado). El motor limpia su buffer interno de eventos cada vez que `getSnapshot()` es invocado, por lo que llamar `getSnapshot()` más de una vez por frame perdería eventos — se documenta como precondición del método, igual que ya asume el loop actual de `arkanoid-canvas.tsx` (una sola llamada por `requestAnimationFrame`).

### `components/games/arkanoid/arkanoid-canvas.tsx` (estado interno nuevo, no expuesto en props)

```ts
// dentro del useEffect existente, junto al resto de refs de setup:
const audioCtx = new (
  window.AudioContext || (window as any).webkitAudioContext
)();
const buffers: Partial<Record<SoundEvent, AudioBuffer>> = {};
// carga async de ambos mp3 vía fetch + decodeAudioData, con try/catch silencioso
```

No se agrega ningún campo nuevo a `public.games`, `lib/storage.ts` ni props de `GameCanvasProps` — la reproducción de audio es un efecto colateral interno del componente, invisible para `game-player.tsx`.

## Plan de implementación

1. **Copiar los assets de audio**: crear `public/sounds/arkanoid/` y copiar `ball-bounce.mp3` y `break-sound.mp3` desde `references/started-games/04-arkanoid/assets/sounds/` sin modificarlos. Sin uso todavía, no hay cambio visible.
2. **Extender el motor con eventos de sonido**: en `components/games/arkanoid/engine.ts`, agregar el tipo `SoundEvent`, un buffer privado (`private soundEvents: SoundEvent[] = []`), emitir `"paddle-hit"` en la rama de colisión con el paddle y `"block-break"` en la rama de colisión con bloque dentro de `update(dt)`, agregar `sounds` a `EngineSnapshot`, y hacer que `getSnapshot()` devuelva una copia del buffer y lo vacíe (`this.soundEvents = []`) antes de retornar. El motor sigue sin ninguna dependencia de `Audio`/DOM.
3. **Reproducir sonido en el canvas**: en `components/games/arkanoid/arkanoid-canvas.tsx`, dentro del `useEffect` principal, crear el `AudioContext`, cargar y decodificar ambos mp3 a `AudioBuffer` (con try/catch silencioso por archivo), y en el `loop` de `requestAnimationFrame`, después de `engine.getSnapshot()`, recorrer `snapshot.sounds` reproduciendo el buffer correspondiente vía `AudioBufferSourceNode` para cada evento. Cerrar el `AudioContext` en el cleanup del efecto.
4. **Verificación end-to-end**: `npm run dev`, navegar a `/games/arkanoid/play`, jugar una partida real: confirmar que suena un efecto al rebotar la pelota en el paddle y otro distinto al destruir cada bloque, que no suena nada en rebotes de pared/pérdida de vida/cambio de nivel/game over, que el juego sigue funcionando igual si se simula un error de carga (ej. renombrando temporalmente un mp3), y que `npx tsc --noEmit` no reporta errores.

## Criterios de aceptación

- [ ] `public/sounds/arkanoid/ball-bounce.mp3` y `public/sounds/arkanoid/break-sound.mp3` existen y son servidos como archivos estáticos.
- [ ] Al rebotar la pelota en el paddle, se reproduce el sonido `ball-bounce.mp3` exactamente una vez por rebote (no se repite en bucle ni se acumula si hay varios rebotes seguidos).
- [ ] Al destruir un bloque, se reproduce el sonido `break-sound.mp3` exactamente una vez por bloque destruido.
- [ ] Ningún otro evento del juego (rebote en pared, pérdida de vida, avance de nivel, game over, victoria) reproduce sonido.
- [ ] `EngineSnapshot` expone el campo `sounds: SoundEvent[]`, vacío la mayoría de los frames y con 1-2 elementos en los frames donde ocurre una colisión relevante.
- [ ] Si se fuerza un error de carga de audio (ej. archivo faltante o `AudioContext` no soportado), el juego sigue siendo completamente jugable (movimiento, colisiones, score, game over) sin errores no capturados en consola que interrumpan la ejecución.
- [ ] Pausar el juego ("PAUSA") no genera nuevos sonidos mientras está pausado (no se llama `update(dt)`, por lo tanto no se generan eventos nuevos).
- [ ] Asteroids y Tetris no cambian de comportamiento tras este spec.
- [ ] `npx tsc --noEmit` no reporta errores.

## Decisiones tomadas y descartadas

- **Buffer de eventos en el snapshot en vez de callback inyectado** (tomada, confirmada con el usuario): mantiene `ArkanoidEngine` sin ninguna dependencia de `Audio`/`AudioContext`/DOM, preservando el contrato "motor puro" establecido en SPEC 04/07/08. El costo es una precondición sutil (`getSnapshot()` debe llamarse una sola vez por frame para no perder eventos), aceptable porque ya es el patrón real de uso en `arkanoid-canvas.tsx`.
- **Web Audio API (`AudioContext` + `AudioBuffer`) en vez de `new Audio()`** (tomada, confirmada con el usuario): el rebote en el paddle puede repetirse con frecuencia; decodificar una sola vez y reproducir vía `AudioBufferSourceNode` evita la latencia y el costo de instanciar/destruir elementos `<audio>` repetidamente.
- **Sin control de mute ni persistencia de preferencia** (tomada, confirmada con el usuario): acota el alcance a los dos efectos pedidos; un control de volumen/mute se deja para una spec futura si se generaliza a más juegos.
- **Solo paddle-hit y block-break, sin sonido en pared/vida/nivel/game-over** (tomada, confirmada con el usuario): es exactamente lo pedido por el usuario; agregar más eventos de sonido ahora ampliaría el alcance sin pedido explícito.
- **Nombres de archivo originales (`ball-bounce.mp3`, `break-sound.mp3`) sin recomprimir** (tomada, confirmada con el usuario): menor fricción al portar, coincide 1:1 con la referencia en `references/started-games/04-arkanoid/assets/sounds/`.
- **Sin infraestructura de audio compartida entre juegos** (tomada): esta spec resuelve el caso puntual de Arkanoid; si Asteroids/Tetris necesitan sonido más adelante, se evaluará extraer un hook o utilidad común en ese momento en vez de anticiparla ahora sin un segundo caso de uso real.

## Riesgos identificados

- **Políticas de autoplay del navegador**: si el `AudioContext` se crea en un estado `"suspended"` (algunos navegadores lo exigen incluso tras un click previo en otra página), los sonidos podrían no reproducirse en el primer frame hasta que el usuario interactúe directamente con el canvas (tecla o mousemove); no se agrega lógica de `resume()` explícita en esta spec (ver decisión de alcance).
- **Pérdida de eventos si `getSnapshot()` se llama más de una vez por frame**: cualquier cambio futuro a `arkanoid-canvas.tsx` que llame `getSnapshot()` dos veces en el mismo frame (por ejemplo, para depuración) vaciaría el buffer de sonido antes de que el loop principal lo consuma, perdiendo el evento silenciosamente. Se documenta como precondición del método en el modelo de datos.
- **Decodificación asíncrona de los mp3**: si el usuario destruye un bloque o toca el paddle antes de que `decodeAudioData` termine (carga lenta), ese evento puntual no sonará porque el buffer aún no está disponible; no se bloquea el inicio del juego esperando la carga de audio.
