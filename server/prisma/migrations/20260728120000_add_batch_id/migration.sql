-- AlterTable
ALTER TABLE "Tugas" ADD COLUMN "batchId" TEXT;

-- CreateIndex
CREATE INDEX "Tugas_batchId_idx" ON "Tugas"("batchId");
