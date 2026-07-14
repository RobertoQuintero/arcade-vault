# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## Project

Arcade Vault — a platform for playing games online and competing for the highest scores (per README, in Spanish). The codebase is currently a fresh `create-next-app` scaffold with no game/scoring logic implemented yet (`app/page.tsx` is still the default template).

## Commands

- `npm run dev` — start the dev server (Next.js, Turbopack by default)
- `npm run build` — production build
- `npm run start` — run the production build
- `npm run lint` — ESLint via `eslint.config.mjs` (flat config, `eslint-config-next` core-web-vitals + typescript rules)

No test runner is configured yet.

## Stack

- Next.js 16 (App Router), React 19, TypeScript (strict), Tailwind CSS v4 (via `@tailwindcss/postcss`, no `tailwind.config` file — v4 is CSS-first, see `app/globals.css`)
- Path alias `@/*` maps to the repo root (`tsconfig.json`)

## Next.js version note

This repo pins Next.js 16, which has behavioral and API differences from earlier versions you may know from training data. Before implementing App Router features (routing, caching, data fetching, server actions, `use cache`, etc.), check the bundled docs in `node_modules/next/dist/docs/01-app/` rather than assuming Next.js 13/14 conventions — in particular `02-guides/upgrading/version-16.md` and `02-guides/migrating-to-cache-components.md` call out breaking changes.

## Spec-driven workflow

The README references a spec-driven design workflow (`/spec` and `/spec-impl` commands) provided by the `Klerith/fernando-skills` package (`npx skills@latest add Klerith/fernando-skills`). These skills are not yet installed in this repo — if `/spec` or `/spec-impl` are invoked and unavailable, that package needs to be added first.
