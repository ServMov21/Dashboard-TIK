import express from 'express'
import multer from 'multer'
import { PrismaClient } from '@prisma/client'
import path from 'path'
import fs from 'fs/promises'
import authMiddleware from '../middleware/authMiddleware.js'

const prisma = new PrismaClient()
const router = express.Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 200 * 1024 * 1024 } })

const safeName = (value) => String(value || 'file').replace(/[^a-zA-Z0-9._-]/g, '_')

async function uniqueFilePath(directory, originalName) {
  const ext = path.extname(originalName)
  const base = path.basename(originalName, ext)
  let index = 0
  while (true) {
    const suffix = index === 0 ? '' : ` (${index})`
    const candidate = path.join(directory, `${base}${suffix}${ext}`)
    try {
      await fs.access(candidate)
      index += 1
    } catch {
      return candidate
    }
  }
}

async function generateUniqueKode() {
  for (let i = 0; i < 10; i++) {
    const kode = Math.random().toString(36).substring(2, 8).toUpperCase()
    const existing = await prisma.quickShareRoom.findUnique({ where: { kode } })
    if (!existing) return kode
  }
  throw new Error('Gagal membuat kode unik.')
}

// Tandai room sebagai "berakhir" jika sudah lewat batas waktu, tapi status di DB masih "aktif"
async function withExpiryCheck(room) {
  if (room.status === 'aktif' && new Date(room.batasWaktu) < new Date()) {
    room = await prisma.quickShareRoom.update({ where: { id: room.id }, data: { status: 'berakhir' } })
  }
  return room
}

async function getBaseDir() {
  const settings = await prisma.pengaturan.findFirst()
  return settings?.baseDir || './storage'
}

// ========================= HOST (perlu login: guru atau siswa) =========================

// Daftar room milik user yang sedang login
router.get('/rooms', authMiddleware, async (req, res) => {
  try {
    const rooms = await prisma.quickShareRoom.findMany({
      where: { hostId: req.user.id, hostRole: req.user.role },
      include: { _count: { select: { files: true } } },
      orderBy: { createdAt: 'desc' },
    })
    const updated = []
    for (const r of rooms) updated.push(await withExpiryCheck(r))
    res.json(updated)
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil daftar room.', error: error.message })
  }
})

// Buat room baru
router.post('/rooms', authMiddleware, async (req, res) => {
  try {
    const { nama, password, mode, durasiMenit, batasSizeMB, batasFile } = req.body
    if (!nama) return res.status(400).json({ message: 'Nama room wajib diisi.' })

    const kode = await generateUniqueKode()
    const batasWaktu = new Date(Date.now() + (Number(durasiMenit) || 60) * 60 * 1000)

    const room = await prisma.quickShareRoom.create({
      data: {
        kode,
        nama,
        password: password || null,
        mode: mode || 'terima',
        hostId: req.user.id,
        hostRole: req.user.role,
        batasWaktu,
        batasSize: batasSizeMB ? Number(batasSizeMB) * 1024 * 1024 : null,
        batasFile: batasFile ? Number(batasFile) : null,
      },
    })
    res.status(201).json(room)
  } catch (error) {
    res.status(500).json({ message: 'Gagal membuat room.', error: error.message })
  }
})

// Detail + daftar file dalam sebuah room (khusus pemilik room)
router.get('/rooms/:id', authMiddleware, async (req, res) => {
  try {
    const room = await prisma.quickShareRoom.findUnique({
      where: { id: req.params.id },
      include: { files: { orderBy: { createdAt: 'desc' } } },
    })
    if (!room) return res.status(404).json({ message: 'Room tidak ditemukan.' })
    if (room.hostId !== req.user.id || room.hostRole !== req.user.role) {
      return res.status(403).json({ message: 'Akses ditolak.' })
    }
    res.json(await withExpiryCheck(room))
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil detail room.', error: error.message })
  }
})

// Tutup/hapus room beserta filenya
router.delete('/rooms/:id', authMiddleware, async (req, res) => {
  try {
    const room = await prisma.quickShareRoom.findUnique({ where: { id: req.params.id }, include: { files: true } })
    if (!room) return res.status(404).json({ message: 'Room tidak ditemukan.' })
    if (room.hostId !== req.user.id || room.hostRole !== req.user.role) {
      return res.status(403).json({ message: 'Akses ditolak.' })
    }
    for (const f of room.files) {
      try { await fs.unlink(f.path) } catch { /* file mungkin sudah tidak ada */ }
    }
    await prisma.quickShareRoom.delete({ where: { id: room.id } })
    res.json({ message: 'Room berhasil ditutup.' })
  } catch (error) {
    res.status(500).json({ message: 'Gagal menutup room.', error: error.message })
  }
})

// Host mengunduh file yang dikirim ke room-nya
router.get('/download/:fileId', authMiddleware, async (req, res) => {
  try {
    const file = await prisma.quickShareFile.findUnique({ where: { id: req.params.fileId }, include: { room: true } })
    if (!file) return res.status(404).json({ message: 'File tidak ditemukan.' })
    if (file.room.hostId !== req.user.id || file.room.hostRole !== req.user.role) {
      return res.status(403).json({ message: 'Akses ditolak.' })
    }
    res.download(file.path, file.namaFile)
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengunduh file.', error: error.message })
  }
})

// ========================= TAMU (PUBLIK — tanpa login) =========================

