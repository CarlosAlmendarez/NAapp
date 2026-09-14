import { NextResponse, type NextRequest } from "next/server";
import { obtenerUsuarioValidoOrNull, filtroCasillasPorRol } from "@/lib/auth-helpers";
import { obtenerCasaActiva } from "@/lib/casa-server";
import { CASA_NUMERO } from "@/lib/casa";
import { construirLibroRutas } from "@/lib/exportar-xlsx";
import { registrarAuditoria } from "@/lib/audit";

const ROLES_EXPORTAN_RUTAS = ["ADMIN_GENERAL", "REPRESENTANTE_GENERAL"] as const;

/**
 * Exportación 2: mismo catálogo, con columnas extra al final que
 * identifican a qué ruta pertenece cada casilla capturada, y las filas
 * agrupadas por ruta para distinguirlas de un vistazo. Admin general
 * exporta el catálogo completo; el RG exporta SOLO lo que le corresponde
 * (`filtroCasillasPorRol`, igual que el resto de la app) — nunca el
 * catálogo completo.
 */
export async function GET(request: NextRequest) {
  const usuario = await obtenerUsuarioValidoOrNull();
  if (!usuario) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (!ROLES_EXPORTAN_RUTAS.includes(usuario.rol as (typeof ROLES_EXPORTAN_RUTAS)[number])) {
    return new NextResponse("No tienes permiso para exportar este archivo.", { status: 403 });
  }

  const casa = await obtenerCasaActiva();
  if (!casa) {
    return new NextResponse("Elige una casa (26 o 52) antes de exportar.", { status: 400 });
  }

  const buffer = await construirLibroRutas(casa, filtroCasillasPorRol(usuario));

  await registrarAuditoria({
    usuarioId: usuario.id,
    accion: "EXPORTAR",
    entidad: "EnlaceCasilla",
    datosDespues: { formato: "xlsx", casa },
  });

  const fecha = new Date().toISOString().slice(0, 10);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="rutas-nueva-alianza-slp-casa-${CASA_NUMERO[casa]}-${fecha}.xlsx"`,
    },
  });
}
