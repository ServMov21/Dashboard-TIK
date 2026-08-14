import express from 'express'
import { getXpConfig, computeXpComponents } from '../utils/xpEngine.js'
import multer from 'multer'
import { PrismaClient } from '@prisma/client'
import { catatAktivitas, JENIS_AKTIVITAS } from '../services/activityService.js'
import authMiddleware from '../middleware/authMiddleware.js'
import path from 'path'
import fs from 'fs/promises'
import XLSX from 'xlsx'
import { isOfficePreviewable, convertOfficeFileToHtml } from '../utils/officePreview.js'

const prisma = new PrismaClient()
const router = express.Router()

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 50 * 1024 * 1024 } })

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

// Upload tugas
router.post('/upload', authMiddleware, upload.single('file'), async (req, res) => {
  if (req.user.role !== 'siswa') {
    return res.status(403).json({ message: 'Hanya untuk siswa.' })
  }
  try {
    const { tugasId } = req.body
    const file = req.file

    if (!file) return res.status(400).json({ message: 'Tidak ada file diunggah.' })

    const siswa = await prisma.siswa.findUnique({ where: { id: req.user.id } })
    const tugas = await prisma.tugas.findUnique({ where: { id: tugasId } })
    if (!tugas) return res.status(404).json({ message: 'Tugas tidak ditemukan.' })
    if (tugas.status === 'ditutup') {
      return res.status(403).json({ message: 'Tugas ini sudah ditutup oleh guru. Kamu tidak bisa mengirim jawaban lagi.' })
    }
    if (tugas.status === 'draft') {
      return res.status(403).json({ message: 'Tugas ini belum dibuka oleh guru.' })
    }
    const settings = await prisma.pengaturan.findFirst() || { baseDir: './storage' }

    const ext = path.extname(file.originalname)
    const cleanSiswaName = siswa.nama.replace(/[^a-zA-Z0-9]/g, '_')
    const finalFilename = `${cleanSiswaName}${ext}`

    const kelasFolder = `${siswa.kelas}${siswa.rombel}`
    const tugasFolder = safeName(tugas.judul)
    const pattern = settings.submissionFolderPattern || 'KELAS_ROMBEL/NAMA_TUGAS'

    let destination
    switch (pattern) {
      case 'NAMA_TUGAS/KELAS_ROMBEL':
        destination = path.join(settings.baseDir, 'PengumpulanTugas', tugasFolder, kelasFolder)
        break
      case 'KELAS_ROMBEL/NAMA_TUGAS':
      default:
        destination = path.join(settings.baseDir, 'PengumpulanTugas', kelasFolder, tugasFolder)
        break
    }

    await fs.mkdir(destination, { recursive: true })
    const duplicateMode = settings.duplicateFileHandling || 'RENAME_INCREMENT'

    let finalPath
    if (duplicateMode === 'REPLACE') {
      finalPath = path.join(destination, finalFilename)
    } else {
      finalPath = await uniqueFilePath(destination, finalFilename)
    }

    await fs.writeFile(finalPath, file.buffer)

    const duplicateLabel = duplicateMode === 'REPLACE' ? 'diperbarui' : 'ditambahkan'

    // Replace
    const existing = await prisma.pengumpulan.findFirst({
      where: { tugasId, siswaId: req.user.id },
    })

    if (existing) {
      // Hanya hapus file lama jika mode REPLACE.
      // Pada mode RENAME_INCREMENT, file baru sudah punya nama unik (mis. "nama (1).pdf"),
      // jadi file lama harus tetap disimpan, bukan dihapus.
      if (duplicateMode === 'REPLACE' && existing.path !== finalPath) {
        try { await fs.unlink(existing.path) } catch (err) {}
      }

      const updated = await prisma.pengumpulan.update({
        where: { id: existing.id },
        data: { namaFile: path.basename(finalPath), path: finalPath, ukuran: file.size },
      })
      req.app.get('io').emit('pengumpulan-update', updated)
      // Log aktivitas UPLOAD
      await catatAktivitas({
        siswaId: req.user.id,
        tugasId: tugas.id,
        jenis: JENIS_AKTIVITAS.UPLOAD,
        deskripsi: `Mengunggah ulang file ${path.basename(finalPath)}`,
        io: req.app.get('io')
      })
      return res.json({ message: `File berhasil ${duplicateLabel}.`, data: updated })
    }

    // Hitung xpBase dan xpEarly saat pertama kali upload
    const xpCfg = await getXpConfig(prisma)
    const isEarly = tugas.deadline && new Date() < new Date(tugas.deadline)
    const xpBase = xpCfg.xpBase
    const xpEarly = isEarly ? xpCfg.xpEarly : 0
    const xpTotal = xpBase + xpEarly

    const pengumpulan = await prisma.pengumpulan.create({
      data: {
        tugasId, siswaId: req.user.id, namaFile: path.basename(finalPath), path: finalPath, ukuran: file.size,
        xpBase, xpEarly, xpTotal,
      },
    })

    // Kolaborasi: Cek dan duplikasi ke partner
    const collab = await prisma.collabTugas.findFirst({
      where: { tugasId, OR: [{ siswa1Id: req.user.id }, { siswa2Id: req.user.id }] }
    })
    if (collab) {
      const partnerId = collab.siswa1Id === req.user.id ? collab.siswa2Id : collab.siswa1Id
      const partnerPengumpulan = await prisma.pengumpulan.findFirst({ where: { tugasId, siswaId: partnerId } })
      if (partnerPengumpulan) {
        await prisma.pengumpulan.update({
          where: { id: partnerPengumpulan.id },
          data: { namaFile: path.basename(finalPath), path: finalPath, ukuran: file.size, xpBase, xpEarly, xpTotal }
        })
      } else {
        await prisma.pengumpulan.create({
          data: { tugasId, siswaId: partnerId, namaFile: path.basename(finalPath), path: finalPath, ukuran: file.size, xpBase, xpEarly, xpTotal }
        })
      }
    }

    req.app.get('io').emit('pengumpulan-baru', pengumpulan)
    // Log aktivitas UPLOAD
    await catatAktivitas({
      siswaId: req.user.id,
      tugasId: tugas.id,
      jenis: JENIS_AKTIVITAS.UPLOAD,
      deskripsi: `Mengunggah file ${path.basename(finalPath)}`,
      io: req.app.get('io')
    })
    res.status(201).json({ message: 'Tugas berhasil diunggah.', data: pengumpulan })
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengunggah tugas.', error: error.message })
  }
})

