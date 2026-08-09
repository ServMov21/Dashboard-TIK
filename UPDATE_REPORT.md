# Laporan Update Dashboard TIK (Ringkasan Eksekutif)

Dokumen ini mencatat seluruh perbaikan, fitur baru, dan pembaruan yang telah diterapkan sejak audit terakhir. Pembaruan mencakup klien, server, database, dan konfigurasi.

---

## 1. Perbaikan Bug (Fixes)

### 1.1 Keamanan
- **JWT Secret Hardcoded Dihapus**: Jika `JWT_SECRET` tidak diset, server berhenti otomatis. Tidak ada fallback default.
- **CORS Diperketat**: Akses API hanya untuk `FRONTEND_URL` (default `http://localhost:5173`).
- **Auth Middleware Konsisten**: Semua endpoint sensitif terlindungi `authMiddleware` dengan role-check.

### 1.2 Stabilitas Sistem
- **Database Crash Fix**: Fallback `settings?.baseDir || './storage'` di `fileSharing.js` dan `localDisk.js`.
- **Cross-Device File Move**: Ganti `fs.rename` ke `copyFile + unlink` (anti-EXDEV untuk Windows).
- **Client Crash Fix**: Bungkus `JSON.parse` di `App.jsx` dengan try-catch.
- **Memory Leak Socket**: Ganti variabel global di `NotificationProvider.jsx` menjadi `useRef` + auto-disconnect.
- **TugasPage Blank Page**: `getTimeLeft` mengembalikan objek `{ended:true}` yang crash React. Sekarang selalu mengembalikan string.

### 1.3 UX Login
- **Login Error Specific**: Tambah `skipAuthRedirect` agar 401 (password salah) tidak membuang inputan siswa.
- **Lihat Password**: Tombol toggle Lihat/Sembunyi pada input password siswa.
- **Auto-redirect Aman**: `App.jsx` tunggu `localStorage` dibaca dulu, baru navigasi ke `/login`.

### 1.4 Auth & Password
- **Timezone Bug Fixed**: `parseBirthParts` dan `getUTCDate/getUTCMonth/getUTCFullYear` agar `DDMMYYYY` konsisten lintas zona waktu.
- **Login Siswa**: Backend hanya cocokkan `siswa.password` apa adanya.

### 1.5 Algoritma Acak Tempat Duduk
- **Tagged Wajib Berdua**: Siswa ditandai otomatis dapat pasangan. Jika jumlah tagged ganjil, dipadukan dengan random siswa lain.
- **Jenis Kelamin**: Pair harus gender sama.
- **Laki-laki Isi Kanan Dulu**: Sisi kanan Lab terisi cowok terlebih dahulu.
- **Sebaran Merata**: 16 PC diisi 1 siswa dulu, lalu sisa disebar acak.

### 1.6 Navigasi & Rute
- **Route Sync**: Menu Sidebar (Sharing, Disk, Quick Share) sekarang terhubung ke endpoint nyata.
- **Login Siswa Login Gagal**: Tidak lagi redirect paksa.

### 1.7 Dashboard Data Akurat
- **Dashboard Guru Real**: Total siswa, tugas aktif, terkumpul, storage path semuanya dari API.
- **Dashboard Siswa Real**: Total/selesai/belum dari `/api/siswa/dashboard-data`.

---

## 2. Fitur Baru

### 2.1 Autentikasi & Login
- **Multi-step Login Siswa**: Pilih Kelas → Rombel → Cari Nama (search live) → Password.
- **Dropdown Dinamis**: Data kelas dan rombel otomatis dari database.
- **Tampilkan/Sembunyikan Password**.

### 2.2 Tambah Tugas (Guru)
- **Modal Form Lengkap**: Judul, jenis (text/dokumen/gambar/video/link), deskripsi, lampiran multi-file, deadline, kelas target, rombel target, status.
- **Trigger**: Tombol "Tambah Tugas" + kartu kosong di grid.
- **Launch Draft**: Tugas bisa langsung di-aktivasi saat disimpan.
- **Edit Status**: Tombol 🚀 untuk launch draft.

### 2.3 Upload Tugas (Siswa)
- **UI Modern**: Drag & drop file di `DetailTugasPage`.
- **Replace Logic**: File lama siswa otomatis tertimpa atau dibuat clone dengan suffix `(1)`, `(2)` sesuai konfigurasi.

