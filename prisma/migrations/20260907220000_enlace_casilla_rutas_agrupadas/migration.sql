-- AlterTable
ALTER TABLE "enlaces_casilla" ADD COLUMN "rutaId" TEXT;
ALTER TABLE "enlaces_casilla" ADD COLUMN "ordenEnRuta" INTEGER NOT NULL DEFAULT 0;

-- Backfill: cada enlace capturado antes de este cambio se vuelve su propia
-- ruta de una sola casilla (no había agrupación previa que reconstruir).
UPDATE "enlaces_casilla" SET "rutaId" = "id" WHERE "rutaId" IS NULL;

ALTER TABLE "enlaces_casilla" ALTER COLUMN "rutaId" SET NOT NULL;

-- CreateIndex
CREATE INDEX "enlaces_casilla_rutaId_idx" ON "enlaces_casilla"("rutaId");
