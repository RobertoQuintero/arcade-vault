# 02 — Landing page de Arcade Vault

- **Estado:** Aprobado
- **Dependencias:** SPEC 01 (MVP visual)
- **Fecha:** 2026-07-17

## Objetivo

Implementar en `/` la landing page de Arcade Vault con la estructura de `references/templates/home-about/home.jsx` (hero, por qué Arcade Vault, vista previa de juegos, stats, actividad en vivo, precios y CTA final), migrando la Biblioteca actual de `/` a `/games` y actualizando la navegación para reflejar ambas rutas.

## Alcance

**Incluido:**

- Nueva landing en `app/page.tsx` (Client Component) con las secciones de `home.jsx`: hero con eyebrow/título/CTA, siluetas pixel decorativas flotantes, sección "¿Por qué Arcade Vault?" (feature grid de 4 tarjetas), vista previa de juegos (`GAMES.slice(0, 6)` en tarjetas simples sin tilt), stats (conteo real de `GAMES.length` en vez de "12+"), "Actividad en Vivo" (ticker de últimas puntuaciones derivado de `GAMES` — título + `best` — y lista "Top Jugadores" estática de marcador de posición), sección de precios (plan único gratuito + FAQ, solo visual) y CTA final.
- Animación reveal-on-scroll (`IntersectionObserver` que agrega la clase `.in` a `.reveal`) portada como hook, igual que en la plantilla.
- Migración de la Biblioteca actual (buscador, chips de categoría, grid con tilt 3D, estado vacío) de `app/page.tsx` a `app/games/page.tsx`, sin cambios de comportamiento.
- Nuevo componente `components/mini-game-card.tsx` (portada + título + categoría, sin tilt ni botón) para la vista previa de juegos de la landing, distinto de `GameCard`.
- Actualización de `components/nav.tsx`: nuevo link "Inicio" apuntando a `/`, el link "Biblioteca" pasa a apuntar a `/games` (y su estado activo se recalcula para `/games`, `/games/[id]` y `/games/[id]/play`), tanto en el nav de escritorio como en el panel móvil.
- Porte a `app/globals.css` del subconjunto de clases de `references/templates/home-about/styles.css` que usa `home.jsx` (secciones `home-*`, `feature-*`, `mini-*`, `stat-*`, `activity-*`, `tick-*`, `top-*`, `pricing-*`/`price-*`/`faq-*`, `final-*`, `kicker`, `section-*`, `reveal`/`.in`, siluetas `.silo`), no el archivo completo.
- Los CTAs de la landing navegan a rutas existentes: "EXPLORAR JUEGOS" / "VER TODOS LOS JUEGOS" / "INSERTAR MONEDA" → `/games`; "CREAR CUENTA" / "EMPEZAR GRATIS" → `/auth`; "VER SALÓN" → `/hall-of-fame`.

**Explícitamente fuera de alcance:**

- La página "Acerca de" (`about.jsx`) — se deja para un spec futuro; el nav no incluye ese link todavía.
- Clases CSS de `home-about/styles.css` que pertenecen solo a About o a elementos decorativos no usados por Home (ej. `about-*`, `contact-*`, `gp-*` del gamepad decorativo).
- Cualquier fuente de datos real para "Top Jugadores" (sigue siendo una lista estática de marcador de posición, igual que la plantilla) — no hay agregación real de puntuaciones entre juegos todavía.
- Lógica de pago o checkout real para la sección de precios — es puramente visual, mismo criterio que los botones sociales de Auth en el SPEC 01.
- Redirecciones o alias desde la Biblioteca en `/` — la ruta simplemente se mueve a `/games`, sin compatibilidad con la URL anterior.
- Cambios a `/games/[id]`, `/games/[id]/play`, `/hall-of-fame` o `/auth` más allá de que sigan funcionando igual tras el cambio de rutas.

## Modelo de datos

No se introduce persistencia nueva ni cambios a `lib/storage.ts`. Se agrega una función derivada en `lib/games.ts` para alimentar el ticker de actividad de la landing:

```ts
export interface ActivityRow {
  title: string;   // Game.title
  score: number;   // Game.best
  color: Game["color"];
  ago: string;      // "hace 2 min", texto fijo por posición
}

export function activityFeed(): ActivityRow[];
```

`activityFeed()` toma los juegos de `GAMES` cuyo `best` es una puntuación tipo score (se excluye `duelo-pixel`, cuyo `best: 24` representa rondas ganadas, no puntos), preservando el orden del catálogo, y les asigna en orden la misma lista fija de textos relativos que usa la plantilla (`"hace 2 min"`, `"hace 5 min"`, `"hace 8 min"`, `"hace 12 min"`, `"hace 18 min"`, `"hace 24 min"`, `"hace 31 min"`).

