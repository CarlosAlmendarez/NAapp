/**
 * Crea (o actualiza la asignación de) un usuario Capturador por cada
 * distrito local del catálogo (prisma/data/distritos-locales.json),
 * asignado por DISTRITO_LOCAL (no por municipio) — así queda correcto
 * incluso para los municipios repartidos en varios distritos (San Luis
 * Potosí capital: distritos 4-8; Soledad de Graciano Sánchez: 9-10).
 *
 * Correo: distrito{N}@nuevaalianzaslp.org
 *
 * Uso:
 *   npx tsx scripts/crear-usuarios-por-distrito.ts
 *
 * Es seguro volver a correrlo: si el usuario ya existe, no se le cambia la
 * contraseña ni se duplica su asignación de distrito.
 */
import { PrismaClient, Rol } from "@prisma/client";
import bcrypt from "bcryptjs";
import { readFileSync, existsSync, writeFileSync } from "fs";
import path from "path";
import { randomInt } from "crypto";

const prisma = new PrismaClient();
const DOMINIO = "nuevaalianzaslp.org";
const BCRYPT_ROUNDS = 12;

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
  const ruta = path.join(__dirname, "..", "prisma", "data", "distritos-locales.json");
  if (!existsSync(ruta)) {
    console.error(
      "No se encontró prisma/data/distritos-locales.json. Corre primero " +
        "`npx tsx scripts/importar-secciones-casillas.ts`."
    );
    process.exit(1);
  }

  const distritos: { nombre: string }[] = JSON.parse(readFileSync(ruta, "utf-8"));
  const credenciales: { correo: string; password: string; nuevo: boolean }[] = [];

  for (const { nombre: distrito } of distritos) {
    const numero = numeroDeDistrito(distrito);
    const correo = `distrito${numero}@${DOMINIO}`;
    const nombreCuenta = `Capturador — Distrito ${distrito}`;

    const existente = await prisma.usuario.findUnique({
      where: { correo },
      include: { localidades: true },
    });

    if (existente) {
      // Ya existe: solo aseguramos que tenga asignado su distrito (por si
      // se corrió antes de que existiera el catálogo completo), sin tocar
      // contraseña ni otros datos.
      const yaAsignado = existente.localidades.some(
        (l) => l.tipo === "DISTRITO_LOCAL" && l.valor === distrito
      );
      if (!yaAsignado) {
        await prisma.usuarioLocalidad.create({
          data: { usuarioId: existente.id, tipo: "DISTRITO_LOCAL", valor: distrito },
        });
      }
      credenciales.push({ correo, password: "(ya existía, sin cambios)", nuevo: false });
      continue;
    }

    const password = generarPassword();
    const passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS);

    await prisma.usuario.create({
      data: {
        nombre: nombreCuenta,
        correo,
        passwordHash,
        rol: Rol.CAPTURADOR,
        activo: true,
        localidades: { create: [{ tipo: "DISTRITO_LOCAL", valor: distrito }] },
      },
    });

    credenciales.push({ correo, password, nuevo: true });
  }

  console.log("\nUsuario por distrito local:\n");
  console.log("correo".padEnd(28), "password");
  console.log("-".repeat(60));
  for (const c of credenciales) {
    console.log(c.correo.padEnd(28), c.password, c.nuevo ? "" : "(existente)");
  }

  const nuevos = credenciales.filter((c) => c.nuevo);
  if (nuevos.length > 0) {
    const rutaSalida = path.join(__dirname, "..", "credenciales-distritos.csv");
    const csv =
      "correo,password\n" + nuevos.map((c) => `${c.correo},${c.password}`).join("\n") + "\n";
    writeFileSync(rutaSalida, csv);
    console.log(
      `\n⚠️  Contraseñas guardadas en ${rutaSalida} (NO está en git — ver .gitignore). ` +
        "Repártelas por un canal seguro y bórralo del disco después. Cada capturador debe " +
        "cambiar su contraseña en su primer inicio de sesión."
    );
  } else {
    console.log("\nTodos los usuarios ya existían — no se generaron contraseñas nuevas.");
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
