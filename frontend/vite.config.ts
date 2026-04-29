/// <reference types="vitest/config" />
import { defineConfig } from "vite";
import { fileURLToPath, URL } from "node:url";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Vite builds the SPA into the backend's static-resources dir so Quarkus
// serves the UI from the same host as the API + redirect endpoints.
// In dev the SPA runs on its own Vite server and proxies /api to the backend.
export default defineConfig(() => ({
  base: "/",
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  build: {
    outDir: "../backend/src/main/resources/META-INF/resources",
    emptyOutDir: true,
  },
  server: {
    port: 5173,
    proxy: {
      "/api": "http://localhost:8080",
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
  },
}));