// GET pengumpulan milik siswa yang sedang login untuk suatu tugas
router.get('/saya/:tugasId', authMiddleware, async (req, res) => {
  if (req.user.role !== 'siswa') {
    return res.status(403).json({ message: 'Hanya untuk siswa.' })
  }
  try {
    const { tugasId } = req.params
    const pengumpulan = await prisma.pengumpulan.findFirst({
      where: { tugasId, siswaId: req.user.id },
    })
    res.json(pengumpulan)
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil status pengumpulan.', error: error.message })
  }
})

// Preview file pengumpulan (inline) - siswa hanya boleh lihat miliknya sendiri, guru boleh lihat semua
router.get('/view/:pengumpulanId', authMiddleware, async (req, res) => {
  try {
    const p = await prisma.pengumpulan.findUnique({ where: { id: req.params.pengumpulanId } })
    if (!p) return res.status(404).json({ message: 'File tidak ditemukan.' })

    if (req.user.role === 'siswa' && p.siswaId !== req.user.id) {
      return res.status(403).json({ message: 'Akses ditolak.' })
    }

    const filePath = path.resolve(p.path)
    try {
      await fs.access(filePath)
    } catch {
      return res.status(404).json({ message: 'File tidak ditemukan di server.' })
    }

    const ext = path.extname(p.namaFile).toLowerCase()
    const mimeTypes = {
      '.pdf': 'application/pdf',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.gif': 'image/gif',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.mov': 'video/quicktime',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.ppt': 'application/vnd.ms-powerpoint',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      '.zip': 'application/zip',
      '.rar': 'application/x-rar-compressed',
    }
    const mime = mimeTypes[ext] || 'application/octet-stream'
    res.setHeader('Content-Type', mime)
    res.setHeader('Content-Disposition', `inline; filename="${path.basename(p.path)}"`)
    res.sendFile(filePath)
  } catch (error) {
    res.status(500).json({ message: 'Gagal memuat file.', error: error.message })
  }
})

