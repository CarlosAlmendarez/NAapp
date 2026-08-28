import { z } from "zod";

// Clave de elector del INE: 18 caracteres alfanuméricos.
const CLAVE_ELECTOR_REGEX = /^[A-Z0-9]{18}$/;

const nombrePersonaSchema = {
  nombre: z.string().trim().min(1, "El nombre es obligatorio.").max(100),
  apellidoPaterno: z.string().trim().min(1, "El apellido paterno es obligatorio.").max(100),
  apellidoMaterno: z
    .string()
    .trim()
    .max(100)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : undefined)),
  claveElector: z
    .string()
    .trim()
    .toUpperCase()
    .regex(CLAVE_ELECTOR_REGEX, "La clave de elector debe tener 18 caracteres alfanuméricos."),
  correoElectronico: z
    .string()
    .trim()
    .toLowerCase()
    .email("Correo inválido.")
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : undefined)),
  telefono: z
    .string()
    .trim()
    .transform((v) => v.replace(/\D+/g, ""))
    .refine((v) => v === "" || v.length === 10, "El teléfono debe tener 10 dígitos.")
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : undefined)),
};

export const representanteSchema = z.object({
  ...nombrePersonaSchema,
  tipo: z.enum(["PROPIETARIO", "SUPLENTE"]),
  propone: z.string().trim().min(1, "Indica qué partido/coalición propone al RC.").max(150),
});

export type RepresentanteInput = z.infer<typeof representanteSchema>;

export const asistenteSchema = z.object({
  nombre: nombrePersonaSchema.nombre,
  apellidoPaterno: nombrePersonaSchema.apellidoPaterno,
  apellidoMaterno: nombrePersonaSchema.apellidoMaterno,
  claveElector: nombrePersonaSchema.claveElector.optional().or(z.literal("")).transform((v) =>
    v ? v : undefined
  ),
  correoElectronico: nombrePersonaSchema.correoElectronico,
  telefono: nombrePersonaSchema.telefono,
});

export type AsistenteInput = z.infer<typeof asistenteSchema>;
