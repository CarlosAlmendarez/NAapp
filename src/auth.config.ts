import type { NextAuthConfig } from "next-auth";

/**
 * Configuración "edge-safe": no importa Prisma ni bcrypt, por lo que puede
 * usarse en el middleware (Edge runtime). El proveedor de credenciales (que
 * sí necesita Node.js) se agrega únicamente en `src/auth.ts`, que es lo que
 * usan las Server Actions, Route Handlers y Server Components.
 *
 * El middleware solo hace una verificación gruesa (¿hay sesión o no?) —
 * la verificación fina de rol y localidad ocurre siempre en el servidor,
 * en `src/lib/auth-helpers.ts`, para cada Server Action / Route Handler.
 */
export const authConfig = {
  pages: {
    signIn: "/login",
  },
  session: {
    // Requerido por el proveedor de Credenciales: Auth.js no soporta
    // sesiones de base de datos con Credentials (solo aplican a proveedores
    // OAuth vinculados a una cuenta). La revocación inmediata (desactivar
    // usuario / "cerrar sesión en todos los dispositivos") se logra con el
    // contador `sessionVersion`, verificado contra la BD en cada
    // Server Action / página protegida — ver src/lib/auth-helpers.ts.
    strategy: "jwt",
    maxAge: 12 * 60 * 60, // 12 horas
  },
  cookies: {
    sessionToken: {
      options: {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        secure: process.env.NODE_ENV === "production",
      },
    },
  },
  callbacks: {
    authorized({ auth, request }) {
      const isLoggedIn = Boolean(auth?.user);
      const isLoginPage = request.nextUrl.pathname.startsWith("/login");

      if (isLoginPage) {
        // Si ya hay sesión, sacarlo de /login hacia el dashboard.
        if (isLoggedIn) {
          return Response.redirect(new URL("/dashboard", request.nextUrl));
        }
        return true;
      }

      // Todo lo demás (excepto lo público, filtrado por el matcher del
      // middleware) requiere sesión.
      return isLoggedIn;
    },
  },
  providers: [], // se agregan en src/auth.ts
} satisfies NextAuthConfig;
