# 14 — Optimización de performance en el motor de Frogger

- **Estado:** Implementado
- **Dependencias:** Ninguna (Frogger ya implementado, specs previas 01-05 del roadmap de Frogger en el historial de commits; no hay spec numerada previa de Frogger en `specs/`, solo `specs/game-jam/frogger/01-frogger-core.md`)
- **Fecha:** 2026-07-24

## Objetivo

Optimizar el dibujo por-frame del motor de Frogger (`components/games/frogger/engine.ts`) — principalmente el uso de `ctx.shadowBlur`/`shadowColor` por entidad en la skin `neon` — pre-renderizando sprites de cada tipo de entidad una sola vez, para eliminar el jank reportado sin cambiar el aspecto visual del juego.

## Alcance

**Incluido:**

- Optimizar `drawEntity()` en `components/games/frogger/engine.ts`: en vez de fijar `ctx.shadowBlur`/`shadowColor` y redibujar la forma de cada entidad (auto, camión, tronco, tortuga) en cada frame, pre-renderizar cada variante visual (tipo × variante de color × skin × estado submerged/visible de tortuga) una sola vez en un `HTMLCanvasElement` offscreen (con el glow ya "horneado" si la skin es `neon`), y dibujar con `ctx.drawImage()` en el loop de render.
- Invalidar y regenerar la caché de sprites cuando cambia el `cellSize` (por `resize()`) o la skin activa (`setSkin()`), ya que ambos afectan el tamaño/color con el que se pre-renderiza cada sprite.
- Aplicar la misma técnica de sprite pre-renderizado a la rana (`drawFrog()`) si el profiling confirma que también aporta un costo relevante (tiene `shadowBlur` condicional a `skin.glow`, pero se dibuja una sola vez por frame vs. 15-25+ entidades).
- Medir con el panel Performance de Chrome DevTools el impacto antes/después, en un escenario reproducible: Frogger, skin `neon`, nivel avanzado (varias vueltas jugadas para que `buildLanes` genere carriles a velocidad alta con máxima densidad de entidades).
- Cualquier otra optimización puntual dentro de `engine.ts` que el profiling identifique como cuello de botella significativo durante la implementación (a documentar en el spec o en el commit si aparece).

**Explícitamente fuera de alcance:**

- `components/game-player.tsx` y el patrón `onSnapshot` → `setScore/setLives/setLevel` en cada frame (60 fps) que también causa re-renders de React. Es un problema compartido por los 5 juegos reales, no específico de Frogger — queda para una spec aparte.
- Cualquier cambio a Asteroids, Tetris, Arkanoid o Snake, aunque compartan patrones de `shadowBlur`.
- Cambios de gameplay, balance, dificultad, o al contrato del motor (`EngineSnapshot`, `setKey`, `forceGameOver`, etc.).
- Cambios visuales que alteren cómo se ve la skin `neon`, `retro` o `clasico` — el objetivo es performance, no rediseño (skin-designer no aplica aquí).
- Soporte de `devicePixelRatio` / escalado de canvas en alta densidad de píxeles (no reportado como síntoma, no se toca en esta spec).
- Tests automatizados de performance (no hay test runner configurado en el proyecto).

## Modelo de datos

No se introduce persistencia ni tipos públicos nuevos. Se agrega una estructura interna privada al motor:

- `spriteCache: Map<string, HTMLCanvasElement>` — caché en memoria dentro de `FroggerEngine`, no exportada. La clave combina todo lo que afecta el resultado visual pre-renderizado, por ejemplo:
  `` `${type}:${variant ?? 0}:${submerged ?? false}:${cellSizeBucket}:${skinName}` ``
  (donde `type` es `"car" | "truck" | "log" | "turtle" | "frog"`, `variant` selecciona el color dentro de `skin.carColors`, y `skinName` es la skin activa — `clasico` | `neon` | `retro`).
- La caché se limpia por completo (`spriteCache.clear()`) en `resize()` y en `setSkin()`, ya que ambos invalidan todas las entradas existentes (cambia el tamaño en px o los colores/glow de la skin).
- Los sprites se generan de forma perezosa: la primera vez que `drawEntity`/`drawFrog` necesita una clave no presente en la caché, la renderiza a un canvas offscreen del tamaño `cellSize × cellSize` (o el bounding box que corresponda) y la guarda; frames siguientes reutilizan la entrada con `drawImage()`.

## Plan de implementación

