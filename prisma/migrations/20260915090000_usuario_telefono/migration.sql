-- Teléfono de contacto del usuario (se exige a nivel de app solo para
-- REPRESENTANTE_GENERAL; nullable en la columna porque el resto de roles no
-- lo necesitan, y las cuentas ya existentes tampoco lo tienen).
ALTER TABLE "usuarios" ADD COLUMN "telefono" TEXT;
