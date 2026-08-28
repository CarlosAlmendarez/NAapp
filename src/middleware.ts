import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";

/**
 * Middleware "grueso": solo decide si hay o no una sesión válida y
 * redirige a /login en caso contrario. La verificación fina de rol y
 * localidad (RBAC) se hace siempre en el servidor, por cada
 * Server Action / Route Handler / página — ver src/lib/auth-helpers.ts.
 * No se usa Prisma aquí porque el middleware corre en Edge runtime.
 */
export const { auth: middleware } = NextAuth(authConfig);

export const config = {
  // Excluye assets estáticos, imágenes, favicon y las rutas de la API de
  // Auth.js (que maneja su propia lógica de sesión).
  matcher: ["/((?!api/auth|_next/static|_next/image|favicon.ico|robots.txt).*)"],
  // Runtime Node.js (estable desde Next.js 15.5): evita advertencias de
  // compatibilidad de `jose`/Auth.js con el Edge runtime.
  runtime: "nodejs",
};
