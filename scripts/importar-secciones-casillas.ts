/**
 * Convierte el archivo oficial "SECCIONES Y CASILLAS 2024.xlsx" (padrón de
 * distritos, municipios y casillas de San Luis Potosí) a los archivos JSON
 * que consume `prisma/seed.ts`:
 *
 *   prisma/data/municipios.json         — catálogo de municipios (columna MUNICIPIO)
 *   prisma/data/distritos-locales.json  — catálogo de distritos locales (columna DISTRITO LOCAL)
 *   prisma/data/casillas.json           — catálogo completo de casillas
 *
 * Uso:
 *   npx tsx scripts/importar-secciones-casillas.ts [ruta-al-xlsx]
 *
 * Si no se pasa ruta, usa `prisma/data/secciones-y-casillas-2024.xlsx`.
 *
 * El archivo trae también columnas de RC propietario/suplente (nombre,
 * clave de elector, correo, teléfono, propone) — al día en que se generó
 * este importador venían vacías (esa es la captura que hace la app). Si en
 * el futuro el archivo ya trae esas columnas llenas, este script las
 * ignora a propósito (no se cargan datos personales por un script sin
 * cifrar) y solo avisa cuántas filas las traían, para revisarlas a mano.
 */
import * as XLSX from "xlsx";
import { writeFileSync, existsSync } from "fs";
import path from "path";

const HOJA = "sabana.";
const FILAS_ENCABEZADO = 2; // dos filas de encabezado antes de los datos
const TIPO_CASILLA_REGEX = /^(B|C\d{2}|S\d{2}|E\d{2}(C\d{2})?)$/;

