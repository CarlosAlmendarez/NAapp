import { test, expect } from "@playwright/test";
import {
  login,
  prisma,
  CREDENCIALES,
  seccionDePrueba,
  claveElectorDePrueba,
} from "./helpers";

/**
 * Ciclo de vida real de una casilla: crear, capturar RC propietario y
 * suplente, y las reglas de acceso por rol/localidad — contra la base de
 * PRUEBA (ver npm run test:e2e). Todo lo creado aquí queda marcado con
 * "PRUEBA-E2E" en `coloniaLocalidad` y se borra en tests/global-teardown.ts
 * al terminar toda la corrida, sin importar en qué worker corrió cada test.
 */
const MARCADOR = "PRUEBA-E2E";

test.describe.serial("Casilla: crear y capturar RC (Admin general)", () => {
  let casillaId = "";
  const seccion = seccionDePrueba();

  test("crea una casilla nueva", async ({ page }) => {
    await login(page, CREDENCIALES.adminGeneral);
    await page.goto("/casillas/nueva");

    await page.getByLabel("Distrito local").fill("1. MATEHUALA");
    await page.getByLabel("Municipio").click();
    await page.getByRole("option", { name: "AHUALULCO" }).click();
    await page.getByLabel("Sección").fill(String(seccion));
    await page.getByLabel(/Tipo de casilla/).fill("B");
    await page.getByLabel("Colonia / localidad").fill(MARCADOR);
    await page.getByLabel("Domicilio").fill("Calle de prueba 123");
    await page.getByLabel(/Ubicación/).fill("Escuela de prueba E2E");
    await page.getByRole("button", { name: "Crear casilla" }).click();

    // Ojo: NO usar waitForURL(/\/casillas\/[a-z0-9]+$/) aquí — esa
    // expresión también hace match con la URL actual "/casillas/nueva"
    // (la palabra "nueva" cumple [a-z0-9]+), así que resolvería de
    // inmediato sin esperar la navegación real y `casillaId` terminaría
    // literalmente en "nueva". Se espera un contenido que solo existe en
    // la página de detalle ya cargada, y de ahí se lee la URL.
    await expect(page.getByText(`Sección ${seccion}`)).toBeVisible({ timeout: 10000 });
    casillaId = page.url().split("/casillas/")[1]!;
    expect(casillaId).toBeTruthy();
    expect(casillaId).not.toBe("nueva");

    await expect(page.getByText("Tipo de Casilla:")).toBeVisible();
    await expect(page.getByText("Básica")).toBeVisible();
    await expect(page.getByRole("heading", { name: "Representantes de Casilla" })).toBeVisible();
    // Editar/eliminar la casilla sigue deshabilitado para todos.
    await expect(page.getByRole("link", { name: "Editar" })).toHaveCount(0);
  });

  test("rechaza una sección+tipo duplicados", async ({ page }) => {
    await login(page, CREDENCIALES.adminGeneral);
    await page.goto("/casillas/nueva");
    await page.getByLabel("Distrito local").fill("1. MATEHUALA");
    await page.getByLabel("Municipio").click();
    await page.getByRole("option", { name: "AHUALULCO" }).click();
    await page.getByLabel("Sección").fill(String(seccion));
    await page.getByLabel(/Tipo de casilla/).fill("B");
    await page.getByLabel("Colonia / localidad").fill(MARCADOR);
    await page.getByLabel("Domicilio").fill("Otra calle");
    await page.getByLabel(/Ubicación/).fill("Otra ubicación");
    await page.getByRole("button", { name: "Crear casilla" }).click();

    await expect(page.getByText(/Ya existe una casilla con sección/)).toBeVisible();
  });

  test("captura el RC propietario", async ({ page }) => {
    await login(page, CREDENCIALES.adminGeneral);
    await page.goto(`/casillas/${casillaId}`);
    await page.getByRole("link", { name: "Capturar" }).first().click();
    await page.waitForURL(/\/representante\/propietario$/);

    await page.getByLabel("Nombre(s)").fill("Juan");
    await page.getByLabel("Apellido paterno").fill("Pérez");
    await page.getByLabel("Apellido materno").fill("García");
    await page.getByLabel("Clave de elector").fill(claveElectorDePrueba());
    await page.getByLabel(/Propone/).fill("Nueva Alianza");
    await page.getByRole("button", { name: "Guardar representante" }).click();

    await page.waitForURL(new RegExp(`/casillas/${casillaId}$`));
    await expect(page.getByText("RC Propietario")).toBeVisible();
    await expect(page.getByText("Juan Pérez García")).toBeVisible();
    await expect(page.getByText("Propone: Nueva Alianza")).toBeVisible();
  });

  test("captura el RC suplente y el resumen queda completo", async ({ page }) => {
    await login(page, CREDENCIALES.adminGeneral);
    await page.goto(`/casillas/${casillaId}`);
    // Admin general también ve la sección de Enlace de casilla (módulo
    // Rutas), que también trae su propio botón "Capturar" — .first() toma
    // el de RC suplente (la sección de RC va antes en el DOM).
    await page.getByRole("link", { name: "Capturar" }).first().click();
    await page.waitForURL(/\/representante\/suplente$/);

    await page.getByLabel("Nombre(s)").fill("María");
    await page.getByLabel("Apellido paterno").fill("López");
    await page.getByLabel("Clave de elector").fill(claveElectorDePrueba());
    await page.getByLabel(/Propone/).fill("Nueva Alianza");
    await page.getByRole("button", { name: "Guardar representante" }).click();

    await page.waitForURL(new RegExp(`/casillas/${casillaId}$`));
    await expect(page.getByText("RC Suplente")).toBeVisible();
    await expect(page.getByText("María López")).toBeVisible();

    const casilla = await prisma.casilla.findUnique({
      where: { id: casillaId },
      include: { representantes: true },
    });
    expect(casilla?.representantes).toHaveLength(2);
  });

  test("editar el RC propietario ya capturado actualiza los datos", async ({ page }) => {
    await login(page, CREDENCIALES.adminGeneral);
    await page.goto(`/casillas/${casillaId}`);
    await page
      .getByRole("link", { name: "Editar" })
      .first()
      .click(); // "Editar" del RC propietario (ya capturado)
    await page.waitForURL(/\/representante\/propietario$/);

    await expect(page.getByLabel("Nombre(s)")).toHaveValue("Juan");
    await page.getByLabel("Nombre(s)").fill("Juan Carlos");
    await page.getByLabel("Clave de elector").fill(claveElectorDePrueba());
    await page.getByRole("button", { name: "Guardar representante" }).click();

    await page.waitForURL(new RegExp(`/casillas/${casillaId}$`));
    await expect(page.getByText("Juan Carlos Pérez García")).toBeVisible();
  });
});

