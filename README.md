# Perched

A candidate-first recruitment platform where jobseekers build a profile and recruiters
search for and connect with candidates.

The project is an early-stage monorepo: a React single-page app backed by two Express
services (a general API and a dedicated identity/auth service), fronted by an nginx
reverse proxy. Docker Compose is the source of truth for local development.

## Stack

| Area | Tech |
| --- | --- |
| Frontend | React 19 + TypeScript, Vite, SCSS, React Router |
| Backend API | TypeScript, Express 5, Redis, MongoDB |
| Identity service | TypeScript, Express 5, MongoDB, JWT, bcrypt |
| CV structuring | Claude API (Claude Haiku 4.5 by default) — parses uploaded CVs into structured profile data |
| Shared backend lib | `@perched/shared-backend` — Mongo/Redis clients, `User` model, controllers, middleware, logging |
| Proxy | nginx |
| Tooling | npm workspaces, Node 26+, tsup, nodemon, Prettier |

## Repository layout

```
src/
  frontend/
    main-ui/            React SPA (@perched/main-ui)
  backend/
    server/             Express API (@perched/server)
    identity-server/    Auth service (@perched/identity-server)
    shared/             Shared library (@perched/shared-backend)
  proxy/
    nginx/              Dev reverse proxy
docker-compose.development.yml
```

See [`AGENTS.md`](./AGENTS.md) and [`src/frontend/AGENTS.md`](./src/frontend/AGENTS.md)
for contributor and architecture conventions. Each package has its own README:
[`main-ui`](./src/frontend/main-ui/README.md), [`server`](./src/backend/server/README.md),
[`identity-server`](./src/backend/identity-server/README.md),
[`shared`](./src/backend/shared/README.md), [`proxy/nginx`](./src/proxy/nginx/README.md).

## Prerequisites

- Docker Desktop / Docker Engine with Compose
- Node 26+ and npm 11+ (only needed on the host when changing dependencies)

## Running locally

```bash
npm run dev
```

This runs [`scripts/dev.mjs`](./scripts/dev.mjs), which calls
`docker compose -f docker-compose.development.yml up --build`. Compose installs the
workspace dependencies once (the `dependencies` service), then starts every app with hot
reload. Polling watchers are enabled so reload works on Windows bind mounts. Extra args
pass straight through, e.g. `npm run dev -- server` to start one service.

