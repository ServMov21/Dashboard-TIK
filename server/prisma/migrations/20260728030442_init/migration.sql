-- CreateTable
CREATE TABLE "Guru" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "nama" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Siswa" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nama" TEXT NOT NULL,
    "tanggalLahir" DATETIME NOT NULL,
    "kelas" TEXT NOT NULL,
    "rombel" TEXT NOT NULL,
    "jenisKelamin" TEXT NOT NULL,
    "nis" TEXT,
    "password" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Tugas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "judul" TEXT NOT NULL,
    "deskripsi" TEXT,
    "jenis" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "deadline" DATETIME,
    "kelasTarget" TEXT NOT NULL,
    "rombelTarget" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "LampiranTugas" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tugasId" TEXT NOT NULL,
    "namaFile" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    CONSTRAINT "LampiranTugas_tugasId_fkey" FOREIGN KEY ("tugasId") REFERENCES "Tugas" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Pengumpulan" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tugasId" TEXT NOT NULL,
    "siswaId" TEXT NOT NULL,
    "namaFile" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "ukuran" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Pengumpulan_tugasId_fkey" FOREIGN KEY ("tugasId") REFERENCES "Tugas" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "Pengumpulan_siswaId_fkey" FOREIGN KEY ("siswaId") REFERENCES "Siswa" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AktivitasSiswa" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "siswaId" TEXT NOT NULL,
    "tugasId" TEXT,
    "jenis" TEXT NOT NULL,
    "deskripsi" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AktivitasSiswa_siswaId_fkey" FOREIGN KEY ("siswaId") REFERENCES "Siswa" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "AktivitasSiswa_tugasId_fkey" FOREIGN KEY ("tugasId") REFERENCES "Tugas" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Pengaturan" (
    "id" TEXT NOT NULL PRIMARY KEY DEFAULT '1',
    "logoPath" TEXT,
    "namaSekolah" TEXT NOT NULL DEFAULT 'Sekolah Kita',
    "alamat" TEXT,
    "baseDir" TEXT NOT NULL DEFAULT './storage',
    "tema" TEXT NOT NULL DEFAULT 'light',
    "jamLogout" INTEGER NOT NULL DEFAULT 60,
    "submissionFolderPattern" TEXT NOT NULL DEFAULT 'KELAS_ROMBEL/NAMA_TUGAS',
    "duplicateFileHandling" TEXT NOT NULL DEFAULT 'RENAME_INCREMENT'
);

-- CreateTable
CREATE TABLE "QuickShareRoom" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "kode" TEXT NOT NULL,
    "nama" TEXT NOT NULL,
    "password" TEXT,
    "mode" TEXT NOT NULL,
    "batasWaktu" DATETIME NOT NULL,
    "batasSize" INTEGER,
    "batasFile" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'aktif',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- CreateTable
CREATE TABLE "QuickShareFile" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "roomId" TEXT NOT NULL,
    "namaFile" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "ukuran" INTEGER NOT NULL,
    "pengirim" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "QuickShareFile_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "QuickShareRoom" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Guru_username_key" ON "Guru"("username");

-- CreateIndex
CREATE INDEX "AktivitasSiswa_siswaId_idx" ON "AktivitasSiswa"("siswaId");

-- CreateIndex
CREATE INDEX "AktivitasSiswa_tugasId_idx" ON "AktivitasSiswa"("tugasId");

-- CreateIndex
CREATE INDEX "AktivitasSiswa_jenis_idx" ON "AktivitasSiswa"("jenis");

-- CreateIndex
CREATE INDEX "AktivitasSiswa_createdAt_idx" ON "AktivitasSiswa"("createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "QuickShareRoom_kode_key" ON "QuickShareRoom"("kode");
