import { test, expect } from "@playwright/test";
import {
  login,
  prisma,
  CREDENCIALES,
  seccionDePrueba,
  claveElectorDePrueba,
} from "./helpers";

/**
 * Módulo de Rutas: el Representante General (RG) recorre las casillas de
 * su distrito local capturando el enlace de cada una, una por una y en el
 * orden que prefiera — contra la base de PRUEBA (ver npm run test:e2e).
 * Las casillas de prueba se crean con el Admin general (marcadas con
 * "PRUEBA-E2E" en `coloniaLocalidad`) para que tests/global-teardown.ts
 * las borre al terminar — el enlace se borra en cascada junto con ellas.
 */
const MARCADOR = "PRUEBA-E2E";

async function crearCasillaDePrueba(
  page: import("@playwright/test").Page,
  distritoLocal: string,
  municipio: string
): Promise<{ casillaId: string; seccion: number }> {
  await login(page, CREDENCIALES.adminGeneral);
  await page.goto("/casillas/nueva");

  const seccion = seccionDePrueba();
  await page.getByLabel("Distrito local").fill(distritoLocal);
  await page.getByLabel("Municipio").click();
  await page.getByRole("option", { name: municipio }).click();
  await page.getByLabel("Sección").fill(String(seccion));
  await page.getByLabel(/Tipo de casilla/).fill("B");
  await page.getByLabel("Colonia / localidad").fill(MARCADOR);
  await page.getByLabel("Domicilio").fill("Calle de prueba rutas");
  await page.getByLabel(/Ubicación/).fill("Ubicación de prueba rutas");
  await page.getByRole("button", { name: "Crear casilla" }).click();

  // Ver la nota en tests/casillas.spec.ts sobre por qué no usar
  // waitForURL con una regex ambigua aquí.
  await expect(page.getByText(`Sección ${seccion}`)).toBeVisible({ timeout: 10000 });
  const casillaId = page.url().split("/casillas/")[1]!;
  expect(casillaId).not.toBe("nueva");
  return { casillaId, seccion };
}

test.describe.serial("Rutas: el RG captura el enlace de sus casillas, una por una", () => {
  let casillaId = "";
  let seccion = 0;

  test("el Admin general prepara una casilla de prueba en el distrito del RG", async ({
    page,
  }) => {
    const creada = await crearCasillaDePrueba(page, "2. SALINAS", "SALINAS");
    casillaId = creada.casillaId;
    seccion = creada.seccion;
  });

  test("el RG ve la casilla como pendiente en /rutas", async ({ page }) => {
    await login(page, CREDENCIALES.rg);
    await page.goto("/rutas");
    await expect(page.getByText(`Sección ${seccion}`)).toBeVisible();

    const fila = page.locator("div", { hasText: `Sección ${seccion}` }).last();
    await expect(fila.getByText("Pendiente")).toBeVisible();
  });

  test("el RG captura el enlace de la casilla", async ({ page }) => {
    await login(page, CREDENCIALES.rg);
    await page.goto(`/rutas/${casillaId}`);

    await page.getByLabel("Nombre(s)").fill("Rosa");
    await page.getByLabel("Apellido paterno").fill("Hernández");
    await page.getByLabel(/Clave de elector/).fill(claveElectorDePrueba());
    await page.getByLabel("Teléfono").fill("4441234567");
    await page.getByRole("button", { name: "Guardar enlace" }).click();

    await page.waitForURL(/\/rutas$/);
    await expect(page.getByText(`Sección ${seccion}`)).toBeVisible();
    await expect(page.getByText("Rosa Hernández")).toBeVisible();
    await expect(page.getByText("Tel: 4441234567")).toBeVisible();
  });

  test("la casilla capturada aparece en el detalle de la casilla con estatus Capturado", async ({
    page,
  }) => {
    await login(page, CREDENCIALES.rg);
    await page.goto(`/casillas/${casillaId}`);
    await expect(page.getByRole("heading", { name: "Enlace de casilla" })).toBeVisible();
    await expect(page.getByText("Rosa Hernández")).toBeVisible();
    await expect(page.getByRole("link", { name: "Editar" })).toBeVisible();
  });

  test("editar el enlace ya capturado actualiza los datos sin perder el orden de captura", async ({
    page,
  }) => {
    const antes = await prisma.enlaceCasilla.findUnique({ where: { casillaId } });
    expect(antes).not.toBeNull();

    await login(page, CREDENCIALES.rg);
    await page.goto(`/rutas/${casillaId}`);
    await expect(page.getByLabel("Nombre(s)")).toHaveValue("Rosa");
    await page.getByLabel("Nombre(s)").fill("Rosa María");
    await page.getByLabel(/Clave de elector/).fill(claveElectorDePrueba());
    await page.getByRole("button", { name: "Guardar enlace" }).click();

    await page.waitForURL(/\/rutas$/);
    await expect(page.getByText("Rosa María Hernández")).toBeVisible();

    const despues = await prisma.enlaceCasilla.findUnique({ where: { casillaId } });
    expect(despues).not.toBeNull();
    // El orden real de la ruta (cuándo se visitó por primera vez) no debe
    // moverse solo porque se corrigió un dato — ver el comentario en
    // actions/enlaces.ts.
    expect(despues!.capturadoEn.getTime()).toBe(antes!.capturadoEn.getTime());
    expect(despues!.updatedAt.getTime()).toBeGreaterThan(antes!.updatedAt.getTime());
  });
});

