import { test, expect } from "@playwright/test";
import { login, prisma, CREDENCIALES, correoDePrueba } from "./helpers";

/**
 * Ciclo de vida de usuarios: crear (cada rol), editar, restablecer
 * contraseña, desactivar (y que eso invalide su sesión activa de
 * inmediato), y las restricciones de acceso a /usuarios por rol. Todo lo
 * creado aquí se marca con "PRUEBA-E2E" en el nombre y se borra en
 * tests/global-teardown.ts.
 */

test.describe("Crear usuarios (Admin general) — un caso por rol", () => {
  test("crea un Capturador con municipio asignado", async ({ page }) => {
    const correo = correoDePrueba("PRUEBA-E2E-cap-municipio");
    await login(page, CREDENCIALES.adminGeneral);
    await page.goto("/usuarios/nuevo");

    await page.getByLabel("Nombre completo").fill("PRUEBA-E2E Capturador Municipio");
    await page.getByLabel("Correo").fill(correo);
    await page.getByLabel("Contraseña temporal").fill("Prueba123!Segura");
    // Rol ya es "Capturador" por defecto; se prueba la pestaña de
    // Municipios (los usuarios sembrados de prueba solo usan distritos).
    await page.getByRole("checkbox", { name: "CATORCE" }).click();
    await page.getByRole("button", { name: "Crear usuario" }).click();

    await page.waitForURL(/\/usuarios$/);
    await expect(page.getByTestId("usuarios-tabla-escritorio").getByText(correo)).toBeVisible();

    // El usuario nuevo debe poder entrar y ver solo su municipio.
    const context2 = await page.context().browser()!.newContext();
    const page2 = await context2.newPage();
    await login(page2, { correo, password: "Prueba123!Segura" });
    await expect(page2.getByText(/CATORCE/)).toBeVisible();
    await context2.close();
  });

  test("crea un Administrador de casillas", async ({ page }) => {
    const correo = correoDePrueba("PRUEBA-E2E-admincasillas");
    await login(page, CREDENCIALES.adminGeneral);
    await page.goto("/usuarios/nuevo");

    await page.getByLabel("Nombre completo").fill("PRUEBA-E2E Admin Casillas Nuevo");
    await page.getByLabel("Correo").fill(correo);
    await page.getByLabel("Contraseña temporal").fill("Prueba123!Segura");
    await page.getByLabel("Rol").click();
    await page.getByRole("option", { name: "Administrador de casillas" }).click();
    await page.getByRole("button", { name: "Crear usuario" }).click();

    await page.waitForURL(/\/usuarios$/);
    await expect(page.getByTestId("usuarios-tabla-escritorio").getByText(correo)).toBeVisible();
  });

  test("crea un Representante General (RG)", async ({ page }) => {
    const correo = correoDePrueba("PRUEBA-E2E-rg");
    await login(page, CREDENCIALES.adminGeneral);
    await page.goto("/usuarios/nuevo");

    await page.getByLabel("Nombre completo").fill("PRUEBA-E2E RG Nuevo");
    await page.getByLabel("Correo").fill(correo);
    await page.getByLabel("Contraseña temporal").fill("Prueba123!Segura");
    await page.getByLabel("Rol").click();
    await page.getByRole("option", { name: "Representante General (RG)" }).click();
    await page.getByRole("button", { name: "Crear usuario" }).click();

    await page.waitForURL(/\/usuarios$/);
    await expect(page.getByTestId("usuarios-tabla-escritorio").getByText(correo)).toBeVisible();
  });

  test("un Capturador sin ninguna localidad marcada no se puede crear (validación)", async ({
    page,
  }) => {
    const correo = correoDePrueba("PRUEBA-E2E-sin-localidad");
    await login(page, CREDENCIALES.adminGeneral);
    await page.goto("/usuarios/nuevo");

    await page.getByLabel("Nombre completo").fill("PRUEBA-E2E Sin Localidad");
    await page.getByLabel("Correo").fill(correo);
    await page.getByLabel("Contraseña temporal").fill("Prueba123!Segura");
    await page.getByRole("button", { name: "Crear usuario" }).click();

    await expect(
      page.getByText(/al menos un municipio o distrito local asignado/)
    ).toBeVisible();
    await expect(page).toHaveURL(/\/usuarios\/nuevo$/); // no se creó, sigue en el formulario
  });

  test("correo duplicado se rechaza", async ({ page }) => {
    await login(page, CREDENCIALES.adminGeneral);
    await page.goto("/usuarios/nuevo");
    await page.getByLabel("Nombre completo").fill("PRUEBA-E2E Duplicado");
    await page.getByLabel("Correo").fill(CREDENCIALES.adminGeneral.correo);
    await page.getByLabel("Contraseña temporal").fill("Prueba123!Segura");
    await page.getByLabel("Rol").click();
    await page.getByRole("option", { name: "Administrador general" }).click();
    await page.getByRole("button", { name: "Crear usuario" }).click();
    await expect(page.getByText(/Ya existe un usuario con ese correo/)).toBeVisible();
  });
});

