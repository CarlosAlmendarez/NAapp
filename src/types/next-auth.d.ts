import type { Rol } from "@prisma/client";
import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    id: string;
    rol: Rol;
    sessionVersion: number;
  }

  interface Session {
    user: {
      id: string;
      rol: Rol;
      sessionVersion: number;
    } & DefaultSession["user"];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    rol: Rol;
    sessionVersion: number;
  }
}

// `next-auth/jwt` re-exporta el tipo `JWT` de `@auth/core/jwt` con
// `export *`; algunas rutas de tipos (ej. el callback `session`, tipado a
// través de `NextAuthConfig` -> `AuthConfig`) resuelven `JWT` directo desde
// `@auth/core/jwt`, así que se aumenta también aquí para que la fusión de
// declaraciones aplique en todos los casos.
declare module "@auth/core/jwt" {
  interface JWT {
    id: string;
    rol: Rol;
    sessionVersion: number;
  }
}