// Preview file DOCX/XLSX sebagai HTML (supaya bisa dipratinjau di browser tanpa
// perlu didownload dulu) - siswa hanya boleh lihat miliknya sendiri, guru boleh lihat semua
router.get('/preview-html/:pengumpulanId', authMiddleware, async (req, res) => {
  try {
    const p = await prisma.pengumpulan.findUnique({ where: { id: req.params.pengumpulanId } })
    if (!p) return res.status(404).json({ message: 'File tidak ditemukan.' })
    if (req.user.role === 'siswa' && p.siswaId !== req.user.id) {
      return res.status(403).json({ message: 'Akses ditolak.' })
    }
    if (!isOfficePreviewable(p.namaFile)) {
      return res.status(400).json({ message: 'Tipe file ini tidak memerlukan konversi pratinjau.' })
    }
    const filePath = path.resolve(p.path)
    try { await fs.access(filePath) } catch { return res.status(404).json({ message: 'File tidak ditemukan di server.' }) }

    const { type, html } = await convertOfficeFileToHtml(filePath, p.namaFile)
    res.json({ type, html })
  } catch (error) {
    res.status(500).json({ message: 'Gagal membuat pratinjau file. Silakan download file untuk melihatnya.', error: error.message })
  }
})

// GET status pengumpulan untuk suatu tugas
router.get('/status/:tugasId', authMiddleware, async (req, res) => {
  if (req.user.role !== 'guru') return res.status(403).json({ message: 'Akses ditolak.' })
  try {
    const { tugasId } = req.params
    const tugas = await prisma.tugas.findUnique({ where: { id: tugasId } })
    if (!tugas) return res.status(404).json({ message: 'Tugas tidak ditemukan.' })

    let kelasTarget = []
    try {
      kelasTarget = JSON.parse(tugas.kelasTarget || '[]')
    } catch (err) {
      kelasTarget = []
    }

    let rombelTarget = []
    try {
      rombelTarget = tugas.rombelTarget ? JSON.parse(tugas.rombelTarget || '[]') : []
    } catch (err) {
      rombelTarget = []
    }

    const allSiswa = await prisma.siswa.findMany({
      where: {
        ...(kelasTarget.length ? { kelas: { in: kelasTarget } } : {}),
        ...(rombelTarget.length ? { rombel: { in: rombelTarget } } : {}),
      },
    })
    const sudahMengumpulkan = await prisma.pengumpulan.findMany({
      where: { tugasId },
      include: { siswa: { select: { nama: true, kelas: true, rombel: true } } },
    })

    const statusSiswa = allSiswa.map((s) => {
      const p = sudahMengumpulkan.find((p) => p.siswaId === s.id)
      return {
        id: s.id,
        siswaId: s.id,
        pengumpulanId: p ? p.id : null,
        tugasId,
        nama: s.nama,
        kelas: s.kelas,
        rombel: s.rombel,
        sudahUpload: !!p,
        jamUpload: p ? p.updatedAt : null,
        namaFile: p ? p.namaFile : null,
        ukuran: p ? p.ukuran : null,
        path: p ? p.path : null,
        xpBonus: p ? p.xpBonus : 0,
        xpTotal: p ? p.xpTotal : 0,
        nilai: p ? p.nilai : null,
        keterangan: p ? p.keterangan : null,
      }
    })
    res.json(statusSiswa)
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil status.', error: error.message })
  }
})

// PUT /nilai/:id — Guru memberikan nilai dan keterangan pada pengumpulan siswa
router.put('/nilai/:id', authMiddleware, async (req, res) => {
  if (req.user.role !== 'guru') return res.status(403).json({ message: 'Akses ditolak.' })
  try {
    const { nilai, keterangan } = req.body
    const updateData = {}
    let nilaiVal = null
    if (nilai !== undefined) {
      const n = parseFloat(nilai)
      if (isNaN(n) || n < 0 || n > 100) return res.status(400).json({ message: 'Nilai harus antara 0 dan 100.' })
      updateData.nilai = n
      nilaiVal = n
    }
    if (keterangan !== undefined) updateData.keterangan = String(keterangan).trim() || null

    // Hitung ulang komponen XP saat nilai diset
    if (nilaiVal !== null) {
      const xpCfg = await getXpConfig(prisma)
      const existing = await prisma.pengumpulan.findUnique({ where: { id: req.params.id }, include: { tugas: true } })
      if (existing) {
        const { xpNilai, xpEarly, xpPerfect } = computeXpComponents(xpCfg, {
          nilai: nilaiVal, deadline: existing.tugas?.deadline, waktuKumpul: existing.createdAt,
        })
        updateData.xpNilai = xpNilai
        updateData.xpEarly = xpEarly
        updateData.xpPerfect = xpPerfect
        updateData.xpTotal = Math.round(((existing.xpBase || 0) + xpNilai + xpEarly + xpPerfect + (existing.xpBonus || 0)) * 10) / 10
      }
    }

    const updated = await prisma.pengumpulan.update({ where: { id: req.params.id }, data: updateData })
    res.json({ message: 'Nilai berhasil disimpan.', pengumpulan: updated })
  } catch (error) {
    res.status(500).json({ message: 'Gagal menyimpan nilai.', error: error.message })
  }
})