> **CV structuring needs a Claude API key.** Set `ANTHROPIC_API_KEY` in
> `src/backend/server/.env` (gitignored — see [Environment](#environment) below) before
> uploading a CV; without it, CV uploads still work but the structured-profile parse
> fails and retries. See ADR-021 in [`ADR.md`](./ADR.md) — production use additionally
> requires a Zero Data Retention agreement with Anthropic before real candidate CVs are
> sent.

Everything is reached through the proxy at **http://localhost:80**:

| Path | Routed to |
| --- | --- |
| `/` , `/static` | `main-ui` (Vite dev server) |
| `/api/` | `server` |
| `/identity/` | `identity-server` |

App services are not published to the host. Other host-mapped ports for local access:

| Service | Port |
| --- | --- |
| MongoDB (`db-mongo`) | `27017` |
| Redis (`db-redis`) | `6379` |
| RedisInsight (`redis-insight`) | `6479` |

### Auth endpoints (via proxy)

- `POST /identity/user/register` — `{ firstName, lastName, email, password, role }` where `role` is `recruiter` or `candidate`
- `POST /identity/user/login` — `{ email, password }` → returns the user with a JWT `token`; the token carries the user's `role` claim

### Candidate endpoints (via proxy)

All candidate routes require `Authorization: Bearer <token>` and act only on the caller's
own data (the user is resolved from the token).

- `POST /api/candidate/cv` — `{ fileName, mimeType, contentBase64 }`, PDF only, up to 10 MB → `200` with the stored CV metadata `{ fileName, mimeType, sizeBytes, uploadedAt }`. Replaces any existing CV and queues a background job that structures the CV into the candidate's profile (see [server README](./src/backend/server/README.md)).
- `GET /api/candidate/cv` — the caller's stored CV metadata, or `404` when none.
- `GET /api/candidate/cv/file` — the caller's CV bytes (`application/pdf`, inline), or `404`.
- `GET /api/candidate/cv/resume` — the structured view of the CV plus its parse status (`pending` / `processing` / `ready` / `failed`), or `404` when there is no CV.
- `PUT /api/candidate/cv/resume` — save a candidate-corrected version of the structured CV.
- `POST /api/candidate/cv/resume/reparse` — re-run structuring for the current CV → `202`.
- `DELETE /api/candidate/cv` — removes the caller's CV → `204`, or `404` when none.

Outside production the API also serves `/api/debug/cv/*` routes for stepping through the
CV structuring pipeline against your own CV, with a `/debug/cv` page in the SPA as their
UI (both dev-only — see the [server README](./src/backend/server/README.md) and ADR-020).

## Common scripts

| Command | Description |
| --- | --- |
| `npm run dev` | Build and start the full stack in Docker |
| `npm run docker:containers:clean` | Stop and remove project containers |
| `npm run docker:clean` | Remove project containers, local images, and volumes |
| `npm run clean` | Delete `node_modules` and build output across workspaces |
| `npm run prettier:write:all` | Format all workspaces |
| `npm run typecheck` | Type-check every workspace with `tsc --noEmit` |

Per-workspace commands run through npm workspaces, e.g.
`npm run build --workspace=@perched/main-ui` or
`npm run typecheck --workspace=@perched/server`. The build steps (`tsup` on the
backend, `vite build` on the front end) are transpile-only and do **not** check
types, so run `npm run typecheck` to catch type errors.

## Environment

**Docker Compose is the source of truth.** `npm run dev` sets every non-secret backend
variable inline from the `environment:` blocks in
[`docker-compose.development.yml`](./docker-compose.development.yml), so a fresh clone
runs with no `.env` file needed for anything except the Claude API key. Those inline
values are insecure local-dev defaults — never reuse them.

Each backend package keeps a committed `.env.template`. It documents the variables that
package reads; for `identity-server` and `server`, Compose also loads a sibling `.env`
when present (`env_file`, `required: false`) for secrets that must not sit in the
checked-in Compose file — `server` needs this for `ANTHROPIC_API_KEY` (CV structuring,
ADR-021). The template is also the starting point for running a service
**directly on the host** (outside Compose), where `dotenv` loads the same `.env`.

| Package | Variables | How env reaches it |
| --- | --- | --- |
| [`server`](./src/backend/server/README.md#environment) | `PORT`, `REDIS_HOST`, `REDIS_PORT`, `REDIS_PASSWORD`, `MONGO_URL`, `JWT_KEY`, `CLAUDE_MODEL`, `ANTHROPIC_API_KEY` | Compose `environment:` for everything but `ANTHROPIC_API_KEY`, which comes only from `src/backend/server/.env` (`env_file`, `required: false`) |
| [`identity-server`](./src/backend/identity-server/README.md#environment) | `API_PORT`, `MONGO_URL`, `JWT_KEY` | Compose `environment:` **plus** `src/backend/identity-server/.env` when present (`env_file`, `required: false`) |
| [`shared`](./src/backend/shared/README.md#environment) | `JWT_KEY` | Library — reads the env of whichever service embeds it; has no `.env` load of its own |

To run a service on the host, copy its `.env.template` to `.env` in the same folder and
adjust the hostnames (Compose uses service names like `db-mongo` / `db-redis`; a host run
needs `127.0.0.1`). For `server`, also fill in `ANTHROPIC_API_KEY` — see
[server README](./src/backend/server/README.md#environment). `.env` is gitignored — never
commit one, or any real secret.

## Status

Early scaffolding. The frontend serves a home page plus login and sign up pages: sign up
picks a recruiter or candidate role, and the app keeps the session (and role, read from
the JWT) in local state. Candidate profiles, search, and recruiter workflows are not
built yet.
