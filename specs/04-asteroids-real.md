# 04 — Juego real de Asteroids

- **Estado:** Implementado
- **Dependencias:** SPEC 01 (MVP visual — define `GAMES`, `GamePlayer`, `saveScore`)
- **Fecha:** 2026-07-19

## Objetivo

Renombrar el juego "ROCAS" (id `rocas`) a "ASTEROIDS" (id `asteroids`) en el catálogo y reemplazar la simulación falsa de `GamePlayer` por el juego real (nave, asteroides que se dividen, disparo, power-up de disparo triple) cuando `game.id === "asteroids"`, portando la lógica de `references/started-games/02-asteroids/game.js` a un motor TypeScript en canvas que alimenta el HUD y el guardado de puntuación ya existentes.

## Alcance

**Incluido:**

- Renombrar en `lib/games.ts` el juego con id `rocas` a id `asteroids`: `id: "asteroids"`, `title: "ASTEROIDS"`, manteniendo `cover`, `color`, `cat`, `best`, `plays`, `short` y `long` tal cual.
- Nuevo motor puro (sin JSX) en `components/games/asteroids/engine.ts`, con las clases `Ship`, `Asteroid`, `Bullet`, `Particle`, `PowerUp` y las funciones de update/spawneo/colisión, portadas de `references/started-games/02-asteroids/game.js`, adaptadas a TypeScript y a dimensiones de canvas dinámicas (no fijas en 800×600).
- Nuevo componente `components/games/asteroids/asteroids-canvas.tsx`: monta el `<canvas>`, captura teclado (flechas + espacio, igual que el original), corre el loop (`requestAnimationFrame`) y dibuja **todo** el campo de juego incluyendo su propio HUD (`drawHUD`: score, nivel, iconos de vidas, indicador de disparo triple) y su propio overlay de "GAME OVER" (`drawOverlay`), igual que el original. Es decir: se mantiene el HUD y los controles propios del juego tal cual están en `game.js`.
- Además de dibujar su propio HUD, el motor expone su estado (`EngineSnapshot`: score, vidas, nivel, si terminó la partida) hacia afuera vía callback, para que el HUD externo de React (`game-player.tsx`) también se mantenga sincronizado — ambos HUD (el del canvas y el de React) muestran la misma información en paralelo.
- El componente acepta control externo de pausa (prop `paused`) que detiene el loop real (no solo lo oculta visualmente) y un método/prop para forzar el fin de partida inmediato (usado por el botón "FIN" del HUD de React).
- Power-up de disparo triple (`PowerUp`, `tripleShot`, `POWERUP_DROP_CHANCE`, `POWERUP_DURATION`, `TRIPLE_SPREAD`) portado tal cual desde `game.js`, incluyendo su indicador en el HUD del canvas.
- Modificar `components/game-player.tsx`: cuando `game.id === "asteroids"`, renderiza `AsteroidsCanvas` dentro de `.crt-screen` en lugar del `.game-arena` falso, y su HUD externo (score/vidas/nivel) más los botones Pausa/Fin/Salir y el modal de fin de partida pasan a reflejar el estado real recibido del motor (reemplazando el `setInterval` de score aleatorio y el cálculo de nivel por umbral de puntos, que quedan solo para los demás juegos). El botón "FIN" fuerza el fin de partida inmediato con el score acumulado hasta ese momento, igual que llegar a 0 vidas.
- Reinicio: el "GAME OVER" propio del canvas ya no reinicia por barra espaciadora (ese gesto quedaba pensado para jugar standalone); el reinicio real de la partida lo dispara el botón "JUGAR DE NUEVO" del modal de React, que remonta/reinicia el motor.
- El resto de juegos (`caida`, `serpentina`, `gloton`, etc.) siguen usando exactamente la simulación falsa actual, sin cambios de comportamiento.
- Canvas responsivo: ocupa el 100% del ancho/alto de `.crt-screen` (que ya mantiene `aspect-ratio: 4/3`); el motor usa las dimensiones reales del canvas en cada resize en vez de constantes fijas 800×600.

**Explícitamente fuera de alcance:**

- Controles táctiles/on-screen — solo teclado (flechas + espacio), como en el original.
- Arquitectura genérica para portar otros juegos de referencia — este spec resuelve únicamente Asteroids.
- Tabla de puntuaciones (leaderboard) por juego más allá del `saveScore()` ya existente.
- Sonido/efectos de audio.
- Tests automatizados.
- Cambios a `app/games/[id]/page.tsx` o a la generación de `seededScores` más allá de que sigan funcionando con el nuevo id `asteroids`.

