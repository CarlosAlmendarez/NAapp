import "server-only";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";

type AuditInput = {
  usuarioId: string | null;
  accion: string;
  entidad: string;
  entidadId?: string | null;
  datosAntes?: unknown;
  datosDespues?: unknown;
};

/** Registra una entrada de auditoría. Nunca debe romper el flujo principal. */
export async function registrarAuditoria(input: AuditInput): Promise<void> {
  try {
    const h = await headers();
    const ip =
      h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? h.get("x-real-ip") ?? "desconocida";

    await prisma.auditLog.create({
      data: {
        usuarioId: input.usuarioId,
        accion: input.accion,
        entidad: input.entidad,
        entidadId: input.entidadId ?? null,
        datosAntes: input.datosAntes === undefined ? undefined : (input.datosAntes as object),
        datosDespues:
          input.datosDespues === undefined ? undefined : (input.datosDespues as object),
        ip,
      },
    });
  } catch (error) {
    // La auditoría nunca debe tumbar la operación principal; se registra
    // en el log del servidor para no perder visibilidad del fallo.
    console.error("No se pudo registrar auditoría:", error);
  }
}
