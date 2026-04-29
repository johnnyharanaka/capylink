#!/usr/bin/env bash
set -e

cleanup() {
    echo ""
    echo "Shutting down Quarkus and Vite..."
    kill 0
}
trap 'cleanup' EXIT

echo "Starting backend (Quarkus on http://localhost:8080)..."
(cd backend && ./mvnw quarkus:dev) &

echo "Starting frontend (Vite on http://localhost:5173)..."
(cd frontend && npm run dev) &

wait
