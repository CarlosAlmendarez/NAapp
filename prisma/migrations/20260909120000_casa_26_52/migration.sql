-- "Casa" (26 / 52): las capturas de RC, enlace de Rutas y asistentes pasan a
-- llevarse por casa. El catálogo de casillas (tabla "casillas") NO se toca.
-- Todas las filas ya existentes se migran a la Casa 26 (C26).

-- CreateEnum
CREATE TYPE "Casa" AS ENUM ('C26', 'C52');

-- AlterTable: usuarios.casa — solo se llena para REPRESENTANTE_GENERAL, sin
-- backfill (queda NULL para todos los usuarios actuales).
ALTER TABLE "usuarios" ADD COLUMN "casa" "Casa";

-- AlterTable: representantes_casilla.casa — backfill de lo existente a C26.
ALTER TABLE "representantes_casilla" ADD COLUMN "casa" "Casa" NOT NULL DEFAULT 'C26';
ALTER TABLE "representantes_casilla" ALTER COLUMN "casa" DROP DEFAULT;

-- AlterTable: asistentes_electorales.casa — backfill de lo existente a C26.
ALTER TABLE "asistentes_electorales" ADD COLUMN "casa" "Casa" NOT NULL DEFAULT 'C26';
ALTER TABLE "asistentes_electorales" ALTER COLUMN "casa" DROP DEFAULT;

-- AlterTable: enlaces_casilla.casa — backfill de lo existente a C26.
ALTER TABLE "enlaces_casilla" ADD COLUMN "casa" "Casa" NOT NULL DEFAULT 'C26';
ALTER TABLE "enlaces_casilla" ALTER COLUMN "casa" DROP DEFAULT;

-- DropIndex: los únicos viejos (sin casa) se reemplazan por los compuestos.
DROP INDEX "representantes_casilla_casillaId_tipo_key";
DROP INDEX "enlaces_casilla_casillaId_key";

-- CreateIndex
CREATE INDEX "representantes_casilla_casa_idx" ON "representantes_casilla"("casa");

-- CreateIndex
CREATE UNIQUE INDEX "representantes_casilla_casillaId_tipo_casa_key" ON "representantes_casilla"("casillaId", "tipo", "casa");

-- CreateIndex
CREATE INDEX "asistentes_electorales_casa_idx" ON "asistentes_electorales"("casa");

-- CreateIndex
CREATE INDEX "enlaces_casilla_casa_idx" ON "enlaces_casilla"("casa");

-- CreateIndex
CREATE UNIQUE INDEX "enlaces_casilla_casillaId_casa_key" ON "enlaces_casilla"("casillaId", "casa");
