import { ZodError } from "zod";
import { AutorizacionError } from "@/lib/auth-helpers";

export type ActionResult<T = undefined> =
  | { success: true; data: T }
  | { success: false; error: string; fieldErrors?: Record<string, string[]> };

export function ok<T>(data: T): ActionResult<T> {
  return { success: true, data };
}

export function fail(error: string, fieldErrors?: Record<string, string[]>): ActionResult<never> {
  return { success: false, error, fieldErrors };
}

/**
 * Error de negocio "seguro de mostrar" (ej. "ya existe una casilla con esa
 * sección", "ese correo ya está en uso"). Úsala en vez de `new Error(...)`
 * en las Server Actions para que `ejecutarAccion` muestre el mensaje real
 * al usuario — un `Error` genérico (por ejemplo uno que venga de Prisma)
 * puede traer detalles internos en `.message` que no deben llegar al
 * cliente, así que esos sí se quedan como el mensaje genérico de abajo.
 */
export class AccionError extends Error {}

/**
 * Envuelve una Server Action para convertir errores esperados (Zod,
 * AutorizacionError, AccionError) en un ActionResult legible por el
 * cliente, en vez de dejar que Next.js muestre un error genérico de
 * servidor. Cualquier otro tipo de error (uno realmente inesperado, ej.
 * de Prisma/red) se registra en el log del servidor y se le muestra al
 * usuario un mensaje genérico — nunca se le expone `.message` tal cual,
 * porque podría traer detalles internos.
 */
export async function ejecutarAccion<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return ok(data);
  } catch (error) {
    if (error instanceof ZodError) {
      return fail("Revisa los datos del formulario.", error.flatten().fieldErrors as Record<string, string[]>);
    }
    if (error instanceof AutorizacionError || error instanceof AccionError) {
      return fail(error.message);
    }
    console.error(error);
    return fail("Ocurrió un error inesperado. Intenta de nuevo.");
  }
}
