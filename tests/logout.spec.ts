import { test, expect } from "@playwright/test";

/**
 * Regresión: "Cerrar sesión" y "Cerrar sesión en todos los dispositivos"
 * vivían como <form action={...}> dentro de un DropdownMenuItem de Radix.
 * Radix cierra (desmonta) el menú al seleccionar un ítem, lo que
 * desconectaba el <form> del documento a mitad del envío nativo — el
 * navegador cancelaba la petición ("Form submission canceled because the
 * form is not connected") y la sesión nunca se cerraba. Se corrigió
 * llamando la Server Action directamente (ver
 * src/components/layout/dropdown-accion-item.tsx) en vez de depender de
 * un <form> nativo dentro del menú.
 */

const ADMIN = { correo: "admin@nuevaalianzaslp.org", password: "6vxMT!NnH7iLeu7UHs" };
const CAPTURADOR = { correo: "distrito12@nuevaalianzaslp.org", password: "KALYSngT7W6#eEJD" };

test("cerrar sesión: cierra sesión de verdad, sin warnings de consola", async ({ page }) => {
  const avisosConsola: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "warning" || msg.type() === "error") avisosConsola.push(msg.text());
  });

  await page.goto("/login");
  await page.getByLabel("Correo institucional").fill(ADMIN.correo);
  await page.getByLabel("Contraseña").fill(ADMIN.password);
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.waitForURL(/\/dashboard/);

  await page.getByRole("button", { name: /Administrador General/ }).click();
  await page.getByText("Cerrar sesión", { exact: true }).click();
  await page.waitForURL(/\/login/, { timeout: 10000 });

  const avisosDeEnvio = avisosConsola.filter((a) => a.includes("Form submission canceled"));
  expect(avisosDeEnvio, "no debe aparecer el warning de envío cancelado").toHaveLength(0);

  // La sesión debe estar realmente cerrada, no solo redirigido visualmente.
  await page.goto("/dashboard");
  await page.waitForURL(/\/login/);
});

test('"cerrar sesión en todos los dispositivos": cierra sesión de verdad', async ({ page }) => {
  const avisosConsola: string[] = [];
  page.on("console", (msg) => {
    if (msg.type() === "warning" || msg.type() === "error") avisosConsola.push(msg.text());
  });

  await page.goto("/login");
  await page.getByLabel("Correo institucional").fill(CAPTURADOR.correo);
  await page.getByLabel("Contraseña").fill(CAPTURADOR.password);
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.waitForURL(/\/dashboard/);

  await page.getByRole("button", { name: /Capturador/ }).click();
  await page.getByText("Cerrar sesión en todos los dispositivos").click();
  await page.waitForURL(/\/login\?motivo=sesiones_cerradas/, { timeout: 10000 });

  const avisosDeEnvio = avisosConsola.filter((a) => a.includes("Form submission canceled"));
  expect(avisosDeEnvio, "no debe aparecer el warning de envío cancelado").toHaveLength(0);

  await page.goto("/dashboard");
  await page.waitForURL(/\/login/);
});
