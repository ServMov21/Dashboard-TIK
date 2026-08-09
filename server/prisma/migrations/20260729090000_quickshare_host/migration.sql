-- AlterTable
ALTER TABLE "QuickShareRoom" ADD COLUMN "hostId" TEXT;
ALTER TABLE "QuickShareRoom" ADD COLUMN "hostRole" TEXT;

-- CreateIndex
CREATE INDEX "QuickShareRoom_hostId_idx" ON "QuickShareRoom"("hostId");
