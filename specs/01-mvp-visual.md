# 01 — MVP visual de Arcade Vault

- **Estado:** Implementado
- **Dependencias:** Ninguna (primer spec del proyecto)
- **Fecha:** 2026-07-14

## Objetivo

Implementar la parte visual —sin lógica de juego real— de las 5 pantallas de Arcade Vault (Biblioteca, Detalle de juego, Reproductor, Salón de la Fama, Auth) descritas en `references/templates/`, migradas a App Router de Next.js 16 con componentes React/TypeScript, un catálogo de juegos estático y persistencia mock en `localStorage` para sesión de usuario y puntuaciones guardadas.

## Alcance

**Incluido:**
- 5 rutas reales con App Router: `/` (Biblioteca), `/games/[id]` (Detalle), `/games/[id]/play` (Reproductor), `/hall-of-fame` (Salón de la Fama), `/auth` (Auth).
- Componente de navegación (`Nav`) compartido en el layout, con estado activo por ruta, menú móvil (hamburguesa + panel lateral) y botón de sesión (Iniciar sesión / nombre de usuario).
- Biblioteca: hero animado, buscador por nombre, chips de categoría (`TODOS/ARCADE/PUZZLE/SHOOTER/VERSUS`), grid de tarjetas de juego con efecto tilt 3D al hover, estado vacío "NO HAY RESULTADOS".
- Detalle: portada CSS del juego, tags, descripción, tira de estadísticas (partidas, mejor global, dificultad), botones "JUGAR AHORA" / "VOLVER AL VAULT", tabla de mejores puntuaciones (leaderboard) generada con `seededScores`.
- Reproductor: HUD (jugador, puntuación, vidas, nivel), marco CRT con la animación de "juego" de fondo (nave, enemigos, grid) igual que la plantilla, botones pausa/fin/salir, modal de fin de juego con input de iniciales y botón "GUARDAR PUNTUACIÓN" que persiste en `localStorage`. Se conserva la simulación demo (`setInterval` que sube la puntuación) tal cual está en `reproductor.jsx`, como placeholder visual — no es lógica de juego real.
- Salón de la Fama: tabs por juego, podio (oro/plata/bronce), tabla completa de puntuaciones con fila destacada "tu mejor marca" si hay sesión iniciada.
- Auth: tabs "Iniciar sesión"/"Crear cuenta", formulario mock (usuario/contraseña/email), botón "Jugar como invitado", botones sociales Google/GitHub (solo visuales, sin conexión real), guarda el nombre de usuario en `localStorage` al enviar el formulario.
- Catálogo de juegos y generador de puntuaciones (`GAMES`, `CATS`, `seededScores`) portados a un módulo TypeScript estático.
- Persistencia en `localStorage`: sesión de usuario (`av_user`) y puntuaciones guardadas (`av_scores`), igual que en las plantillas.
- Footer global con el texto de la plantilla.

**Explícitamente fuera de alcance:**
- Cualquier lógica de juego jugable real (colisiones, físicas, controles, canvas/WebGL) — los 8 juegos del catálogo no son jugables, solo tienen ficha y HUD de demostración.
- Backend, base de datos, API real, autenticación real (OAuth de Google/GitHub, hashing de contraseñas, sesiones server-side).
- Validación de formularios más allá de la que ya existe en las plantillas.
- Internacionalización / soporte multi-idioma (todo el contenido queda en español, como en las plantillas).
- Tests automatizados (no hay test runner configurado en el proyecto).
- Cambios al sistema de diseño ya portado en `app/globals.css` / `app/layout.tsx` más allá de lo necesario para que las 5 pantallas funcionen (ese trabajo ya se hizo en el commit `1180609`).

## Modelo de datos

No se introduce persistencia en servidor ni base de datos; solo estructuras estáticas en código y dos claves de `localStorage` en el cliente.

### Catálogo estático (`lib/games.ts`)

