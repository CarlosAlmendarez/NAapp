import "server-only";
import { redirect } from "next/navigation";
import type { Rol } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export type UsuarioAutenticado = {
  id: string;
  nombre: string;
  correo: string;
  rol: Rol;
  activo: boolean;
  /** Municipios asignados. Solo relevante cuando rol === "CAPTURADOR". */
  localidades: string[];
};

export class AutorizacionError extends Error {}

/**
 * Punto único de verdad para autenticación + autorización de bajo nivel.
 *
 * SIEMPRE vuelve a consultar la base de datos — nunca confía en el rol,
 * el estado "activo" ni la localidad codificados en el JWT — y valida
 * `sessionVersion` contra la BD para poder revocar sesiones de inmediato
 * (al desactivar una cuenta, o con "cerrar sesión en todos los
 * dispositivos"). Esto es necesario porque Auth.js con el proveedor de
 * Credenciales solo admite sesiones JWT, no sesiones de base de datos
 * (ver comentario en src/auth.config.ts).
 */
async function obtenerUsuarioValidoOrNull(): Promise<UsuarioAutenticado | null> {
  const session = await auth();
  if (!session?.user?.id) return null;

  const usuario = await prisma.usuario.findUnique({
    where: { id: session.user.id },
    include: { localidades: true },
  });

  if (!usuario) return null;
  if (!usuario.activo) return null;
  if (usuario.sessionVersion !== session.user.sessionVersion) return null;

  return {
    id: usuario.id,
    nombre: usuario.nombre,
    correo: usuario.correo,
    rol: usuario.rol,
    activo: usuario.activo,
    localidades: usuario.localidades.map((l) => l.municipio),
  };
}

/** Para Server Components / páginas: redirige a /login si la sesión no es válida. */
export async function requireUser(): Promise<UsuarioAutenticado> {
  const usuario = await obtenerUsuarioValidoOrNull();
  if (!usuario) {
    redirect("/login");
  }
  return usuario;
}

/** Para Server Actions / Route Handlers: lanza un error controlado en vez de redirigir. */
export async function requireUserOrThrow(): Promise<UsuarioAutenticado> {
  const usuario = await obtenerUsuarioValidoOrNull();
  if (!usuario) {
    throw new AutorizacionError("Tu sesión ya no es válida. Vuelve a iniciar sesión.");
  }
  return usuario;
}

export function requireRole(usuario: UsuarioAutenticado, roles: Rol[]): void {
  if (!roles.includes(usuario.rol)) {
    throw new AutorizacionError("No tienes permiso para realizar esta acción.");
  }
}

/**
 * Verifica que un capturador tenga asignado el municipio indicado.
 * Admin general y admin de casillas tienen acceso a todos los municipios.
 */
export function requireLocalidadAccess(usuario: UsuarioAutenticado, municipio: string): void {
  if (usuario.rol === "ADMIN_GENERAL" || usuario.rol === "ADMIN_CASILLAS") return;
  if (!usuario.localidades.includes(municipio)) {
    throw new AutorizacionError("No tienes acceso a casillas de este municipio.");
  }
}

/** Filtro Prisma a aplicar en cualquier consulta de Casilla según el rol del usuario. */
export function filtroCasillasPorRol(usuario: UsuarioAutenticado) {
  if (usuario.rol === "ADMIN_GENERAL" || usuario.rol === "ADMIN_CASILLAS") {
    return {};
  }
  // Capturador sin localidades asignadas no debe ver ninguna casilla.
  return { municipio: { in: usuario.localidades.length > 0 ? usuario.localidades : ["__ninguna__"] } };
}

/**
 * Invalida de inmediato todas las sesiones activas de un usuario
 * (incrementa el contador que se compara en cada request). Se usa al
 * desactivar una cuenta y en la acción "cerrar sesión en todos los
 * dispositivos".
 */
export async function invalidarSesionesDe(usuarioId: string): Promise<void> {
  await prisma.usuario.update({
    where: { id: usuarioId },
    data: { sessionVersion: { increment: 1 } },
  });
}
