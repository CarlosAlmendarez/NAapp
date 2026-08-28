import { z } from "zod";
import { passwordSchema } from "@/lib/validations/auth";

export const rolSchema = z.enum([
  "ADMIN_GENERAL",
  "ADMIN_CASILLAS",
  "CAPTURADOR",
  "REPRESENTANTE_GENERAL",
]);

export const localidadAsignadaSchema = z.object({
  tipo: z.enum(["MUNICIPIO", "DISTRITO_LOCAL"]),
  valor: z.string().trim().min(1),
});

export const crearUsuarioSchema = z
  .object({
    nombre: z.string().trim().min(1, "El nombre es obligatorio.").max(150),
    correo: z.string().trim().toLowerCase().email("Correo inválido."),
    password: passwordSchema,
    rol: rolSchema,
    localidades: z.array(localidadAsignadaSchema).default([]),
  })
  .refine(
    (data) =>
      (data.rol !== "CAPTURADOR" && data.rol !== "REPRESENTANTE_GENERAL") ||
      data.localidades.length > 0,
    {
      message:
        "Un capturador o Representante General debe tener al menos un municipio o distrito local asignado.",
      path: ["localidades"],
    }
  );

export type CrearUsuarioInput = z.infer<typeof crearUsuarioSchema>;

export const editarUsuarioSchema = z
  .object({
    id: z.string().cuid(),
    nombre: z.string().trim().min(1, "El nombre es obligatorio.").max(150),
    correo: z.string().trim().toLowerCase().email("Correo inválido."),
    rol: rolSchema,
    activo: z.boolean(),
    localidades: z.array(localidadAsignadaSchema).default([]),
  })
  .refine(
    (data) =>
      (data.rol !== "CAPTURADOR" && data.rol !== "REPRESENTANTE_GENERAL") ||
      data.localidades.length > 0,
    {
      message:
        "Un capturador o Representante General debe tener al menos un municipio o distrito local asignado.",
      path: ["localidades"],
    }
  );

export type EditarUsuarioInput = z.infer<typeof editarUsuarioSchema>;

export const resetearPasswordSchema = z.object({
  id: z.string().cuid(),
  passwordNueva: passwordSchema,
});