```ts
export type GameCategory = "ARCADE" | "PUZZLE" | "SHOOTER" | "VERSUS";

export interface Game {
  id: string;
  title: string;
  short: string;
  long: string;
  cat: GameCategory;
  cover: string;   // clase CSS del cover generado (ej. "cover-bricks")
  color: "cyan" | "magenta" | "yellow" | "green";
  best: number;
  plays: string;   // ej. "12.4K"
}

export const GAMES: Game[];
export const CATS: ("TODOS" | GameCategory)[];

export interface ScoreRow {
  rank: number;
  name: string;
  score: number;
  date: string; // dd/mm/yyyy
}

export function seededScores(seed: number, count?: number): ScoreRow[];
```

Contenido y valores idénticos a `references/templates/data.jsx` (los mismos 8 juegos, misma lista `PLAYERS`, mismo algoritmo pseudoaleatorio con semilla).

### Persistencia en `localStorage` (`lib/storage.ts`)

```ts
export interface StoredUser {
  name: string;
}

export interface ScoreEntry {
  game: string;   // Game.id
  score: number;
  name: string;
  at: number;     // Date.now()
}

// claves: "av_user" (StoredUser | null), "av_scores" (ScoreEntry[])
export function getUser(): StoredUser | null;
export function setUser(user: StoredUser | null): void;
export function saveScore(entry: Omit<ScoreEntry, "at">): void;
```

Estas funciones encapsulan el mismo esquema de claves (`av_user`, `av_scores`) que usa `app.jsx` en las plantillas, pero como utilidades tipadas en vez de lógica inline repetida en cada componente.

## Plan de implementación

1. **Capa de datos**: crear `lib/games.ts` (catálogo `GAMES`, `CATS`, `seededScores`) y `lib/storage.ts` (`getUser`, `setUser`, `saveScore` sobre `localStorage`), portando los valores exactos de `data.jsx` y el esquema de `app.jsx`. El proyecto sigue compilando y `app/page.tsx` no cambia todavía.

2. **Navegación global**: crear `components/nav.tsx` (Client Component) con logo, links activos por ruta (`usePathname`), contador de créditos, botón de sesión leyendo `getUser()`/`setUser(null)`, y menú móvil (hamburguesa + panel + backdrop). Integrarlo en `app/layout.tsx` junto con el footer ya definido en las plantillas. El sitio ya navega entre páginas vacías con nav y footer visibles.

3. **Biblioteca (`app/page.tsx`)**: hero, buscador, chips de categoría, grid de `GameCard` (con tilt 3D) filtrando `GAMES` por texto y categoría, estado vacío. Cada tarjeta enlaza a `/games/[id]`. La ruta raíz queda funcional y navegable.

4. **Detalle (`app/games/[id]/page.tsx`)**: portada CSS del juego, tags, descripción, tira de stats, botones de acción, leaderboard con `seededScores`. Manejar `id` inexistente con `notFound()`. Enlaza a `/games/[id]/play` y de vuelta a `/`.

5. **Reproductor (`app/games/[id]/play/page.tsx`)**: Client Component con el HUD, marco CRT con la animación de fondo (nave/enemigos/grid), simulación demo de puntuación (`setInterval`), pausa, fin de juego, modal con input de iniciales y `saveScore()`. Botón "SALIR" vuelve a `/games/[id]`.

6. **Salón de la Fama (`app/hall-of-fame/page.tsx`)**: tabs por juego, podio top 3, tabla completa con `seededScores`, fila "tu mejor marca" si `getUser()` devuelve sesión activa.

7. **Auth (`app/auth/page.tsx`)**: tabs iniciar sesión/crear cuenta, formulario mock, botón invitado, botones sociales visuales. Al enviar, llama `setUser()` y redirige a `/`. El flujo de sesión queda cerrado de punta a punta (login → nav muestra nombre → logout).

8. **Repaso final**: verificar responsive (breakpoints ya definidos en `globals.css`), estados hover/focus, y que las 5 rutas + nav + footer coincidan visualmente con `references/templates/`.

## Criterios de aceptación

