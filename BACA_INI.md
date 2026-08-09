# Perubahan: Bobot Kustom & Penilaian Kebenaran yang Lebih Bijak

Paket ini HANYA berisi file-file yang berubah (bukan seluruh project). Timpakan
file-file di dalamnya ke lokasi yang sama persis di project `Dashboard-TIK` Anda.

## Daftar file yang berubah
```
server/prisma/schema.prisma
server/prisma/migrations/20260730120000_add_bobot_penilaian_mengetik/migration.sql   (BARU)
server/routes/tugas.js
server/routes/pengumpulanMengetik.js
client/src/utils/typingScore.js
client/src/pages/DetailTugasPage.jsx
client/src/pages/TugasPage.jsx
```

## Cara memasang
1. Salin semua file di atas ke folder project Anda (timpa yang lama).
2. Masuk ke folder `server`, lalu jalankan:
   ```
   npx prisma migrate deploy
   npx prisma generate
   ```
   Ini akan menambah 2 kolom baru (`bobotKebenaran`, `bobotKecepatan`) ke tabel
   `Tugas` tanpa menghapus data yang sudah ada.
3. Jalankan ulang server & client seperti biasa.

## 1. Bobot kustom kebenaran/kecepatan
- Default sekarang **Kebenaran 90 / Kecepatan 10** (sebelumnya 80/20).
- Saat guru membuat tugas jenis **Mengetik**, ada input baru "Bobot Penilaian":
  guru cukup mengisi persentase Kebenaran, persentase Kecepatan otomatis
  menyesuaikan (selalu total 100).
- Kalau field dikosongkan, otomatis pakai default 90/10.
- Bobot ini tersimpan per-tugas (kolom `bobotKebenaran`/`bobotKecepatan` di
  tabel `Tugas`, nullable — null berarti "pakai default aplikasi"), dipakai
  konsisten baik saat siswa mengumpulkan (`server/routes/pengumpulanMengetik.js`)
  maupun saat dihitung ulang di sisi client (`DetailTugasPage.jsx`).
- Tampilan skor sekarang menunjukkan nilai maksimal, misalnya "85/90" dan
  "8/10", supaya siswa & guru tahu skala yang dipakai.

## 2. Logika penilaian kebenaran yang lebih bijak
Sebelumnya sistem membandingkan huruf **berdasarkan posisi index mentah**.
Akibatnya: kalau ada 1 spasi kurang/lebih di tengah naskah, SEMUA huruf
setelah itu ikut dianggap salah karena posisinya jadi bergeser — skor bisa
anjlok ke 0 walau isinya sebenarnya sudah benar. Huruf kapital yang tertukar
di satu tempat juga dihitung sama seperti huruf yang sepenuhnya salah.

Sekarang (`client/src/utils/typingScore.js`) memakai pencocokan berbasis
**LCS per kata/pemisah (spasi & baris baru)**:
- Naskah dipecah jadi potongan kata dan potongan pemisah, lalu dicocokkan
  dengan hasil ketikan siswa secara "alignment" (bukan posisi mentah).
- Kurang/lebih 1 spasi → hanya potongan itu (dan kata yang ikut menyatu
  karenanya) yang kena, bagian teks lain yang sudah benar tetap dinilai benar,
  tidak ikut ambruk.
- Huruf sudah benar tapi beda besar/kecil → dapat potongan nilai sedang
  (bukan 0 total untuk karakter itu).
- Perbedaan format (tebal/miring/garis bawah/rata teks) → potongan kecil per
  atribut, bukan menghanguskan seluruh karakter.
- Kata yang memang salah total tetap bernilai 0 untuk kata itu saja — jadi
  kesalahan nyata tetap tercatat, hanya tidak dibesar-besarkan / menular ke
  bagian lain.

Sudah diuji dengan simulasi: naskah 44 karakter yang kehilangan 1 spasi di
tengah kalimat sekarang mendapat skor ~67.5/90 (bukan langsung 0), dan huruf
kapital yang terlewat di awal kalimat hanya mengurangi skor sedikit
(89.4/90, bukan 0).
