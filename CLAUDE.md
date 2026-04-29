# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`capylink` is a **public** URL shortener (no auth) with a mandatory **21-day expiration** per link — this TTL is the core business rule, not a configuration detail.

The repository is split into two separately-developed but co-deployed packages:

- **`backend/`** — Quarkus 3.34 · Java 17 · PostgreSQL · Flyway · Hibernate ORM Panache · REST Jackson · SmallRye Health.
- **`frontend/`** — Vite · React 19 · TypeScript · Tailwind CSS v4 · `@react-three/fiber` for the animated background. Build output lands in `backend/src/main/resources/META-INF/resources/` so Quarkus serves the SPA on the same host as the API and redirects.

This split mirrors the sibling capypad project. Unlike capypad, capylink uses a **single domain** (`https://link.eiji.dev`) for both the creation UI and the short URLs, because short URLs must be served by the redirect endpoint — there is no value in splitting domains.

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
npm run build    # outputs to ../backend/src/main/resources/META-INF/resources/
npm run lint
npm test         # vitest
```

### Release build (full stack)

```bash
(cd frontend && npm run build)   # bake the SPA into backend resources
(cd backend && ./mvnw package)   # produce the runnable JAR
docker compose build && docker compose up -d
```

## Database

Postgres is **reused from the sibling capypad project** (same droplet, container `capypad-postgres`, port `127.0.0.1:5432`), but in a **separate database `capylink`** with a dedicated user — do not share the `capypad` database (Keycloak and the capypad backend already live there).

- Container on the droplet: attach to the `capypad-net` network (`external: true`), JDBC `jdbc:postgresql://postgres:5432/capylink`.
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
- **`RedirectResource` is mounted at `/{slug:[A-Za-z0-9]+}`**: the regex constraint is load-bearing — without it the route would swallow `/index.html`, `/q/health`, `/api/links`, and any SPA asset path, because JAX-RS routing wins over Vert.x static handling. If you change the slug alphabet, update both the entity column length, the generator alphabet, and this regex.
- **Endpoints**: `POST /api/links` creates (returns 201 + `{slug, shortUrl, expiresAt}`), `GET /{slug}` redirects (302) or 410/404.

### Frontend (`frontend/src/`)

- **Vite build outputs into `backend/src/main/resources/META-INF/resources/`** (configured in `vite.config.ts`). Quarkus picks anything under `META-INF/resources/` from the classpath and serves it at the root, so the SPA shares a host with the API and redirects.
- **No router**: the SPA is a single page. The redirect endpoint on the same host owns `/{slug}` paths (JAX-RS wins over the SPA's `index.html` fallback for those, thanks to the slug regex).
- **Dark mode** lives on `<html class="dark">`, persisted in `localStorage`, applied before paint via the inline script in `index.html` to avoid flash. `useDarkMode` is the toggle hook.
- **`Background.tsx`** is the same animated point-network as capypad (`@react-three/fiber` + `three`). Keep it visually subdued so it never competes with foreground content.
- **Logo** mirrors capypad's `</CapyPad>` style: monospace bracketed, purple/pink gradients on the brackets and "capy", neutral stone gradient on "link".
- **API client** (`src/api.ts`) reads `VITE_API_URL` if set; in dev it stays empty and Vite proxies `/api` to `:8080`.

## Deployment (Docker on the droplet)

`backend/Dockerfile` + root `docker-compose.yml` mirror the capypad pattern: `eclipse-temurin:17-jre`, `COPY target/quarkus-app /app`, healthcheck on `/q/health/ready`, 350M memory limit, bound to `127.0.0.1:8081` (8080 is taken by capypad-backend), joined to the **external** `capypad-net` network so it can reach `postgres:5432`.

Build flow:

1. `cd frontend && npm run build` — bakes the SPA into `backend/src/main/resources/META-INF/resources/`.
2. `cd backend && ./mvnw package` — packages the JAR (with the SPA inside).
3. `docker compose build && docker compose up -d` from the repo root.

Secrets (`CAPYLINK_DB_USER`, `CAPYLINK_DB_PASSWORD`, `CAPYLINK_BASE_URL`) live in `backend/.env` on the droplet only — `backend/.env.example` is the committed template. Non-sensitive `CAPYLINK_DB_URL` and `QUARKUS_PROFILE=prod` are hardcoded in `docker-compose.yml`.

`backend/.dockerignore` is deny-by-default with only `target/quarkus-app/**` re-included — make sure any new path the Dockerfile needs is explicitly allowed back, otherwise the build silently misses files.

## Sibling project

`../capypad` is another Quarkus + React project by the same user (with Keycloak + a separate frontend deploy). When you need to understand droplet conventions (Docker network, resource limits, healthchecks, frontend stack choices), check `../capypad/`. capylink does **not** depend on capypad's Keycloak — it is public.