1. **Baseline de medición**: con la app corriendo (`npm run dev`), abrir Frogger con skin `neon`, jugar hasta un nivel avanzado (varias rondas) para maximizar densidad/velocidad de entidades, y capturar un perfil de ~10s con el panel Performance de Chrome DevTools. Registrar FPS promedio y tiempo de scripting/rendering atribuible a `draw()`/`drawEntity()`. Este perfil "antes" es la referencia para comparar al final.
2. **Utilidad de generación de sprites**: en `engine.ts`, agregar un método privado `private getOrCreateSprite(key: string, size: number, render: (c: CanvasRenderingContext2D, size: number) => void): HTMLCanvasElement` que busca en `this.spriteCache`, y si no existe, crea un `document.createElement("canvas")` del tamaño dado, ejecuta `render` sobre su contexto 2D, lo guarda en la caché y lo retorna.
3. **Extraer el dibujo de cada tipo de entidad a funciones "render into sprite"**: refactorizar el cuerpo actual de `drawEntity()` (casos `car`, `truck`, `log`, `turtle`) para que cada rama dibuje sobre un contexto de sprite aislado (coordenadas relativas a `(0,0)`, tamaño `width_px × cellSize`) en vez de sobre el `ctx` del canvas principal con `shadowBlur` aplicado por-frame. El `shadowBlur`/`shadowColor` para el glow de la skin `neon` se aplica **una sola vez, al generar el sprite**, no en cada frame.
4. **Reescribir `drawEntity()`**: calcular la `key` de caché según tipo/variante/submerged/cellSize/skin, obtener el sprite vía `getOrCreateSprite()`, y dibujarlo con `ctx.drawImage(sprite, x, y)` en la posición correspondiente a `e.col`/`lane.row`. Quitar el `ctx.shadowBlur`/`shadowColor` del `ctx` principal en esta función.
5. **Invalidación de caché**: en `resize()`, después de recalcular `cellSize`, llamar `this.spriteCache.clear()`. En `setSkin()`, después de asignar `this.skin`, llamar también `this.spriteCache.clear()`.
6. **Evaluar `drawFrog()`**: con el perfil del paso 1, si el dibujo de la rana (glow condicional) representa un costo medible, aplicar la misma técnica de sprite cacheado (clave por `skinName` + `cellSize`, ya que la rana no cambia de color por variante). Si el costo es despreciable, dejarla como está y documentarlo en la spec/commit.
7. **Verificación funcional manual**: jugar Frogger completo en las 3 skins (`clasico`, `neon`, `retro`) — cruzar carretera, saltar sobre troncos/tortugas (incluyendo el ciclo de inmersión), llegar a las 5 metas, perder una vida, game over y reinicio — confirmando que el aspecto visual es idéntico al de antes del cambio (sin regresiones visuales) y que el juego responde igual a los controles.
8. **Verificación de resize/cambio de skin en caliente**: redimensionar la ventana del navegador durante una partida y cambiar de skin desde el selector del HUD, confirmando que las entidades se ven correctas con el nuevo tamaño/color (sin sprites "viejos" pegados de la caché).
9. **Medición final**: repetir el mismo escenario del paso 1 (Frogger, skin `neon`, nivel avanzado, ~10s de perfil) y comparar FPS/tiempo de scripting contra el baseline.
10. **Verificación de tipos**: `npx tsc --noEmit` sin errores.

## Criterios de aceptación

- [x] `drawEntity()` en `components/games/frogger/engine.ts` ya no llama a `ctx.shadowBlur`/`shadowColor` sobre el contexto principal en cada frame para autos, camiones, troncos y tortugas — el glow (si aplica) se pre-renderiza una sola vez por combinación tipo/variante/submerged/tamaño/skin.
- [x] Las entidades se dibujan vía `ctx.drawImage()` desde una caché de sprites (`spriteCache`), generada de forma perezosa (`getOrCreateSprite`).
- [x] La caché de sprites se invalida correctamente (`.clear()`) al redimensionar el canvas (`resize()`) y al cambiar de skin (`setSkin()`) — no quedan sprites con tamaño o color incorrecto tras esos eventos.
- [x] El aspecto visual de Frogger es indistinguible del original en las 3 skins (`clasico`, `neon`, `retro`): mismos colores, mismo glow en `neon`, mismas formas de auto/camión/tronco/tortuga/rana. Verificado manualmente.
- [x] El gameplay no cambia: cruces de carretera, saltos sobre troncos/tortugas, ciclo de inmersión de tortugas, las 5 metas, pérdida de vidas, game over y reinicio funcionan igual que antes de la optimización. Verificado manualmente.
- [x] Medido con el panel Performance de Chrome DevTools en el mismo escenario (Frogger, skin `neon`, nivel avanzado, ~10s de perfil): ~58 fps promedio, tiempo de scripting atribuible a `draw()` reducido de ~14ms a ~4ms por frame. Nota: no se capturó un perfil "antes" formal (paso 1 del plan se omitió a pedido del usuario), por lo que estos números documentan el estado post-optimización, no una comparación directa antes/después.
- [x] `npx tsc --noEmit` no reporta errores.

