import { z } from "zod";
import { passwordSchema } from "@/lib/validations/auth";

export const rolSchema = z.enum(["ADMIN_GENERAL", "ADMIN_CASILLAS", "CAPTURADOR"]);

export const crearUsuarioSchema = z
  .object({
    nombre: z.string().trim().min(1, "El nombre es obligatorio.").max(150),
    correo: z.string().trim().toLowerCase().email("Correo inválido."),
    password: passwordSchema,
    rol: rolSchema,
    localidades: z.array(z.string().trim().min(1)).default([]),
  })
  .refine((data) => data.rol !== "CAPTURADOR" || data.localidades.length > 0, {
    message: "Un capturador debe tener al menos una localidad/municipio asignado.",
    path: ["localidades"],
  });

export type CrearUsuarioInput = z.infer<typeof crearUsuarioSchema>;

export const editarUsuarioSchema = z
  .object({
    id: z.string().cuid(),
    nombre: z.string().trim().min(1, "El nombre es obligatorio.").max(150),
    correo: z.string().trim().toLowerCase().email("Correo inválido."),
    rol: rolSchema,
    activo: z.boolean(),
    localidades: z.array(z.string().trim().min(1)).default([]),
  })
  .refine((data) => data.rol !== "CAPTURADOR" || data.localidades.length > 0, {
    message: "Un capturador debe tener al menos una localidad/municipio asignado.",
    path: ["localidades"],
  });

export type EditarUsuarioInput = z.infer<typeof editarUsuarioSchema>;

export const resetearPasswordSchema = z.object({
  id: z.string().cuid(),
  passwordNueva: passwordSchema,
});
