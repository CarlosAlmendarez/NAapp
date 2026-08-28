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
 * Envuelve una Server Action para convertir errores esperados (Zod,
 * AutorizacionError) en un ActionResult legible por el cliente, en vez de
 * dejar que Next.js muestre un error genérico de servidor. Cualquier otro
 * error se re-lanza (y Next.js lo registra) para no ocultar bugs reales.
 */
export async function ejecutarAccion<T>(fn: () => Promise<T>): Promise<ActionResult<T>> {
  try {
    const data = await fn();
    return ok(data);
  } catch (error) {
    if (error instanceof ZodError) {
      return fail("Revisa los datos del formulario.", error.flatten().fieldErrors as Record<string, string[]>);
    }
    if (error instanceof AutorizacionError) {
      return fail(error.message);
    }
    console.error(error);
    return fail("Ocurrió un error inesperado. Intenta de nuevo.");
  }
}