## Decisiones tomadas y descartadas

- **Alcance acotado solo a Frogger** (tomada, confirmada con el usuario): aunque el patrón de re-render por `onSnapshot` en `game-player.tsx` afecta a los 5 juegos reales, el usuario pidió enfocar esta spec únicamente en Frogger. Ese fix compartido queda para una spec aparte.
- **Sprites pre-renderizados en vez de reducir/quitar el glow** (tomada, confirmada con el usuario): frente a la alternativa de bajar `glowBlur` o aplicar el glow solo a rana/metas, se prefirió mantener el resultado visual exactamente igual y eliminar el costo re-renderizando una sola vez por combinación tipo/variante/skin/tamaño, en vez de recalcularlo 60 veces por segundo por entidad.
- **Caché en memoria (`Map`) dentro de la instancia del motor, sin persistencia** (tomada): los sprites dependen de `cellSize` (que cambia con el viewport) y de la skin activa, por lo que no tiene sentido persistirlos entre sesiones ni compartirlos entre instancias del motor.
- **Invalidación total de la caché en `resize()`/`setSkin()` en vez de invalidación selectiva por clave** (tomada): son eventos poco frecuentes (no ocurren en el loop de 60fps), así que el costo de regenerar todos los sprites en esos momentos es despreciable comparado con la complejidad de invalidar solo las claves afectadas.
- **`drawFrog()` se optimiza condicionalmente, según lo que muestre el profiling del paso 1** (tomada, confirmada con el usuario vía el plan): a diferencia de las entidades de carriles (15-25+ por frame), la rana se dibuja una sola vez por frame, por lo que su costo individual de `shadowBlur` es mucho menor; no se justifica optimizarla a priori sin medir primero.
- **Verificación por medición en DevTools Performance en vez de solo verificación visual/subjetiva** (tomada, confirmada con el usuario): da un criterio de aceptación objetivo (FPS/tiempo de scripting antes vs. después) en vez de depender de una percepción de "se siente más fluido".

## Riesgos identificados

- **Bug de invalidación de caché**: si se olvida limpiar `spriteCache` en algún punto donde cambia el tamaño o color relevante (por ejemplo, si en el futuro se agrega una nueva variante de color dinámica), podrían quedar sprites "pegados" con el aspecto incorrecto. Mitigado incluyendo la limpieza explícitamente en `resize()` y `setSkin()`, y verificado manualmente en el paso 8 del plan.
- **Costo de generación perezosa en el primer frame de cada combinación nueva**: la primera vez que aparece una combinación tipo/variante/submerged/tamaño/skin no vista antes, se paga el costo de renderizarla (antes de guardarla en caché), lo que podría causar un micro-frame más lento la primera vez. Riesgo menor: ocurre pocas veces por partida (variantes limitadas por `skin.carColors.length` y tamaños fijos), no en cada frame.
- **Memoria de la caché**: cada combinación agrega un `HTMLCanvasElement` en memoria. Con las combinaciones acotadas (4-5 tipos × pocas variantes × 2 estados de tortuga × 1 tamaño activo × 1 skin activa a la vez, ya que se limpia en `setSkin`/`resize`), el número de entradas vivas simultáneamente es pequeño (decenas), sin riesgo real de crecimiento descontrolado.
- **La ganancia medida puede ser menor a la esperada si el cuello de botella real no es `shadowBlur`**: el profiling del paso 1 podría revelar que el costo dominante está en otro lado (por ejemplo, el propio `requestAnimationFrame`/composición del navegador). Mitigado por medir primero (paso 1) y decidir sobre `drawFrog()` (paso 6) en base a datos reales, no a suposiciones.
