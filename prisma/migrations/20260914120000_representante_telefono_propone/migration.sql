-- Teléfono de quien propone/recomienda al RC. Nullable en la base (las
-- capturas ya existentes no lo tienen); la app lo exige al capturar/editar
-- (ver representanteSchema en src/lib/validations/persona.ts).
ALTER TABLE "representantes_casilla" ADD COLUMN "telefonoPropone" TEXT;
