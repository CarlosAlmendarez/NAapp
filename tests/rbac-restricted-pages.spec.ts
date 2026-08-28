import { test, expect } from "@playwright/test";
import { login, CREDENCIALES, correoDePrueba } from "./helpers";

/**
 * Acceso a /cuenta/password y /estadisticas (exclusivas de Admin general)
 * para los otros tres roles, y el limitador de intentos de login. El
 * acceso de Admin general a estas pantallas ya está cubierto en
 * responsive.spec.ts; aquí se prueba que los demás roles queden bloqueados
 * — y que sea el servidor el que bloquea, no solo la UI.
 */

test.describe("Solo Admin general entra a /cuenta/password y /estadisticas", () => {
  for (const [nombreRol, credenciales] of [
    ["Admin de casillas", CREDENCIALES.adminCasillas],
    ["Representante General", CREDENCIALES.rg],
    ["Capturador", CREDENCIALES.capturadorDistrito12],
  ] as const) {
    test(`${nombreRol} no puede ver /cuenta/password`, async ({ page }) => {
      await login(page, credenciales);
      await page.goto("/cuenta/password");
      await expect(page).toHaveURL(/\/dashboard/);
      await expect(page.getByLabel("Contraseña actual")).toHaveCount(0);
    });

    test(`${nombreRol} no puede ver /estadisticas`, async ({ page }) => {
      await login(page, credenciales);
      await page.goto("/estadisticas");
      await expect(page).toHaveURL(/\/dashboard/);
    });
  }
});

test("el menú de usuario no ofrece \"Cambiar contraseña\" a un Capturador", async ({ page }) => {
  await login(page, CREDENCIALES.capturadorDistrito12);
  await page.getByRole("button", { name: /Capturador/ }).click();
  await expect(page.getByText("Cambiar contraseña")).toHaveCount(0);
  await expect(page.getByText("Cerrar sesión", { exact: true })).toBeVisible();
});

test("login: se bloquea tras 5 intentos fallidos seguidos (mismo correo)", async ({ page }) => {
  // Correo único e inexistente: el limitador cuenta el intento fallido
  // igual (revisa antes de saber si el usuario existe), y así esta prueba
  // no depende de ni afecta a ninguna cuenta real, y es repetible sin
  // heredar el conteo de una corrida anterior.
  const correo = correoDePrueba("PRUEBA-E2E-ratelimit");

  for (let i = 0; i < 5; i++) {
    await page.goto("/login");
    await page.getByLabel("Correo institucional").fill(correo);
    await page.getByLabel("Contraseña").fill("contraseña-incorrecta");
    await page.getByRole("button", { name: /entrar/i }).click();
    await expect(page.getByText("Correo o contraseña incorrectos")).toBeVisible();
  }

  await page.goto("/login");
  await page.getByLabel("Correo institucional").fill(correo);
  await page.getByLabel("Contraseña").fill("contraseña-incorrecta-otra-vez");
  await page.getByRole("button", { name: /entrar/i }).click();
  await expect(page.getByText(/Demasiados intentos fallidos/)).toBeVisible();
});
