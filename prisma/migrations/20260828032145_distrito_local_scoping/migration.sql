-- CreateEnum
CREATE TYPE "TipoLocalidad" AS ENUM ('MUNICIPIO', 'DISTRITO_LOCAL');

-- DropIndex
DROP INDEX "usuario_localidades_municipio_idx";

-- DropIndex
DROP INDEX "usuario_localidades_usuarioId_municipio_key";

-- AlterTable
ALTER TABLE "usuario_localidades" DROP COLUMN "municipio",
ADD COLUMN     "tipo" "TipoLocalidad" NOT NULL,
ADD COLUMN     "valor" TEXT NOT NULL;

-- CreateTable
CREATE TABLE "distritos_locales" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,

    CONSTRAINT "distritos_locales_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "distritos_locales_nombre_key" ON "distritos_locales"("nombre");

-- CreateIndex
CREATE INDEX "usuario_localidades_tipo_valor_idx" ON "usuario_localidades"("tipo", "valor");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_localidades_usuarioId_tipo_valor_key" ON "usuario_localidades"("usuarioId", "tipo", "valor");

