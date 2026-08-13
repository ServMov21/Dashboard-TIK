import express from 'express'
import multer from 'multer'
import { PrismaClient } from '@prisma/client'
import authMiddleware from '../middleware/authMiddleware.js'
import { createBackup, startAutoBackup } from '../services/backupService.js'
import path from 'path'
import fs from 'fs'
import AdmZip from 'adm-zip'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const prisma = new PrismaClient()
const router = express.Router()
const upload = multer({ dest: 'storage/temp/' })

// POST /api/backup/run - Trigger backup manual
router.post('/run', authMiddleware, async (req, res) => {
  if (req.user.role !== 'guru') return res.status(403).json({ message: 'Akses ditolak.' })
  try {
    const settings = await prisma.pengaturan.findFirst()
    const backupDir = settings?.backupDir || path.join(__dirname, '../backups')
    
    const zipPath = await createBackup(backupDir)
    res.json({ message: 'Backup berhasil dibuat.', file: path.basename(zipPath), path: zipPath })
  } catch (error) {
    res.status(500).json({ message: 'Gagal membuat backup.', error: error.message })
  }
})

// POST /api/backup/restore - Upload ZIP dan restore
router.post('/restore', authMiddleware, upload.single('backupFile'), async (req, res) => {
  if (req.user.role !== 'guru') return res.status(403).json({ message: 'Akses ditolak.' })
  if (!req.file) return res.status(400).json({ message: 'File backup tidak ditemukan.' })

  const tempExtractPath = path.join(__dirname, `../storage/temp/extract-${Date.now()}`)
  
  try {
    const zip = new AdmZip(req.file.path)
    zip.extractAllTo(tempExtractPath, true)

    // Validasi isi ZIP (harus ada dev.db)
    const dbBackupPath = path.join(tempExtractPath, 'dev.db')
    if (!fs.existsSync(dbBackupPath)) {
      throw new Error('File database dev.db tidak ditemukan di dalam backup.')
    }

    const settings = await prisma.pengaturan.findFirst()
    const backupDir = settings?.backupDir || path.join(__dirname, '../backups')

    // 1. Buat safety backup dari data aktif saat ini
    try {
      await createBackup(backupDir)
    } catch (backupErr) {
      console.warn('Gagal membuat safety backup sebelum restore:', backupErr.message)
    }

    // 2. Putuskan koneksi Prisma agar SQLite file tidak terkunci
    await prisma.$disconnect()

    // 3. Salin dev.db baru
    const activeDbPath = path.join(__dirname, '../prisma/dev.db')
    
    // Hapus wal dan shm jika ada agar tidak korup
    const walPath = activeDbPath + '-wal'
    const shmPath = activeDbPath + '-shm'
    if (fs.existsSync(walPath)) fs.unlinkSync(walPath)
    if (fs.existsSync(shmPath)) fs.unlinkSync(shmPath)

    fs.copyFileSync(dbBackupPath, activeDbPath)

    // 4. Salin folder storage
    const backupStoragePath = path.join(tempExtractPath, 'storage')
    const activeStoragePath = path.join(__dirname, '../storage')

    if (fs.existsSync(backupStoragePath)) {
      // Hapus storage aktif lama kecuali folder temp
      const items = fs.readdirSync(activeStoragePath)
      for (const item of items) {
        if (item === 'temp') continue
        const itemPath = path.join(activeStoragePath, item)
        if (fs.lstatSync(itemPath).isDirectory()) {
          fs.rmSync(itemPath, { recursive: true, force: true })
        } else {
          fs.unlinkSync(itemPath)
        }
      }

      // Salin dari folder backup storage ke storage aktif
      const backupItems = fs.readdirSync(backupStoragePath)
      for (const item of backupItems) {
        const src = path.join(backupStoragePath, item)
        const dest = path.join(activeStoragePath, item)
        if (fs.lstatSync(src).isDirectory()) {
          fs.cpSync(src, dest, { recursive: true })
        } else {
          fs.copyFileSync(src, dest)
        }
      }
    }

    // Hubungkan kembali Prisma
    await prisma.$connect()

    // Jalankan ulang scheduler auto-backup jika konfigurasi berubah setelah restore
    await startAutoBackup()

    res.json({ message: 'Restore database dan storage berhasil diselesaikan.' })
  } catch (error) {
    res.status(500).json({ message: 'Gagal merestore backup.', error: error.message })
  } finally {
    // Bersihkan file temporer
    if (fs.existsSync(req.file.path)) fs.unlinkSync(req.file.path)
    if (fs.existsSync(tempExtractPath)) fs.rmSync(tempExtractPath, { recursive: true, force: true })
  }
})

export default router
