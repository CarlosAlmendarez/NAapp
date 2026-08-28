import { z } from "zod";

export const loginSchema = z.object({
  correo: z
    .string()
    .trim()
    .toLowerCase()
    .min(1, "El correo es obligatorio.")
    .email("Correo inválido."),
  password: z.string().min(1, "La contraseña es obligatoria."),
});

export type LoginInput = z.infer<typeof loginSchema>;

// Política de contraseñas: mínimo 10 caracteres, al menos una mayúscula,
// una minúscula y un número. Se aplica al crear/cambiar contraseñas
// (no al iniciar sesión, para no filtrar información de la política).
export const passwordSchema = z
  .string()
  .min(10, "La contraseña debe tener al menos 10 caracteres.")
  .max(100, "La contraseña es demasiado larga.")
  .regex(/[a-z]/, "Debe incluir al menos una letra minúscula.")
  .regex(/[A-Z]/, "Debe incluir al menos una letra mayúscula.")
  .regex(/[0-9]/, "Debe incluir al menos un número.");

export const cambiarPasswordSchema = z
  .object({
    passwordActual: z.string().min(1, "Ingresa tu contraseña actual."),
    passwordNueva: passwordSchema,
    confirmarPassword: z.string(),
  })
  .refine((data) => data.passwordNueva === data.confirmarPassword, {
    message: "Las contraseñas no coinciden.",
    path: ["confirmarPassword"],
  });

export type CambiarPasswordInput = z.infer<typeof cambiarPasswordSchema>;
