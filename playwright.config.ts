import { defineConfig } from "@playwright/test";

/**
 * Pruebas end-to-end (responsividad, sesión, RBAC, CRUD real) — ver
 * tests/*.spec.ts. Corren contra un `next start` ya levantado apuntando a
 * la base de PRUEBA, nunca producción — ver README, sección
 * "Pruebas automatizadas" para cómo correrlas (`npm run test:e2e`).
 */
export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  retries: 0,
  reporter: [["list"]],
  globalTeardown: "./tests/global-teardown.ts",
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
  },
});
