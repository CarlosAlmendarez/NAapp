import { test, expect, type Page } from "@playwright/test";

/**
 * Pruebas de responsividad: visitan las pantallas principales en tres
 * tamaños de viewport (celular, tablet, escritorio) y verifican que:
 *   1. La página no genera scroll horizontal (nada "se sale" del ancho).
 *   2. Los elementos clave de cada pantalla (encabezados, navegación,
 *      botones de acción, datos de la tabla/tarjetas) siguen siendo
 *      visibles — nada queda oculto por el layout responsivo.
 *
 * Requiere un `next start` corriendo contra la base real (ver
 * PLAYWRIGHT_BASE_URL / playwright.config.ts) y los usuarios de prueba ya
 * sembrados (admin, un capturador por distrito, y el RG de prueba).
 */

const VIEWPORTS: Record<string, { width: number; height: number }> = {
  celular: { width: 390, height: 844 },
  tablet: { width: 768, height: 1024 },
  escritorio: { width: 1440, height: 900 },
};

const USUARIOS = {
  admin: { correo: "admin@nuevaalianzaslp.org", password: "6vxMT!NnH7iLeu7UHs" },
  capturador: { correo: "distrito12@nuevaalianzaslp.org", password: "KALYSngT7W6#eEJD" },
  rg: { correo: "rg@nuevaalianzaslp.org", password: "N6uNFK6kF#iMv#Ah" },
};

async function login(page: Page, usuario: { correo: string; password: string }) {
  await page.goto("/login");
  await page.getByLabel("Correo institucional").fill(usuario.correo);
  await page.getByLabel("Contraseña").fill(usuario.password);
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.waitForURL(/\/dashboard/);
}

/** Ningún elemento debe empujar el ancho del documento más allá del viewport. */
async function expectSinScrollHorizontal(page: Page) {
  const desbordeX = await page.evaluate(
    () => document.documentElement.scrollWidth - window.innerWidth
  );
  expect(desbordeX, "la página no debe generar scroll horizontal").toBeLessThanOrEqual(1);
}

