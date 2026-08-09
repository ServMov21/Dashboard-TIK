-- AlterTable
-- Tambah kolom bobot penilaian kustom (kebenaran & kecepatan) khusus tugas mengetik.
-- Nullable: kalau NULL, aplikasi memakai default 90 (kebenaran) / 10 (kecepatan).
ALTER TABLE "Tugas" ADD COLUMN "bobotKebenaran" REAL;
ALTER TABLE "Tugas" ADD COLUMN "bobotKecepatan" REAL;