## Modelo de datos

No se introduce persistencia nueva (`saveScore` y `ScoreEntry` de `lib/storage.ts` no cambian). Se agregan tipos e interfaces para el motor del juego y su comunicación con React.

### `lib/games.ts` (modificación)

El registro con id `rocas` pasa a:

```ts
{
  id: "asteroids",
  title: "ASTEROIDS",
  short: "Pulveriza asteroides en gravedad cero.",
  long: "Tu nave triangular flota en vacío absoluto. Dispara y rota para dividir rocas en fragmentos cada vez más pequeños. Cuidado con los OVNIs en el horizonte.",
  cat: "SHOOTER",
  cover: "cover-rocas",
  color: "yellow",
  best: 41200,
  plays: "15.6K",
}
```

(`cover` se deja igual ya que la clase CSS `cover-rocas` no cambia; solo cambian `id` y `title`.)

### `components/games/asteroids/engine.ts`

```ts
export type EngineState = "playing" | "dead" | "gameover";

export interface EngineSnapshot {
  score: number;
  lives: number;
  level: number;
  state: EngineState;
}

export class AsteroidsEngine {
  constructor(width: number, height: number);
  resize(width: number, height: number): void;
  update(dt: number): void;
  draw(ctx: CanvasRenderingContext2D): void; // incluye drawHUD y drawOverlay propios, como el original
  setKey(code: string, down: boolean): void;
  forceGameOver(): void;
  getSnapshot(): EngineSnapshot;
}
```

`AsteroidsEngine` encapsula el estado que en `game.js` son variables globales (`ship`, `bullets`, `asteroids`, `particles`, `powerUps`, `score`, `lives`, `level`, `state`, etc.) como propiedades de instancia. `draw()` sigue dibujando su propio HUD y overlay de game over igual que el original (`drawHUD`, `drawOverlay`). `getSnapshot()` es lo que `asteroids-canvas.tsx` reenvía a React para que el HUD externo de `GamePlayer` se mantenga sincronizado en paralelo; `forceGameOver()` lleva el motor a `state: "gameover"` de inmediato (usado por el botón "FIN" del HUD de React).

### `components/games/asteroids/asteroids-canvas.tsx`

```ts
export interface AsteroidsCanvasProps {
  paused: boolean;
  onSnapshot: (snapshot: EngineSnapshot) => void;
  forceEndRef?: React.RefObject<(() => void) | null>;
}
```

`onSnapshot` se invoca en cada frame para que `GamePlayer` actualice su HUD externo. `forceEndRef` expone `forceGameOver()` hacia `GamePlayer` para el botón "FIN".

### `components/game-player.tsx` (modificación)

No se agregan tipos nuevos; el componente reemplaza sus `useState` locales de `score`/`level`/`lives` (para el caso `asteroids`) por el `EngineSnapshot` recibido en `onSnapshot`.

## Plan de implementación

