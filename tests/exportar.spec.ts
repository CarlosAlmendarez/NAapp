import { test, expect } from "@playwright/test";
import * as XLSX from "xlsx";
import { login, CREDENCIALES, seccionDePrueba, claveElectorDePrueba } from "./helpers";

/**
 * Exportación XLSX (solo Admin general — ni RG ni Admin de casillas ni
 * Capturador): dos endpoints, /api/exportar/casillas (catálogo completo,
 * mismo formato que el padrón oficial) y /api/exportar/rutas (mismo
 * formato + columnas de ruta, con las casillas de una misma ruta juntas).
 * Ver src/lib/exportar-xlsx.ts.
 */
const MARCADOR = "PRUEBA-E2E";

function leerLibro(buffer: Buffer) {
  const wb = XLSX.read(buffer, { type: "buffer" });
  const ws = wb.Sheets[wb.SheetNames[0]!]!;
  return XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false, defval: "" });
}

test.describe("Acceso a los endpoints de exportación por rol", () => {
  for (const [nombreRol, credenciales] of [
    ["Admin de casillas", CREDENCIALES.adminCasillas],
    ["Capturador", CREDENCIALES.capturadorDistrito4],
    ["Representante General", CREDENCIALES.rg],
  ] as const) {
    test(`${nombreRol} recibe 403 al pedir /api/exportar/casillas y /api/exportar/rutas`, async ({
      page,
    }) => {
      await login(page, credenciales);
      const r1 = await page.request.get("/api/exportar/casillas");
      expect(r1.status()).toBe(403);
      const r2 = await page.request.get("/api/exportar/rutas");
      expect(r2.status()).toBe(403);
    });
  }

  for (const [nombreRol, credenciales] of [
    ["Admin de casillas", CREDENCIALES.adminCasillas],
    ["Capturador", CREDENCIALES.capturadorDistrito4],
    ["Representante General", CREDENCIALES.rg],
  ] as const) {
    test(`${nombreRol} no ve el botón "Exportar XLSX" en /casillas`, async ({ page }) => {
      await login(page, credenciales);
      await page.goto("/casillas");
      await expect(page.getByRole("link", { name: "Exportar XLSX" })).toHaveCount(0);
    });
  }

  test('Admin general SÍ ve "Exportar XLSX" en /casillas y en /rutas', async ({ page }) => {
    await login(page, CREDENCIALES.adminGeneral);
    await page.goto("/casillas");
    await expect(page.getByRole("link", { name: "Exportar XLSX" })).toBeVisible();

    await page.goto("/rutas");
    await expect(page.getByRole("link", { name: "Exportar XLSX" })).toBeVisible();
  });
});

