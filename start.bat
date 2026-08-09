@echo off
cd /d "%~dp0"

REM Cek apakah Node.js terinstall
where node >nul 2>nul
if %errorlevel% neq 0 (
    echo Node.js tidak ditemukan. Silakan install Node.js LTS terlebih dahulu.
    echo Kunjungi: https://nodejs.org/
    pause
    exit /b 1
)

REM Cek apakah npm terinstall
where npm >nul 2>nul
if %errorlevel% neq 0 (
    echo npm tidak ditemukan. Silakan install Node.js LTS terlebih dahulu.
    echo Kunjungi: https://nodejs.org/
    pause
    exit /b 1
)

REM Install dependencies jika belum terinstall
IF NOT EXIST "node_modules" (
    echo Menginstall dependencies proyek utama...
    call npm install
    if %errorlevel% neq 0 (
        echo Gagal menginstall dependencies proyek utama.
        pause
        exit /b 1
    )
)

echo Menginstall dependencies frontend...
cd client
call npm install
if %errorlevel% neq 0 (
    echo Gagal menginstall dependencies frontend.
    pause
    exit /b 1
)
cd ..

IF NOT EXIST "client\node_modules\.bin\vite.cmd" (
    echo Vite belum ditemukan setelah install frontend.
    pause
    exit /b 1
)

IF NOT EXIST "server\node_modules" (
    echo Menginstall dependencies backend...
    cd server
    call npm install
    if %errorlevel% neq 0 (
        echo Gagal menginstall dependencies backend.
        pause
        exit /b 1
    )
    cd ..
)

REM Generate Prisma client & Migrate DB
echo Menjalankan Prisma migrate dan seed...
cd server

REM Buat .env otomatis jika belum ada
IF NOT EXIST ".env" (
    echo .env tidak ditemukan, membuat file .env baru...
    echo PORT=5000> .env
    echo HOST=0.0.0.0>> .env
    echo JWT_SECRET=dashboard-tik-local-secret-key-2024>> .env
    echo DATABASE_URL="file:./dev.db">> .env
    echo FRONTEND_URL=http://localhost:5000>> .env
    echo MAX_UPLOAD_SIZE_MB=500>> .env
    echo File .env berhasil dibuat.
)
REM Cek apakah Prisma perlu diupdate. Jika perlu, update otomatis dulu,
REM baru lanjut proses. Jika sudah versi terbaru, langsung lanjut.
call node scripts\checkPrismaUpdate.js

call npx prisma generate
if %errorlevel% neq 0 (
    echo Gagal menjalankan prisma generate.
    pause
    exit /b 1
)
call npx prisma migrate deploy
if %errorlevel% neq 0 (
    echo Gagal menjalankan prisma migrate.
    pause
    exit /b 1
)
call npx prisma db seed
if %errorlevel% neq 0 (
    echo Gagal menjalankan prisma db seed.
    pause
    exit /b 1
)
cd ..

REM Build frontend
echo Membangun frontend...
cd client
call npm run build
if %errorlevel% neq 0 (
    echo Gagal membangun frontend.
    pause
    exit /b 1
)
cd ..

echo Memulai server backend dan frontend...
start cmd /k "cd server && npm start"
timeout /t 5 >nul
start http://localhost:5000

echo Dashboard TIK berhasil dijalankan!
echo Tutup jendela command prompt ini untuk menghentikan server.

pause >nul
exit
