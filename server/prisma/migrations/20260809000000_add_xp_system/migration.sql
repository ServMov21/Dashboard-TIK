-- AlterTable Pengumpulan: tambah kolom XP
ALTER TABLE "Pengumpulan" ADD COLUMN "xpBase"    REAL NOT NULL DEFAULT 0;
ALTER TABLE "Pengumpulan" ADD COLUMN "xpNilai"   REAL NOT NULL DEFAULT 0;
ALTER TABLE "Pengumpulan" ADD COLUMN "xpEarly"   REAL NOT NULL DEFAULT 0;
ALTER TABLE "Pengumpulan" ADD COLUMN "xpPerfect" REAL NOT NULL DEFAULT 0;
ALTER TABLE "Pengumpulan" ADD COLUMN "xpBonus"   REAL NOT NULL DEFAULT 0;
ALTER TABLE "Pengumpulan" ADD COLUMN "xpTotal"   REAL NOT NULL DEFAULT 0;

-- AlterTable PengumpulanMengetik: tambah kolom XP
ALTER TABLE "PengumpulanMengetik" ADD COLUMN "xpBase"    REAL NOT NULL DEFAULT 0;
ALTER TABLE "PengumpulanMengetik" ADD COLUMN "xpNilai"   REAL NOT NULL DEFAULT 0;
ALTER TABLE "PengumpulanMengetik" ADD COLUMN "xpEarly"   REAL NOT NULL DEFAULT 0;
ALTER TABLE "PengumpulanMengetik" ADD COLUMN "xpPerfect" REAL NOT NULL DEFAULT 0;
ALTER TABLE "PengumpulanMengetik" ADD COLUMN "xpBonus"   REAL NOT NULL DEFAULT 0;
ALTER TABLE "PengumpulanMengetik" ADD COLUMN "xpTotal"   REAL NOT NULL DEFAULT 0;

-- CreateTable XpSetting
CREATE TABLE "XpSetting" (
    "id"          TEXT NOT NULL DEFAULT '1' PRIMARY KEY,
    "xpBase"      REAL NOT NULL DEFAULT 80,
    "xpNilai70"   REAL NOT NULL DEFAULT 20,
    "xpNilai80"   REAL NOT NULL DEFAULT 40,
    "xpNilai90"   REAL NOT NULL DEFAULT 70,
    "xpNilai100"  REAL NOT NULL DEFAULT 100,
    "xpEarly"     REAL NOT NULL DEFAULT 25,
    "xpPerfect"   REAL NOT NULL DEFAULT 70,
    "xpBonusMax"  REAL NOT NULL DEFAULT 20,
    "titleConfig" TEXT NOT NULL DEFAULT '[]'
);