test.describe("Formato del archivo exportado", () => {
  test("exportar casillas: mismo encabezado de dos filas que el padrón oficial, sin claves de elector", async ({
    page,
  }) => {
    await login(page, CREDENCIALES.adminGeneral);
    const respuesta = await page.request.get("/api/exportar/casillas");
    expect(respuesta.status()).toBe(200);
    expect(respuesta.headers()["content-type"]).toBe(
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    expect(respuesta.headers()["content-disposition"]).toContain("casillas-nueva-alianza-slp-");
    expect(respuesta.headers()["content-disposition"]).toContain(".xlsx");

    const filas = leerLibro(await respuesta.body());
    expect(filas[0]).toEqual([
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "",
      "PROPIETARIO",
      "",
      "",
      "",
      "",
      "",
      "",
      "SUPLENTE",
      "",
      "",
      "",
      "",
      "",
      "",
    ]);
    expect(filas[1]).toEqual([
      "DISTRITO FEDERAL",
      "DISTRITO LOCAL",
      "MUNICIPIO",
      "SECCIÓN",
      "TIPO CASILLA",
      "MUNICIPIO",
      "DOMICILIO",
      "COLONIA/LOCALIDAD",
      "CÓDIGO POSTAL",
      "UBICACIÓN",
      "Nombre",
      "Apellido Paterno",
      "Apellido Materno",
      "Clave de Elector",
      "Correo Electrónico",
      "Teléfono",
      "Propone",
      "Nombre",
      "Apellido Paterno",
      "Apellido Materno",
      "Clave de Elector",
      "Correo Electrónico",
      "Teléfono",
      "Propone",
    ]);
    // Miles de casillas reales del catálogo, no solo las de prueba.
    expect(filas.length).toBeGreaterThan(3000);
  });

  test.describe.serial("exportar rutas: casillas de la misma ruta quedan juntas, con datos correctos", () => {
    let seccionUno = 0;
    let seccionDos = 0;

    test("preparación: 2 casillas y una ruta capturada que las une", async ({ page }) => {
      await login(page, CREDENCIALES.adminGeneral);

      await page.goto("/casillas/nueva");
      seccionUno = seccionDePrueba();
      await page.getByLabel("Distrito local").fill("2. SALINAS");
      await page.getByLabel("Municipio").click();
      await page.getByRole("option", { name: "SALINAS" }).click();
      await page.getByLabel("Sección").fill(String(seccionUno));
      await page.getByLabel(/Tipo de casilla/).fill("B");
      await page.getByLabel("Colonia / localidad").fill(MARCADOR);
      await page.getByLabel("Domicilio").fill("Calle export 1");
      await page.getByLabel(/Ubicación/).fill("Ubicación export 1");
      await page.getByRole("button", { name: "Crear casilla" }).click();
      await expect(page.getByText(`Sección ${seccionUno}`)).toBeVisible({ timeout: 10000 });

      await page.goto("/casillas/nueva");
      seccionDos = seccionDePrueba();
      await page.getByLabel("Distrito local").fill("2. SALINAS");
      await page.getByLabel("Municipio").click();
      await page.getByRole("option", { name: "SALINAS" }).click();
      await page.getByLabel("Sección").fill(String(seccionDos));
      await page.getByLabel(/Tipo de casilla/).fill("B");
      await page.getByLabel("Colonia / localidad").fill(MARCADOR);
      await page.getByLabel("Domicilio").fill("Calle export 2");
      await page.getByLabel(/Ubicación/).fill("Ubicación export 2");
      await page.getByRole("button", { name: "Crear casilla" }).click();
      await expect(page.getByText(`Sección ${seccionDos}`)).toBeVisible({ timeout: 10000 });

      await page.goto("/rutas/nueva");
      await page.getByLabel("Nombre(s)").fill("Exportadora");
      await page.getByLabel("Apellido paterno").fill("DePrueba");
      await page.getByLabel(/Clave de elector/).fill(claveElectorDePrueba());
      await page.getByLabel("Teléfono").fill("4445551234");
      await page.getByLabel(/Agregar casilla/).fill(String(seccionUno));
      await page.getByRole("button", { name: `Agregar casilla sección ${seccionUno}` }).click();
      await page.getByLabel(/Agregar casilla/).fill(String(seccionDos));
      await page.getByRole("button", { name: `Agregar casilla sección ${seccionDos}` }).click();
      await page.getByRole("button", { name: "Guardar ruta" }).click();
      await page.waitForURL(/\/rutas$/);
    });

    test("las 2 casillas aparecen juntas, con la misma RUTA #, el orden correcto y sin clave de elector", async ({
      page,
    }) => {
      // Cada test() recibe su propia `page` (sin cookies) aunque esté en
      // el mismo describe.serial — hay que volver a iniciar sesión.
      await login(page, CREDENCIALES.adminGeneral);
      const respuesta = await page.request.get("/api/exportar/rutas");
      expect(respuesta.status()).toBe(200);
      expect(respuesta.headers()["content-disposition"]).toContain("rutas-nueva-alianza-slp-");

      const filas = leerLibro(await respuesta.body());
      // Encabezado extra de rutas al final del de columnas normal.
      expect(filas[1]!.slice(24)).toEqual([
        "RUTA #",
        "ORDEN EN RUTA",
        "Nombre",
        "Apellido Paterno",
        "Apellido Materno",
        "Correo Electrónico",
        "Teléfono",
        "Capturado el",
      ]);

      const filaUno = filas.find((f) => String(f[3]) === String(seccionUno));
      const filaDos = filas.find((f) => String(f[3]) === String(seccionDos));
      expect(filaUno, "debe existir la fila de la primera casilla").toBeTruthy();
      expect(filaDos, "debe existir la fila de la segunda casilla").toBeTruthy();

      // Misma ruta (mismo número), orden 1 y 2 respectivamente, y datos
      // del enlace correctos.
      expect(filaUno![24]).toBe(filaDos![24]); // mismo RUTA #
      expect(filaUno![25]).toBe("1");
      expect(filaDos![25]).toBe("2");
      expect(filaUno![26]).toBe("Exportadora");
      expect(filaUno![30]).toBe("4445551234"); // Teléfono del enlace
      // Nunca se exporta la clave de elector, ni en el RC ni en el enlace.
      expect(filaUno![13]).toBe(""); // Clave de Elector propietario
      expect(filaUno![20]).toBe(""); // Clave de Elector suplente

      // Las dos filas de esta ruta deben quedar contiguas en el archivo
      // (justo por eso se "pegan": para distinguir la ruta de un vistazo).
      const indiceUno = filas.indexOf(filaUno!);
      const indiceDos = filas.indexOf(filaDos!);
      expect(Math.abs(indiceUno - indiceDos)).toBe(1);
    });
  });
});
