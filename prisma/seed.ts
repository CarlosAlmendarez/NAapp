import { PrismaClient, Rol, TipoRepresentante } from "@prisma/client";
import bcrypt from "bcryptjs";
import { readFileSync, existsSync } from "fs";
import path from "path";
import { encryptField } from "../src/lib/crypto";

const prisma = new PrismaClient();

type MunicipioSeed = { nombre: string; clave?: string };

function cargarMunicipios(): MunicipioSeed[] {
  const rutaOficial = path.join(__dirname, "data", "municipios.json");
  const rutaEjemplo = path.join(__dirname, "data", "municipios.sample.json");

  if (existsSync(rutaOficial)) {
    return JSON.parse(readFileSync(rutaOficial, "utf-8"));
  }

  console.warn(
    "\n⚠️  No se encontró prisma/data/municipios.json — usando prisma/data/municipios.sample.json " +
      "(catálogo de ejemplo, INCOMPLETO). Reemplázalo por el catálogo oficial de los 58 " +
      "municipios de San Luis Potosí antes de usar el sistema en producción.\n"
  );
  return JSON.parse(readFileSync(rutaEjemplo, "utf-8"));
}

async function seedMunicipios() {
  const municipios = cargarMunicipios();
  for (const m of municipios) {
    await prisma.municipio.upsert({
      where: { nombre: m.nombre },
      update: { clave: m.clave },
      create: { nombre: m.nombre, clave: m.clave },
    });
  }
  console.log(`✔ ${municipios.length} municipio(s) cargado(s).`);
  return municipios;
}

function cargarDistritosLocales(): { nombre: string }[] {
  const ruta = path.join(__dirname, "data", "distritos-locales.json");
  if (!existsSync(ruta)) return [];
  return JSON.parse(readFileSync(ruta, "utf-8"));
}

async function seedDistritosLocales() {
  const distritos = cargarDistritosLocales();
  for (const d of distritos) {
    await prisma.distritoLocal.upsert({
      where: { nombre: d.nombre },
      update: {},
      create: { nombre: d.nombre },
    });
  }
  console.log(`✔ ${distritos.length} distrito(s) local(es) cargado(s).`);
}

async function seedAdminGeneral() {
  const nombre = process.env.SEED_ADMIN_NOMBRE;
  const correo = process.env.SEED_ADMIN_CORREO?.trim().toLowerCase();
  const password = process.env.SEED_ADMIN_PASSWORD;

  if (!nombre || !correo || !password) {
    console.warn(
      "⚠️  SEED_ADMIN_NOMBRE / SEED_ADMIN_CORREO / SEED_ADMIN_PASSWORD no están definidas en " +
        ".env — se omite la creación del primer Administrador general. Defínelas y vuelve a " +
        "correr `npm run db:seed`."
    );
    return;
  }

  const existente = await prisma.usuario.findUnique({ where: { correo } });
  if (existente) {
    console.log(`✔ El Administrador general (${correo}) ya existe, no se modifica.`);
    return;
  }

  const passwordHash = await bcrypt.hash(password, 12);
  await prisma.usuario.create({
    data: { nombre, correo, passwordHash, rol: Rol.ADMIN_GENERAL, activo: true },
  });
  console.log(`✔ Administrador general creado: ${correo}`);
  console.log("  ⚠️  Cambia esta contraseña desde la app inmediatamente después de iniciar sesión.");
}

type CasillaSeed = {
  distritoFederal: string;
  distritoLocal: string;
  municipio: string;
  seccion: number;
  tipoCasilla: string;
  domicilio: string;
  coloniaLocalidad: string;
  codigoPostal: string | null;
  ubicacion: string;
};

/**
 * Carga el catálogo real de casillas generado por
 * `scripts/importar-secciones-casillas.ts` a partir del padrón oficial
 * (prisma/data/secciones-y-casillas-2024.xlsx -> prisma/data/casillas.json).
 * Usa `createMany` con `skipDuplicates` para que sea idempotente (una
 * casilla ya capturada por un usuario nunca se pisa: este catálogo solo
 * inserta las que faltan, según la restricción única sección+tipo).
 */
