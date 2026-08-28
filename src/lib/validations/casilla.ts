import { z } from "zod";

// Tipos de casilla del padrón: Básica (B), Contigua (C01, C02...),
// Especial (S01, S02...) y Extraordinaria (E01, E01C01...).
const TIPO_CASILLA_REGEX = /^(B|C\d{2}|S\d{2}|E\d{2}(C\d{2})?)$/;

export const casillaSchema = z.object({
  // Ya no se captura desde la UI (solo se usa/muestra el distrito local
  // para organizar el acceso) — se deja opcional para no perder el valor
  // ya cargado del padrón oficial en las casillas existentes.
  distritoFederal: z.string().trim().max(120).optional(),
  distritoLocal: z.string().trim().min(1, "El distrito local es obligatorio.").max(120),
  municipio: z.string().trim().min(1, "El municipio es obligatorio.").max(120),
  seccion: z.coerce
    .number()
    .int("La sección debe ser un número entero.")
    .positive("La sección debe ser un número positivo.")
    .max(99999),
  tipoCasilla: z
    .string()
    .trim()
    .toUpperCase()
    .regex(TIPO_CASILLA_REGEX, "Tipo de casilla inválido (ej. B, C01, S01, E01, E01C01)."),
  domicilio: z.string().trim().min(1, "El domicilio es obligatorio.").max(300),
  coloniaLocalidad: z.string().trim().min(1, "La colonia/localidad es obligatoria.").max(200),
  codigoPostal: z
    .string()
    .trim()
    .regex(/^\d{5}$/, "El código postal debe tener 5 dígitos.")
    .optional()
    .or(z.literal(""))
    .transform((v) => (v ? v : undefined)),
  ubicacion: z.string().trim().min(1, "La ubicación es obligatoria.").max(300),
});

export type CasillaInput = z.infer<typeof casillaSchema>;

export const casillaFiltroSchema = z.object({
  municipio: z.string().trim().optional(),
  seccion: z.coerce.number().int().positive().optional(),
  busqueda: z.string().trim().max(200).optional(),
  page: z.coerce.number().int().positive().default(1),
});
