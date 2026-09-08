import { NextResponse, type NextRequest } from "next/server";
import { obtenerUsuarioValidoOrNull } from "@/lib/auth-helpers";
import { construirLibroCasillas } from "@/lib/exportar-xlsx";
import { registrarAuditoria } from "@/lib/audit";

/**
 * Exportación 1: el catálogo completo de casillas en el mismo formato que
 * el padrón oficial ("SECCIONES Y CASILLAS 2024.xlsx"). Solo Admin
 * general — ni RG ni ningún otro rol, ni siquiera Admin de casillas (ver
 * el botón en la página, gateado igual).
 */
export async function GET(request: NextRequest) {
  const usuario = await obtenerUsuarioValidoOrNull();
  if (!usuario) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (usuario.rol !== "ADMIN_GENERAL") {
    return new NextResponse("No tienes permiso para exportar este archivo.", { status: 403 });
  }

  const buffer = await construirLibroCasillas();

  await registrarAuditoria({
    usuarioId: usuario.id,
    accion: "EXPORTAR",
    entidad: "Casilla",
    datosDespues: { formato: "xlsx" },
  });

  const fecha = new Date().toISOString().slice(0, 10);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="casillas-nueva-alianza-slp-${fecha}.xlsx"`,
    },
  });
}
