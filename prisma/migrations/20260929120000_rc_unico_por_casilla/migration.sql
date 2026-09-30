-- El RC (propietario/suplente) deja de ser "por casa": pasa a ser UN solo
-- registro por casilla, compartido entre Casa 26 y Casa 52 — la columna
-- `casa` se conserva solo para identificar en cuál se capturó
-- originalmente (nunca se toca al editar), igual que EnlaceCasilla.casa.
--
-- Salvaguarda: si hubiera un propietario/suplente capturado en AMBAS
-- casas para la misma casilla (no debería, pero por si acaso), se
-- conserva el más antiguo (primero capturado) y se borra el duplicado.
-- Verificado en producción antes de esta migración: 0 conflictos.
DELETE FROM "representantes_casilla" a
USING "representantes_casilla" b
WHERE a."casillaId" = b."casillaId"
  AND a.tipo = b.tipo
  AND a."capturadoEn" > b."capturadoEn";

DELETE FROM "representantes_casilla" a
USING "representantes_casilla" b
WHERE a."casillaId" = b."casillaId"
  AND a.tipo = b.tipo
  AND a."capturadoEn" = b."capturadoEn"
  AND a.id > b.id;

DROP INDEX "representantes_casilla_casillaId_tipo_casa_key";

CREATE UNIQUE INDEX "representantes_casilla_casillaId_tipo_key" ON "representantes_casilla"("casillaId", "tipo");
