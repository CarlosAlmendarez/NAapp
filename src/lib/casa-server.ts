import "server-only";
import { cookies } from "next/headers";
import type { Casa } from "@prisma/client";
import { COOKIE_CASA, esCasa } from "@/lib/casa";

/** Casa activa según la cookie, o `null` si el usuario aún no eligió. */
export async function obtenerCasaActiva(): Promise<Casa | null> {
  const cookieStore = await cookies();
  const valor = cookieStore.get(COOKIE_CASA)?.value;
  return esCasa(valor) ? valor : null;
}

/**
 * Para páginas/consultas que asumen que ya hay casa (el gate del layout
 * corta antes si no la hay). Lanza si se llama sin casa elegida.
 */
export async function requireCasaActiva(): Promise<Casa> {
  const casa = await obtenerCasaActiva();
  if (!casa) {
    throw new Error("No hay una casa activa seleccionada.");
  }
  return casa;
}
