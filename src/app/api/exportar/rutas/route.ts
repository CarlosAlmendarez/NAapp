import { NextResponse, type NextRequest } from "next/server";
import { obtenerUsuarioValidoOrNull } from "@/lib/auth-helpers";
import { construirLibroRutas } from "@/lib/exportar-xlsx";
import { registrarAuditoria } from "@/lib/audit";

/**
 * Exportación 2: mismo catálogo, con columnas extra al final que
 * identifican a qué ruta pertenece cada casilla capturada, y las filas
 * agrupadas por ruta para distinguirlas de un vistazo. Solo Admin general
 * — ni siquiera el RG que sí captura las rutas (ver el botón en la
 * página, gateado igual).
 */
export async function GET(request: NextRequest) {
  const usuario = await obtenerUsuarioValidoOrNull();
  if (!usuario) {
    return NextResponse.redirect(new URL("/login", request.url));
  }
  if (usuario.rol !== "ADMIN_GENERAL") {
    return new NextResponse("No tienes permiso para exportar este archivo.", { status: 403 });
  }

  const buffer = await construirLibroRutas();

  await registrarAuditoria({
    usuarioId: usuario.id,
    accion: "EXPORTAR",
    entidad: "EnlaceCasilla",
    datosDespues: { formato: "xlsx" },
  });

  const fecha = new Date().toISOString().slice(0, 10);
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename="rutas-nueva-alianza-slp-${fecha}.xlsx"`,
    },
  });
}
