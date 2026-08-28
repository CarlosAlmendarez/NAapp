/**
 * Crea el RG de prueba, un Admin de casillas de prueba, y los 15
 * capturadores por distrito, todos con contraseñas FIJAS y conocidas (las
 * mismas que ya usan tests/*.spec.ts) — a diferencia de
 * scripts/crear-usuarios-por-distrito.ts (para producción, genera
 * contraseñas aleatorias y las escribe en credenciales-distritos.csv),
 * este script es solo para dejar la base de PRUEBA lista para correr la
 * suite de Playwright sin tener que tocar los archivos de prueba cada vez.
 *
 * Uso (siempre contra .env.test, nunca contra producción):
 *   npm run test:db:seed:usuarios
 *
 * Es seguro volver a correrlo: si un correo ya existe, no lo toca.
 */
import { PrismaClient, Rol } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();
const BCRYPT_ROUNDS = 12;

const RG = { correo: "rg@nuevaalianzaslp.org", password: "N6uNFK6kF#iMv#Ah" };
const ADMIN_CASILLAS = {
  correo: "admincasillas@nuevaalianzaslp.org",
  password: "Tq8#mVn2XpLr9wZk",
};

// Mismas 15 contraseñas que prisma/data/distritos-locales.json (1..15) y
// que ya están documentadas en credenciales.txt / credenciales-distritos.csv.
const CAPTURADORES: { numero: number; password: string }[] = [
  { numero: 1, password: "qUVvP!DJ2nWAiBe@" },
  { numero: 2, password: "Au4UThDDjuas!E4t" },
  { numero: 3, password: "q7SVJgD4L9vsGCND" },
  { numero: 4, password: "DLyocp!Py6RQQy6F" },
  { numero: 5, password: "qVfiAme#ZBva9YU5" },
  { numero: 6, password: "JdPv#kV69gV%WmeE" },
  { numero: 7, password: "sNr8gExabU4X3TB#" },
  { numero: 8, password: "DhWX6Lt%nVVCLr3W" },
  { numero: 9, password: "#nQh3C2usyMKnbBd" },
  { numero: 10, password: "zpzD8hUaE3c6Vss!" },
  { numero: 11, password: "TmEYoKqX28uB!DQG" },
  { numero: 12, password: "KALYSngT7W6#eEJD" },
  { numero: 13, password: "VGm@#GtGHY%9fT7K" },
  { numero: 14, password: "rKe@dtAJhSrVXNgR" },
  { numero: 15, password: "NsC4QWY#vi6qtS73" },
];

async function crearSiNoExiste(datos: {
  nombre: string;
  correo: string;
  password: string;
  rol: Rol;
  localidad?: { tipo: "DISTRITO_LOCAL"; valor: string };
}) {
  const existente = await prisma.usuario.findUnique({ where: { correo: datos.correo } });
  if (existente) {
    // Ya existe de una corrida anterior — se asegura igual de que tenga la
    // localidad esperada (ej. al agregar la restricción geográfica del RG
    // después de que el usuario de prueba ya existía).
    if (datos.localidad) {
      await prisma.usuarioLocalidad.upsert({
        where: {
          usuarioId_tipo_valor: {
            usuarioId: existente.id,
            tipo: datos.localidad.tipo,
            valor: datos.localidad.valor,
          },
        },
        create: { usuarioId: existente.id, ...datos.localidad },
        update: {},
      });
    }
    console.log(`✔ ${datos.correo} ya existe, sin cambios (localidad asegurada).`);
    return;
  }

  const passwordHash = await bcrypt.hash(datos.password, BCRYPT_ROUNDS);
  await prisma.usuario.create({
    data: {
      nombre: datos.nombre,
      correo: datos.correo,
      passwordHash,
      rol: datos.rol,
      activo: true,
      localidades: datos.localidad ? { create: [datos.localidad] } : undefined,
    },
  });
  console.log(`✔ ${datos.correo} creado.`);
}

async function main() {
  await crearSiNoExiste({
    nombre: "Representante General (prueba)",
    correo: RG.correo,
    password: RG.password,
    rol: Rol.REPRESENTANTE_GENERAL,
    // Restringido a este distrito desde que el RG dejó de tener acceso
    // ilimitado (ver módulo de Rutas) — mismo distrito que ya usaban las
    // pruebas de tests/casillas.spec.ts para crear casillas de RG.
    localidad: { tipo: "DISTRITO_LOCAL", valor: "2. SALINAS" },
  });

  await crearSiNoExiste({
    nombre: "Administrador de Casillas (prueba)",
    correo: ADMIN_CASILLAS.correo,
    password: ADMIN_CASILLAS.password,
    rol: Rol.ADMIN_CASILLAS,
  });

  const distritos = await prisma.distritoLocal.findMany();
  const nombrePorNumero = new Map(
    distritos.map((d) => [Number(d.nombre.match(/^(\d+)\./)?.[1]), d.nombre])
  );

  for (const c of CAPTURADORES) {
    const nombreDistrito = nombrePorNumero.get(c.numero);
    if (!nombreDistrito) {
      console.warn(`⚠️  No se encontró el distrito ${c.numero} en el catálogo, se omite.`);
      continue;
    }
    await crearSiNoExiste({
      nombre: `Capturador — Distrito ${nombreDistrito}`,
      correo: `distrito${c.numero}@nuevaalianzaslp.org`,
      password: c.password,
      rol: Rol.CAPTURADOR,
      localidad: { tipo: "DISTRITO_LOCAL", valor: nombreDistrito },
    });
  }

  console.log("\nListo. La base de prueba ya tiene admin, RG y los 15 capturadores.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
