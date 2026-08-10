import express from 'express'
import multer from 'multer'
import XLSX from 'xlsx'
import { PrismaClient } from '@prisma/client'
import authMiddleware from '../middleware/authMiddleware.js'

const prisma = new PrismaClient()
const router = express.Router()
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } })
const requiredHeaders = ['NAMA', 'KELAS', 'ROMBEL', 'TANGGAL LAHIR', 'JENIS KELAMIN']

function parseBirthParts(value) {
  if (typeof value === 'number') {
    const parsed = XLSX.SSF.parse_date_code(value)
    if (!parsed) return null
    return { day: parsed.d, month: parsed.m, year: parsed.y }
  }

  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return {
      day: value.getDate(),
      month: value.getMonth() + 1,
      year: value.getFullYear(),
    }
  }

  const text = String(value || '').trim()
  const match = text.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/)
  if (!match) return null

  const day = Number(match[1])
  const month = Number(match[2])
  const year = Number(match[3])
  const date = new Date(year, month - 1, day)

  if (Number.isNaN(date.getTime()) || date.getDate() !== day || date.getMonth() + 1 !== month || date.getFullYear() !== year) {
    return null
  }

  return { day, month, year }
}

// Get unique kelas for login dropdown
router.get('/login-kelas', async (req, res) => {
  try {
    const kelas = await prisma.siswa.findMany({
      select: { kelas: true },
      distinct: ['kelas'],
      orderBy: { kelas: 'asc' },
    })
    res.json(kelas.map(k => k.kelas))
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil daftar kelas.', error: error.message })
  }
})

// Get unique rombel for login dropdown, filtered by kelas
router.get('/login-rombel', async (req, res) => {
  try {
    const { kelas } = req.query
    if (!kelas) return res.status(400).json({ message: 'Parameter kelas diperlukan.' })

    const rombel = await prisma.siswa.findMany({
      where: { kelas },
      select: { rombel: true },
      distinct: ['rombel'],
      orderBy: { rombel: 'asc' },
    })
    res.json(rombel.map(r => r.rombel))
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil daftar rombel.', error: error.message })
  }
})

// Data siswa untuk dropdown login; tanpa data tanggal lahir.
router.get('/login-list', async (req, res) => {
  try {
    const { kelas, rombel } = req.query
    const whereClause = {}

    if (kelas) whereClause.kelas = kelas
    if (rombel) whereClause.rombel = rombel

    const siswa = await prisma.siswa.findMany({
      where: whereClause,
      select: { id: true, nama: true, kelas: true, rombel: true },
      orderBy: [{ kelas: 'asc' }, { rombel: 'asc' }, { nama: 'asc' }],
    })
    res.json(siswa)
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil daftar siswa.', error: error.message })
  }
})

// Dashboard data untuk siswa — menghitung tugas aktif DAN yang sudah ditutup guru
router.get('/dashboard-data', authMiddleware, async (req, res) => {
  if (req.user.role !== 'siswa') return res.status(403).json({ message: 'Akses ditolak.' })
  try {
    const siswa = await prisma.siswa.findUnique({ where: { id: req.user.id } })
    if (!siswa) return res.status(404).json({ message: 'Data siswa tidak ditemukan.' })

    // Ambil SEMUA tugas yang pernah diaktifkan (launch ATAU ditutup), bukan hanya yang sedang aktif.
    // Tugas berstatus 'draft' tidak dihitung karena belum pernah diperlihatkan ke siswa.
    // Tugas yang dihapus guru otomatis tidak masuk (sudah tidak ada di DB).
    const allActivatedTugas = await prisma.tugas.findMany({
      where: {
        status: { in: ['launch', 'ditutup'] },
        kelasTarget: { contains: `"${siswa.kelas}"` },
      },
      orderBy: { deadline: 'asc' },
    })

    // Filter lebih lanjut berdasarkan rombel siswa
    const filteredTugas = allActivatedTugas.filter(t => {
      const rombelTarget = t.rombelTarget ? JSON.parse(t.rombelTarget || '[]') : []
      return rombelTarget.length === 0 || rombelTarget.includes(siswa.rombel)
    })

    const tugasIds = filteredTugas.map(t => t.id)

    // Hitung tugas yang sudah dikumpulkan siswa (file)
    const filePengumpulan = await prisma.pengumpulan.findMany({
      where: { siswaId: siswa.id, tugasId: { in: tugasIds } },
      select: { tugasId: true, updatedAt: true },
    })

    // Hitung tugas mengetik yang sudah selesai
    const mengetikPengumpulan = await prisma.pengumpulanMengetik.findMany({
      where: { siswaId: siswa.id, tugasId: { in: tugasIds }, status: 'selesai' },
      select: { tugasId: true, updatedAt: true },
    })

    // Set unik dari tugasId yang sudah diselesaikan
    const submittedTugasIds = new Set([
      ...filePengumpulan.map(p => p.tugasId),
      ...mengetikPengumpulan.map(p => p.tugasId),
    ])

    const stats = {
      total: filteredTugas.length,
      selesai: submittedTugasIds.size,
      belum: filteredTugas.length - submittedTugasIds.size,
    }

    // Daftar tugas aktif (hanya 'launch') untuk panel "Tugas Mendatang"
    const tugasAktif = filteredTugas.filter(t => t.status === 'launch')

    // Gabungan pengumpulan file + mengetik (untuk kompatibilitas frontend)
    const allPengumpulan = [
      ...filePengumpulan,
      ...mengetikPengumpulan,
    ]

    res.json({ tugas: tugasAktif, pengumpulan: allPengumpulan, stats })
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil data dashboard siswa.', error: error.message })
  }
})