1. **Renombrar el juego en `lib/games.ts`**: cambiar `id: "rocas"` → `id: "asteroids"` y `title: "ROCAS"` → `title: "ASTEROIDS"`. El proyecto sigue compilando; `/games/asteroids` y `/games/asteroids/play` quedan navegables mostrando la simulación falsa de siempre (todavía no se tocó `GamePlayer`).
2. **Motor puro — estructuras base**: crear `components/games/asteroids/engine.ts` portando `wrap`, `dist`, `rand`, `randInt` y las clases `Bullet`, `Asteroid`, `Particle` (sin `PowerUp` todavía) desde `game.js`, adaptadas a TypeScript con tipos explícitos. Sin uso todavía, no hay cambio visible.
3. **Motor puro — `Ship` y `AsteroidsEngine`**: portar la clase `Ship` y ensamblar `AsteroidsEngine` (estado interno, `update(dt)`, `draw(ctx)` incluyendo `drawHUD`/`drawOverlay` propios, `setKey`, `getSnapshot`, `forceGameOver`, `resize`), incluyendo el ciclo completo de juego (spawneo de asteroides, colisiones bala/asteroide, nave/asteroide, split, next level, game over) tal como en `update()`/`initGame()`/`nextLevel()`/`killShip()`/`draw()` del original, pero **sin** reinicio por `Space` en `gameover` (ese gesto lo reemplaza el botón "JUGAR DE NUEVO" de React). Motor completo y jugable de forma aislada, con su propio HUD dibujado, aún sin integrar a la UI.
4. **Motor puro — power-up de disparo triple**: agregar la clase `PowerUp` y la lógica de drop/recogida/`tripleShot` al motor (incluyendo su indicador en el HUD dibujado), portada tal cual de `game.js`. Motor con paridad funcional completa respecto al original.
5. **`components/games/asteroids/asteroids-canvas.tsx`**: componente que monta el `<canvas>`, instancia `AsteroidsEngine` con las dimensiones reales del contenedor (con `ResizeObserver` o medición en montaje + resize de ventana), captura teclado con `keydown`/`keyup` hacia `setKey`, corre el loop con `requestAnimationFrame` respetando la prop `paused` (loop no llama a `update` mientras `paused === true`, pero sigue en pantalla), llama `onSnapshot` en cada frame, y expone `forceGameOver` vía `forceEndRef`. Componente autocontenido, con su HUD y overlay de game over propios visibles dentro del canvas.
6. **Integrar en `components/game-player.tsx`**: cuando `game.id === "asteroids"`, renderizar `<AsteroidsCanvas>` dentro de `.crt-screen` en vez de `.game-arena`, conectar `onSnapshot` a los `useState` de score/vidas/nivel/gameover existentes (reemplazando el `setInterval` falso y el cálculo de nivel por umbral para este caso), y conectar el botón "FIN" a `forceEndRef.current?.()`. El resto de juegos sigue exactamente igual que antes. `/games/asteroids/play` queda con el juego real, completamente jugable, mostrando el HUD del canvas y el HUD externo de React en paralelo, con guardado de puntuación funcionando.
7. **Repaso final**: jugar una partida completa (perder las 3 vidas y también usar "FIN"), confirmar que ambos HUD (canvas y React) muestran los mismos valores en todo momento, que Pausa detiene el juego de verdad, que el modal de fin de partida guarda el score real vía `saveScore`, que "JUGAR DE NUEVO" reinicia limpiamente el motor, y que los demás juegos del catálogo no cambiaron su comportamiento.

## Criterios de aceptación

- [ ] `/games/asteroids` muestra el juego con título "ASTEROIDS" (antes "ROCAS"); no queda ninguna referencia visible a "ROCAS" en el catálogo.
- [ ] `/games/asteroids/play` renderiza el juego real de Asteroids dentro del `.crt-screen` (nave, asteroides poligonales, disparo, wrap toroidal de bordes) en vez del `.game-arena` decorativo.
- [ ] Las flechas ← → rotan la nave, ↑ propulsa (con llama de propulsor visible), y Espacio dispara balas, igual que en el original.
- [ ] Los asteroides grandes se dividen en medianos y los medianos en pequeños al ser destruidos, con partículas de explosión; los pequeños desaparecen sin dividirse.
- [ ] El canvas dibuja su propio HUD (score, nivel, iconos de vidas, indicador "3x" de disparo triple), igual que el original, y en paralelo el HUD externo de React (fuera del canvas) muestra los mismos valores en tiempo real — ambos coinciden siempre.
- [ ] Los asteroides sueltan ocasionalmente el power-up de disparo triple (ícono "3x" cian); recogerlo activa disparo triple por 5 segundos, reflejado en ambos HUD.
- [ ] Al perder una vida, la nave reaparece con parpadeo de invencibilidad temporal; al perder las 3 vidas, el canvas muestra su overlay "GAME OVER" y, en paralelo, se abre el modal de fin de partida de React con la puntuación final real.
- [ ] El botón "PAUSA" detiene realmente el juego (asteroides, nave y balas dejan de moverse) y "REANUDAR" lo continúa exactamente donde quedó.
- [ ] El botón "FIN" termina la partida de inmediato con la puntuación acumulada hasta ese momento, mostrando el overlay "GAME OVER" del canvas y abriendo el modal de fin de partida de React.
- [ ] Guardar la puntuación en el modal invoca `saveScore({ game: "asteroids", score, name })` con la puntuación real de la partida jugada.
- [ ] "JUGAR DE NUEVO" del modal de React reinicia el motor completamente (nueva nave, nuevos asteroides, score/vidas/nivel en su estado inicial); la barra espaciadora ya no reinicia la partida desde el overlay del canvas.
- [ ] Limpiar un nivel completo (todos los asteroides destruidos) avanza al siguiente nivel, reflejado en ambos HUD.
- [ ] El resto de los juegos del catálogo (`caida`, `serpentina`, `gloton`, `invasores`, `ranaria`, `duelo-pixel`, `bloque-buster`) siguen mostrando la simulación falsa sin ningún cambio de comportamiento.
- [ ] Redimensionar la ventana del navegador mientras se juega ajusta el tamaño del canvas sin romper el layout ni la playabilidad.
- [ ] No hay ninguna ruta rota (404 inesperado) al navegar a `/games/asteroids` y `/games/asteroids/play` tras el renombrado del id.

