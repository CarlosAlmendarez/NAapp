-- CreateEnum
CREATE TYPE "Rol" AS ENUM ('ADMIN_GENERAL', 'ADMIN_CASILLAS', 'CAPTURADOR');

-- CreateEnum
CREATE TYPE "TipoRepresentante" AS ENUM ('PROPIETARIO', 'SUPLENTE');

-- CreateTable
CREATE TABLE "municipios" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "clave" TEXT,

    CONSTRAINT "municipios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuarios" (
    "id" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "correo" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "rol" "Rol" NOT NULL,
    "activo" BOOLEAN NOT NULL DEFAULT true,
    "sessionVersion" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "creadoPorId" TEXT,

    CONSTRAINT "usuarios_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "usuario_localidades" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT NOT NULL,
    "municipio" TEXT NOT NULL,
    "asignadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "usuario_localidades_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "casillas" (
    "id" TEXT NOT NULL,
    "distritoFederal" TEXT NOT NULL,
    "distritoLocal" TEXT NOT NULL,
    "municipio" TEXT NOT NULL,
    "seccion" INTEGER NOT NULL,
    "tipoCasilla" TEXT NOT NULL,
    "domicilio" TEXT NOT NULL,
    "coloniaLocalidad" TEXT NOT NULL,
    "codigoPostal" TEXT,
    "ubicacion" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "createdById" TEXT,
    "updatedById" TEXT,

    CONSTRAINT "casillas_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "representantes_casilla" (
    "id" TEXT NOT NULL,
    "casillaId" TEXT NOT NULL,
    "tipo" "TipoRepresentante" NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellidoPaterno" TEXT NOT NULL,
    "apellidoMaterno" TEXT,
    "claveElectorCifrada" TEXT NOT NULL,
    "correoElectronico" TEXT,
    "telefono" TEXT,
    "propone" TEXT NOT NULL,
    "capturadoPorId" TEXT,
    "capturadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "representantes_casilla_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "asistentes_electorales" (
    "id" TEXT NOT NULL,
    "casillaId" TEXT NOT NULL,
    "nombre" TEXT NOT NULL,
    "apellidoPaterno" TEXT NOT NULL,
    "apellidoMaterno" TEXT,
    "claveElectorCifrada" TEXT,
    "correoElectronico" TEXT,
    "telefono" TEXT,
    "capturadoPorId" TEXT,
    "capturadoEn" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "asistentes_electorales_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "usuarioId" TEXT,
    "accion" TEXT NOT NULL,
    "entidad" TEXT NOT NULL,
    "entidadId" TEXT,
    "datosAntes" JSONB,
    "datosDespues" JSONB,
    "ip" TEXT,
    "timestamp" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "municipios_nombre_key" ON "municipios"("nombre");

-- CreateIndex
CREATE UNIQUE INDEX "usuarios_correo_key" ON "usuarios"("correo");

-- CreateIndex
CREATE INDEX "usuarios_rol_idx" ON "usuarios"("rol");

-- CreateIndex
CREATE INDEX "usuario_localidades_municipio_idx" ON "usuario_localidades"("municipio");

-- CreateIndex
CREATE UNIQUE INDEX "usuario_localidades_usuarioId_municipio_key" ON "usuario_localidades"("usuarioId", "municipio");

-- CreateIndex
CREATE INDEX "casillas_municipio_idx" ON "casillas"("municipio");

-- CreateIndex
CREATE INDEX "casillas_coloniaLocalidad_idx" ON "casillas"("coloniaLocalidad");

-- CreateIndex
CREATE INDEX "casillas_seccion_idx" ON "casillas"("seccion");

-- CreateIndex
CREATE UNIQUE INDEX "casillas_seccion_tipoCasilla_key" ON "casillas"("seccion", "tipoCasilla");

-- CreateIndex
CREATE INDEX "representantes_casilla_casillaId_idx" ON "representantes_casilla"("casillaId");

-- CreateIndex
CREATE UNIQUE INDEX "representantes_casilla_casillaId_tipo_key" ON "representantes_casilla"("casillaId", "tipo");

-- CreateIndex
CREATE INDEX "asistentes_electorales_casillaId_idx" ON "asistentes_electorales"("casillaId");

-- CreateIndex
CREATE INDEX "audit_logs_entidad_entidadId_idx" ON "audit_logs"("entidad", "entidadId");

-- CreateIndex
CREATE INDEX "audit_logs_usuarioId_idx" ON "audit_logs"("usuarioId");

-- CreateIndex
CREATE INDEX "audit_logs_timestamp_idx" ON "audit_logs"("timestamp");

-- AddForeignKey
ALTER TABLE "usuarios" ADD CONSTRAINT "usuarios_creadoPorId_fkey" FOREIGN KEY ("creadoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "usuario_localidades" ADD CONSTRAINT "usuario_localidades_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "casillas" ADD CONSTRAINT "casillas_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "casillas" ADD CONSTRAINT "casillas_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "representantes_casilla" ADD CONSTRAINT "representantes_casilla_casillaId_fkey" FOREIGN KEY ("casillaId") REFERENCES "casillas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "representantes_casilla" ADD CONSTRAINT "representantes_casilla_capturadoPorId_fkey" FOREIGN KEY ("capturadoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "representantes_casilla" ADD CONSTRAINT "representantes_casilla_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asistentes_electorales" ADD CONSTRAINT "asistentes_electorales_casillaId_fkey" FOREIGN KEY ("casillaId") REFERENCES "casillas"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asistentes_electorales" ADD CONSTRAINT "asistentes_electorales_capturadoPorId_fkey" FOREIGN KEY ("capturadoPorId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "asistentes_electorales" ADD CONSTRAINT "asistentes_electorales_updatedById_fkey" FOREIGN KEY ("updatedById") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_usuarioId_fkey" FOREIGN KEY ("usuarioId") REFERENCES "usuarios"("id") ON DELETE SET NULL ON UPDATE CASCADE;