// Info room untuk halaman join publik (tanpa membocorkan password)
router.get('/public/:kode', async (req, res) => {
  try {
    let room = await prisma.quickShareRoom.findUnique({
      where: { kode: req.params.kode.toUpperCase() },
      include: { _count: { select: { files: true } } },
    })
    if (!room) return res.status(404).json({ message: 'Kode room tidak ditemukan.' })
    room = await withExpiryCheck(room)

    res.json({
      nama: room.nama,
      mode: room.mode,
      status: room.status,
      hasPassword: !!room.password,
      batasWaktu: room.batasWaktu,
      batasSize: room.batasSize,
      batasFile: room.batasFile,
      jumlahFile: room._count.files,
      bisaLihatFile: room.mode === 'bagikan' || room.mode === 'keduanya',
    })
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil info room.', error: error.message })
  }
})

// Tamu mengirim file ke room (TANPA LOGIN)
router.post('/public/:kode/upload', upload.array('files', 20), async (req, res) => {
  try {
    let room = await prisma.quickShareRoom.findUnique({ where: { kode: req.params.kode.toUpperCase() } })
    if (!room) return res.status(404).json({ message: 'Kode room tidak ditemukan.' })
    room = await withExpiryCheck(room)
    if (room.status !== 'aktif') return res.status(410).json({ message: 'Room ini sudah tidak aktif / berakhir.' })
    if (room.mode === 'bagikan') return res.status(403).json({ message: 'Room ini hanya untuk berbagi file dari host, tidak menerima kiriman.' })

    if (room.password) {
      const inputPassword = req.body.password || ''
      if (inputPassword !== room.password) {
        return res.status(401).json({ message: 'Password room salah.' })
      }
    }

    if (!req.files || req.files.length === 0) {
      return res.status(400).json({ message: 'Pilih minimal 1 file.' })
    }

    if (room.batasFile) {
      const jumlahSaatIni = await prisma.quickShareFile.count({ where: { roomId: room.id } })
      if (jumlahSaatIni + req.files.length > room.batasFile) {
        return res.status(400).json({ message: `Room ini hanya menerima maksimal ${room.batasFile} file.` })
      }
    }
    if (room.batasSize) {
      const totalSize = req.files.reduce((sum, f) => sum + f.size, 0)
      if (totalSize > room.batasSize) {
        return res.status(400).json({ message: 'Ukuran file melebihi batas yang diizinkan.' })
      }
    }

    const pengirim = (req.body.pengirim || 'Tamu').toString().slice(0, 100)
    const baseDir = await getBaseDir()
    const dir = path.join(baseDir, 'QuickShare', safeName(room.kode))
    await fs.mkdir(dir, { recursive: true })

    const saved = []
    for (const file of req.files) {
      const target = await uniqueFilePath(dir, file.originalname)
      await fs.writeFile(target, file.buffer)
      const record = await prisma.quickShareFile.create({
        data: {
          roomId: room.id,
          namaFile: file.originalname,
          path: target,
          ukuran: file.size,
          pengirim,
        },
      })
      saved.push(record)
    }

    req.app.get('io')?.emit('quickshare-file-baru', { roomId: room.id, files: saved })
    res.status(201).json({ message: 'File berhasil dikirim.', files: saved })
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengirim file.', error: error.message })
  }
})

// Daftar file dalam room (untuk tamu — hanya jika mode room mengizinkan berbagi keluar)
router.get('/public/:kode/files', async (req, res) => {
  try {
    let room = await prisma.quickShareRoom.findUnique({ where: { kode: req.params.kode.toUpperCase() } })
    if (!room) return res.status(404).json({ message: 'Kode room tidak ditemukan.' })
    room = await withExpiryCheck(room)
    if (room.mode !== 'bagikan' && room.mode !== 'keduanya') {
      return res.status(403).json({ message: 'Room ini tidak membagikan daftar file ke tamu.' })
    }
    if (room.password) {
      const inputPassword = req.query.password || ''
      if (inputPassword !== room.password) return res.status(401).json({ message: 'Password room salah.' })
    }
    const files = await prisma.quickShareFile.findMany({ where: { roomId: room.id }, orderBy: { createdAt: 'desc' } })
    res.json(files.map((f) => ({ id: f.id, namaFile: f.namaFile, ukuran: f.ukuran, pengirim: f.pengirim, createdAt: f.createdAt })))
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil daftar file.', error: error.message })
  }
})

// Tamu mengunduh file yang dibagikan host (hanya untuk room mode bagikan/keduanya)
router.get('/public/:kode/download/:fileId', async (req, res) => {
  try {
    let room = await prisma.quickShareRoom.findUnique({ where: { kode: req.params.kode.toUpperCase() } })
    if (!room) return res.status(404).json({ message: 'Kode room tidak ditemukan.' })
    room = await withExpiryCheck(room)
    if (room.mode !== 'bagikan' && room.mode !== 'keduanya') {
      return res.status(403).json({ message: 'Room ini tidak membagikan file ke tamu.' })
    }
    if (room.password) {
      const inputPassword = req.query.password || ''
      if (inputPassword !== room.password) return res.status(401).json({ message: 'Password room salah.' })
    }
    const file = await prisma.quickShareFile.findFirst({ where: { id: req.params.fileId, roomId: room.id } })
    if (!file) return res.status(404).json({ message: 'File tidak ditemukan.' })
    res.download(file.path, file.namaFile)
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengunduh file.', error: error.message })
  }
})

export default router
