import { defineConfig } from "@playwright/test";

/**
 * Pruebas de responsividad end-to-end (ver tests/responsive.spec.ts).
 * Corren contra un `next start` ya levantado — ver README, sección
 * "Pruebas de responsividad" para cómo correrlas.
 */
export default defineConfig({
  testDir: "./tests",
  fullyParallel: true,
  retries: 0,
  reporter: [["list"]],
  use: {
    baseURL: process.env.PLAYWRIGHT_BASE_URL ?? "http://localhost:3000",
    trace: "retain-on-failure",
  },
});
