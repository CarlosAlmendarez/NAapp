import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";

/**
 * Limitador de intentos: 5 intentos / 15 minutos por clave (IP + correo).
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

function memoryCheck(key: string): { success: boolean; remaining: number } {
  const now = Date.now();
  const bucket = memoryBuckets.get(key);
  if (!bucket || bucket.resetAt < now) {
    memoryBuckets.set(key, { count: 1, resetAt: now + MEMORY_WINDOW_MS });
    return { success: true, remaining: MEMORY_LIMIT - 1 };
  }
  if (bucket.count >= MEMORY_LIMIT) {
    return { success: false, remaining: 0 };
  }
  bucket.count += 1;
  return { success: true, remaining: MEMORY_LIMIT - bucket.count };
}

export type RateLimitResult = {
  success: boolean;
  remaining: number;
  usingFallback: boolean;
};

export async function checkLoginRateLimit(key: string): Promise<RateLimitResult> {
  if (upstashLimiter) {
    const { success, remaining } = await upstashLimiter.limit(key);
    return { success, remaining, usingFallback: false };
  }
  const result = memoryCheck(key);
  return { ...result, usingFallback: true };
}

export function getClientIp(request: Request): string {
  const forwardedFor = request.headers.get("x-forwarded-for");
  if (forwardedFor) return forwardedFor.split(",")[0]!.trim();
  const realIp = request.headers.get("x-real-ip");
  if (realIp) return realIp;
  return "desconocida";
}
