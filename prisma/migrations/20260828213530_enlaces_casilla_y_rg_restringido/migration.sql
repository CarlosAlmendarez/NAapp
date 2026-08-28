-- CreateTable
CREATE TABLE "enlaces_casilla" (
    "id" TEXT NOT NULL,
    "casillaId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellidoPaterno" TEXT NOT NULL,
    "apellidoMaterno" TEXT,
    "claveElectorCifrada" TEXT NOT NULL,
    "telefono" TEXT NOT NULL,
    "correoElectronico" TEXT,
    "capturadoPorId" TEXT,
    "capturadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "enlaces_casilla_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "enlaces_casilla_casillaId_key" ON "enlaces_casilla"("casillaId");

-- CreateIndex
CREATE INDEX "enlaces_casilla_casillaId_idx" ON "enlaces_casilla"("casillaId");

-- AddForeignKey
ALTER TABLE "enlaces_casilla" ADD CONSTRAINT "enlaces_casilla_casillaId_fkey" FOREIGN KEY ("casillaId") REFERENCES "casillas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enlaces_casilla" ADD CONSTRAINT "enlaces_casilla_capturadoPorId_fkey" FOREIGN KEY ("capturadoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enlaces_casilla" ADD CONSTRAINT "enlaces_casilla_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