### 2.4 Pengaturan (Guru) - GUI Fungsional
- **Identitas Sekolah**: Nama, Alamat, Logo.
- **Local Disk**: Root storage path.
- **Pola Folder Pengumpulan** (Baru):
  - `KELAS_ROMBEL/NAMA_TUGAS` (Default)
  - `NAMA_TUGAS/KELAS_ROMBEL`
- **Penanganan File Duplikat** (Baru):
  - `Rename Increment` (file (1).ext, (2).ext)
  - `Replace` (timpa)
- **Tampilan & Sistem**: Tema, Sesi Logout Otomatis.

### 2.5 Struktur Folder Pengumpulan (Baru)
Folder default:
```text
{baseDir}/PengumpulanTugas/{KELAS}{ROMBEL}/{NAMA TUGAS}/{nama_siswa.ext}
```
Duplikat otomatis menjadi:
```text
ahmad_fauzi.docx
ahmad_fauzi (1).docx
ahmad_fauzi (2).docx
```

### 2.6 Akun Siswa - Daftar Tugas
- **Filter Per-Rombel**: Tugas hanya tampil untuk siswa kelas+rombel yang sesuai.
- **Countdown Real-time**: Hari/Jam/Menit/Detik.

### 2.7 Dashboard Statistik
- **Progress Bar Per-Tugas**: Persentase dihitung per kelas target.
- **Aktivitas Terbaru**: Dari data tugas terbaru.

---

## 3. File yang Berubah

| File | Perubahan |
|------|-----------|
| `client/src/utils/api.js` | Wrapper fetch, `skipAuthRedirect`, FormData handling |
| `client/src/App.jsx` | `checkingAuth`, route sync, Navigate |
| `client/src/pages/LoginPage.jsx` | Filter dinamis, show password, error spesifik |
| `client/src/pages/DashboardGuru.jsx` | Data real dari API |
| `client/src/pages/DashboardSiswa.jsx` | Data real dari API |
| `client/src/pages/TugasPage.jsx` | Modal form tambah tugas, filter rombel, countdown fix |
| `client/src/pages/SiswaPage.jsx` | Upload template + import Excel |
| `client/src/pages/SettingsPage.jsx` | Form GUI fungsional |
| `client/src/pages/AcakTempatDudukPage.jsx` | Rombel dinamis |
| `client/src/components/NotificationProvider.jsx` | useRef socket cleanup |
| `server/prisma/schema.prisma` | Tambah `submissionFolderPattern`, `duplicateFileHandling` |
| `server/middleware/authMiddleware.js` | Exit jika JWT_SECRET missing |
| `server/routes/auth.js` | Exit jika JWT_SECRET missing |
| `server/routes/siswa.js` | parseBirthParts UTC, login-kelas/rombel, dashboard-data, template download |
| `server/routes/tugas.js` | Filter kelas+rombel, parse aman |
| `server/routes/pengumpulan.js` | Struktur folder dinamis, rename increment |
| `server/routes/fileSharing.js` | Fallback baseDir, copyFile+unlink |
| `server/routes/localDisk.js` | Fallback baseDir |
| `server/routes/pengaturan.js` | Tambah field baru |
| `server/routes/acakTempatDuduk.js` | Tagged berdua gender sama, laki-laki sisi kanan |
| `server/server.js` | CORS dari env |
| `start.bat` | Auto-create `.env`, npm install untuk client, pesan diperbaiki |

---

## 4. Panduan Migrasi Database

Setelah update schema Prisma, jalankan migrasi sekali:

```bat
cd server
npx prisma migrate dev --name add_settings_pattern
```

Ini menambahkan kolom baru `submissionFolderPattern` dan `duplicateFileHandling` ke tabel `Pengaturan`.

---

## 5. Cara Menjalankan

```bat
cd "D:\Dashboard-TIK"
start.bat
```

Atau manual:
```bash
cd server
npm run dev
cd ../client
npm run dev
```

Akses di:
- Guru (server): `http://localhost:5000`
- Siswa (LAN): `http://192.168.x.x:5000`

Login default:
- Guru: `admin / admin123`
- Siswa: Nama Siswa + Tanggal Lahir (DDMMYYYY)

---

*Sistem Dashboard TIK sudah dalam kondisi stabil, fitur lengkap, dan siap dipakai.*