async function seedCasillasReales(): Promise<boolean> {
  const ruta = path.join(__dirname, "data", "casillas.json");
  if (!existsSync(ruta)) return false;

  const casillas: CasillaSeed[] = JSON.parse(readFileSync(ruta, "utf-8"));
  const TAM_LOTE = 500;
  let insertadas = 0;

  for (let i = 0; i < casillas.length; i += TAM_LOTE) {
    const lote = casillas.slice(i, i + TAM_LOTE);
    const resultado = await prisma.casilla.createMany({ data: lote, skipDuplicates: true });
    insertadas += resultado.count;
  }

  console.log(
    `✔ Catálogo real de casillas: ${insertadas} nueva(s) insertada(s) de ${casillas.length} en el archivo ` +
      `(las ya existentes —por sección+tipo— se omiten).`
  );
  return true;
}

async function seedCasillasDeEjemplo(municipios: MunicipioSeed[]) {
  if (municipios.length === 0) return;

  const yaHayCasillas = (await prisma.casilla.count()) > 0;
  if (yaHayCasillas) {
    console.log("✔ Ya existen casillas, se omite la carga de casillas de ejemplo.");
    return;
  }

  const [m1, m2] = municipios;
  const ejemplos = [
    {
      distritoFederal: "1. MATEHUALA",
      distritoLocal: "1. MATEHUALA",
      municipio: m1.nombre,
      seccion: 101,
      tipoCasilla: "B",
      domicilio: "Calle Ejemplo #100",
      coloniaLocalidad: "Centro",
      codigoPostal: "78700",
      ubicacion: "Escuela Primaria Ejemplo",
    },
    {
      distritoFederal: "1. MATEHUALA",
      distritoLocal: "1. MATEHUALA",
      municipio: m1.nombre,
      seccion: 101,
      tipoCasilla: "C01",
      domicilio: "Calle Ejemplo #100",
      coloniaLocalidad: "Centro",
      codigoPostal: "78700",
      ubicacion: "Escuela Primaria Ejemplo",
    },
    ...(m2
      ? [
          {
            distritoFederal: "2. SAN LUIS POTOSÍ",
            distritoLocal: "2. SAN LUIS POTOSÍ",
            municipio: m2.nombre,
            seccion: 205,
            tipoCasilla: "B",
            domicilio: "Av. Ejemplo #200",
            coloniaLocalidad: "Del Valle",
            codigoPostal: "78000",
            ubicacion: "Casa Ejidal Ejemplo",
          },
        ]
      : []),
  ];

  const creadas = [];
  for (const datos of ejemplos) {
    creadas.push(await prisma.casilla.create({ data: datos }));
  }
  console.log(`✔ ${creadas.length} casilla(s) de ejemplo creada(s).`);

  if (!process.env.FIELD_ENCRYPTION_KEY) {
    console.warn(
      "⚠️  FIELD_ENCRYPTION_KEY no está definida — se omite el RC de ejemplo (requiere cifrar " +
        "la clave de elector)."
    );
    return;
  }

  await prisma.representanteCasilla.create({
    data: {
      casillaId: creadas[0]!.id,
      tipo: TipoRepresentante.PROPIETARIO,
      nombre: "Nombre",
      apellidoPaterno: "Ejemplo",
      apellidoMaterno: "Demo",
      claveElectorCifrada: encryptField("EJEMPLO000000000A"),
      propone: "Nueva Alianza",
    },
  });
  console.log("✔ Representante de casilla de ejemplo creado.");
}

async function main() {
  const municipios = await seedMunicipios();
  await seedDistritosLocales();
  await seedAdminGeneral();

  const seCargoElCatalogoReal = await seedCasillasReales();
  if (!seCargoElCatalogoReal) {
    console.warn(
      "\n⚠️  No se encontró prisma/data/casillas.json — se omite el catálogo real de casillas. " +
        "Corre `npx tsx scripts/importar-secciones-casillas.ts` con el Excel oficial para generarlo. " +
        "Mientras tanto se cargan solo un par de casillas de ejemplo.\n"
    );
    await seedCasillasDeEjemplo(municipios);
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
