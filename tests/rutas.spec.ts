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

/** Distrito exacto que tiene asignado el RG de prueba (ver scripts/sembrar-usuarios-prueba.ts). */
const DISTRITO_RG = "2. SALINAS";

async function crearCasillaDePrueba(
  page: import("@playwright/test").Page,
  distritoLocal: string,
  municipio: string,
  // false por defecto: hace login como Admin general primero. Al crear
  // MÁS de una casilla seguida en la misma `page` dentro de un mismo
  // test, pasar `true` a partir de la segunda — reintentar login() con
  // una sesión ya activa solo redirige a /dashboard sin mostrar el
  // formulario, y login() se queda esperando un campo que nunca aparece
  // (mismo bug ya documentado más abajo, en "Admin general también...").
  yaLogueado = false
): Promise<{ casillaId: string; seccion: number }> {
  if (!yaLogueado) {
    await login(page, CREDENCIALES.adminGeneral);
  }
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

/** Recalcula las estadísticas de Rutas del RG directamente en BD, para comparar contra la UI. */
async function statsEsperadasDeRuta(): Promise<{
  total: number;
  capturadas: number;
  porcentaje: number;
}> {
  const total = await prisma.casilla.count({ where: { distritoLocal: DISTRITO_RG } });
  const capturadas = await prisma.enlaceCasilla.count({
    where: { casilla: { distritoLocal: DISTRITO_RG } },
  });
  return {
    total,
    capturadas,
    porcentaje: total === 0 ? 0 : Math.round((capturadas / total) * 100),
  };
}

async function capturarEnlace(
  page: import("@playwright/test").Page,
  casillaId: string,
  datos: { nombre: string; apellidoPaterno: string; telefono: string }
): Promise<void> {
  await page.goto(`/rutas/${casillaId}`);
  await page.getByLabel("Nombre(s)").fill(datos.nombre);
  await page.getByLabel("Apellido paterno").fill(datos.apellidoPaterno);
  await page.getByLabel(/Clave de elector/).fill(claveElectorDePrueba());
  await page.getByLabel("Teléfono").fill(datos.telefono);
  await page.getByRole("button", { name: "Guardar enlace" }).click();
  await page.waitForURL(/\/rutas$/);
}

/**
 * Todo lo que crea/captura casillas en el distrito del RG (2. SALINAS) vive
 * en UN solo describe.serial: `fullyParallel: true` (playwright.config.ts)
 * corre bloques serial distintos en workers distintos, y varias de estas
 * pruebas comparan conteos "antes/después" — si dos bloques mutaran el
 * mismo distrito en paralelo, esas comparaciones de delta se volverían
 * flaky por una razón ajena a la app. Mantenerlo todo en una sola cadena
 * serial es lo que garantiza que nada más lo toca mientras corre.
 */
test.describe.serial("Rutas: captura, orden, validaciones y dashboard del RG", () => {
  let casillaId = "";
  let seccion = 0;

  test("el Admin general prepara una casilla de prueba en el distrito del RG", async ({
    page,
  }) => {
    const creada = await crearCasillaDePrueba(page, DISTRITO_RG, "SALINAS");
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

  test("el RG ya no ve la sección de Enlace en el detalle de la casilla (solo desde /rutas)", async ({
    page,
  }) => {
    await login(page, CREDENCIALES.rg);
    await page.goto(`/casillas/${casillaId}`);
    // El RG siempre debe capturar/editar desde /rutas — el detalle de la
    // casilla ya no le ofrece ese atajo (ver
    // src/app/(app)/casillas/[id]/page.tsx).
    await expect(page.getByRole("heading", { name: "Enlace de casilla" })).toHaveCount(0);
  });

  test("Admin general SÍ ve y puede editar el Enlace desde el detalle de la casilla", async ({
    page,
  }) => {
    await login(page, CREDENCIALES.adminGeneral);
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

  // --- Dashboard del RG: refleja sus propios enlaces, no RC ni suplentes ---

  let casillaA = "";
  let casillaB = "";

  test("preparación: 2 casillas más de prueba en el distrito del RG", async ({ page }) => {
    const a = await crearCasillaDePrueba(page, DISTRITO_RG, "SALINAS");
    casillaA = a.casillaId;
    const b = await crearCasillaDePrueba(page, DISTRITO_RG, "SALINAS", true);
    casillaB = b.casillaId;
  });

  test("capturar RC propietario (Admin) en casillaA no altera el dashboard del RG", async ({
    page,
  }) => {
    const antes = await statsEsperadasDeRuta();

    // OJO: cada test() recibe su propio `page` (contexto nuevo, sin
    // cookies) aunque esté en el mismo describe.serial — la sesión de
    // Admin general del test anterior NO se hereda aquí. Hay que volver a
    // iniciar sesión explícitamente.
    await login(page, CREDENCIALES.adminGeneral);
    await page.goto(`/casillas/${casillaA}`);
    await page.getByRole("link", { name: "Capturar" }).first().click();
    await page.waitForURL(/\/representante\/propietario$/);
    await page.getByLabel("Nombre(s)").fill("Ignacio");
    await page.getByLabel("Apellido paterno").fill("Torres");
    await page.getByLabel("Clave de elector").fill(claveElectorDePrueba());
    await page.getByLabel(/Propone/).fill("Nueva Alianza");
    await page.getByRole("button", { name: "Guardar representante" }).click();
    await page.waitForURL(new RegExp(`/casillas/${casillaA}$`));

    // El RC capturado no debe cambiar ni el total ni los enlaces capturados
    // del RG — son tablas y conteos completamente independientes.
    const despues = await statsEsperadasDeRuta();
    expect(despues).toEqual(antes);
  });

  test("el dashboard del RG NO muestra las etiquetas de RC/suplente", async ({ page }) => {
    await login(page, CREDENCIALES.rg);
    await expect(page.getByText("Avance de captura (RC propietario + suplente)")).toHaveCount(0);
    await expect(page.getByText("Con propietario capturado")).toHaveCount(0);
    await expect(page.getByText("Con suplente capturado")).toHaveCount(0);
    await expect(page.getByText("Avance de tu ruta (enlaces capturados)")).toBeVisible();
  });

  test("el dashboard del RG arranca con el conteo correcto (BD == UI)", async ({ page }) => {
    const esperado = await statsEsperadasDeRuta();

    await login(page, CREDENCIALES.rg);
    await expect(page.getByText(`${esperado.porcentaje}%`)).toBeVisible();
    await expect(
      page.getByText(`${esperado.capturadas} de ${esperado.total} casillas con enlace`)
    ).toBeVisible();
    // Las dos tarjetas chicas: total y capturados.
    const tarjetaTotal = page.locator("p", { hasText: "Casillas en tu alcance" }).locator("..");
    await expect(tarjetaTotal.getByText(String(esperado.total), { exact: true })).toBeVisible();
    const tarjetaCapturadas = page.locator("p", { hasText: "Enlaces capturados" }).locator("..");
    await expect(
      tarjetaCapturadas.getByText(String(esperado.capturadas), { exact: true })
    ).toBeVisible();
  });

  test("capturar el enlace de casillaA incrementa el dashboard del RG en +1", async ({ page }) => {
    const antes = await statsEsperadasDeRuta();

    await login(page, CREDENCIALES.rg);
    await capturarEnlace(page, casillaA, {
      nombre: "Norma",
      apellidoPaterno: "Reyes",
      telefono: "4441112233",
    });

    const despues = await statsEsperadasDeRuta();
    expect(despues.total).toBe(antes.total); // capturar un enlace no crea casillas nuevas
    expect(despues.capturadas).toBe(antes.capturadas + 1);

    await page.goto("/dashboard");
    await expect(
      page.getByText(`${despues.capturadas} de ${despues.total} casillas con enlace`)
    ).toBeVisible();
    await expect(page.getByText(`${despues.porcentaje}%`)).toBeVisible();
  });

  test("capturar el enlace de casillaB incrementa otra vez, y editar casillaA no lo altera", async ({
    page,
  }) => {
    const antes = await statsEsperadasDeRuta();

    await login(page, CREDENCIALES.rg);
    await capturarEnlace(page, casillaB, {
      nombre: "Édgar",
      apellidoPaterno: "Salas",
      telefono: "4445556677",
    });

    let despues = await statsEsperadasDeRuta();
    expect(despues.capturadas).toBe(antes.capturadas + 1);

    // Editar un enlace YA capturado (casillaA) no debe sumar otra cuenta.
    await capturarEnlace(page, casillaA, {
      nombre: "Norma Edición",
      apellidoPaterno: "Reyes",
      telefono: "4441112233",
    });
    despues = await statsEsperadasDeRuta();
    expect(despues.capturadas).toBe(antes.capturadas + 1); // sin cambio extra

    await page.goto("/dashboard");
    await expect(
      page.getByText(`${despues.capturadas} de ${despues.total} casillas con enlace`)
    ).toBeVisible();
  });

  test("Admin general sigue viendo su propio dashboard basado en RC, sin cambios", async ({
    page,
  }) => {
    await login(page, CREDENCIALES.adminGeneral);
    await expect(page.getByText("Avance de captura (RC propietario + suplente)")).toBeVisible();
    await expect(page.getByText("Con propietario capturado")).toBeVisible();
    await expect(page.getByText("Con suplente capturado")).toBeVisible();
    await expect(page.getByText("Avance de tu ruta (enlaces capturados)")).toHaveCount(0);
  });

  // --- Orden no secuencial, validaciones y edición ---

  let casillaUno = "";
  let casillaDos = "";
  let casillaTres = "";
  let seccionUno = 0;
  let seccionDos = 0;
  let seccionTres = 0;

  test("preparación: 3 casillas más de prueba en el distrito del RG", async ({ page }) => {
    const uno = await crearCasillaDePrueba(page, DISTRITO_RG, "SALINAS");
    casillaUno = uno.casillaId;
    seccionUno = uno.seccion;
    const dos = await crearCasillaDePrueba(page, DISTRITO_RG, "SALINAS", true);
    casillaDos = dos.casillaId;
    seccionDos = dos.seccion;
    const tres = await crearCasillaDePrueba(page, DISTRITO_RG, "SALINAS", true);
    casillaTres = tres.casillaId;
    seccionTres = tres.seccion;
  });

  test("el orden de Capturadas refleja el orden real de captura, no la sección", async ({
    page,
  }) => {
    // Ya van 3 enlaces capturados antes en esta misma cadena (la casilla
    // original + A + B) — los badges de estas 3 nuevas empiezan donde esas
    // dejaron, no en 1.
    const antesDeCapturar = (await statsEsperadasDeRuta()).capturadas;

    await login(page, CREDENCIALES.rg);

    // Captura deliberadamente en un orden distinto al de creación/sección:
    // Tres, luego Uno, luego Dos.
    await capturarEnlace(page, casillaTres, {
      nombre: "Primero",
      apellidoPaterno: "EnCapturarse",
      telefono: "4440000001",
    });
    await capturarEnlace(page, casillaUno, {
      nombre: "Segundo",
      apellidoPaterno: "EnCapturarse",
      telefono: "4440000002",
    });
    await capturarEnlace(page, casillaDos, {
      nombre: "Tercero",
      apellidoPaterno: "EnCapturarse",
      telefono: "4440000003",
    });

    await page.goto("/rutas");
    // En orden de captura (no de sección): Tres, luego Uno, luego Dos —
    // con los badges consecutivos a partir de `antesDeCapturar`.
    const seccionesEnOrden = [seccionTres, seccionUno, seccionDos];
    for (let i = 0; i < seccionesEnOrden.length; i++) {
      const fila = page
        .locator("div.rounded-lg", { hasText: `Sección ${seccionesEnOrden[i]}` })
        .filter({ hasText: "Capturado" });
      const ordenEsperado = antesDeCapturar + i + 1;
      await expect(fila.getByText(String(ordenEsperado), { exact: true })).toBeVisible();
    }
  });

  test("un teléfono inválido se rechaza sin guardar el enlace", async ({ page }) => {
    await login(page, CREDENCIALES.rg);
    await page.goto(`/rutas/${casillaTres}`); // ya capturada, se intenta editar con datos malos
    await page.getByLabel("Teléfono").fill("123"); // menos de 10 dígitos
    await page.getByLabel(/Clave de elector/).fill(claveElectorDePrueba());
    await page.getByRole("button", { name: "Guardar enlace" }).click();

    await expect(page.getByText(/El teléfono debe tener 10 dígitos/)).toBeVisible();
    await expect(page).toHaveURL(new RegExp(`/rutas/${casillaTres}$`)); // no navegó, no se guardó
  });

  test("una clave de elector con formato inválido se rechaza", async ({ page }) => {
    await login(page, CREDENCIALES.rg);
    await page.goto(`/rutas/${casillaTres}`);
    await page.getByLabel(/Clave de elector/).fill("CORTA123"); // no llega a 18 caracteres
    await page.getByLabel("Teléfono").fill("4441234567");
    await page.getByRole("button", { name: "Guardar enlace" }).click();

    await expect(
      page.getByText(/La clave de elector debe tener 18 caracteres alfanuméricos/)
    ).toBeVisible();
  });

  test("editar un enlace capturado nunca vuelve a mostrar la clave de elector", async ({
    page,
  }) => {
    await login(page, CREDENCIALES.rg);
    await page.goto(`/rutas/${casillaTres}`);
    // Nombre/apellido/teléfono sí se prefijan; la clave de elector nunca —
    // se debe volver a capturar por seguridad (igual que en RC).
    await expect(page.getByLabel("Nombre(s)")).toHaveValue("Primero");
    await expect(page.getByLabel(/Clave de elector/)).toHaveValue("");
    await expect(page.getByText(/vuelve a capturarla para confirmarla/)).toBeVisible();
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
