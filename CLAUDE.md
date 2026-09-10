# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

> The `@AGENTS.md` import above is the Next.js "agent rules" block that `next dev`
> regenerates. It points at `node_modules/next/dist/docs/` — that folder is not
> present in every install (it wasn't at last check); if it's missing, rely on
> the Next.js 15 App Router conventions already used across `src/`.

## What this is

Internal (non-public) electoral capture tool for **Nueva Alianza SLP**: manage
polling stations (`Casilla`) and their party representatives (RC) across San Luis
Potosí. There is **no public sign-up** — the only entry point is `/login`, and all
accounts are created by an Administrador general. Everything — code, comments,
identifiers, UI strings, commit messages — is written in **Spanish**; match that.

## Commands

```bash
npm run dev                # dev server (localhost:3000)
npm run build              # production build
npm run lint               # eslint (next/core-web-vitals + next/typescript)
npm run db:migrate         # prisma migrate dev (uses DIRECT_URL)
npm run db:migrate:deploy  # apply existing migrations, no new ones (prod/CI)
npm run db:seed            # municipios + distritos + 3,660 casillas + first admin
npm run db:studio          # Prisma Studio
```

There is no `tsc` typecheck script; `npm run build` is the type gate.

### End-to-end tests (Playwright) — always against the TEST database

Tests run against a **separate Neon database** configured in `.env.test` (not in
git). Every test command is prefixed with `dotenv -e .env.test --` so production
(`.env`) is never touched. `tests/helpers.ts` also re-checks `DATABASE_URL` as a
safeguard.

```bash
npx playwright install chromium     # first time only
npm run test:db:setup               # migrate + seed catalog + seed test users
npm run test:build                  # build with .env.test
npm run test:start                  # run `next start` on :3000 in another terminal
npm run test:e2e                    # runs tests/*.spec.ts against that server
```

Run a single spec / test:

```bash
npm run test:e2e -- tests/rutas.spec.ts
npm run test:e2e -- -g "nombre de la prueba"
```

Test-user credentials live in `tests/helpers.ts` (`CREDENCIALES`) and are seeded
by `scripts/sembrar-usuarios-prueba.ts` — if you change one, change both.

### Catalog import

`prisma/data/municipios.json` + `casillas.json` are generated from the official
Excel padrón via `npx tsx scripts/importar-secciones-casillas.ts`. Re-run when the
INE/party publishes a new Excel. The importer never loads RC personal data even if
present in the sheet (those must be captured encrypted through the app).

## Architecture

### Auth & session revocation

- **Auth.js (NextAuth v5)** with the Credentials provider and **JWT sessions**
  (`src/auth.ts`, `src/auth.config.ts`). Auth.js does not support DB sessions with
  Credentials, so immediate revocation is done manually.
- `src/auth.config.ts` is **edge-safe** (no Prisma/bcrypt) and is what
  `src/middleware.ts` uses — the middleware only answers "is there a session?" and
  redirects to `/login`. It never checks role or locality.
- Every `Usuario` has a `sessionVersion` counter. `obtenerUsuarioValidoOrNull()`
  in `src/lib/auth-helpers.ts` **re-queries the DB on every protected page and
  Server Action**, checking `activo` and `sessionVersion === token.sessionVersion`.
  `invalidarSesionesDe()` increments it (account deactivation, password change,
  "cerrar sesión en todos los dispositivos").
- `/login` must use `obtenerUsuarioValidoOrNull()`, **not** bare `auth()`, to
  decide whether to bounce to `/dashboard` — otherwise a revoked-but-unexpired JWT
  causes a redirect loop with the protected pages.

### RBAC — `src/lib/auth-helpers.ts` is the single source of truth

Never trust role/locality from the JWT or from what the UI already filtered.
Re-validate in each Server Action / page.

- `requireUser()` — pages/Server Components: redirects to `/login` if invalid.
- `requireUserOrThrow()` — Server Actions/Route Handlers: throws `AutorizacionError`.
- `requireRole(usuario, roles)` — throws if the role isn't allowed.
- `requireLocalidadAccess(usuario, casilla)` / `tieneAccesoALocalidad(...)`.
- `filtroCasillasPorRol(usuario)` — returns a `Prisma.CasillaWhereInput` to scope
  **every** `Casilla` query. Combine it as an independent `AND` clause; never
  overwrite `where.OR` (the role filter and text search each carry their own OR —
  clobbering one re-opens out-of-scope access). See `casillas-query.ts`,
  `rutas-query.ts`, `stats.ts` for the pattern.

Roles (`Rol` enum) and helper sets:

| Rol | Casilla catalog | Captures RC | Rutas module | Geo-scoped |
|---|---|---|---|---|
| `ADMIN_GENERAL` | create | — | yes | no |
| `ADMIN_CASILLAS` | create | — | — | no |
| `CAPTURADOR` | — | yes | — | **yes** (via `UsuarioLocalidad`) |
| `REPRESENTANTE_GENERAL` (RG) | — | — | yes | **yes** (one RG per distrito local) |

Editing and deleting `Casilla` are **disabled for everyone, including
ADMIN_GENERAL** (`actualizarCasilla`/`eliminarCasilla` in `src/actions/casillas.ts`
always throw) to protect the official catalog. `EnlaceCasilla` likewise has no
delete action.

### Geographic scoping — two independent dimensions

`UsuarioLocalidad` rows are each a `MUNICIPIO` **or** a `DISTRITO_LOCAL`. A large
municipality is split across several distritos locales (e.g. SLP capital = 4–8),
so access is `OR(assigned municipio, assigned distrito local)` — never assume a
distrito maps to a fixed set of municipios.

### Server Actions pattern

Every mutation lives in `src/actions/*.ts` (`"use server"`) and follows:

1. Wrap the body in `ejecutarAccion(async () => { ... })` from
   `src/lib/action-result.ts` → returns `ActionResult<T>`.
2. `const usuario = await requireUserOrThrow()` then `requireRole(...)` /
   `requireLocalidadAccess(...)`.
3. `schema.parse(formData)` with a Zod schema from `src/lib/validations/`.
4. Throw `AccionError` for safe-to-display business errors (e.g. "ya existe…").
   Any other thrown error is logged and shown to the user as a generic message —
   never surface a raw `.message` (may leak Prisma/internal detail).
5. `registrarAuditoria({ ... })` from `src/lib/audit.ts` (best-effort; never
   breaks the main flow).
6. `revalidatePath(...)`.

### Sensitive data

- Clave de elector is encrypted at rest with AES-256-GCM (`src/lib/crypto.ts`,
  key in `FIELD_ENCRYPTION_KEY`). Stored field is `claveElectorCifrada`.
  By product decision the edit forms (RC and rutas) now **prefill the decrypted
  clave** so it can be corrected without retyping/losing it, and the rutas PDF
  (`/imprimir/rutas`) prints it decrypted. The Server Actions treat an empty
  `claveElector` on an edit as "keep the stored one" (never blank it); it is only
  mandatory on create. `maskClaveElector()` is still used for plain listings.
- Login: `bcryptjs` (12 rounds), constant-time dummy-hash compare for unknown
  emails, generic error for every failure (anti-enumeration), rate limit of
  5 **failed** attempts / 15 min per IP+email (`src/lib/rate-limit.ts`, Upstash
  Redis in prod, single-process in-memory fallback that is **not** production-safe).
- `AuditLog` records who/what/when + IP for logins and mutations.

### Routing

- `src/app/(app)/` — protected area; its `layout.tsx` calls `requireUser()`.
  Contains `dashboard`, `casillas`, `rutas`, `usuarios`, `estadisticas`, `cuenta`.
- `src/app/login/` — the only public page.
- `src/middleware.ts` runs on the Node.js runtime (not Edge) and excludes
  `api/auth`, `_next/*`, `favicon.ico`, `robots.txt`.
- Path alias: `@/*` → `src/*`.

### Rutas module

`EnlaceCasilla` (one per casilla, `@unique casillaId`) is the RG's route: the RG
walks their distrito's casillas registering each one's *enlace/contact* (distinct
from the RC in `RepresentanteCasilla`). Route order shown in the UI is
`capturadoEn` ascending and does not change on edit. `rutas-query.ts` splits
casillas into `capturadas` (by `capturadoEn`) and `pendientes` (by `seccion`),
scoped by the same `filtroCasillasPorRol`.

### Data layer

- **Prisma 6.19.3** intentionally pinned (Prisma 7 moves datasource config to
  `prisma.config.ts` + requires an adapter — see README "Nota sobre Prisma 7").
- `src/lib/prisma.ts` — singleton client. `DATABASE_URL` = Neon pooled;
  `DIRECT_URL` = direct, used only by `prisma migrate`.
- Models use `@@map` to snake_case table names; ids are `cuid()`.

### UI

Tailwind CSS v4 + hand-rolled shadcn/ui-style primitives in
`src/components/ui/`, mobile-first. `next.config.ts` sets a strict CSP that
**forbids external CDNs** (no third-party scripts, fonts, or images) plus HSTS,
`X-Frame-Options: DENY`, and global `X-Robots-Tag: noindex`.
