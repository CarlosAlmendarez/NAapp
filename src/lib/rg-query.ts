import "server-only";
import type { Casa } from "@prisma/client";
import { prisma } from "@/lib/prisma";

export type RgDeCasilla = {
  nombre: string;
  correo: string;
};

/**
 * Representante General "nominal" de una casilla en una casa dada: el
 * Usuario activo con rol REPRESENTANTE_GENERAL, esa `casa`, y el distrito
 * local de la casilla entre sus localidades asignadas
 * (`UsuarioLocalidad`). Hay a lo sumo uno — lo garantiza la validación de
 * unicidad "un RG por distrito local POR casa" en `actions/usuarios.ts`.
 *
 * Se usa para:
 *  - mostrar a quien captura RC quién es el RG de esa casilla (Cambio 2), y
 *  - decidir si se permite capturar RC suplente (solo si NO hay RG).
 */
export async function obtenerRgDeCasilla(
  distritoLocal: string,
  casa: Casa
): Promise<RgDeCasilla | null> {
  const rg = await prisma.usuario.findFirst({
    where: {
      rol: "REPRESENTANTE_GENERAL",
      activo: true,
      casa,
      localidades: { some: { tipo: "DISTRITO_LOCAL", valor: distritoLocal } },
    },
    select: { nombre: true, correo: true },
  });
  return rg;
}
