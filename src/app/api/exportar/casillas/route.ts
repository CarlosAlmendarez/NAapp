import { NextResponse, type NextRequest } from "next/server";
import { obtenerUsuarioValidoOrNull, filtroCasillasPorRol } from "@/lib/auth-helpers";
import { obtenerCasaActiva } from "@/lib/casa-server";
import { CASA_NUMERO } from "@/lib/casa";
import { construirLibroCasillas } from "@/lib/exportar-xlsx";
import { registrarAuditoria } from "@/lib/audit";

const ROLES_EXPORTAN_CASILLAS = ["ADMIN_GENERAL", "CAPTURADOR"] as const;

/**
 * Exportación 1: casillas en el mismo formato que el padrón oficial
 * ("SECCIONES Y CASILLAS 2024.xlsx"), con RC y RG ya capturados. Admin
 * general exporta el catálogo completo; Capturador exporta SOLO lo que le
 * corresponde (`filtroCasillasPorRol`, igual que el resto de la app) —
 * nunca el catálogo completo. Ni RG ni Admin de casillas lo ven (ver el
 * botón en la página, gateado igual).
 */
export async function GET(request: NextRequest) {
  const usuario = await obtenerUsuarioValidoOrNull();
  if (!usuario) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (!ROLES_EXPORTAN_CASILLAS.includes(usuario.rol as (typeof ROLES_EXPORTAN_CASILLAS)[number])) {
    return new NextResponse("No tienes permiso para exportar este archivo.", { status: 403 });
  }

  const casa = await obtenerCasaActiva();
  if (!casa) {
    return new NextResponse("Elige una casa (26 o 52) antes de exportar.", { status: 400 });
  }

  const buffer = await construirLibroCasillas(casa, filtroCasillasPorRol(usuario));

  await registrarAuditoria({
    usuarioId: usuario.id,
    accion: "EXPORTAR",
    entidad: "Casilla",
    datosDespues: { formato: "xlsx", casa },
  });

  const fecha = new Date().toISOString().slice(0, 10);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="casillas-nueva-alianza-slp-casa-${CASA_NUMERO[casa]}-${fecha}.xlsx"`,
    },
  });
}
