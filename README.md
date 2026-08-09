# Dashboard Guru TIK (Localhost Only)

Proyek ini adalah aplikasi Dashboard Guru TIK yang didesain khusus untuk dijalankan di lingkungan lokal (localhost / Local Area Network) di laboratorium komputer sekolah.

## Fitur Utama

- **Dashboard Guru (Admin)**: Kelola data tugas, unggahan siswa, data siswa (impor dari Excel), acak tempat duduk, file sharing, dan quick share.
- **Dashboard Siswa (Client)**: Tanpa install aplikasi, siswa dapat mengakses dari browser menggunakan IP LAN guru, login dengan tanggal lahir, melihat tugas, mengunggah tugas, dan menggunakan quick share.
- **File Sharing & Request**: Berbagi file/folder secara cepat tanpa internet.
- **Quick Share**: Berbagi file dan transfer cepat dengan kode/QR Code.
- **Database SQLite**: Portable, tanpa perlu instalasi database server eksternal.

## Prasyarat Server (Komputer Guru)

- **Node.js** (LTS terbaru)
- **Git** (opsional)

## Cara Menjalankan

### Cara 1: Menggunakan file Batch (Windows - Sekali Klik)
Cukup klik dua kali file `start.bat` yang berada di root direktori proyek ini.
Script akan otomatis:
1. Memeriksa keberadaan Node.js dan npm.
2. Menginstall semua dependensi (jika belum ada).
3. Melakukan migrasi database SQLite dan seeding user awal.
4. Melakukan kompilasi (build) frontend React.
5. Menjalankan server backend Express dan membuka browser secara otomatis ke alamat `http://localhost:5000`.

### Cara 2: Menjalankan Secara Manual
1. Buka terminal di root direktori proyek.
2. Jalankan instalasi dependensi untuk semua modul:
   ```bash
   npm run install-all
   ```
3. Lakukan inisialisasi database SQLite menggunakan Prisma:
   ```bash
   npm run migrate-db
   ```
4. Lakukan build frontend:
   ```bash
   npm run build-client
   ```
5. Jalankan aplikasi:
   ```bash
   npm start
   ```
6. Buka browser dan arahkan ke: `http://localhost:5000`.

## Akses Siswa (Client LAN)
1. Dapatkan IP Address lokal komputer Guru (misalnya `192.168.1.10`).
2. Jalankan server di komputer Guru (sehingga port `5000` aktif).
3. Komputer siswa yang terhubung dalam satu jaringan Wi-Fi/LAN yang sama dapat mengakses website melalui browser dengan alamat:
   ```
   http://192.168.1.10:5000
   ```

## Akun Guru Awal
- **Username**: `admin`
- **Password**: `admin123`
# Dashboard-TIK
