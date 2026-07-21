# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

Arcade Vault — a platform for playing classic arcade games online and competing for the highest scores (README is in Spanish; UI copy is Spanish). Games run in the browser on `<canvas>`, scores persist to Supabase, and a shared leaderboard ("Hall of Fame") ranks players across all games.

Currently implemented as **real, playable** games: **Asteroids**, **Tetris**, **Arkanoid** (with sound), and **Snake**. The catalog, home, detail, player and leaderboard are all data-driven off the Supabase `games` table, so adding a game is additive — no page rewrites.

No test runner is configured. Verify changes with `npx tsc --noEmit` and by running the app (`npm run dev`).

## Skills

- **Usa siempre `/frontend-design` para diseñar la interfaz de usuario** o arte de covers.
- **`/game-impl`** (`.claude/skills/game-impl/`) — the project's own spec-first workflow to add a real game end-to-end: writes the spec, ports/creates the engine, canvas component, registry entry, cover, and the Supabase `games` row. Read its `SKILL.md` and `game-integration.md` (the engine/canvas/registry/migration templates) before adding any game. It codifies the pattern established by Asteroids and specs 04–06.

## Stack

- Next.js 16.2 (App Router), React 19, TypeScript (strict), Tailwind CSS v4 (via `@tailwindcss/postcss`, no `tailwind.config` — v4 is CSS-first, see `app/globals.css`)
- Supabase (`@supabase/supabase-js`, `@supabase/ssr`) — auth + Postgres for `games` and `scores`
- Resend (`resend`) — transactional email for the contact form
- Google fonts loaded via `next/font`: Press Start 2P (`--font-pixel`), JetBrains Mono (`--font-mono`), Courier Prime (`--font-courier`)
- Path alias `@/*` maps to the repo root (`tsconfig.json`)

### Environment variables

- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY` — Supabase client/server
- `RESEND_API_KEY`, `CONTACT_TO_EMAIL` — contact form (`app/about/actions.ts`)

## Architecture

### Routes (`app/`)

- `/` — home (`page.tsx` + `home-content.tsx`), dynamic featured games + activity feed
- `/games` — catalog (`page.tsx` + `games-library.tsx`), category tabs (`TODOS`/`ARCADE`/`PUZZLE`/`SHOOTER`/`VERSUS`)
- `/games/[id]` — game detail + per-game leaderboard
- `/games/[id]/play` — the player (`game-player.tsx`)
- `/hall-of-fame` — global leaderboard
- `/about` — about + contact form (Server Action → Resend)
- `/auth` — sign in / sign up (Server Actions → Supabase auth)
- `/references/implemented-games.md` — When you need to check wich games are implemented and how to implement new ones

### Data layer (`lib/`)

- `lib/supabase/client.ts` (browser), `server.ts` (Server Components/Actions), `middleware.ts` (session refresh helper `updateSession`)
- `lib/games.ts` — `Game` type, `getGames()`, `getGameById()`, category list, activity feed. Reads the `games` table.
- `lib/storage.ts` — leaderboard is **generic**: `saveScore()` / `getScoresForGame()` index the `scores` table by `game.id`, so no per-game code is needed. Also holds the localStorage guest user helpers.
- `lib/session-user.ts` — `useSessionUser()` hook unifies a Supabase-authenticated user and a localStorage "guest" into one `SessionUser`; `signOutSession()`.

### Games system (`components/games/`)

- `components/games/registry.ts` — `GAME_CANVASES: Record<string, ComponentType<GameCanvasProps>>` maps `game.id` → canvas component. This replaces any per-game `if` in `game-player.tsx`. An id absent from the map falls back to the decorative `.game-arena` simulation.
- Per game: `components/games/<id>/engine.ts` (pure TS engine, no React) + `<id>-canvas.tsx` (`"use client"`, mounts `<canvas>`, drives the RAF loop, forwards `EngineSnapshot`).
- **Engine contract** (do not deviate): `constructor(width, height)`, `resize`, `update(dt)`, `draw(ctx)` (engine draws its own HUD + game-over overlay), `setKey(code, down)`, `forceGameOver()`, `getSnapshot(): EngineSnapshot` (`{ score, lives, level, state }`). Canonical reference: `components/games/asteroids/`.

### Supabase schema (`supabase/migrations/`)

- `scores` — `id`, `game` (text, the game id), `score`, `name`, `user_id` (nullable FK to `auth.users`), `created_at`. RLS: public read, public insert.
- `games` — `id`, `title`, `short`, `long`, `cat`, `cover` (a CSS class), `color`, `best`, `plays`. RLS: public read. Adding a game = one insert migration.
- Apply migrations via the Supabase MCP tools (`mcp__supabase__apply_migration`).

## Spec-driven workflow

Specs live in `specs/` (numbered `NN-slug.md`, Spanish). Each real game has a spec (04 Asteroids, 07 Tetris, 08 Arkanoid, 09 Arkanoid sound, 10 Snake); 05–06 cover the leaderboard and Supabase catalog. New games go through `/game-impl`, which is spec-first. The README references `/spec` and `/spec-impl` from `Klerith/fernando-skills`; `specs/.spec-config.yml` configures `/spec-impl` branch creation.

## Next.js version note

This repo pins Next.js 16, which has behavioral and API differences from earlier versions you may know from training data. Before implementing App Router features (routing, caching, data fetching, server actions, `use cache`, etc.), check the bundled docs in `node_modules/next/dist/docs/01-app/` rather than assuming Next.js 13/14 conventions — in particular `02-guides/upgrading/version-16.md` and `02-guides/migrating-to-cache-components.md` call out breaking changes.
