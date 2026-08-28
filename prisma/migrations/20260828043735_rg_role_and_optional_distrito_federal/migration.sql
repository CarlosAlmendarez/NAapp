-- AlterEnum
ALTER TYPE "Rol" ADD VALUE 'REPRESENTANTE_GENERAL';

-- AlterTable
ALTER TABLE "casillas" ALTER COLUMN "distritoFederal" DROP NOT NULL;

