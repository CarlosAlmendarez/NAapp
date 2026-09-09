-- El enlace de Rutas vuelve a ser ÚNICO por casilla, sin importar la casa:
-- un solo RG/enlace por casilla, compartido entre Casa 26 y Casa 52. Se
-- quita la columna `casa` de enlaces_casilla (el RC sí sigue por casa).

-- Salvaguarda: si hubiera enlaces duplicados por casilla (uno en C26 y
-- otro en C52), conservar el más antiguo. En la práctica no hay ninguno
-- (el módulo estaba recién migrado y sin capturas).
DELETE FROM "enlaces_casilla" a
USING "enlaces_casilla" b
WHERE a."casillaId" = b."casillaId"
  AND a."capturadoEn" > b."capturadoEn";

DELETE FROM "enlaces_casilla" a
USING "enlaces_casilla" b
WHERE a."casillaId" = b."casillaId"
  AND a."capturadoEn" = b."capturadoEn"
  AND a."id" > b."id";

-- DropIndex
DROP INDEX "enlaces_casilla_casillaId_casa_key";
DROP INDEX "enlaces_casilla_casa_idx";
DROP INDEX "enlaces_casilla_casillaId_idx";

-- AlterTable
ALTER TABLE "enlaces_casilla" DROP COLUMN "casa";

-- CreateIndex
CREATE UNIQUE INDEX "enlaces_casilla_casillaId_key" ON "enlaces_casilla"("casillaId");
