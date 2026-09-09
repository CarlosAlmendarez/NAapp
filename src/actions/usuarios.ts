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
import { CASA_LABEL } from "@/lib/casa";
import { ejecutarAccion, AccionError, type ActionResult } from "@/lib/action-result";
import type { Casa } from "@prisma/client";

const BCRYPT_ROUNDS = 12;

const ROLES_CON_LOCALIDADES: readonly string[] = ["CAPTURADOR", "REPRESENTANTE_GENERAL"];

/**
 * Un distrito local solo debe tener 1 Representante General activo POR
 * casa (26 / 52) — así puede haber un RG para (distrito, Casa 26) y otro
 * distinto para (distrito, Casa 52), pero no dos en la misma casa (evita
 * capturas duplicadas/confusas del mismo distrito en el módulo de Rutas).
 * `excluirUsuarioId` se usa al editar, para no chocar contra el propio
 * registro que se está guardando.
 */
async function verificarDistritoLibreParaRG(
  localidades: { tipo: "MUNICIPIO" | "DISTRITO_LOCAL"; valor: string }[],
  casa: Casa,
  excluirUsuarioId?: string
): Promise<void> {
  const distritos = localidades.filter((l) => l.tipo === "DISTRITO_LOCAL").map((l) => l.valor);
  if (distritos.length === 0) return;

  const conflicto = await prisma.usuarioLocalidad.findFirst({
    where: {
      tipo: "DISTRITO_LOCAL",
      valor: { in: distritos },
      usuario: {
        rol: "REPRESENTANTE_GENERAL",
        activo: true,
        casa,
        ...(excluirUsuarioId ? { NOT: { id: excluirUsuarioId } } : {}),
      },
    },
    include: { usuario: true },
  });

  if (conflicto) {
    throw new AccionError(
      `El distrito local "${conflicto.valor}" ya tiene asignado a otro Representante General activo en ${CASA_LABEL[casa]} (${conflicto.usuario.nombre}).`
    );
  }
}

/** Solo el Administrador general crea, edita y desactiva usuarios. */
export async function crearUsuario(formData: unknown): Promise<ActionResult<{ id: string }>> {
  return ejecutarAccion(async () => {
    const admin = await requireUserOrThrow();
    requireRole(admin, ["ADMIN_GENERAL"]);

    const datos = crearUsuarioSchema.parse(formData);

    const existente = await prisma.usuario.findUnique({ where: { correo: datos.correo } });
    if (existente) throw new AccionError("Ya existe un usuario con ese correo.");

    const casa = datos.rol === "REPRESENTANTE_GENERAL" ? (datos.casa ?? null) : null;
    if (datos.rol === "REPRESENTANTE_GENERAL" && casa) {
      await verificarDistritoLibreParaRG(datos.localidades, casa);
    }

    const passwordHash = await bcrypt.hash(datos.password, BCRYPT_ROUNDS);

    const nuevo = await prisma.usuario.create({
      data: {
        nombre: datos.nombre,
        correo: datos.correo,
        passwordHash,
        rol: datos.rol,
        casa,
        creadoPorId: admin.id,
        localidades: ROLES_CON_LOCALIDADES.includes(datos.rol)
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
    if (!anterior) throw new AccionError("El usuario no existe.");

    const correoEnUso = await prisma.usuario.findFirst({
      where: { correo: datos.correo, NOT: { id: datos.id } },
    });
    if (correoEnUso) throw new AccionError("Ese correo ya está en uso por otro usuario.");

    const casa = datos.rol === "REPRESENTANTE_GENERAL" ? (datos.casa ?? null) : null;

    // Solo importa si el usuario quedará como RG activo tras este guardado
    // — uno ya desactivado, o que deja de ser RG, no debe bloquear el
    // distrito para nadie más. La unicidad es por (distrito, casa).
    if (datos.rol === "REPRESENTANTE_GENERAL" && datos.activo && casa) {
      await verificarDistritoLibreParaRG(datos.localidades, casa, datos.id);
    }

    const seDesactivo = anterior.activo && !datos.activo;

    const actualizado = await prisma.$transaction(async (tx) => {
      const usuarioActualizado = await tx.usuario.update({
        where: { id: datos.id },
        data: {
          nombre: datos.nombre,
          correo: datos.correo,
          rol: datos.rol,
          activo: datos.activo,
          casa,
          // Si se desactiva, se revocan sus sesiones activas de inmediato.
          ...(seDesactivo ? { sessionVersion: { increment: 1 } } : {}),
        },
      });

      await tx.usuarioLocalidad.deleteMany({ where: { usuarioId: datos.id } });
      if (ROLES_CON_LOCALIDADES.includes(datos.rol) && datos.localidades.length > 0) {
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
    if (!usuario) throw new AccionError("El usuario no existe.");

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
