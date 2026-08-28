import { PrismaClient } from "@prisma/client";

/**
 * Borra todo lo que las pruebas E2E crean en la base de PRUEBA, sin
 * importar en qué worker corrió cada test (por eso no se hace en
 * `test.afterAll` de cada archivo — con varios workers no comparten
 * memoria). Todo lo creado por las pruebas queda marcado:
 *   - Casillas: coloniaLocalidad === "PRUEBA-E2E" (el borrado hace cascada
 *     a sus representantes por la relación en el schema).
 *   - Usuarios: nombre empieza con "PRUEBA-E2E" (cascada a sus
 *     localidades asignadas).
 * Nunca toca el catálogo real ni los usuarios fijos (admin, RG, admin de
 * casillas, capturadores por distrito) que siembra
 * `npm run test:db:setup`.
 */
export default async function globalTeardown() {
  const prisma = new PrismaClient();
  try {
    const casillas = await prisma.casilla.deleteMany({
      where: { coloniaLocalidad: "PRUEBA-E2E" },
    });
    const usuarios = await prisma.usuario.deleteMany({
      where: { nombre: { startsWith: "PRUEBA-E2E" } },
    });
    console.log(
      `\n[global-teardown] Limpieza: ${casillas.count} casilla(s) y ${usuarios.count} usuario(s) de prueba borrados.`
    );
  } finally {
    await prisma.$disconnect();
  }
}
