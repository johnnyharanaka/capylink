# capylink

Public URL shortener with mandatory 21-day link expiration. Sibling of `capypad`, deployed to the same droplet on the shared `capypad-net` network.

## Repository structure

- **`backend/`** — Quarkus 3.34 · Java 17 · PostgreSQL · Flyway. Owns `POST /api/links` and `GET /{slug}` redirects. Also serves the built SPA at `/`.
- **`frontend/`** — Vite · React 19 · TypeScript · Tailwind v4. Builds into `backend/src/main/resources/META-INF/resources/`.

## Quick start

```bash
./dev.sh                # backend on :8080, frontend on :5173 (proxies /api)
```

Or separately:

```bash
cd backend && ./mvnw quarkus:dev
cd frontend && npm install && npm run dev
```

## Release build

```bash
(cd frontend && npm run build)   # bake SPA into backend resources
(cd backend && ./mvnw package)
docker compose build && docker compose up -d
```

See `CLAUDE.md` for full architecture notes, env vars, and deployment details.