La lista "Top Jugadores · Hoy" se mantiene como arreglo estático de marcador de posición dentro de `app/page.tsx` (mismos valores literales de `home.jsx`: `NEONFOX 312840, PX_KAI 248110, M00NRYU 196720, VAULT_07 154300, GLITCHA 138900`), ya que no existe todavía una fuente real de puntuaciones agregadas entre juegos.

## Plan de implementación

1. **`lib/games.ts`**: agregar el tipo `ActivityRow` y la función `activityFeed()` (excluye `duelo-pixel`, asigna los textos fijos "hace X min"). El proyecto sigue compilando, sin cambios visuales.
2. **`app/globals.css`**: portar el subconjunto de clases de `references/templates/home-about/styles.css` que usa `home.jsx` (secciones `home-*`, `feature-*`, `mini-*`, `stat-*`, `activity-*`, `tick-*`, `top-*`, `pricing-*`/`price-*`/`faq-*`, `final-*`, `kicker`, `section-*`, `reveal`/`.in`, `.silo`). Sin uso todavía, no hay cambio visual.
3. **Migrar Biblioteca**: crear `app/games/page.tsx` con el contenido íntegro actual de `app/page.tsx` (buscador, chips, grid, estado vacío), sin cambios de comportamiento. `/games` queda funcional e idéntica a la Biblioteca de hoy; `/` sigue mostrando temporalmente el mismo contenido sin tocar.
4. **`components/mini-game-card.tsx`**: nuevo componente de tarjeta simple (portada + título + categoría, sin tilt) para la vista previa de juegos de la landing.
5. **Reescribir `app/page.tsx` — Hero**: eyebrow, título, subtítulo, CTAs ("EXPLORAR JUEGOS" → `/games`, "CREAR CUENTA" → `/auth`) y siluetas pixel decorativas (`FloatingSilhouettes`). La ruta raíz deja de ser la Biblioteca y muestra el hero de la landing.
6. **Actualizar `components/nav.tsx`**: agregar link "Inicio" (`/`), repuntar "Biblioteca" a `/games`, recalcular estados activos (`isHomeActive`, `isLibraryActive` cubriendo `/games`, `/games/[id]`, `/games/[id]/play`) en el nav de escritorio y en el panel móvil.
7. **`app/page.tsx` — sección "¿Por qué Arcade Vault?"**: feature grid con las 4 tarjetas y sus iconos pixel SVG.
8. **`app/page.tsx` — vista previa de juegos**: mini-rail con `MiniGameCard` sobre `GAMES.slice(0, 6)`, cada una enlazando a `/games/[id]`, y botón "VER TODOS LOS JUEGOS →" hacia `/games`.
9. **`app/page.tsx` — sección de stats**: tres bloques (`GAMES.length` + "JUEGOS", "MILES DE PARTIDAS", "GLOBAL RANKING"), con el conteo real del catálogo.
10. **`app/page.tsx` — "Actividad en Vivo"**: ticker con `activityFeed()` y lista estática "Top Jugadores · Hoy" con botón "VER SALÓN →" hacia `/hall-of-fame`.
11. **`app/page.tsx` — precios y CTA final**: tarjeta de plan único gratuito + FAQ, y sección final "¿LISTO PARA JUGAR?" con CTA hacia `/games`.
12. **`app/page.tsx` — reveal-on-scroll**: hook `useReveal` (`IntersectionObserver` que agrega `.in` a `.reveal`) aplicado a las secciones de la landing, igual que en la plantilla.
13. **Repaso final**: verificar responsive (breakpoints ya definidos en `globals.css`), estados hover/focus, y que `/` y `/games` coincidan visualmente con `home.jsx` y con la Biblioteca original, respectivamente.

## Criterios de aceptación