## Decisiones tomadas y descartadas

- **Renombrar `rocas` → `asteroids` en vez de agregar un juego nuevo** (tomada): es el mismo juego (misma descripción, mismo cover, misma categoría SHOOTER); crear una entrada duplicada dejaría dos tarjetas para el mismo contenido en el catálogo.
- **Mantener el HUD y el overlay de "GAME OVER" propios del canvas, además del HUD externo de React** (tomada): decisión explícita del usuario — el juego conserva su experiencia autocontenida (HUD dibujado, controles) tal como en `game.js`, y adicionalmente notifica su estado a React vía `onSnapshot` para que el HUD del sitio (que además dispara el guardado de puntuación) se mantenga sincronizado. No se elimina ninguno de los dos.
- **Motor encapsulado en una clase `AsteroidsEngine` en vez de mantener variables globales de módulo** (tomada): `game.js` usa variables globales (`ship`, `bullets`, `score`, etc.) porque es un script standalone de una sola instancia; en React, donde el componente puede montarse/desmontarse y en teoría convivir con otros juegos, encapsular el estado en una instancia evita fugas de estado entre montajes.
- **Solo teclado, sin controles táctiles** (tomada): fuera de alcance explícito; el original tampoco los tenía y no fue pedido para este spec.
- **Sin arquitectura genérica reusable para otros juegos** (tomada): se prefiere resolver Asteroids de forma directa (`if (game.id === "asteroids")`) en vez de diseñar una abstracción especulativa antes de tener un segundo juego real portado que confirme el patrón correcto.
- **Reinicio de partida solo vía botón "JUGAR DE NUEVO" de React, no por barra espaciadora en el overlay del canvas** (tomada): con el modal de React controlando el flujo de fin de partida (guardar puntuación, reintentar), permitir un segundo camino de reinicio (Space) generaría dos fuentes de verdad para "cuándo empieza una partida nueva".
- **Canvas responsivo con dimensiones dinámicas en vez de 800×600 fijos escalados por CSS** (tomada): mantiene la nitidez del renderizado en cualquier tamaño de pantalla y es consistente con que el resto del sitio es responsive.
- **Incluir el power-up de disparo triple** (tomada): aunque no está en el README del juego de referencia, ya está implementado y pulido en `game.js`; omitirlo sería descartar trabajo funcional existente sin una razón concreta.

## Riesgos identificados

- **Dos HUD mostrando el mismo dato pueden desincronizarse visualmente por un frame**: como el HUD del canvas se dibuja dentro del loop `draw()` y el HUD de React se actualiza vía `onSnapshot` + `setState` (asíncrono), en momentos de alta carga podrían verse valores desfasados un frame entre ambos. Mitigación: no se requiere sincronización estricta a nivel de frame, solo que ambos converjan visualmente de inmediato; no se agrega manejo especial.
- **Pérdida del foco de teclado**: si el usuario hace clic fuera del canvas (por ejemplo en el botón "PAUSA"), los listeners de `keydown`/`keyup` están en `window` (igual que el original), por lo que el juego sigue respondiendo a teclas globalmente, incluso sin que el canvas tenga foco explícito — se mantiene el mismo comportamiento que `game.js`.
- **Cambio de tamaño del canvas en pleno juego reposiciona proporciones internas**: al redimensionar el canvas dinámicamente, un asteroide o la nave podrían quedar momentáneamente fuera del nuevo área visible hasta el siguiente `wrap()`. Es un efecto menor y transitorio; no se agrega lógica de reposicionamiento especial.
- **Renombrado de id rompe enlaces externos ya compartidos a `/games/rocas`**: al no haber redirección desde la URL antigua, cualquier enlace guardado a `/games/rocas` devolverá 404. Se acepta porque el catálogo es interno y reciente, sin usuarios reales con enlaces guardados que proteger (mismo criterio ya usado en SPEC 02 para el movimiento de rutas).
