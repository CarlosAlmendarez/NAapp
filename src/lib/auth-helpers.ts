import "server-only";
import { redirect } from "next/navigation";
import type { Prisma, Rol } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";

export type LocalidadAsignada = { tipo: "MUNICIPIO" | "DISTRITO_LOCAL"; valor: string };

export type UsuarioAutenticado = {
  id: string;
  nombre: string;
  correo: string;
  rol: Rol;
  activo: boolean;
  /** Municipios y/o distritos locales asignados. Solo relevante cuando rol === "CAPTURADOR". */
  localidades: LocalidadAsignada[];
};

/** Solo las localidades de tipo MUNICIPIO asignadas al usuario. */
export function municipiosAsignados(usuario: UsuarioAutenticado): string[] {
  return usuario.localidades.filter((l) => l.tipo === "MUNICIPIO").map((l) => l.valor);
}

/** Solo las localidades de tipo DISTRITO_LOCAL asignadas al usuario. */
export function distritosAsignados(usuario: UsuarioAutenticado): string[] {
  return usuario.localidades.filter((l) => l.tipo === "DISTRITO_LOCAL").map((l) => l.valor);
}

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
    localidades: usuario.localidades.map((l) => ({ tipo: l.tipo, valor: l.valor })),
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

type CasillaGeografia = { municipio: string; distritoLocal: string };

/**
 * true si el usuario puede ver/editar una casilla, ya sea por tener
 * asignado su municipio o su distrito local. Admin general y admin de
 * casillas siempre tienen acceso. Un municipio grande puede estar
 * repartido en varios distritos locales (ej. San Luis Potosí capital o
 * Soledad de Graciano Sánchez), por eso se evalúan ambas dimensiones por
 * separado en vez de asumir que un distrito equivale a un conjunto fijo
 * de municipios.
 */
export function tieneAccesoALocalidad(
  usuario: UsuarioAutenticado,
  casilla: CasillaGeografia
): boolean {
  if (usuario.rol === "ADMIN_GENERAL" || usuario.rol === "ADMIN_CASILLAS") return true;
  return usuario.localidades.some(
    (l) =>
      (l.tipo === "MUNICIPIO" && l.valor === casilla.municipio) ||
      (l.tipo === "DISTRITO_LOCAL" && l.valor === casilla.distritoLocal)
  );
}

/** Igual que `tieneAccesoALocalidad`, pero lanza si no hay acceso. */
export function requireLocalidadAccess(
  usuario: UsuarioAutenticado,
  casilla: CasillaGeografia
): void {
  if (!tieneAccesoALocalidad(usuario, casilla)) {
    throw new AutorizacionError("No tienes acceso a casillas de esta localidad.");
  }
}

/** Filtro Prisma a aplicar en cualquier consulta de Casilla según el rol del usuario. */
export function filtroCasillasPorRol(usuario: UsuarioAutenticado): Prisma.CasillaWhereInput {
  if (usuario.rol === "ADMIN_GENERAL" || usuario.rol === "ADMIN_CASILLAS") {
    return {};
  }

  const municipios = municipiosAsignados(usuario);
  const distritos = distritosAsignados(usuario);

  if (municipios.length === 0 && distritos.length === 0) {
    // Capturador sin localidades asignadas no debe ver ninguna casilla.
    return { id: "__ninguna__" };
  }

  const or: Prisma.CasillaWhereInput[] = [];
  if (municipios.length > 0) or.push({ municipio: { in: municipios } });
  if (distritos.length > 0) or.push({ distritoLocal: { in: distritos } });
  return { OR: or };
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
