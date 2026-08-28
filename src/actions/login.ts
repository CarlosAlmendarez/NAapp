"use server";

import { AuthError } from "next-auth";
import { signIn } from "@/auth";

/**
 * Server Action para el formulario de login (patrón oficial de Auth.js
 * v5 + Next.js App Router con useActionState). `signIn` valida con Zod y
 * aplica rate limiting dentro de `authorize()` (ver src/auth.ts); aquí solo
 * traducimos los errores a un mensaje genérico para el usuario.
 */
export async function autenticar(
  _prevState: string | undefined,
  formData: FormData
): Promise<string | undefined> {
  try {
    await signIn("credentials", {
      correo: formData.get("correo"),
      password: formData.get("password"),
      redirectTo: "/dashboard",
    });
  } catch (error) {
    if (error instanceof AuthError) {
      switch ((error as { code?: string }).code) {
        case "demasiados_intentos":
          return "Demasiados intentos fallidos. Espera unos minutos antes de volver a intentar.";
        default:
          return "Correo o contraseña incorrectos.";
      }
    }
    // Next.js usa una excepción especial para las redirecciones internas
    // de signIn(); debe volver a lanzarse para que el redirect funcione.
    throw error;
  }
}
