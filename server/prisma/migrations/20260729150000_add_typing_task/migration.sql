-- AlterTable
ALTER TABLE "Tugas" ADD COLUMN "naskahMengetik" TEXT;

-- CreateTable
CREATE TABLE "PengumpulanMengetik" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tugasId" TEXT NOT NULL,
    "siswaId" TEXT NOT NULL,
    "hasilKetik" TEXT,
    "status" TEXT NOT NULL DEFAULT 'belum_mulai',
    "waktuMulai" DATETIME,
    "waktuSelesai" DATETIME,
    "durasiDetik" REAL,
    "skorKebenaran" REAL NOT NULL DEFAULT 0,
    "skorKecepatan" REAL NOT NULL DEFAULT 0,
    "skorTotal" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PengumpulanMengetik_tugasId_fkey" FOREIGN KEY ("tugasId") REFERENCES "Tugas" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PengumpulanMengetik_siswaId_fkey" FOREIGN KEY ("siswaId") REFERENCES "Siswa" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "PengumpulanMengetik_tugasId_siswaId_key" ON "PengumpulanMengetik"("tugasId", "siswaId");

-- CreateIndex
CREATE INDEX "PengumpulanMengetik_tugasId_idx" ON "PengumpulanMengetik"("tugasId");

-- CreateIndex
CREATE INDEX "PengumpulanMengetik_siswaId_idx" ON "PengumpulanMengetik"("siswaId");
