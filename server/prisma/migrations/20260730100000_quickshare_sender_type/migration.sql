-- AlterTable
ALTER TABLE "QuickShareFile" ADD COLUMN "pengirimTipe" TEXT NOT NULL DEFAULT 'tamu';
ALTER TABLE "QuickShareFile" ADD COLUMN "pengirimAkunId" TEXT;
ALTER TABLE "QuickShareFile" ADD COLUMN "pengirimAkunRole" TEXT;
