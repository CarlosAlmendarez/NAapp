import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Limitador de intentos de login: 5 intentos **fallidos** / 15 minutos por
 * clave (IP + correo). Se cuentan solo los fallidos a propósito — un
 * usuario que entra y sale de sesión varias veces seguidas con su
 * contraseña correcta no debe quedar bloqueado por eso.
 *
 * Usa Upstash Redis en producción (compartido entre todas las instancias
 * serverless de Vercel). Si las variables de Upstash no están configuradas
 * (ej. en desarrollo local), cae a un limitador en memoria de un solo
 * proceso — NO sirve como protección real en producción con múltiples
 * instancias serverless, solo evita que el flujo se rompa en local.
 */

const hasUpstash = Boolean(
  process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN
);

let upstashLimiter: Ratelimit | null = null;
if (hasUpstash) {
  const redis = new Redis({
    url: process.env.UPSTASH_REDIS_REST_URL!,
    token: process.env.UPSTASH_REDIS_REST_TOKEN!,
  });
  upstashLimiter = new Ratelimit({
    redis,
    limiter: Ratelimit.slidingWindow(5, "15 m"),
    prefix: "ratelimit:login",
  });
}

// --- Fallback en memoria (solo desarrollo / un único proceso) --------------
type Bucket = { count: number; resetAt: number };
const memoryBuckets = new Map<string, Bucket>();
const MEMORY_LIMIT = 5;
const MEMORY_WINDOW_MS = 15 * 60 * 1000;

function memoryPeek(key: string): boolean {
  const bucket = memoryBuckets.get(key);
  if (!bucket || bucket.resetAt < Date.now()) return true;
  return bucket.count < MEMORY_LIMIT;
}

function memoryRegistrarFallo(key: string): void {
  const now = Date.now();
  const bucket = memoryBuckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    memoryBuckets.set(key, { count: 1, resetAt: now + MEMORY_WINDOW_MS });
    return;
  }
  bucket.count += 1;
}

/**
 * Solo consulta si la clave ya está bloqueada — no cuenta como un intento.
 * Se usa antes de verificar la contraseña.
 */
export async function bloqueadoPorIntentos(key: string): Promise<boolean> {
  if (upstashLimiter) {
    const { remaining } = await upstashLimiter.getRemaining(key);
    return remaining <= 0;
  }
  return !memoryPeek(key);
}

/**
 * Registra un intento fallido (contraseña incorrecta, cuenta inactiva,
 * correo inexistente). Un login exitoso NUNCA debe llamar a esto.
 */
export async function registrarIntentoFallido(key: string): Promise<void> {
  if (upstashLimiter) {
    await upstashLimiter.limit(key);
    return;
  }
  memoryRegistrarFallo(key);
}

export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]!.trim();
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "desconocida";
}