test.describe("Acceso a casillas por rol y localidad", () => {
  test("un capturador sin acceso al distrito/municipio no ve la casilla", async ({ page }) => {
    const casillaDistrito5 = await prisma.casilla.findFirst({
      where: { distritoLocal: "5. SAN LUIS POTOSI" },
    });
    expect(casillaDistrito5, "debe existir al menos una casilla real en el distrito 5").toBeTruthy();

    await login(page, CREDENCIALES.capturadorDistrito4);
    await page.goto(`/casillas/${casillaDistrito5!.id}`);
    // notFound() dentro de un Suspense boundary a veces responde 200 con el
    // contenido de "no encontrado" en vez de un 404 HTTP real — lo que
    // importa es que el contenido de la casilla nunca se muestra.
    await expect(page.getByRole("heading", { name: "Representantes de Casilla" })).toHaveCount(0);
    await expect(page.getByText("Domicilio:")).toHaveCount(0);
  });

  test("un capturador SÍ ve una casilla de su propio distrito", async ({ page }) => {
    const casillaDistrito4 = await prisma.casilla.findFirst({
      where: { distritoLocal: "4. SAN LUIS POTOSI" },
    });
    expect(casillaDistrito4).toBeTruthy();

    await login(page, CREDENCIALES.capturadorDistrito4);
    const respuesta = await page.goto(`/casillas/${casillaDistrito4!.id}`);
    expect(respuesta?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: "Representantes de Casilla" })).toBeVisible();
  });

  test("Representante General: no puede crear casillas, no ve RC, y el detalle no ofrece capturar (solo /rutas)", async ({
    page,
  }) => {
    const casillaSalinas = await prisma.casilla.findFirst({
      where: { distritoLocal: "2. SALINAS" },
    });
    expect(
      casillaSalinas,
      "debe existir al menos una casilla real en el distrito 2. SALINAS"
    ).toBeTruthy();

    await login(page, CREDENCIALES.rg);

    // Ya no administra el catálogo de casillas — solo Admin general/Admin
    // de casillas pueden crear casillas (ver tests/rutas.spec.ts para el
    // módulo de Rutas, que sí le corresponde al RG).
    await page.goto("/casillas/nueva");
    await expect(page).toHaveURL(/\/casillas$/);

    await page.goto(`/casillas/${casillaSalinas!.id}`);
    await expect(page.getByRole("heading", { name: "Representantes de Casilla" })).toHaveCount(0);
    // Tampoco ve la sección de Enlace desde aquí — el RG debe capturar
    // siempre a través de /rutas, nunca desde este atajo del detalle
    // (ver src/app/(app)/casillas/[id]/page.tsx).
    await expect(page.getByRole("heading", { name: "Enlace de casilla" })).toHaveCount(0);

    await page.goto(`/casillas/${casillaSalinas!.id}/representante/propietario`);
    // Lo que importa es que el formulario de RC nunca se muestra, más allá
    // del código HTTP exacto (ver nota sobre notFound() en loading.tsx).
    await expect(page.getByLabel("Clave de elector")).toHaveCount(0);
  });

  test("Admin de casillas: crea casillas y captura RC sin restricción de municipio", async ({
    page,
  }) => {
    await login(page, CREDENCIALES.adminCasillas);
    await page.goto("/casillas/nueva");

    const seccion = seccionDePrueba();
    await page.getByLabel("Distrito local").fill("3. SANTA MARIA DEL RIO");
    await page.getByLabel("Municipio").click();
    await page.getByRole("option", { name: "XILITLA" }).click();
    await page.getByLabel("Sección").fill(String(seccion));
    await page.getByLabel(/Tipo de casilla/).fill("B");
    await page.getByLabel("Colonia / localidad").fill(MARCADOR);
    await page.getByLabel("Domicilio").fill("Calle admin casillas 1");
    await page.getByLabel(/Ubicación/).fill("Ubicación admin casillas");
    await page.getByRole("button", { name: "Crear casilla" }).click();

    await expect(page.getByText(`Sección ${seccion}`)).toBeVisible({ timeout: 10000 });
    await expect(page.getByRole("heading", { name: "Representantes de Casilla" })).toBeVisible();
    await expect(page.getByText("RC Propietario")).toBeVisible();

    // No debe tener acceso a Usuarios/Estadísticas/Cambiar contraseña.
    await page.goto("/usuarios");
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test("capturador: no puede crear casillas (redirige a /casillas)", async ({ page }) => {
    await login(page, CREDENCIALES.capturadorDistrito12);
    await page.goto("/casillas/nueva");
    await expect(page).toHaveURL(/\/casillas$/);
  });
});
