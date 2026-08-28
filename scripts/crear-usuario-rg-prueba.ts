/**
 * Crea un único usuario de prueba con el nuevo rol Representante General
 * (RG): solo puede crear/editar/eliminar casillas — nunca captura RC
 * propietario/suplente ni asistentes electorales.
 *
 * Uso:
 *   npx tsx scripts/crear-usuario-rg-prueba.ts
 *
 * Es seguro volver a correrlo: si el correo ya existe, no hace nada.
 */
import { PrismaClient, Rol } from "@prisma/client";
import bcrypt from "bcryptjs";
import { randomInt } from "crypto";

const prisma = new PrismaClient();
const CORREO = "rg@nuevaalianzaslp.org";
const NOMBRE = "Representante General (prueba)";

function generarPassword(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#%";
  let pwd = "";
  for (let i = 0; i < 16; i++) pwd += chars[randomInt(chars.length)];
  return pwd;
}

async function main() {
  const existente = await prisma.usuario.findUnique({ where: { correo: CORREO } });
  if (existente) {
    console.log(`✔ Ya existe un usuario RG (${CORREO}), no se modifica.`);
    return;
  }

  const password = generarPassword();
  const passwordHash = await bcrypt.hash(password, 12);

  await prisma.usuario.create({
    data: {
      nombre: NOMBRE,
      correo: CORREO,
      passwordHash,
      rol: Rol.REPRESENTANTE_GENERAL,
      activo: true,
    },
  });

  console.log("\nUsuario RG de prueba creado:\n");
  console.log("correo:   ", CORREO);
  console.log("password: ", password);
  console.log(
    "\n⚠️  Anota esta contraseña ahora — no se vuelve a mostrar. Cámbiala o pide al " +
      "Administrador general que la restablezca cuando termines de probar."
  );
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