router.get('/', authMiddleware, async (req, res) => {
  if (req.user.role !== 'guru') return res.status(403).json({ message: 'Akses ditolak.' })
  try {
    const siswa = await prisma.siswa.findMany({ orderBy: [{ kelas: 'asc' }, { rombel: 'asc' }, { nama: 'asc' }] })
    res.json(siswa)
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil data siswa.', error: error.message })
  }
})

// Tambah satu siswa manual via form
router.post('/', authMiddleware, async (req, res) => {
  if (req.user.role !== 'guru') return res.status(403).json({ message: 'Akses ditolak.' })
  try {
    const { nama, kelas, rombel, jenisKelamin, tanggalLahir, nis } = req.body

    if (!nama || !String(nama).trim()) return res.status(400).json({ message: 'Nama wajib diisi.' })
    if (!kelas || !String(kelas).trim()) return res.status(400).json({ message: 'Kelas wajib diisi.' })
    if (!rombel || !String(rombel).trim()) return res.status(400).json({ message: 'Rombel wajib diisi.' })
    if (!jenisKelamin || !String(jenisKelamin).trim()) return res.status(400).json({ message: 'Jenis kelamin wajib diisi.' })

    const data = {
      nama: String(nama).trim(),
      kelas: String(kelas).trim(),
      rombel: String(rombel).trim(),
      jenisKelamin: String(jenisKelamin).trim(),
      nis: nis && String(nis).trim() ? String(nis).trim() : null,
    }

    // Password = tanggal lahir (DDMMYYYY), sama seperti flow edit & import Excel
    if (tanggalLahir) {
      const d = new Date(tanggalLahir)
      if (isNaN(d.getTime())) return res.status(400).json({ message: 'Format tanggal lahir tidak valid.' })
      const day = d.getUTCDate()
      const month = d.getUTCMonth() + 1
      const year = d.getUTCFullYear()
      const dd = String(day).padStart(2, '0')
      const mm = String(month).padStart(2, '0')
      data.tanggalLahir = d
      data.password = `${dd}${mm}${year}`
    } else {
      data.password = '123456' // fallback default bila tanggal lahir tidak diisi
    }

    const siswaBaru = await prisma.siswa.create({ data })
    res.status(201).json({ message: 'Data siswa berhasil ditambahkan.', siswa: siswaBaru })
  } catch (error) {
    res.status(500).json({ message: 'Gagal menambahkan data siswa.', error: error.message })
  }
})

router.get('/kelas/list', authMiddleware, async (req, res) => {
  try {
    const rows = await prisma.siswa.findMany({ select: { kelas: true, rombel: true }, distinct: ['kelas', 'rombel'] })
    res.json(rows)
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil kelas.', error: error.message })
  }
})

