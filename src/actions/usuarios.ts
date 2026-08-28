"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireUserOrThrow, requireRole, invalidarSesionesDe } from "@/lib/auth-helpers";
import {
  crearUsuarioSchema,
  editarUsuarioSchema,
  resetearPasswordSchema,
} from "@/lib/validations/usuario";
import { registrarAuditoria } from "@/lib/audit";
import { ejecutarAccion, type ActionResult } from "@/lib/action-result";

const BCRYPT_ROUNDS = 12;

/** Solo el Administrador general crea, edita y desactiva usuarios. */
export async function crearUsuario(formData: unknown): Promise<ActionResult<{ id: string }>> {
  return ejecutarAccion(async () => {
    const admin = await requireUserOrThrow();
    requireRole(admin, ["ADMIN_GENERAL"]);

    const datos = crearUsuarioSchema.parse(formData);

    const existente = await prisma.usuario.findUnique({ where: { correo: datos.correo } });
    if (existente) throw new Error("Ya existe un usuario con ese correo.");

    const passwordHash = await bcrypt.hash(datos.password, BCRYPT_ROUNDS);

    const nuevo = await prisma.usuario.create({
      data: {
        nombre: datos.nombre,
        correo: datos.correo,
        passwordHash,
        rol: datos.rol,
        creadoPorId: admin.id,
        localidades:
          datos.rol === "CAPTURADOR"
            ? { create: datos.localidades.map((l) => ({ tipo: l.tipo, valor: l.valor })) }
            : undefined,
      },
    });

    await registrarAuditoria({
      usuarioId: admin.id,
      accion: "CREAR",
      entidad: "Usuario",
      entidadId: nuevo.id,
      datosDespues: { ...nuevo, passwordHash: "[oculto]" },
    });

    revalidatePath("/usuarios");
    return { id: nuevo.id };
  });
}

export async function actualizarUsuario(formData: unknown): Promise<ActionResult<{ id: string }>> {
  return ejecutarAccion(async () => {
    const admin = await requireUserOrThrow();
    requireRole(admin, ["ADMIN_GENERAL"]);

    const datos = editarUsuarioSchema.parse(formData);

    const anterior = await prisma.usuario.findUnique({ where: { id: datos.id } });
    if (!anterior) throw new Error("El usuario no existe.");

    const correoEnUso = await prisma.usuario.findFirst({
      where: { correo: datos.correo, NOT: { id: datos.id } },
    });
    if (correoEnUso) throw new Error("Ese correo ya está en uso por otro usuario.");

    const seDesactivo = anterior.activo && !datos.activo;

    const actualizado = await prisma.$transaction(async (tx) => {
      const usuarioActualizado = await tx.usuario.update({
        where: { id: datos.id },
        data: {
          nombre: datos.nombre,
          correo: datos.correo,
          rol: datos.rol,
          activo: datos.activo,
          // Si se desactiva, se revocan sus sesiones activas de inmediato.
          ...(seDesactivo ? { sessionVersion: { increment: 1 } } : {}),
        },
      });

      await tx.usuarioLocalidad.deleteMany({ where: { usuarioId: datos.id } });
      if (datos.rol === "CAPTURADOR" && datos.localidades.length > 0) {
        await tx.usuarioLocalidad.createMany({
          data: datos.localidades.map((l) => ({
            usuarioId: datos.id,
            tipo: l.tipo,
            valor: l.valor,
          })),
        });
      }

      return usuarioActualizado;
    });

    await registrarAuditoria({
      usuarioId: admin.id,
      accion: seDesactivo ? "DESACTIVAR" : "ACTUALIZAR",
      entidad: "Usuario",
      entidadId: actualizado.id,
      datosAntes: { ...anterior, passwordHash: "[oculto]" },
      datosDespues: { ...actualizado, passwordHash: "[oculto]" },
    });

    revalidatePath("/usuarios");
    revalidatePath(`/usuarios/${datos.id}`);
    return { id: actualizado.id };
  });
}

export async function resetearPasswordUsuario(formData: unknown): Promise<ActionResult<{ id: string }>> {
  return ejecutarAccion(async () => {
    const admin = await requireUserOrThrow();
    requireRole(admin, ["ADMIN_GENERAL"]);

    const datos = resetearPasswordSchema.parse(formData);
    const usuario = await prisma.usuario.findUnique({ where: { id: datos.id } });
    if (!usuario) throw new Error("El usuario no existe.");

    const passwordHash = await bcrypt.hash(datos.passwordNueva, BCRYPT_ROUNDS);

    await prisma.usuario.update({
      where: { id: datos.id },
      data: { passwordHash, sessionVersion: { increment: 1 } },
    });

    await registrarAuditoria({
      usuarioId: admin.id,
      accion: "RESETEAR_PASSWORD",
      entidad: "Usuario",
      entidadId: usuario.id,
    });

    return { id: usuario.id };
  });
}

/** Fuerza el cierre de todas las sesiones activas de un usuario específico. */
export async function cerrarSesionesDeUsuario(usuarioId: string): Promise<ActionResult<{ id: string }>> {
  return ejecutarAccion(async () => {
    const admin = await requireUserOrThrow();
    requireRole(admin, ["ADMIN_GENERAL"]);

    await invalidarSesionesDe(usuarioId);

    await registrarAuditoria({
      usuarioId: admin.id,
      accion: "CERRAR_SESIONES",
      entidad: "Usuario",
      entidadId: usuarioId,
    });

    revalidatePath("/usuarios");
    return { id: usuarioId };
  });
}