- [ ] `/` muestra el hero con eyebrow, título en 3 líneas, subtítulo y los dos CTAs ("EXPLORAR JUEGOS", "CREAR CUENTA"), además de las siluetas pixel decorativas.
- [ ] El CTA "EXPLORAR JUEGOS" y el botón "VER TODOS LOS JUEGOS →" navegan a `/games`; "CREAR CUENTA" y "EMPEZAR GRATIS →" navegan a `/auth`.
- [ ] `/` muestra la sección "¿Por qué Arcade Vault?" con las 4 tarjetas (JUEGOS CLÁSICOS, 100% GRATIS, LADDER BOARDS, SIEMPRE CRECIENDO), cada una con su ícono pixel.
- [ ] `/` muestra una vista previa de 6 juegos (`GAMES.slice(0, 6)`); cada tarjeta enlaza a `/games/[id]` correcto.
- [ ] `/` muestra la sección de stats con el conteo real de juegos del catálogo (8), no el texto "12+" literal.
- [ ] `/` muestra "Actividad en Vivo" con un ticker de 7 filas (excluyendo Duelo Pixel) generadas por `activityFeed()`, y la lista "Top Jugadores · Hoy" con 5 filas estáticas; el botón "VER SALÓN →" navega a `/hall-of-fame`.
- [ ] `/` muestra la sección de precios (plan único gratuito + 3 preguntas de FAQ) y la sección final "¿LISTO PARA JUGAR?" con su CTA hacia `/games`.
- [ ] Las secciones marcadas `.reveal` se animan (agregan la clase `.in`) al hacer scroll hasta que entran en el viewport.
- [ ] `/games` muestra el buscador, los chips de categoría y el grid de tarjetas con tilt 3D, con el mismo comportamiento de filtrado que tenía antes en `/`.
- [ ] El nav muestra 3 links: "Inicio" (`/`), "Biblioteca" (`/games`), "Salón de la Fama" (`/hall-of-fame`) — sin link "Acerca de".
- [ ] El nav resalta "Inicio" solo en `/`, y resalta "Biblioteca" en `/games`, `/games/[id]` y `/games/[id]/play`.
- [ ] En viewport móvil (<840px), el panel lateral del nav muestra los mismos 3 links y su estado activo coincide con el del nav de escritorio.
- [ ] No hay ninguna ruta rota (404 inesperado) al navegar por todos los enlaces del nav y de las secciones de la landing.

## Decisiones tomadas y descartadas

- **`/` pasa a ser la landing y la Biblioteca se muda a `/games`** (tomada): el `nav.jsx` de la plantilla nueva distingue "Inicio" de "Biblioteca" como rutas separadas; mantener `/` como Biblioteca hubiera dejado sin lugar a la nueva landing. `/games` es consistente con la jerarquía ya existente `/games/[id]` y `/games/[id]/play`.
- **Nombre de ruta `/games` en vez de `/biblioteca`** (tomada): sigue la convención en inglés ya usada por el resto de rutas del proyecto (`/games/[id]`, `/hall-of-fame`), aunque el contenido visible siga en español.
- **Omitir el link "Acerca de" del nav** (tomada): la página About está fuera de alcance de este spec; agregar el link ahora produciría una ruta rota (`/about` inexistente). Se agrega en el spec que implemente About.
- **Conteo real de juegos (`GAMES.length`) en vez de "12+" literal** (tomada): mostrar un número que no corresponde al catálogo real sería información falsa; usar el conteo real además se mantiene correcto si el catálogo crece.
- **Ticker de actividad derivado de `GAMES` (`activityFeed()`) en vez de copiar los arrays literales de la plantilla** (tomada): los valores de la plantilla ya coincidían 1:1 con `Game.best`, así que derivarlos evita duplicar datos que podrían desincronizarse.
- **Excluir `duelo-pixel` del ticker de actividad** (tomada): su `best: 24` representa rondas ganadas, no una puntuación en la misma escala que el resto de juegos (decenas de miles); incluirlo desentonaría visualmente en el ticker.
- **Lista fija de textos "hace X min" para el ticker** (tomada): `GAMES` no tiene timestamps; reutilizar la misma lista de textos de la plantilla es la opción más simple y fiel al diseño original.
- **"Top Jugadores · Hoy" como lista estática de marcador de posición** (tomada): no existe todavía una fuente real de puntuaciones agregadas entre juegos (ver SPEC 01, fuera de alcance del backend real); se mantiene igual que en la plantilla.
- **Nuevo componente `MiniGameCard` en vez de reutilizar `GameCard`** (tomada): la plantilla usa una tarjeta visualmente más simple (sin tilt, sin botón "JUGAR") para la vista previa de la landing; forzar `GameCard` ahí introduciría comportamiento (tilt, botón) que la plantilla no pide.
- **Portar solo el subconjunto de CSS que usa `home.jsx`** (tomada), no el archivo `home-about/styles.css` completo: evita arrastrar clases de About (`about-*`, `contact-*`) y de elementos decorativos no usados (`gp-*` del gamepad), que no aplican a este spec.
- **Sin redirección desde la antigua Biblioteca en `/`** (descartada): se consideró agregar un redirect o alias, pero no fue solicitado y el proyecto no tiene usuarios con enlaces guardados que proteger.
- **Incluir `duelo-pixel` en el ticker con su valor real** (descartada): se prefirió excluirlo por la inconsistencia de escala frente a incluir un dato que se ve como un error visual.