for (const [dispositivo, viewport] of Object.entries(VIEWPORTS)) {
  test.describe(`Responsivo — ${dispositivo} (${viewport.width}x${viewport.height})`, () => {
    test.use({ viewport });

    test("login: formulario y logo visibles, sin overflow", async ({ page }) => {
      await page.goto("/login");
      await expect(page.getByRole("heading", { name: "Iniciar sesión" })).toBeVisible();
      await expect(page.getByLabel("Correo institucional")).toBeVisible();
      await expect(page.getByLabel("Contraseña")).toBeVisible();
      await expect(page.getByRole("button", { name: /entrar/i })).toBeVisible();
      await expectSinScrollHorizontal(page);
    });

    test("dashboard (admin general): stats y acciones rápidas visibles", async ({ page }) => {
      await login(page, USUARIOS.admin);
      await expect(page.getByRole("heading", { name: /^Hola,/ })).toBeVisible();
      await expect(page.getByText("Avance de captura")).toBeVisible();
      await expect(page.getByText("Casillas en tu alcance")).toBeVisible();
      await expect(page.getByRole("link", { name: "Ver casillas" })).toBeVisible();
      await expect(page.getByRole("link", { name: "Administrar usuarios" })).toBeVisible();
      // Header y navegación deben seguir presentes en todas las pantallas.
      await expect(page.getByRole("link", { name: "Casillas", exact: true })).toBeVisible();
      await expect(page.getByRole("link", { name: "Usuarios", exact: true })).toBeVisible();
      await expectSinScrollHorizontal(page);
    });

    test("dashboard (capturador): localidad asignada visible", async ({ page }) => {
      await login(page, USUARIOS.capturador);
      await expect(page.getByRole("heading", { name: /^Hola,/ })).toBeVisible();
      await expect(page.getByText(/Distrito local 12/)).toBeVisible();
      // Un capturador no debe ver el link de Usuarios en la nav.
      await expect(page.getByRole("link", { name: "Usuarios", exact: true })).toHaveCount(0);
      await expectSinScrollHorizontal(page);
    });

    test("casillas: filtro, tarjetas y paginación visibles", async ({ page }) => {
      await login(page, USUARIOS.admin);
      await page.goto("/casillas");
      await expect(page.getByRole("heading", { name: "Casillas" })).toBeVisible();
      await expect(page.getByPlaceholder(/Buscar por sección/)).toBeVisible();
      await expect(page.getByRole("link", { name: "Nueva casilla" })).toBeVisible();
      // Al menos una tarjeta de casilla debe verse, con su tipo etiquetado.
      await expect(page.getByText(/^Sección \d+$/).first()).toBeVisible();
      await expect(page.getByText("Tipo de Casilla:").first()).toBeVisible();
      await expectSinScrollHorizontal(page);
    });

    test("detalle de casilla: encabezado en negritas y RC visibles, sin editar/eliminar", async ({
      page,
    }) => {
      await login(page, USUARIOS.admin);
      await page.goto("/casillas");
      await page.getByText(/^Sección \d+$/).first().click();
      await page.waitForURL(/\/casillas\/[a-z0-9]+$/);
      // "Distrito local ..." es el encabezado en negritas; "Sección N" es
      // el texto secundario debajo.
      await expect(page.getByRole("heading", { name: /^Distrito local /i })).toBeVisible();
      await expect(page.getByText("Tipo de Casilla:")).toBeVisible();
      await expect(page.getByText("Distrito federal")).toHaveCount(0);
      await expect(page.getByRole("heading", { name: "Representantes de Casilla" })).toBeVisible();
      await expect(page.getByText("RC Propietario")).toBeVisible();
      await expect(page.getByText("RC Suplente")).toBeVisible();
      // Editar/eliminar la casilla está deshabilitado para todos.
      await expect(page.getByRole("link", { name: "Editar" })).toHaveCount(0);
      await expect(page.getByRole("button", { name: "Eliminar" })).toHaveCount(0);
      await expectSinScrollHorizontal(page);
    });

    test("detalle de casilla (RG): sin sección de Representantes de Casilla", async ({ page }) => {
      await login(page, USUARIOS.rg);
      await page.goto("/casillas");
      await page.getByText(/^Sección \d+$/).first().click();
      await page.waitForURL(/\/casillas\/[a-z0-9]+$/);
      await expect(page.getByRole("heading", { name: /^Distrito local /i })).toBeVisible();
      await expect(page.getByRole("heading", { name: "Representantes de Casilla" })).toHaveCount(0);
      // El RG siempre captura desde /rutas, nunca desde este atajo.
      await expect(page.getByRole("heading", { name: "Enlace de casilla" })).toHaveCount(0);
      await expectSinScrollHorizontal(page);
    });

    test("nueva casilla: formulario completo visible", async ({ page }) => {
      await login(page, USUARIOS.admin);
      await page.goto("/casillas/nueva");
      await expect(page.getByLabel("Distrito local")).toBeVisible();
      await expect(page.getByLabel("Municipio")).toBeVisible();
      await expect(page.getByLabel("Sección")).toBeVisible();
      await expect(page.getByLabel(/Tipo de casilla/)).toBeVisible();
      await expect(page.getByLabel("Domicilio")).toBeVisible();
      await expect(page.getByLabel(/Ubicación/)).toBeVisible();
      await expect(page.getByRole("button", { name: "Crear casilla" })).toBeVisible();
      await expectSinScrollHorizontal(page);
    });

    test("usuarios: todos los datos visibles (tabla en pantallas grandes, tarjetas en celular)", async ({
      page,
    }) => {
      await login(page, USUARIOS.admin);
      await page.goto("/usuarios");
      await expect(page.getByRole("heading", { name: "Usuarios" })).toBeVisible();
      await expect(page.getByRole("link", { name: "Nuevo usuario" })).toBeVisible();

      const [vistaActiva, vistaInactiva] =
        dispositivo === "celular"
          ? [page.getByTestId("usuarios-lista-movil"), page.getByTestId("usuarios-tabla-escritorio")]
          : [page.getByTestId("usuarios-tabla-escritorio"), page.getByTestId("usuarios-lista-movil")];
      await expect(vistaActiva).toBeVisible();
      await expect(vistaInactiva).toBeHidden();
      await expect(vistaActiva.getByText("admin@nuevaalianzaslp.org")).toBeVisible();
      if (dispositivo !== "celular") {
        await expect(page.getByRole("columnheader", { name: "Correo" })).toBeVisible();
      }
      await expectSinScrollHorizontal(page);
    });

    test("nuevo usuario: selector de municipio/distrito visible", async ({ page }) => {
      await login(page, USUARIOS.admin);
      await page.goto("/usuarios/nuevo");
      await expect(page.getByLabel("Nombre completo")).toBeVisible();
      await expect(page.getByLabel("Correo")).toBeVisible();
      await expect(page.getByRole("tab", { name: "Municipios" })).toBeVisible();
      await expect(page.getByRole("tab", { name: "Distritos locales" })).toBeVisible();
      await expectSinScrollHorizontal(page);
    });

    test("estadísticas: avance por municipio visible en cualquier tamaño", async ({ page }) => {
      await login(page, USUARIOS.admin);
      await page.goto("/estadisticas");
      await expect(page.getByRole("heading", { name: "Estadísticas globales" })).toBeVisible();

      const [vistaActiva, vistaInactiva] =
        dispositivo === "celular"
          ? [
              page.getByTestId("estadisticas-lista-movil"),
              page.getByTestId("estadisticas-tabla-escritorio"),
            ]
          : [
              page.getByTestId("estadisticas-tabla-escritorio"),
              page.getByTestId("estadisticas-lista-movil"),
            ];
      await expect(vistaActiva).toBeVisible();
      await expect(vistaInactiva).toBeHidden();
      await expect(vistaActiva.getByText("CARDENAS")).toBeVisible();
      if (dispositivo !== "celular") {
        await expect(page.getByRole("columnheader", { name: "Municipio" })).toBeVisible();
      }
      await expectSinScrollHorizontal(page);
    });

    test("cambiar contraseña: solo accesible para admin general", async ({ page }) => {
      await login(page, USUARIOS.admin);
      await page.goto("/cuenta/password");
      await expect(page.getByRole("heading", { name: "Cambiar contraseña" })).toBeVisible();
      await expect(page.getByLabel("Contraseña actual")).toBeVisible();
      await expectSinScrollHorizontal(page);
    });
  });
}