// GET status pengumpulan gabungan untuk satu batch tugas (semua kelas/rombel
// yang dibuat dalam satu kali "Tambah Tugas" akan dihitung sebagai satu kesatuan)
router.get('/status-batch/:batchId', authMiddleware, async (req, res) => {
  if (req.user.role !== 'guru') return res.status(403).json({ message: 'Akses ditolak.' })
  try {
    const { batchId } = req.params
    const tugasRows = await prisma.tugas.findMany({ where: { batchId } })
    if (!tugasRows.length) return res.status(404).json({ message: 'Tugas tidak ditemukan.' })

    let statusSiswa = []
    for (const tugas of tugasRows) {
      let kelasTarget = []
      try { kelasTarget = JSON.parse(tugas.kelasTarget || '[]') } catch { kelasTarget = [] }
      let rombelTarget = []
      try { rombelTarget = tugas.rombelTarget ? JSON.parse(tugas.rombelTarget || '[]') : [] } catch { rombelTarget = [] }

      const allSiswa = await prisma.siswa.findMany({
        where: {
          ...(kelasTarget.length ? { kelas: { in: kelasTarget } } : {}),
          ...(rombelTarget.length ? { rombel: { in: rombelTarget } } : {}),
        },
      })
      const sudahMengumpulkan = await prisma.pengumpulan.findMany({
        where: { tugasId: tugas.id },
      })

      statusSiswa = statusSiswa.concat(allSiswa.map((s) => {
        const p = sudahMengumpulkan.find((p) => p.siswaId === s.id)
        return {
          id: s.id,
          siswaId: s.id,
          pengumpulanId: p ? p.id : null,
          tugasId: tugas.id,
          nama: s.nama,
          kelas: s.kelas,
          rombel: s.rombel,
          sudahUpload: !!p,
          jamUpload: p ? p.updatedAt : null,
          namaFile: p ? p.namaFile : null,
          ukuran: p ? p.ukuran : null,
        }
      }))
    }

    res.json({
      judul: tugasRows[0].judul,
      batchId,
      tugasIds: tugasRows.map((t) => t.id),
      siswa: statusSiswa,
    })
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil status.', error: error.message })
  }
})

// Export Excel rekap pengumpulan
router.get('/export/:tugasId', authMiddleware, async (req, res) => {
  if (req.user.role !== 'guru') return res.status(403).json({ message: 'Akses ditolak.' })
  try {
    const { tugasId } = req.params
    const tugas = await prisma.tugas.findUnique({ where: { id: tugasId } })
    if (!tugas) return res.status(404).json({ message: 'Tugas tidak ditemukan.' })

    let kelasTarget = []
    try {
      kelasTarget = JSON.parse(tugas.kelasTarget || '[]')
    } catch (err) {
      kelasTarget = []
    }

    let rombelTarget = []
    try {
      rombelTarget = tugas.rombelTarget ? JSON.parse(tugas.rombelTarget || '[]') : []
    } catch (err) {
      rombelTarget = []
    }

    const allSiswa = await prisma.siswa.findMany({
      where: {
        ...(kelasTarget.length ? { kelas: { in: kelasTarget } } : {}),
        ...(rombelTarget.length ? { rombel: { in: rombelTarget } } : {}),
      },
    })
    const sudahMengumpulkan = await prisma.pengumpulan.findMany({
      where: { tugasId },
      include: { siswa: { select: { nama: true, kelas: true, rombel: true } } },
    })

    const statusSiswa = allSiswa.map((s) => {
      const p = sudahMengumpulkan.find((p) => p.siswaId === s.id)
      return {
        Nama: s.nama,
        Kelas: s.kelas,
        Rombel: s.rombel,
        Status: !!p ? 'Sudah' : 'Belum',
        'Nama File': p ? p.namaFile : '-',
        'Jam Upload': p ? new Date(p.updatedAt).toLocaleString('id-ID') : '-',
      }
    })

    const worksheet = XLSX.utils.json_to_sheet(statusSiswa)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Rekap Pengumpulan')
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

    res.setHeader('Content-Disposition', `attachment; filename=rekap-${tugas.judul.replace(/ /g, '_')}.xlsx`)
    res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').send(buffer)
  } catch (error) {
    res.status(500).json({ message: 'Gagal export data.', error: error.message })
  }
})

