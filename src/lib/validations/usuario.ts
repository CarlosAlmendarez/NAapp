import { z } from "zod";
import { passwordSchema } from "@/lib/validations/auth";
import { normalizarTelefonoMx } from "@/lib/utils";

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

export const casaSchema = z.enum(["C26", "C52"]);

const telefonoSchema = z
  .string()
  .trim()
  .transform((v) => normalizarTelefonoMx(v))
  .refine((v) => v === "" || v.length === 10, "El teléfono debe tener 10 dígitos (número de México).")
  .optional()
  .or(z.literal(""))
  .transform((v) => (v ? v : undefined));

// El Representante General debe tener casa (26 / 52): la unicidad "un RG
// por distrito local" es POR casa. Para el resto de roles el campo se
// ignora y se guarda como null.
const exigeCasaSiRG = (data: { rol: string; casa?: "C26" | "C52" | null }) =>
  data.rol !== "REPRESENTANTE_GENERAL" || data.casa != null;
const mensajeCasaRG = {
  message: "El Representante General debe tener una casa (26 o 52) asignada.",
  path: ["casa"] as PropertyKey[],
};

// El teléfono del RG es lo único de contacto que se muestra a terceros
// (detalle/lista de casillas, impresiones, exportación) — nunca su correo.
const exigeTelefonoSiRG = (data: { rol: string; telefono?: string }) =>
  data.rol !== "REPRESENTANTE_GENERAL" || Boolean(data.telefono);
const mensajeTelefonoRG = {
  message: "El Representante General debe tener un teléfono de contacto.",
  path: ["telefono"] as PropertyKey[],
};

export const crearUsuarioSchema = z
  .object({
    nombre: z.string().trim().toUpperCase().min(1, "El nombre es obligatorio.").max(150),
    correo: z.string().trim().toLowerCase().email("Correo inválido."),
    telefono: telefonoSchema,
    password: passwordSchema,
    rol: rolSchema,
    casa: casaSchema.nullish(),
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
  )
  .refine(exigeCasaSiRG, mensajeCasaRG)
  .refine(exigeTelefonoSiRG, mensajeTelefonoRG);

export type CrearUsuarioInput = z.infer<typeof crearUsuarioSchema>;

export const editarUsuarioSchema = z
  .object({
    id: z.string().cuid(),
    nombre: z.string().trim().toUpperCase().min(1, "El nombre es obligatorio.").max(150),
    correo: z.string().trim().toLowerCase().email("Correo inválido."),
    telefono: telefonoSchema,
    rol: rolSchema,
    activo: z.boolean(),
    casa: casaSchema.nullish(),
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
  )
  .refine(exigeCasaSiRG, mensajeCasaRG)
  .refine(exigeTelefonoSiRG, mensajeTelefonoRG);

export type EditarUsuarioInput = z.infer<typeof editarUsuarioSchema>;

export const resetearPasswordSchema = z.object({
  id: z.string().cuid(),
  passwordNueva: passwordSchema,
});
