/**
 * Reemplaza la única cuenta RG (rg@nuevaalianzaslp.org, con los 15
 * distritos asignados a la vez) por 15 cuentas dedicadas, una por
 * distrito local — el diseño real del módulo de Rutas ("cada distrito
 * local tendrá 1 RG"), igual que ya existe un Capturador por distrito
 * (ver crear-usuarios-por-distrito.ts).
 *
 * Correo: rgdistrito{N}@nuevaalianzaslp.org
 *
 * Uso (contra producción, .env):
 *   npx tsx scripts/crear-rg-por-distrito.ts
 *
 * Es seguro volver a correrlo: si un rgdistrito{N}@ ya existe, no se le
 * cambia la contraseña ni se duplica su asignación de distrito. La
 * desactivación de rg@nuevaalianzaslp.org también es idempotente.
 */
import { PrismaClient, Rol } from "@prisma/client";
import bcrypt from "bcryptjs";
import { readFileSync } from "fs";
import path from "path";
import { randomInt } from "crypto";

const prisma = new PrismaClient();
const DOMINIO = "nuevaalianzaslp.org";
const BCRYPT_ROUNDS = 12;
const CORREO_RG_ANTERIOR = `rg@${DOMINIO}`;

function generarPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#%";
  let pwd = "";
  for (let i = 0; i < 16; i++) pwd += chars[randomInt(chars.length)];
  return pwd;
}

function numeroDeDistrito(nombreDistrito: string): string {
  const match = nombreDistrito.match(/^(\d+)\./);
  if (!match) throw new Error(`No se pudo extraer el número de distrito de "${nombreDistrito}"`);
  return match[1]!;
}

async function main() {
  // 1) Desactivar la cuenta RG anterior (todo-el-estado) — no se borra,
  // solo deja de poder iniciar sesión, y se revoca cualquier sesión activa.
  const anterior = await prisma.usuario.findUnique({ where: { correo: CORREO_RG_ANTERIOR } });
  if (anterior && anterior.activo) {
    await prisma.usuario.update({
      where: { id: anterior.id },
      data: { activo: false, sessionVersion: { increment: 1 } },
    });
    console.log(`✔ ${CORREO_RG_ANTERIOR} desactivada (reemplazada por las 15 cuentas por distrito).`);
  } else if (anterior) {
    console.log(`✔ ${CORREO_RG_ANTERIOR} ya estaba desactivada, sin cambios.`);
  } else {
    console.log(`(${CORREO_RG_ANTERIOR} no existe, nada que desactivar.)`);
  }

  // 2) Crear/asegurar las 15 cuentas RG por distrito.
  const ruta = path.join(__dirname, "..", "prisma", "data", "distritos-locales.json");
  const distritos: { nombre: string }[] = JSON.parse(readFileSync(ruta, "utf-8"));
  const credenciales: { correo: string; distrito: string; password: string; nuevo: boolean }[] =
    [];

  for (const { nombre: distrito } of distritos) {
    const numero = numeroDeDistrito(distrito);
    const correo = `rgdistrito${numero}@${DOMINIO}`;
    const nombreCuenta = `Representante General — Distrito ${distrito}`;

    const existente = await prisma.usuario.findUnique({
      where: { correo },
      include: { localidades: true },
    });

    if (existente) {
      const yaAsignado = existente.localidades.some(
        (l) => l.tipo === "DISTRITO_LOCAL" && l.valor === distrito
      );
      if (!yaAsignado) {
        await prisma.usuarioLocalidad.create({
          data: { usuarioId: existente.id, tipo: "DISTRITO_LOCAL", valor: distrito },
        });
      }
      credenciales.push({ correo, distrito, password: "(ya existía, sin cambios)", nuevo: false });
      continue;
    }

    const password = generarPassword();
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    await prisma.usuario.create({
      data: {
        nombre: nombreCuenta,
        correo,
        passwordHash,
        rol: Rol.REPRESENTANTE_GENERAL,
        activo: true,
        localidades: { create: [{ tipo: "DISTRITO_LOCAL", valor: distrito }] },
      },
    });

    credenciales.push({ correo, distrito, password, nuevo: true });
  }

  console.log("\nRepresentante General por distrito local:\n");
  console.log("correo".padEnd(30), "distrito".padEnd(32), "password");
  console.log("-".repeat(90));
  for (const c of credenciales) {
    console.log(c.correo.padEnd(30), c.distrito.padEnd(32), c.password, c.nuevo ? "" : "(existente)");
  }

  console.log(`\n${credenciales.filter((c) => c.nuevo).length} cuenta(s) nueva(s) creada(s).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
