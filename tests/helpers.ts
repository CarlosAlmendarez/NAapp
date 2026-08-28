import type { Page } from "@playwright/test";
import { PrismaClient } from "@prisma/client";

/**
 * Cliente de Prisma para setup/limpieza directa desde las pruebas. Usa
 * `process.env.DATABASE_URL`, que viene de `.env.test` (ver
 * `npm run test:e2e`, que antepone `dotenv -e .env.test --`). Si esto
 * apunta a producción por error, `DATABASE_URL` no coincidiría con la de
 * `.env.test` y el resto de las pruebas (que esperan usuarios/casillas
 * específicas) fallarían de inmediato — es una salvaguarda adicional.
 */
export const prisma = new PrismaClient();

export const CREDENCIALES = {
  adminGeneral: { correo: "admin@nuevaalianzaslp.org", password: "6vxMT!NnH7iLeu7UHs" },
  adminCasillas: { correo: "admincasillas@nuevaalianzaslp.org", password: "Tq8#mVn2XpLr9wZk" },
  rg: { correo: "rg@nuevaalianzaslp.org", password: "N6uNFK6kF#iMv#Ah" },
  capturadorDistrito12: { correo: "distrito12@nuevaalianzaslp.org", password: "KALYSngT7W6#eEJD" },
  capturadorDistrito4: { correo: "distrito4@nuevaalianzaslp.org", password: "DLyocp!Py6RQQy6F" },
  capturadorDistrito5: { correo: "distrito5@nuevaalianzaslp.org", password: "qVfiAme#ZBva9YU5" },
} as const;

export async function login(
  page: Page,
  usuario: { correo: string; password: string }
): Promise<void> {
  await page.goto("/login");
  await page.getByLabel("Correo institucional").fill(usuario.correo);
  await page.getByLabel("Contraseña").fill(usuario.password);
  await page.getByRole("button", { name: /entrar/i }).click();
  await page.waitForURL(/\/dashboard/);
}

/** Sección alta y aleatoria — fuera del rango real (~1 a ~2500) para no chocar con el catálogo. */
export function seccionDePrueba(): number {
  return 90000 + Math.floor(Math.random() * 9000);
}

export function correoDePrueba(prefijo: string): string {
  return `${prefijo}-${Date.now()}-${Math.floor(Math.random() * 1000)}@nuevaalianzaslp.org`;
}

/** Clave de elector con formato válido (18 alfanuméricos) para pruebas. */
export function claveElectorDePrueba(): string {
  const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
  let out = "";
  for (let i = 0; i < 18; i++) out += chars[Math.floor(Math.random() * chars.length)];
  return out;
}