test.describe.serial("Ciclo de vida de un usuario: editar, resetear contraseña, desactivar", () => {
  const correo = correoDePrueba("PRUEBA-E2E-ciclo");
  const passwordInicial = "Inicial123!Segura";
  const passwordNueva = "Restablecida456!Segura";

  test("Admin general crea el usuario de prueba", async ({ page }) => {
    await login(page, CREDENCIALES.adminGeneral);
    await page.goto("/usuarios/nuevo");
    await page.getByLabel("Nombre completo").fill("PRUEBA-E2E Ciclo Completo");
    await page.getByLabel("Correo").fill(correo);
    await page.getByLabel("Contraseña temporal").fill(passwordInicial);
    await page.getByRole("checkbox", { name: "VENADO" }).click();
    await page.getByRole("button", { name: "Crear usuario" }).click();
    await page.waitForURL(/\/usuarios$/);
    await expect(page.getByTestId("usuarios-tabla-escritorio").getByText(correo)).toBeVisible();
  });

  test("Admin general edita el nombre del usuario", async ({ page }) => {
    await login(page, CREDENCIALES.adminGeneral);
    await page.goto("/usuarios");
    await page.getByRole("link", { name: "PRUEBA-E2E Ciclo Completo" }).click();
    await page.waitForURL(/\/usuarios\/[a-z0-9]+$/);

    await page.getByLabel("Nombre completo").fill("PRUEBA-E2E Ciclo Completo (editado)");
    await page.getByRole("button", { name: "Guardar cambios" }).click();

    await page.waitForURL(/\/usuarios$/);
    await expect(
      page.getByTestId("usuarios-tabla-escritorio").getByText("PRUEBA-E2E Ciclo Completo (editado)")
    ).toBeVisible();
  });

  test("el usuario puede iniciar sesión con su contraseña inicial", async ({ page }) => {
    await login(page, { correo, password: passwordInicial });
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("Admin general restablece la contraseña; la anterior deja de funcionar", async ({
    page,
    browser,
  }) => {
    await login(page, CREDENCIALES.adminGeneral);
    await page.goto("/usuarios");
    await page.getByRole("link", { name: /^PRUEBA-E2E Ciclo Completo/ }).click();
    await page.waitForURL(/\/usuarios\/[a-z0-9]+$/);

    await page.getByLabel("Nueva contraseña temporal").fill(passwordNueva);
    await page.getByRole("button", { name: "Restablecer contraseña" }).click();
    await expect(page.getByText("Contraseña restablecida")).toBeVisible();

    // Probar el login del usuario en un contexto aparte: `page` sigue
    // autenticada como admin, así que ir a /login ahí solo rebotaría a
    // /dashboard (ver login/page.tsx) en vez de mostrar el formulario.
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();

    // La contraseña anterior ya no debe funcionar.
    await page2.goto("/login");
    await page2.getByLabel("Correo institucional").fill(correo);
    await page2.getByLabel("Contraseña").fill(passwordInicial);
    await page2.getByRole("button", { name: /entrar/i }).click();
    await expect(page2.getByText("Correo o contraseña incorrectos")).toBeVisible();

    // La nueva sí funciona.
    await page2.getByLabel("Correo institucional").fill(correo);
    await page2.getByLabel("Contraseña").fill(passwordNueva);
    await page2.getByRole("button", { name: /entrar/i }).click();
    await page2.waitForURL(/\/dashboard/);
    await context2.close();
  });

  test("desactivar el usuario invalida de inmediato su sesión activa", async ({
    page,
    browser,
  }) => {
    // Sesión activa del usuario, en un contexto de navegador aparte.
    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    await login(page2, { correo, password: passwordNueva });
    await expect(page2).toHaveURL(/\/dashboard/);

    // El admin lo desactiva.
    await login(page, CREDENCIALES.adminGeneral);
    await page.goto("/usuarios");
    await page.getByRole("link", { name: /^PRUEBA-E2E Ciclo Completo/ }).click();
    await page.waitForURL(/\/usuarios\/[a-z0-9]+$/);
    await page.getByRole("checkbox", { name: /Cuenta activa/ }).click();
    await page.getByRole("button", { name: "Guardar cambios" }).click();
    await page.waitForURL(/\/usuarios$/);

    // La sesión ya abierta debe quedar invalida en el siguiente request.
    await page2.goto("/dashboard");
    await expect(page2).toHaveURL(/\/login/);

    // Y el login con la cuenta desactivada también se rechaza.
    await page2.goto("/login");
    await page2.getByLabel("Correo institucional").fill(correo);
    await page2.getByLabel("Contraseña").fill(passwordNueva);
    await page2.getByRole("button", { name: /entrar/i }).click();
    await expect(page2.getByText("Correo o contraseña incorrectos")).toBeVisible();

    await context2.close();
  });
});

test.describe("Forzar cierre de sesiones desde Usuarios", () => {
  test('"Cerrar sus sesiones" invalida la sesión activa de otro usuario', async ({
    page,
    browser,
  }) => {
    const correo = correoDePrueba("PRUEBA-E2E-forzar-cierre");
    const password = "ForzarCierre123!";

    await login(page, CREDENCIALES.adminGeneral);
    await page.goto("/usuarios/nuevo");
    await page.getByLabel("Nombre completo").fill("PRUEBA-E2E Forzar Cierre");
    await page.getByLabel("Correo").fill(correo);
    await page.getByLabel("Contraseña temporal").fill(password);
    await page.getByRole("checkbox", { name: "MOCTEZUMA" }).click();
    await page.getByRole("button", { name: "Crear usuario" }).click();
    await page.waitForURL(/\/usuarios$/);

    const context2 = await browser.newContext();
    const page2 = await context2.newPage();
    await login(page2, { correo, password });
    await expect(page2).toHaveURL(/\/dashboard/);

    await page.getByRole("link", { name: "PRUEBA-E2E Forzar Cierre" }).click();
    await page.waitForURL(/\/usuarios\/[a-z0-9]+$/);
    page.once("dialog", (dialog) => dialog.accept());
    await page.getByRole("button", { name: "Cerrar sus sesiones" }).click();
    // Espera a que la Server Action termine de verdad: el botón vuelve a
    // habilitarse (deja de decir "Cerrando…") solo cuando ya resolvió.
    await expect(page.getByRole("button", { name: "Cerrar sus sesiones" })).toBeEnabled({
      timeout: 10000,
    });

    await page2.goto("/dashboard");
    await expect(page2).toHaveURL(/\/login/);
    await context2.close();
  });
});

test.describe("Acceso a /usuarios según el rol", () => {
  for (const [nombreRol, credenciales] of [
    ["Admin de casillas", CREDENCIALES.adminCasillas],
    ["Representante General", CREDENCIALES.rg],
    ["Capturador", CREDENCIALES.capturadorDistrito12],
  ] as const) {
    test(`${nombreRol} no puede ver /usuarios ni /usuarios/nuevo`, async ({ page }) => {
      await login(page, credenciales);

      await page.goto("/usuarios");
      await expect(page).toHaveURL(/\/dashboard/);

      await page.goto("/usuarios/nuevo");
      await expect(page).toHaveURL(/\/dashboard/);
    });
  }
});

test.afterAll(async () => {
  await prisma.$disconnect();
});