test.describe("Acceso al módulo de Rutas por rol y localidad", () => {
  test("el RG no ve ni puede capturar una casilla fuera de su distrito", async ({ page }) => {
    const casillaDistrito4 = await prisma.casilla.findFirst({
      where: { distritoLocal: "4. SAN LUIS POTOSI" },
    });
    expect(casillaDistrito4).toBeTruthy();

    await login(page, CREDENCIALES.rg);
    await page.goto("/rutas");
    await expect(page.getByText(`Sección ${casillaDistrito4!.seccion}`)).toHaveCount(0);

    await page.goto(`/rutas/${casillaDistrito4!.id}`);
    await expect(page.getByLabel("Nombre(s)")).toHaveCount(0);
  });

  test("Admin general también puede usar el módulo de Rutas, sin restricción de distrito", async ({
    page,
  }) => {
    // crearCasillaDePrueba ya deja la sesión de Admin general iniciada en
    // `page` — no volver a llamar login() aquí: /login con una sesión ya
    // activa solo redirige a /dashboard sin mostrar el formulario, y
    // login() se quedaría esperando un campo que nunca aparece.
    const { casillaId, seccion } = await crearCasillaDePrueba(page, "1. MATEHUALA", "AHUALULCO");

    await page.goto("/rutas");
    await expect(page.getByText(`Sección ${seccion}`)).toBeVisible();

    await page.goto(`/rutas/${casillaId}`);
    await page.getByLabel("Nombre(s)").fill("Luis");
    await page.getByLabel("Apellido paterno").fill("Ramírez");
    await page.getByLabel(/Clave de elector/).fill(claveElectorDePrueba());
    await page.getByLabel("Teléfono").fill("4449876543");
    await page.getByRole("button", { name: "Guardar enlace" }).click();

    await page.waitForURL(/\/rutas$/);
    await expect(page.getByText("Luis Ramírez")).toBeVisible();
  });

  test("Admin de casillas no tiene acceso al módulo de Rutas", async ({ page }) => {
    await login(page, CREDENCIALES.adminCasillas);
    await page.goto("/rutas");
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test("Capturador no tiene acceso al módulo de Rutas", async ({ page }) => {
    await login(page, CREDENCIALES.capturadorDistrito12);
    await page.goto("/rutas");
    await expect(page).toHaveURL(/\/dashboard$/);
  });

  test('el menú de navegación solo muestra "Rutas" a Admin general y RG', async ({ page }) => {
    await login(page, CREDENCIALES.capturadorDistrito12);
    await expect(page.getByRole("link", { name: "Rutas" })).toHaveCount(0);
  });
});
