import { Prisma } from "@prisma/client";

/**
 * La base Neon se suspende tras inactividad; el primer intento de
 * conexión después puede fallar o agotar el tiempo. Estos son los errores
 * "de conexión, no de datos" en los que reintentar es seguro (aún no se
 * escribió nada) y suele bastar con un segundo intento.
 */
const CODIGOS_CONEXION = new Set(["P1000", "P1001", "P1002", "P1008", "P1017"]);

export function esErrorTransitorioDeConexion(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientInitializationError) return true;
  if (error instanceof Prisma.PrismaClientRustPanicError) return true;
  if (
    error instanceof Prisma.PrismaClientKnownRequestError &&
    CODIGOS_CONEXION.has(error.code)
  ) {
    return true;
  }
  const msg = error instanceof Error ? error.message : String(error);
  return /can't reach database server|connection (closed|reset|terminated)|ECONNRESET|ETIMEDOUT|Timed out fetching a new connection/i.test(
    msg
  );
}

/**
 * Ejecuta `fn` reintentando solo ante errores transitorios de conexión
 * (ver arriba). Hasta `intentos` totales, con espera creciente entre
 * cada uno. Cualquier otro error se propaga de inmediato.
 */
export async function conReintento<T>(
  fn: () => Promise<T>,
  { intentos = 3, esperaMs = 300 }: { intentos?: number; esperaMs?: number } = {}
): Promise<T> {
  let ultimoError: unknown;
  for (let i = 0; i < intentos; i++) {
    try {
      return await fn();
    } catch (error) {
      ultimoError = error;
      if (i === intentos - 1 || !esErrorTransitorioDeConexion(error)) throw error;
      await new Promise((r) => setTimeout(r, esperaMs * (i + 1)));
    }
  }
  throw ultimoError;
}
