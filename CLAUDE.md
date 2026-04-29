# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

`noLink` is a **public** URL shortener (no auth) with a mandatory **21-day expiration** per link — this TTL is the core business rule, not a configuration detail.

Stack: Quarkus 3.34 · Java 17 · Maven · Hibernate ORM Panache · PostgreSQL · Flyway · REST Jackson · Hibernate Validator · SmallRye Health.

Java 17 was chosen to match the sibling capypad project (same droplet, single JDK installation).
Frontend: plain HTML/CSS/JS served by Quarkus itself from `src/main/resources/META-INF/resources/`.

## Commands

Maven Wrapper is included (`./mvnw`) — no need to install Maven. JDK 17 is already installed locally via Homebrew (`openjdk@17`).

```bash
./mvnw quarkus:dev                                  # dev mode (live reload, Dev UI at /q/dev)
./mvnw test                                         # unit tests
./mvnw test -Dtest=LinkResourceTest                 # single test file
./mvnw test -Dtest=LinkResourceTest#shouldShorten   # single test method
./mvnw verify -Dquarkus.test.integration-test=true  # run *IT tests (skipITs=true by default in pom)
./mvnw package                                      # JAR in target/quarkus-app/
./mvnw package -Dnative                             # native binary (GraalVM)
```

Health: `GET /q/health` · `GET /q/health/ready` · `GET /q/health/live`.

## Database

Postgres is **reused from the sibling capypad project** (same droplet, container `capypad-postgres`, port `127.0.0.1:5432`), but in a **separate database `nolink`** with a dedicated user — do not share the `capypad` database (Keycloak and the capypad backend already live there).

- Container on the droplet: attach to the `capypad-net` network (`external: true`), JDBC `jdbc:postgresql://postgres:5432/nolink`.
- Process on the droplet: `jdbc:postgresql://127.0.0.1:5432/nolink` (port only listens on localhost, so external access is impossible by design).
- Locally: spin up your own Postgres — Quarkus Dev Services will do this automatically during `quarkus:dev` if Docker is running and `quarkus.datasource.devservices.enabled` is not disabled.

Migrations go in `src/main/resources/db/migration/V*__*.sql` (Flyway). Hibernate is set to `validate` only — schema is owned by Flyway, never by `hbm2ddl`.

Required env vars in `%prod`:

| Var                  | Example                                       |
| -------------------- | --------------------------------------------- |
| `NOLINK_DB_URL`      | `jdbc:postgresql://postgres:5432/nolink`      |
| `NOLINK_DB_USER`     | `nolink` (default if unset)                   |
| `NOLINK_DB_PASSWORD` | _(no default — Quarkus fails fast if absent)_ |
| `NOLINK_BASE_URL`    | `https://nolink.example.com`                  |

## Architecture notes

- **21-day TTL** (`nolink.ttl-days`): every link has `created_at` and `expires_at = created_at + 21 days`. Resolving an expired slug returns `410 Gone`, not `404`. `LinkCleanupJob` (`@Scheduled` cron at 03:00 daily) deletes rows whose `expires_at` is older than `nolink.cleanup-grace-days` (7) — the grace window is what keeps the 410 semantically correct for a week before the row is gone and it becomes 404.
- **Slug** (`nolink.slug-length`, default 7, base62): `LinkService.create` generates and checks collision up to 5 times before failing with 503. The column has a UNIQUE constraint as the source of truth.
- **`RedirectResource` is mounted at `/{slug:[A-Za-z0-9]+}`**: the regex constraint is load-bearing — without it the route would swallow `/index.html`, `/q/health`, `/api/links`, and any other static asset, because JAX-RS routing wins over Vert.x static handling. If you change the slug alphabet, update both the entity column length, the generator alphabet, and this regex.
- **Static frontend**: anything under `META-INF/resources/` is served at the root (`index.html` → `/`). Plain HTML/CSS/JS only — no framework, no build step, no npm.
- **Endpoints**: `POST /api/links` creates (returns 201 + `{slug, shortUrl, expiresAt}`), `GET /{slug}` redirects (302) or 410/404.

## Deployment (Docker on the droplet)

`Dockerfile` + `docker-compose.yml` mirror the capypad pattern: `eclipse-temurin:17-jre`, `COPY target/quarkus-app /app`, healthcheck on `/q/health/ready`, 350M memory limit, bound to `127.0.0.1:8081` (8080 is taken by capypad-backend), joined to the **external** `capypad-net` network so it can reach `postgres:5432`.

Build flow: `./mvnw package` → `docker compose build` → `docker compose up -d`. Secrets (`NOLINK_DB_USER`, `NOLINK_DB_PASSWORD`, `NOLINK_BASE_URL`) live in `./.env` on the droplet only — `.env.example` is the committed template. Non-sensitive `NOLINK_DB_URL` and `QUARKUS_PROFILE=prod` are hardcoded in `docker-compose.yml`.

`.dockerignore` is deny-by-default with only `target/quarkus-app/**` re-included — make sure any new path the Dockerfile needs is explicitly allowed back, otherwise the build silently misses files.

## Sibling project

`../capypad` is another Quarkus project by the same user (with Keycloak + a separate frontend). When you need to understand how the droplet is configured (Docker network, resource limits, healthchecks), check `../capypad/docker-compose.yml`. noLink does **not** depend on capypad's Keycloak — it is public.
