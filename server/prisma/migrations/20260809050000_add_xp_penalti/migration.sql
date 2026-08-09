-- AlterTable XpSetting: tambah kolom penalti tidak mengumpulkan/tidak mengerjakan tugas
ALTER TABLE "XpSetting" ADD COLUMN "xpPenaltiTidakKumpul" REAL NOT NULL DEFAULT -50;

-- CreateTable XpPenalti: riwayat pengurangan XP siswa yang tidak mengumpulkan/tidak
-- mengerjakan tugas setelah tugas ditutup oleh guru.
CREATE TABLE "XpPenalti" (
    "id"         TEXT NOT NULL PRIMARY KEY,
    "siswaId"    TEXT NOT NULL,
    "tugasId"    TEXT,
    "xp"         REAL NOT NULL DEFAULT -50,
    "keterangan" TEXT,
    "createdAt"  DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "XpPenalti_siswaId_fkey" FOREIGN KEY ("siswaId") REFERENCES "Siswa" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "XpPenalti_tugasId_fkey" FOREIGN KEY ("tugasId") REFERENCES "Tugas" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "XpPenalti_siswaId_tugasId_key" ON "XpPenalti"("siswaId", "tugasId");
CREATE INDEX "XpPenalti_siswaId_idx" ON "XpPenalti"("siswaId");
CREATE INDEX "XpPenalti_tugasId_idx" ON "XpPenalti"("tugasId");