- [ ] `/` muestra el hero, buscador y chips de categoría; escribir en el buscador y/o cambiar de chip filtra el grid de tarjetas en tiempo real.
- [ ] Buscar un término sin resultados muestra el estado "NO HAY RESULTADOS".
- [ ] Cada tarjeta de juego enlaza a `/games/[id]` y muestra el efecto tilt 3D al mover el mouse encima.
- [ ] `/games/[id]` muestra portada, tags, descripción, stats y una tabla de mejores puntuaciones con al menos 10 filas ordenadas por puntaje descendente.
- [ ] `/games/[id]` con un `id` que no existe en `GAMES` responde con la página 404 de Next.js.
- [ ] El botón "JUGAR AHORA" en el detalle navega a `/games/[id]/play`.
- [ ] `/games/[id]/play` muestra el HUD (jugador, puntuación, vidas, nivel) y la puntuación sube sola cada ~220ms mientras el juego no está pausado ni terminado.
- [ ] El botón "PAUSA" detiene el incremento de puntuación y muestra el overlay "EN PAUSA"; "REANUDAR" lo retoma.
- [ ] El botón "FIN" abre el modal de fin de juego con la puntuación final congelada.
- [ ] Guardar la puntuación en el modal (con iniciales) persiste una entrada en `localStorage` bajo la clave `av_scores` y muestra el mensaje de confirmación.
- [ ] `/hall-of-fame` muestra tabs por cada juego del catálogo; cambiar de tab recalcula podio y tabla para ese juego.
- [ ] Con sesión iniciada, `/hall-of-fame` muestra la fila destacada "tu mejor marca"; sin sesión, no aparece.
- [ ] `/auth` permite alternar entre "Iniciar sesión" y "Crear cuenta", mostrando el campo de correo solo en el segundo tab.
- [ ] Enviar el formulario de `/auth` (o pulsar "Jugar como invitado") guarda la sesión en `localStorage` bajo `av_user` y redirige a `/`.
- [ ] Con sesión iniciada, el nav muestra el nombre de usuario en vez de "Iniciar Sesión"; pulsarlo cierra la sesión y limpia `av_user`.
- [ ] El nav resalta el link activo según la ruta actual (`/`, `/games/[id]`, `/games/[id]/play` resaltan "Biblioteca"; `/hall-of-fame` resalta "Salón de la Fama").
- [ ] En viewport móvil (<840px), el menú hamburguesa abre/cierra el panel lateral con backdrop.
- [ ] No hay ninguna pantalla de las 5 sin implementar ni ruta rota (404 inesperado) al navegar por todos los enlaces del nav y de las pantallas.

## Decisiones tomadas y descartadas

- **Routing real con App Router** (tomada) en vez de un hash router client-side que replique `app.jsx`. Aprovecha las capacidades nativas de Next 16 (rutas, `notFound()`, navegación) y es más idiomático que replicar un router casero.
- **Nombres de ruta en inglés** (`/games`, `/games/[id]`, `/games/[id]/play`, `/hall-of-fame`, `/auth`) (tomada) sobre nombres en español, siguiendo convención de código en inglés aunque el contenido visible siga en español.
- **Mantener la simulación demo del reproductor** (`setInterval` que sube la puntuación, pausa, fin de juego) (tomada) en vez de reducirlo a una maqueta 100% estática. Se documenta explícitamente que no es lógica de juego real, solo un placeholder animado igual al de la plantilla.
- **Persistencia mock en `localStorage`** (tomada) para sesión y puntuaciones, en vez de no persistir nada. Mantiene el comportamiento de las plantillas sin requerir backend.
- **Catálogo como módulo TypeScript estático** (`lib/games.ts`) (tomada) en vez de JSON importado, para tener tipado (`Game`, `ScoreRow`) y mantener `seededScores` junto a los datos que usa.
- **No ocultar botones sociales (Google/GitHub) en Auth** (tomada): se muestran como en la plantilla, puramente visuales, sin conexión real — es un MVP visual, no funcional.
- **No rehacer el sistema visual (`globals.css`/`layout.tsx`)** (tomada): ya fue portado casi literalmente desde `styles.css` en el commit `1180609`; este spec construye las pantallas sobre esa base existente en vez de reescribirla.
- **Hash router de las plantillas** (descartada): se prefirió routing real de Next.js por ser más idiomático y aprovechar App Router.
- **Reproductor sin simulación** (descartada): se prefirió conservar la demo animada tal cual, ya que el usuario la pidió explícitamente en vez de una maqueta inerte.
