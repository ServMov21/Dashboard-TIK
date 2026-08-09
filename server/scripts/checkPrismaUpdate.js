/**
 * Cek apakah paket "prisma" perlu diupdate, lalu update OTOMATIS jika perlu,
 * baru lanjut proses. Jika sudah versi terbaru (atau gagal cek versi karena
 * tidak ada koneksi internet), langsung lanjut proses tanpa update.
 *
 * PENTING: update otomatis dibatasi hanya pada MAJOR VERSION yang sama dengan
 * yang sudah dipakai proyek ini (mis. 5.x -> 5.y terbaru), BUKAN ke major
 * version terbaru secara mutlak. Prisma sering melakukan breaking change antar
 * major version (mis. Prisma 7 menghapus `datasource.url` dari schema.prisma
 * dan mewajibkan `prisma.config.ts` + driver adapter), jadi auto-update lintas
 * major bisa membuat aplikasi rusak/tidak jalan tanpa migrasi kode manual.
 * Kalau ada major version baru yang lebih tinggi, skrip ini hanya memberi
 * info saja tanpa memasangnya otomatis.
 *
 * Dipanggil dari start.bat / package.json sebelum `prisma generate`.
 */
import { execSync } from 'child_process'
import { fileURLToPath } from 'url'
import path from 'path'
import fs from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const serverDir = path.resolve(__dirname, '..')

function run(cmd, opts = {}) {
  return execSync(cmd, { stdio: 'inherit', cwd: serverDir, ...opts })
}

function getOutput(cmd) {
  try {
    return execSync(cmd, { cwd: serverDir, encoding: 'utf-8' }).trim()
  } catch (e) {
    return null
  }
}

function getCurrentPrismaVersion() {
  try {
    const pkgPath = path.join(serverDir, 'node_modules', 'prisma', 'package.json')
    if (!fs.existsSync(pkgPath)) return null
    const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf-8'))
    return pkg.version || null
  } catch (e) {
    return null
  }
}

// Major version Prisma yang didukung skema project ini saat ini (Prisma 5.x
// masih pakai `datasource.url` langsung di schema.prisma). SENGAJA di-hardcode
// di sini (bukan dibaca dari package.json) karena `npm install` akan menulis
// ulang package.json setiap kali dijalankan -- kalau target major dibaca dari
// situ, package.json yang "sudah kadung" ter-update ke major baru (mis. lewat
// perintah manual dari notifikasi npm) akan membuat skrip ini menganggapnya
// sebagai target yang benar dan berhenti melindungi dari breaking change.
// Naikkan angka ini secara SADAR & manual saat kode project sudah dimigrasi
// untuk mendukung major version Prisma yang baru.
const SUPPORTED_PRISMA_MAJOR = 5

function getTargetMajorFromPackageJson() {
  return SUPPORTED_PRISMA_MAJOR
}

function getLatestVersionForMajor(major) {
  // Ambil SEMUA versi prisma yang pernah dirilis (JSON, supaya parsing selalu
  // aman lintas versi npm), lalu filter yang major-nya cocok dan ambil yang
  // tertinggi secara numerik (bukan string) supaya mis. 5.9.0 tidak "lebih
  // besar" dari 5.10.0.
  const raw = getOutput('npm view prisma versions --json')
  if (!raw) return null
  let versions
  try {
    versions = JSON.parse(raw)
  } catch (e) {
    return null
  }
  if (!Array.isArray(versions)) versions = [versions]

  const inMajor = versions.filter(v => majorOf(v) === major && /^\d+\.\d+\.\d+$/.test(v))
  if (inMajor.length === 0) return null

  inMajor.sort((a, b) => {
    const pa = a.split('.').map(Number)
    const pb = b.split('.').map(Number)
    for (let i = 0; i < 3; i++) {
      if (pa[i] !== pb[i]) return pa[i] - pb[i]
    }
    return 0
  })

  return inMajor[inMajor.length - 1]
}

function getAbsoluteLatestVersion() {
  return getOutput('npm view prisma version')
}

function majorOf(version) {
  if (!version) return null
  const match = /^(\d+)\./.exec(version)
  return match ? parseInt(match[1], 10) : null
}

function main() {
  console.log('Memeriksa versi Prisma...')
  const current = getCurrentPrismaVersion()
  const targetMajor = getTargetMajorFromPackageJson() ?? majorOf(current) ?? 5

  const latestInMajor = getLatestVersionForMajor(targetMajor)

  if (!latestInMajor) {
    console.log('Tidak bisa memeriksa versi terbaru Prisma (mungkin tidak ada koneksi internet). Melanjutkan proses dengan versi saat ini...')
    return
  }

  if (!current || current !== latestInMajor) {
    console.log(`Prisma perlu diupdate: ${current || 'belum terinstall'} -> ${latestInMajor} (Prisma ${targetMajor}.x)`)
    console.log('Mengupdate Prisma secara otomatis, mohon tunggu...')
    try {
      run(`npm i --save-dev prisma@${latestInMajor}`)
      run(`npm i @prisma/client@${latestInMajor}`)
      console.log(`Prisma berhasil diupdate ke versi ${latestInMajor}. Melanjutkan proses...`)
    } catch (e) {
      console.error('Gagal mengupdate Prisma secara otomatis. Melanjutkan proses dengan versi saat ini.')
    }
  } else {
    console.log(`Prisma sudah versi terbaru untuk Prisma ${targetMajor}.x (${current}). Melanjutkan proses...`)
  }

  // Info saja (tidak auto-install) kalau ada major version yang lebih baru,
  // karena upgrade major version Prisma butuh migrasi kode manual (schema,
  // prisma.config.ts, driver adapter, dsb).
  const absoluteLatest = getAbsoluteLatestVersion()
  const absoluteMajor = majorOf(absoluteLatest)
  if (absoluteMajor && absoluteMajor > targetMajor) {
    console.log(`Info: tersedia Prisma versi major lebih baru (${absoluteLatest}), tapi proyek ini masih memakai Prisma ${targetMajor}.x dan TIDAK di-update otomatis ke major baru karena berpotensi breaking change (butuh migrasi kode manual). Update mayor bisa dilakukan manual sesuai panduan resmi Prisma jika diperlukan.`)
  }
}

main()