type FilaCasilla = {
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

function limpiar(valor: unknown): string {
  return String(valor ?? "").trim();
}

function main() {
  const rutaArg = process.argv[2];
  const ruta = rutaArg
    ? path.resolve(rutaArg)
    : path.join(__dirname, "..", "prisma", "data", "secciones-y-casillas-2024.xlsx");

  if (!existsSync(ruta)) {
    console.error(`No se encontró el archivo: ${ruta}`);
    process.exit(1);
  }

  const wb = XLSX.readFile(ruta);
  const nombreHoja = wb.SheetNames.includes(HOJA) ? HOJA : wb.SheetNames[0]!;
  if (nombreHoja !== HOJA) {
    console.warn(`⚠️  No se encontró la hoja "${HOJA}", usando "${nombreHoja}" en su lugar.`);
  }
  const ws = wb.Sheets[nombreHoja]!;
  const filas = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, raw: false, defval: "" });
  const datos = filas.slice(FILAS_ENCABEZADO);

  const municipios = new Set<string>();
  const distritosLocales = new Set<string>();
  const casillasPorClave = new Map<string, FilaCasilla>();
  let filasVacias = 0;
  let filasConTipoInvalido = 0;
  let filasConRcPreCapturado = 0;
  let duplicadosResueltos = 0;

  for (const fila of datos) {
    const distritoFederal = limpiar(fila[0]);
    const distritoLocal = limpiar(fila[1]);
    const municipio = limpiar(fila[2]);
    const seccionTexto = limpiar(fila[3]);
    const tipoCasilla = limpiar(fila[4]).toUpperCase();
    const domicilio = limpiar(fila[6]);
    const coloniaLocalidad = limpiar(fila[7]);
    const codigoPostalTexto = limpiar(fila[8]);
    const ubicacion = limpiar(fila[9]);

    // Columnas 10-16 (propietario) y 17-23 (suplente): nombre, apellidos,
    // clave de elector, correo, teléfono, propone.
    const tienePropietario = [10, 11, 13, 16].some((i) => limpiar(fila[i]) !== "");
    const tieneSuplente = [17, 18, 20, 23].some((i) => limpiar(fila[i]) !== "");
    if (tienePropietario || tieneSuplente) filasConRcPreCapturado++;

    if (!municipio && !seccionTexto && !tipoCasilla) {
      filasVacias++;
      continue;
    }

    const seccion = Number(seccionTexto);
    if (!municipio || !Number.isInteger(seccion) || seccion <= 0 || !tipoCasilla) {
      console.warn(`⚠️  Fila omitida por datos incompletos: municipio="${municipio}" sección="${seccionTexto}" tipo="${tipoCasilla}"`);
      continue;
    }

    if (!TIPO_CASILLA_REGEX.test(tipoCasilla)) {
      filasConTipoInvalido++;
      console.warn(`⚠️  Tipo de casilla con formato inesperado, se omite: sección ${seccion}, tipo "${tipoCasilla}"`);
      continue;
    }

    municipios.add(municipio);
    if (distritoLocal) distritosLocales.add(distritoLocal);

    const codigoPostal = /^\d{5}$/.test(codigoPostalTexto) ? codigoPostalTexto : null;

    const clave = `${seccion}|${tipoCasilla}`;
    const registro: FilaCasilla = {
      distritoFederal,
      distritoLocal,
      municipio,
      seccion,
      tipoCasilla,
      domicilio,
      coloniaLocalidad,
      codigoPostal,
      ubicacion,
    };

    const existente = casillasPorClave.get(clave);
    if (existente) {
      duplicadosResueltos++;
      // Si el registro nuevo trae código postal y el guardado no, nos
      // quedamos con el más completo.
      if (!existente.codigoPostal && registro.codigoPostal) {
        casillasPorClave.set(clave, registro);
      }
      continue;
    }
    casillasPorClave.set(clave, registro);
  }

  const numeroInicial = (texto: string) => parseInt(texto, 10) || 0;

  const municipiosOrdenados = [...municipios].sort((a, b) => a.localeCompare(b));
  const distritosOrdenados = [...distritosLocales].sort(
    (a, b) => numeroInicial(a) - numeroInicial(b)
  );
  const casillas = [...casillasPorClave.values()].sort(
    (a, b) => a.municipio.localeCompare(b.municipio) || a.seccion - b.seccion
  );

  const rutaMunicipios = path.join(__dirname, "..", "prisma", "data", "municipios.json");
  const rutaDistritos = path.join(__dirname, "..", "prisma", "data", "distritos-locales.json");
  const rutaCasillas = path.join(__dirname, "..", "prisma", "data", "casillas.json");

  writeFileSync(
    rutaMunicipios,
    JSON.stringify(
      municipiosOrdenados.map((nombre) => ({ nombre })),
      null,
      2
    ) + "\n"
  );
  writeFileSync(
    rutaDistritos,
    JSON.stringify(
      distritosOrdenados.map((nombre) => ({ nombre })),
      null,
      2
    ) + "\n"
  );
  writeFileSync(rutaCasillas, JSON.stringify(casillas, null, 2) + "\n");

  console.log(`\n✔ ${municipiosOrdenados.length} municipio(s) → ${rutaMunicipios}`);
  console.log(`✔ ${distritosOrdenados.length} distrito(s) local(es) → ${rutaDistritos}`);
  console.log(`✔ ${casillas.length} casilla(s) → ${rutaCasillas}`);
  console.log(`  Filas vacías ignoradas: ${filasVacias}`);
  console.log(`  Filas con tipo de casilla no reconocido: ${filasConTipoInvalido}`);
  console.log(`  Duplicados sección+tipo resueltos (se quedó la fila más completa): ${duplicadosResueltos}`);
  if (filasConRcPreCapturado > 0) {
    console.warn(
      `\n⚠️  ${filasConRcPreCapturado} fila(s) del Excel ya traían datos de RC (propietario/suplente). ` +
        "Este importador NO los carga (son datos personales que deben cifrarse vía la app, no por " +
        "script). Revísalos manualmente y captúralos desde la aplicación."
    );
  }
}

main();
