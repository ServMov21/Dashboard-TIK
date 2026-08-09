-- CreateTable
CREATE TABLE "SampahPengumpulan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "jenis" TEXT NOT NULL,
    "originalId" TEXT NOT NULL,
    "tugasId" TEXT NOT NULL,
    "siswaId" TEXT NOT NULL,
    "tugasJudul" TEXT NOT NULL,
    "siswaNama" TEXT NOT NULL,
    "dataJson" TEXT NOT NULL,
    "deletedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateIndex
CREATE INDEX "SampahPengumpulan_tugasId_idx" ON "SampahPengumpulan"("tugasId");

-- CreateIndex
CREATE INDEX "SampahPengumpulan_siswaId_idx" ON "SampahPengumpulan"("siswaId");

-- CreateIndex
CREATE INDEX "SampahPengumpulan_deletedAt_idx" ON "SampahPengumpulan"("deletedAt");