// Edit data siswa (Nama, Kelas, Rombel, Tanggal Lahir)
router.put('/:id', authMiddleware, async (req, res) => {
  if (req.user.role !== 'guru') return res.status(403).json({ message: 'Akses ditolak.' })
  try {
    const { nama, kelas, rombel, tanggalLahir } = req.body

    const updateData = {}
    if (nama !== undefined && nama.trim()) updateData.nama = nama.trim()
    if (kelas !== undefined && kelas.trim()) updateData.kelas = kelas.trim()
    if (rombel !== undefined && rombel.trim()) updateData.rombel = rombel.trim()

    if (tanggalLahir) {
      const d = new Date(tanggalLahir)
      if (isNaN(d.getTime())) {
        return res.status(400).json({ message: 'Format tanggal lahir tidak valid.' })
      }
      updateData.tanggalLahir = d

      // Perbarui password sesuai tanggal lahir baru (format: DDMMYYYY)
      const day = d.getUTCDate()
      const month = d.getUTCMonth() + 1
      const year = d.getUTCFullYear()
      const dd = String(day).padStart(2, '0')
      const mm = String(month).padStart(2, '0')
      updateData.password = `${dd}${mm}${year}`
    }

    if (Object.keys(updateData).length === 0) {
      return res.status(400).json({ message: 'Tidak ada data yang diperbarui.' })
    }

    const updatedSiswa = await prisma.siswa.update({
      where: { id: req.params.id },
      data: updateData,
    })

    res.json({ message: 'Data siswa berhasil diperbarui.', siswa: updatedSiswa })
  } catch (error) {
    res.status(500).json({ message: 'Gagal memperbarui data siswa.', error: error.message })
  }
})

// Import Excel sesuai template.
router.post('/import', authMiddleware, upload.single('file'), async (req, res) => {
  if (req.user.role !== 'guru') return res.status(403).json({ message: 'Akses ditolak.' })
  if (!req.file) return res.status(400).json({ message: 'File Excel wajib diunggah.' })

  try {
    const workbook = XLSX.read(req.file.buffer, { type: 'buffer' })
    const firstSheet = workbook.Sheets[workbook.SheetNames[0]]
    const rows = XLSX.utils.sheet_to_json(firstSheet, { defval: '' })
    const headers = XLSX.utils.sheet_to_json(firstSheet, { header: 1 })[0] || []
    const missing = requiredHeaders.filter((header) => !headers.includes(header))
    if (missing.length) return res.status(400).json({ message: `Kolom "${missing[0]}" tidak ditemukan. Silakan gunakan Template Data Siswa.` })

    const data = rows.map((row, index) => {
      const birthParts = parseBirthParts(row['TANGGAL LAHIR'])
      const emptyHeader = requiredHeaders.find((header) => !String(row[header] ?? '').trim())
      if (emptyHeader) throw new Error(`Baris ${index + 2}: kolom "${emptyHeader}" wajib diisi.`)
      if (!birthParts) throw new Error(`Baris ${index + 2}: format TANGGAL LAHIR tidak valid.`)

      const dd = String(birthParts.day).padStart(2, '0')
      const mm = String(birthParts.month).padStart(2, '0')
      const tanggalLahir = new Date(Date.UTC(birthParts.year, birthParts.month - 1, birthParts.day))

      return {
        nama: String(row.NAMA).trim(), kelas: String(row.KELAS).trim(), rombel: String(row.ROMBEL).trim(),
        tanggalLahir, jenisKelamin: String(row['JENIS KELAMIN']).trim(), nis: row.NIS ? String(row.NIS).trim() : null,
        password: `${dd}${mm}${birthParts.year}`,
      }
    })

    await prisma.$transaction([prisma.siswa.deleteMany(), prisma.siswa.createMany({ data })])
    res.json({ message: `${data.length} data siswa berhasil diimpor.`, total: data.length })
  } catch (error) {
    res.status(400).json({ message: error.message || 'Gagal mengimpor file Excel.' })
  }
})

router.get('/template/download', (req, res) => {
  const sheet = XLSX.utils.aoa_to_sheet([requiredHeaders])
  const workbook = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(workbook, sheet, 'Data Siswa')
  const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })
  res.setHeader('Content-Disposition', 'attachment; filename=template-data-siswa.xlsx')
  res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').send(buffer)
})

export default router