// Export Excel rekap pengumpulan gabungan (satu batch tugas / satu assignment)
router.get('/export-batch/:batchId', authMiddleware, async (req, res) => {
  if (req.user.role !== 'guru') return res.status(403).json({ message: 'Akses ditolak.' })
  try {
    const { batchId } = req.params
    const tugasRows = await prisma.tugas.findMany({ where: { batchId } })
    if (!tugasRows.length) return res.status(404).json({ message: 'Tugas tidak ditemukan.' })

    let statusSiswa = []
    for (const tugas of tugasRows) {
      let kelasTarget = []
      try { kelasTarget = JSON.parse(tugas.kelasTarget || '[]') } catch { kelasTarget = [] }
      let rombelTarget = []
      try { rombelTarget = tugas.rombelTarget ? JSON.parse(tugas.rombelTarget || '[]') : [] } catch { rombelTarget = [] }

      const allSiswa = await prisma.siswa.findMany({
        where: {
          ...(kelasTarget.length ? { kelas: { in: kelasTarget } } : {}),
          ...(rombelTarget.length ? { rombel: { in: rombelTarget } } : {}),
        },
      })
      const sudahMengumpulkan = await prisma.pengumpulan.findMany({ where: { tugasId: tugas.id } })

      statusSiswa = statusSiswa.concat(allSiswa.map((s) => {
        const p = sudahMengumpulkan.find((p) => p.siswaId === s.id)
        return {
          Nama: s.nama,
          Kelas: s.kelas,
          Rombel: s.rombel,
          Status: p ? 'Sudah' : 'Belum',
          'Nama File': p ? p.namaFile : '-',
          'Jam Upload': p ? new Date(p.updatedAt).toLocaleString('id-ID') : '-',
        }
      }))
    }

    const worksheet = XLSX.utils.json_to_sheet(statusSiswa)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Rekap Pengumpulan')
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

    res.setHeader('Content-Disposition', `attachment; filename=rekap-${tugasRows[0].judul.replace(/ /g, '_')}.xlsx`)
    res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').send(buffer)
  } catch (error) {
    res.status(500).json({ message: 'Gagal export data.', error: error.message })
  }
})

// Download file siswa
router.get('/download/:pengumpulanId', authMiddleware, async (req, res) => {
  if (req.user.role !== 'guru') return res.status(403).json({ message: 'Akses ditolak.' })
  try {
    const p = await prisma.pengumpulan.findUnique({ where: { id: req.params.pengumpulanId } })
    if (!p) return res.status(404).json({ message: 'File tidak ditemukan.' })
    res.download(p.path, p.namaFile)
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengunduh file.', error: error.message })
  }
})

// Hapus hasil pengumpulan tugas milik siswa (khusus guru) - record DB dipindah dulu
// ke "Recently Deleted" (SampahPengumpulan) supaya bisa dipulihkan (restore), file
// fisik TIDAK dihapus (baru dihapus permanen saat guru membersihkan sampah),
// dan record aslinya dihapus dari tabel Pengumpulan supaya siswa yang bersangkutan
// bisa mengumpulkan ulang tugasnya.
router.delete('/:pengumpulanId', authMiddleware, async (req, res) => {
  if (req.user.role !== 'guru') return res.status(403).json({ message: 'Akses ditolak.' })
  try {
    const p = await prisma.pengumpulan.findUnique({
      where: { id: req.params.pengumpulanId },
      include: { siswa: { select: { nama: true } }, tugas: { select: { judul: true } } },
    })
    if (!p) return res.status(404).json({ message: 'Data pengumpulan tidak ditemukan.' })

    await prisma.sampahPengumpulan.create({
      data: {
        jenis: 'file',
        originalId: p.id,
        tugasId: p.tugasId,
        siswaId: p.siswaId,
        tugasJudul: p.tugas?.judul || 'Tugas',
        siswaNama: p.siswa?.nama || '-',
        dataJson: JSON.stringify(p),
      },
    })

    await prisma.pengumpulan.delete({ where: { id: p.id } })

    req.app.get('io').emit('pengumpulan-update', { tugasId: p.tugasId, siswaId: p.siswaId, pengumpulanId: p.id, deleted: true })
    // Log aktivitas
    await catatAktivitas({
      siswaId: p.siswaId,
      tugasId: p.tugasId,
      jenis: JENIS_AKTIVITAS.UPLOAD,
      deskripsi: `Hasil tugas ${p.namaFile} dihapus oleh guru (dipindahkan ke Recently Deleted)`,
      io: req.app.get('io')
    })

    res.json({ message: 'Hasil tugas siswa dihapus & dipindahkan ke Recently Deleted.' })
  } catch (error) {
    res.status(500).json({ message: 'Gagal menghapus hasil tugas.', error: error.message })
  }
})

export default router