# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`capylink` is a **public** URL shortener (no auth) with a mandatory **21-day expiration** per link — this TTL is the core business rule, not a configuration detail.

The repository is split into two separately-developed but co-deployed packages:

- **`backend/`** — Quarkus 3.34 · Java 17 · PostgreSQL · Flyway · Hibernate ORM Panache · REST Jackson · SmallRye Health. API-only, deployed to the droplet behind **`api.eiji.dev`** (the same host capypad's backend uses; routed by path).
- **`frontend/`** — Vite · React 19 · TypeScript · Tailwind CSS v4 · `@react-three/fiber` for the animated background. Builds to `dist/` and is published to **GitHub Pages at `https://link.eiji.dev`**.

This split mirrors the sibling capypad project: static SPA on GitHub Pages, API on the droplet. Because GitHub Pages is static and can't serve a server-side 302, the short link `link.eiji.dev/{slug}` is resolved **client-side**: the SPA reads the slug, calls `GET https://api.eiji.dev/api/links/{slug}` for the target, and does `window.location.replace`. Tradeoff: link-preview bots that don't run JS won't follow the redirect — accepted in exchange for Pages hosting.

Java 17 was chosen to match the sibling capypad project (same droplet, single JDK installation).

## Commands

### Full stack (dev)

```bash
./dev.sh   # starts backend on :8080 and frontend on :5173 (with /api proxy)
```

### Backend

Maven Wrapper is included (`./mvnw`) — no need to install Maven. JDK 17 is already installed locally via Homebrew (`openjdk@17`).

```bash
cd backend
./mvnw quarkus:dev                                  # dev mode (live reload, Dev UI at /q/dev)
./mvnw test                                         # unit tests
./mvnw test -Dtest=LinkResourceTest                 # single test file
./mvnw test -Dtest=LinkResourceTest#shouldShorten   # single test method
./mvnw verify -Dquarkus.test.integration-test=true  # *IT tests (skipITs=true by default in pom)
./mvnw package                                      # JAR in target/quarkus-app/
./mvnw package -Dnative                             # native binary (GraalVM)
```

Health: `GET /q/health` · `GET /q/health/ready` · `GET /q/health/live`.

### Frontend

```bash
cd frontend
npm install
npm run dev      # Vite on :5173 (proxies /api → :8080)
npm run build    # outputs to frontend/dist/ (published to GitHub Pages)
npm run lint
npm test         # vitest
```

### Release build

Frontend and backend deploy **independently** (GitHub Actions):

- **Frontend** → `.github/workflows/deploy.yml` builds `dist/`, sets `VITE_API_URL=https://api.eiji.dev`, adds `CNAME=link.eiji.dev` + `404.html` (SPA fallback), publishes to GitHub Pages.
- **Backend** → `.github/workflows/deploy-backend.yml` packages the JAR and ships it to the droplet (`docker compose up -d`).

Local backend release: `(cd backend && ./mvnw package) && docker compose build && docker compose up -d`.

## Database

Postgres is **reused from the sibling capypad project** (same droplet, container `capypad-postgres`, port `127.0.0.1:5432`), but in a **separate database `capylink`** with a dedicated user — do not share the `capypad` database (Keycloak and the capypad backend already live there).

- Container on the droplet: attach to capypad's shared network, JDBC `jdbc:postgresql://postgres:5432/capylink`. Compose prefixes network names with the project, so the real external network is **`capypad_capypad-net`** (not `capypad-net`) — `docker-compose.yml` maps it via `networks.capypad-net.name`.
- Process on the droplet: `jdbc:postgresql://127.0.0.1:5432/capylink` (port only listens on localhost, so external access is impossible by design).
- Locally: spin up your own Postgres — Quarkus Dev Services will do this automatically during `quarkus:dev` if Docker is running and `quarkus.datasource.devservices.enabled` is not disabled.

Migrations go in `backend/src/main/resources/db/migration/V*__*.sql` (Flyway). Hibernate is set to `validate` only — schema is owned by Flyway, never by `hbm2ddl`.

Required env vars in `%prod`:

| Var                    | Example                                       |
| ---------------------- | --------------------------------------------- |
| `CAPYLINK_DB_URL`      | `jdbc:postgresql://postgres:5432/capylink`    |
| `CAPYLINK_DB_USER`     | `capylink` (default if unset)                 |
| `CAPYLINK_DB_PASSWORD` | _(no default — Quarkus fails fast if absent)_ |
| `CAPYLINK_BASE_URL`    | `https://link.eiji.dev`                       |

## Architecture notes

### Backend (`com.capylink.link.*`)

- **21-day TTL** (`capylink.ttl-days`): every link has `created_at` and `expires_at = created_at + 21 days`. Resolving an expired slug returns `410 Gone`, not `404`. `LinkCleanupJob` (`@Scheduled` cron at 03:00 daily) deletes rows whose `expires_at` is older than `capylink.cleanup-grace-days` (7) — the grace window keeps the 410 semantically correct for a week before the row is gone and it becomes 404.
- **Slug** (`capylink.slug-length`, default 7, base62): `LinkService.create` generates and checks collision up to 5 times before failing with 503. The column has a UNIQUE constraint as the source of truth.
- **`RedirectResource` is mounted at `/{slug:[A-Za-z0-9]+}`**: server-side 302 redirect. Still present and tested, but **not used in the Pages topology** — only `/api/links*` is routed to this backend on `api.eiji.dev`, so the root `/{slug}` route is never reached in prod. The regex is still load-bearing if you ever serve the SPA from the backend again. If you change the slug alphabet, update the entity column length, the generator alphabet, and both slug regexes (here and on `LinkResource.resolve`).
- **Endpoints**: `POST /api/links` creates (201 + `{slug, shortUrl, expiresAt}`; `shortUrl` uses `CAPYLINK_BASE_URL` = `https://link.eiji.dev`); `GET /api/links/{slug}` resolves to JSON `{slug, targetUrl, expiresAt}` or 410/404 (this is what the Pages SPA calls); `GET /{slug}` is the legacy server-side 302 (410/404).
- **CORS** (`application.properties`): allowed origin `https://link.eiji.dev`, set **unconditionally** (not `%prod`-gated) — the JAR is packaged with the default profile and only the runtime profile is prod, so a build-time-gated flag would be baked off.

### Frontend (`frontend/src/`)

- **Vite builds to `frontend/dist/`** (configured in `vite.config.ts`), published to GitHub Pages. The `404.html` (= a copy of `index.html`, made in the deploy workflow) makes Pages serve the SPA for any unknown path, including `/{slug}`.
- **Routing lives in `main.tsx`** (no router lib): if `window.location.pathname` is a bare slug (`/^[A-Za-z0-9]+$/`), it renders `Redirect` (resolves via the API and `window.location.replace`s to the target, with not-found/expired states); otherwise it renders `App` (the creation UI).
- **Dark mode** lives on `<html class="dark">`, persisted in `localStorage`, applied before paint via the inline script in `index.html` to avoid flash. `useDarkMode` is the toggle hook.
- **`Background.tsx`** is the same animated point-network as capypad (`@react-three/fiber` + `three`). Keep it visually subdued so it never competes with foreground content.
- **Logo** mirrors capypad's `</CapyPad>` style: monospace bracketed, purple/pink gradients on the brackets and "capy", neutral stone gradient on "link".
- **API client** (`src/api.ts`): `createLink` (POST) and `resolveLink` (GET, throws `ResolveError` with `not_found`/`expired`). Reads `VITE_API_URL` for the backend origin; in dev it stays empty and Vite proxies `/api` to `:8080`. In prod it's `https://api.eiji.dev`.

## Deployment

Two independent targets:

- **Frontend → GitHub Pages** (`link.eiji.dev`) via `.github/workflows/deploy.yml`. DNS: `link.eiji.dev` → GitHub Pages.
- **Backend → droplet** (`api.eiji.dev`) via `.github/workflows/deploy-backend.yml`. The reverse proxy on the droplet must route `api.eiji.dev/api/links*` → the capylink container (`127.0.0.1:8081`), leaving capypad's other `api.eiji.dev` paths intact.

`backend/Dockerfile` + root `docker-compose.yml` mirror the capypad pattern: `eclipse-temurin:17-jre`, `COPY target/quarkus-app /app`, healthcheck on `/q/health/ready`, 350M memory limit, bound to `127.0.0.1:8081` (8080 is taken by capypad-backend), joined to the **external** `capypad-net` network so it can reach `postgres:5432`.

GitHub secrets (used by the workflows): `ENV_PRODUCTION` (the full `backend/.env`), `DROPLET_SSH_KEY`, `DROPLET_IP`. The frontend's `VITE_API_URL` is not secret — it's set inline in `deploy.yml`.

Backend env: secrets (`CAPYLINK_DB_USER`, `CAPYLINK_DB_PASSWORD`, `CAPYLINK_BASE_URL`) live in `backend/.env` on the droplet only — `backend/.env.example` is the committed template. Non-sensitive `CAPYLINK_DB_URL` and `QUARKUS_PROFILE=prod` are hardcoded in `docker-compose.yml`. `CAPYLINK_BASE_URL=https://link.eiji.dev` so minted short URLs point at the Pages domain.

`backend/.dockerignore` is deny-by-default with only `target/quarkus-app/**` re-included — make sure any new path the Dockerfile needs is explicitly allowed back, otherwise the build silently misses files.

## Sibling project

`../capypad` is another Quarkus + React project by the same user (with Keycloak + a separate frontend deploy). When you need to understand droplet conventions (Docker network, resource limits, healthchecks, frontend stack choices), check `../capypad/`. capylink does **not** depend on capypad's Keycloak — it is public.
