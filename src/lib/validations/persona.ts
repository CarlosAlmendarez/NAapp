import { z } from "zod";
import { normalizarTelefonoMx } from "@/lib/utils";

// Clave de elector del INE: 18 caracteres alfanuméricos.
const CLAVE_ELECTOR_REGEX = /^[A-Z0-9]{18}$/;

// Todos los datos de personas se guardan en MAYÚSCULAS (los inputs también
// las fuerzan visualmente, ver components/ui/input.tsx `uppercase`).
const nombrePersonaSchema = {
  nombre: z.string().trim().toUpperCase().min(1, "El nombre es obligatorio.").max(100),
  apellidoPaterno: z
    .string()
    .trim()
    .toUpperCase()
    .min(1, "El apellido paterno es obligatorio.")
    .max(100),
  apellidoMaterno: z
    .string()
    .trim()
    .toUpperCase()
    .max(100)
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : undefined)),
  claveElector: z
    .string()
    .trim()
    .toUpperCase()
    .regex(CLAVE_ELECTOR_REGEX, "La clave de elector debe tener 18 caracteres alfanuméricos."),
  // Opcional a nivel base; RC y enlace de Rutas lo vuelven obligatorio
  // (ver `correoObligatorio`).
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
    .transform((v) => normalizarTelefonoMx(v))
    .refine(
      (v) => v === "" || v.length === 10,
      "El teléfono debe tener 10 dígitos (número de México)."
    )
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : undefined)),
};

// Correo obligatorio — se exige en la captura de RC (casilla) y de enlace
// (rutas).
const correoObligatorio = z
  .string()
  .trim()
  .toLowerCase()
  .min(1, "El correo electrónico es obligatorio.")
  .email("Correo inválido.");

export const representanteSchema = z.object({
  ...nombrePersonaSchema,
  correoElectronico: correoObligatorio,
  tipo: z.enum(["PROPIETARIO", "SUPLENTE"]),
  propone: z
    .string()
    .trim()
    .toUpperCase()
    .min(1, "Indica qué partido/coalición propone al RC.")
    .max(150),
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

// Enlace de casilla (módulo Rutas, capturado por el Representante
// General): a diferencia del RC, aquí el teléfono es obligatorio — es el
// dato de contacto principal que el RG registra al recorrer su distrito.
export const enlaceCasillaSchema = z.object({
  nombre: nombrePersonaSchema.nombre,
  apellidoPaterno: nombrePersonaSchema.apellidoPaterno,
  apellidoMaterno: nombrePersonaSchema.apellidoMaterno,
  claveElector: nombrePersonaSchema.claveElector,
  telefono: z
    .string()
    .trim()
    .transform((v) => normalizarTelefonoMx(v))
    .refine((v) => v.length === 10, "El teléfono debe tener 10 dígitos (número de México)."),
  correoElectronico: correoObligatorio,
});

export type EnlaceCasillaInput = z.infer<typeof enlaceCasillaSchema>;
