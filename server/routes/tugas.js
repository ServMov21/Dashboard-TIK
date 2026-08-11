import express from 'express'
import multer from 'multer'
import { PrismaClient } from '@prisma/client'
import authMiddleware from '../middleware/authMiddleware.js'
import path from 'path'
import fs from 'fs/promises'
import crypto from 'crypto'
import { applyPenaltiTidakKumpul } from '../utils/xpEngine.js'
import { isOfficePreviewable, convertOfficeFileToHtml } from '../utils/officePreview.js'

const prisma = new PrismaClient()
const router = express.Router()
const upload = multer({ dest: './storage/temp' })

function normalizeArray(value) {
  if (!value) return []
  if (Array.isArray(value)) return value
  try {
    const parsed = JSON.parse(value)
    return Array.isArray(parsed) ? parsed : [String(parsed)]
  } catch (err) {
    return [String(value)]
  }
}

// Bobot penilaian default tugas mengetik. Total selalu 100.
const DEFAULT_BOBOT_KEBENARAN = 90
const DEFAULT_BOBOT_KECEPATAN = 10

function parseBobotKebenaran(rawValue) {
  if (rawValue === undefined || rawValue === null || rawValue === '') {
    return { bobotKebenaran: null, bobotKecepatan: null }
  }
  const angka = Number(rawValue)
  if (Number.isNaN(angka)) {
    return { bobotKebenaran: null, bobotKecepatan: null }
  }
  const bobotKebenaran = Math.min(100, Math.max(0, Math.round(angka * 10) / 10))
  const bobotKecepatan = Math.round((100 - bobotKebenaran) * 10) / 10
  return { bobotKebenaran, bobotKecepatan }
}

// GET semua tugas (untuk Guru)
router.get('/', authMiddleware, async (req, res) => {
  if (req.user.role !== 'guru') {
    return res.status(403).json({ message: 'Akses ditolak.' })
  }
  try {
    const tugas = await prisma.tugas.findMany({
      include: {
        _count: {
          select: { pengumpulan: true, pengumpulanMengetik: true },
        },
        lampiran: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    const tugasWithProgress = await Promise.all(tugas.map(async (tugas) => {
      const kelasTarget = JSON.parse(tugas.kelasTarget || '[]')
      const rombelTarget = tugas.rombelTarget ? JSON.parse(tugas.rombelTarget || '[]') : []

      const rombelGroups = {}
      if (rombelTarget.length === 0) {
        const siswaList = await prisma.siswa.findMany({
          where: { kelas: { in: kelasTarget } }
        })
        siswaList.forEach(s => {
          const key = `${s.kelas}${s.rombel}`
          if (!rombelGroups[key]) rombelGroups[key] = { kelas: s.kelas, rombel: s.rombel, total: 0 }
          rombelGroups[key].total++
        })
      } else {
        for (const rombel of rombelTarget) {
          for (const kelas of kelasTarget) {
            const key = `${kelas}${rombel}`
            const count = await prisma.siswa.count({
              where: { kelas, rombel }
            })
            if (count > 0) {
              rombelGroups[key] = { kelas, rombel, total: count }
            }
          }
        }
      }

      let pengumpulanPerRombel = {}
      let totalTerkumpul = 0
      if (tugas.jenis === 'mengetik') {
        const hasilMengetik = await prisma.pengumpulanMengetik.findMany({
          where: { tugasId: tugas.id, status: 'selesai' },
          include: { siswa: { select: { kelas: true, rombel: true } } },
        })
        hasilMengetik.forEach(p => {
          const key = `${p.siswa.kelas}${p.siswa.rombel}`
          pengumpulanPerRombel[key] = (pengumpulanPerRombel[key] || 0) + 1
        })
        totalTerkumpul = hasilMengetik.length
      } else {
        const pengumpulan = await prisma.pengumpulan.findMany({
          where: { tugasId: tugas.id },
          include: { siswa: { select: { kelas: true, rombel: true } } }
        })
        pengumpulan.forEach(p => {
          const key = `${p.siswa.kelas}${p.siswa.rombel}`
          pengumpulanPerRombel[key] = (pengumpulanPerRombel[key] || 0) + 1
        })
        totalTerkumpul = pengumpulan.length
      }

      const rombelProgress = Object.keys(rombelGroups).map(key => ({
        key,
        kelas: rombelGroups[key].kelas,
        rombel: rombelGroups[key].rombel,
        total: rombelGroups[key].total,
        collected: pengumpulanPerRombel[key] || 0,
        percent: rombelGroups[key].total > 0 ? Math.round((pengumpulanPerRombel[key] || 0) / rombelGroups[key].total * 100) : 0
      }))

      return { ...tugas, rombelProgress, totalTerkumpul }
    }))

    res.json(tugasWithProgress)
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil data tugas.', error: error.message })
  }
})

// GET tugas untuk siswa
router.get('/siswa', authMiddleware, async (req, res) => {
  if (req.user.role !== 'siswa') {
    return res.status(403).json({ message: 'Hanya untuk siswa.' })
  }
  try {
    const siswa = await prisma.siswa.findUnique({ where: { id: req.user.id } })
    const allTugas = await prisma.tugas.findMany({
      where: { status: { in: ['launch', 'ditutup'] } },
      orderBy: { deadline: 'asc' },
    })

    const tugas = allTugas.filter((t) => {
      const kelasTarget = JSON.parse(t.kelasTarget || '[]')
      const rombelTarget = t.rombelTarget ? JSON.parse(t.rombelTarget || '[]') : []
      const kelasMatch = kelasTarget.includes(siswa.kelas)
      const rombelMatch = rombelTarget.length === 0 || rombelTarget.includes(siswa.rombel)
      return kelasMatch && rombelMatch
    })
    res.json(tugas)
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil tugas siswa.', error: error.message })
  }
})

router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const tugas = await prisma.tugas.findUnique({
      where: { id: req.params.id },
      include: { lampiran: true },
    })
    if (!tugas) {
      return res.status(404).json({ message: 'Tugas tidak ditemukan.' })
    }

    if (req.user.role === 'siswa') {
      try {
        await prisma.aktivitasSiswa.create({
          data: {
            siswaId: req.user.id,
            tugasId: tugas.id,
            jenis: 'BUKA_TUGAS',
          }
        })
      } catch (e) {
        console.error('Gagal log aktivitas buka tugas:', e)
      }
    }

    res.json(tugas)
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil detail tugas.', error: error.message })
  }
})

// Preview lampiran (inline)
router.get('/lampiran/:id/view', authMiddleware, async (req, res) => {
  try {
    const lampiran = await prisma.lampiranTugas.findUnique({
      where: { id: req.params.id },
      include: { tugas: true }
    })
    if (!lampiran) {
      return res.status(404).json({ message: 'File tidak ditemukan.' })
    }
    const filePath = path.resolve(lampiran.path)
    try {
      await fs.access(filePath)
    } catch {
      return res.status(404).json({ message: 'File tidak ditemukan di server.' })
    }

    const ext = path.extname(lampiran.namaFile).toLowerCase()
    const mimeTypes = {
      '.pdf': 'application/pdf',
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
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
    res.setHeader('Content-Disposition', `inline; filename="${path.basename(lampiran.path)}"`)
    res.sendFile(filePath)
  } catch (error) {
    res.status(500).json({ message: 'Gagal memuat file.', error: error.message })
  }
})

// Preview lampiran DOCX/XLSX sebagai HTML (supaya bisa dipratinjau di browser
// tanpa perlu didownload dulu)
router.get('/lampiran/:id/preview-html', authMiddleware, async (req, res) => {
  try {
    const lampiran = await prisma.lampiranTugas.findUnique({ where: { id: req.params.id } })
    if (!lampiran) return res.status(404).json({ message: 'File tidak ditemukan.' })
    if (!isOfficePreviewable(lampiran.namaFile)) {
      return res.status(400).json({ message: 'Tipe file ini tidak memerlukan konversi pratinjau.' })
    }
    const filePath = path.resolve(lampiran.path)
    try { await fs.access(filePath) } catch { return res.status(404).json({ message: 'File tidak ditemukan di server.' }) }

    const { type, html } = await convertOfficeFileToHtml(filePath, lampiran.namaFile)
    res.json({ type, html })
  } catch (error) {
    res.status(500).json({ message: 'Gagal membuat pratinjau file. Silakan download file untuk melihatnya.', error: error.message })
  }
})

// Download lampiran
router.get('/lampiran/:id/download', authMiddleware, async (req, res) => {
  try {
    const lampiran = await prisma.lampiranTugas.findUnique({
      where: { id: req.params.id },
      include: { tugas: true }
    })
    if (!lampiran) {
      return res.status(404).json({ message: 'File tidak ditemukan.' })
    }
    const filePath = path.resolve(lampiran.path)
    try {
      await fs.access(filePath)
    } catch {
      return res.status(404).json({ message: 'File tidak ditemukan di server.' })
    }
    res.download(filePath, lampiran.namaFile)
  } catch (error) {
    res.status(500).json({ message: 'Gagal mendownload file.', error: error.message })
  }
})

// POST tugas baru (Guru)
router.post('/', authMiddleware, upload.array('lampiran', 5), async (req, res) => {
  if (req.user.role !== 'guru') {
    return res.status(403).json({ message: 'Akses ditolak.' })
  }
  try {
    const { judul, deskripsi, jenis, deadline, status, naskahMengetik, bobotKebenaran } = req.body

    const bobot = jenis === 'mengetik' ? parseBobotKebenaran(bobotKebenaran) : { bobotKebenaran: null, bobotKecepatan: null }

    const kelasTarget = normalizeArray(req.body.kelasTarget)
    const rombelTarget = normalizeArray(req.body.rombelTarget)

    let rombelTargets = []
    if (rombelTarget.length > 0) {
      rombelTarget.forEach(rombel => {
        kelasTarget.forEach(kelas => {
          rombelTargets.push({ kelas, rombel })
        })
      })
    } else {
      const siswaList = await prisma.siswa.findMany({
        where: { kelas: { in: kelasTarget } },
        select: { kelas: true, rombel: true },
        distinct: ['kelas', 'rombel']
      })
      rombelTargets = siswaList
    }

    const batchId = crypto.randomUUID()
    const createdTasks = []
    for (const target of rombelTargets) {
      const newTugas = await prisma.tugas.create({
        data: {
          judul,
          deskripsi,
          jenis,
          deadline: deadline ? new Date(deadline) : null,
          status: status || 'draft',
          kelasTarget: JSON.stringify([target.kelas]),
          rombelTarget: JSON.stringify([target.rombel]),
          batchId,
          naskahMengetik: jenis === 'mengetik' ? (naskahMengetik || '') : null,
          bobotKebenaran: bobot.bobotKebenaran,
          bobotKecepatan: bobot.bobotKecepatan,
          lampiran: {
            create: jenis === 'mengetik' ? [] : req.files.map((file) => ({
              namaFile: file.originalname,
              path: file.path,
            })),
          },
        },
      })
      createdTasks.push({ ...newTugas, targetRombel: target })
    }

    res.status(201).json({ message: 'Tugas berhasil dibuat.', tugas: createdTasks })
  } catch (error) {
    res.status(500).json({ message: 'Gagal membuat tugas.', error: error.message })
  }
})

// CLONE tugas ke kelas lain
router.post('/:id/clone', authMiddleware, async (req, res) => {
  if (req.user.role !== 'guru') return res.status(403).json({ message: 'Akses ditolak.' })
  try {
    const original = await prisma.tugas.findUnique({
      where: { id: req.params.id },
      include: { lampiran: true }
    })
    if (!original) return res.status(404).json({ message: 'Tugas tidak ditemukan.' })

    const kelasTarget = normalizeArray(req.body.kelasTarget)
    if (kelasTarget.length === 0) return res.status(400).json({ message: 'Pilih minimal 1 kelas target.' })

    const rombelTarget = normalizeArray(req.body.rombelTarget)

    let rombelTargets = []
    if (rombelTarget.length > 0) {
      rombelTarget.forEach(rombel => {
        kelasTarget.forEach(kelas => {
          rombelTargets.push({ kelas, rombel })
        })
      })
    } else {
      const siswaList = await prisma.siswa.findMany({
        where: { kelas: { in: kelasTarget } },
        select: { kelas: true, rombel: true },
        distinct: ['kelas', 'rombel']
      })
      rombelTargets = siswaList
    }

    if (rombelTargets.length === 0) {
      return res.status(400).json({ message: 'Tidak ada siswa ditemukan di kelas yang dipilih.' })
    }

    const batchId = crypto.randomUUID()
    const createdTasks = []

    for (const target of rombelTargets) {
      const newTugas = await prisma.tugas.create({
        data: {
          judul: `${original.judul} (Salinan)`,
          deskripsi: original.deskripsi,
          jenis: original.jenis,
          deadline: original.deadline,
          status: 'draft',
          kelasTarget: JSON.stringify([target.kelas]),
          rombelTarget: JSON.stringify([target.rombel]),
          batchId,
          naskahMengetik: original.naskahMengetik,
          bobotKebenaran: original.bobotKebenaran,
          bobotKecepatan: original.bobotKecepatan,
          lampiran: {
            create: original.lampiran.map(l => ({
              namaFile: l.namaFile,
              path: l.path,
            }))
          }
        }
      })
      createdTasks.push({ ...newTugas, targetRombel: target })
    }

    res.status(201).json({ message: 'Tugas berhasil disalin.', count: createdTasks.length, tugas: createdTasks })
  } catch (error) {
    res.status(500).json({ message: 'Gagal menyalin tugas.', error: error.message })
  }
})

// UPDATE tugas — mendukung multipart (edit penuh) & JSON (ubah status)
router.put('/:id', authMiddleware, upload.array('lampiran', 5), async (req, res) => {
  if (req.user.role !== 'guru') return res.status(403).json({ message: 'Akses ditolak.' })
  try {
    const { judul, deskripsi, deadline, status, kelasTarget, rombelTarget, naskahMengetik, bobotKebenaran, keepLampiranIds } = req.body
    const bobot = bobotKebenaran !== undefined ? parseBobotKebenaran(bobotKebenaran) : null

    // Kelola lampiran hanya jika ini adalah edit penuh (judul dikirim)
    const isFullEdit = judul !== undefined

    if (isFullEdit) {
      const existingLampiran = await prisma.lampiranTugas.findMany({ where: { tugasId: req.params.id } })

      // Tentukan ID lampiran yang tetap dipertahankan
      const keepIds = keepLampiranIds !== undefined
        ? normalizeArray(keepLampiranIds)
        : existingLampiran.map(l => l.id)

      // Hapus lampiran yang dihilangkan guru
      const toDelete = existingLampiran.filter(l => !keepIds.includes(l.id))
      for (const lamp of toDelete) {
        try { await fs.unlink(path.resolve(lamp.path)) } catch { /* abaikan jika file sudah hilang */ }
        await prisma.lampiranTugas.delete({ where: { id: lamp.id } })
      }

      // Tambah lampiran baru jika ada file yang diunggah
      if (req.files && req.files.length > 0) {
        await prisma.lampiranTugas.createMany({
          data: req.files.map(file => ({
            tugasId: req.params.id,
            namaFile: file.originalname,
            path: file.path,
          }))
        })
      }
    }

    const updatedTugas = await prisma.tugas.update({
      where: { id: req.params.id },
      data: {
        ...(judul !== undefined && { judul }),
        ...(deskripsi !== undefined && { deskripsi }),
        ...(deadline !== undefined && { deadline: deadline ? new Date(deadline) : null }),
        ...(status !== undefined && {
          status,
          ...(status === 'launch' && { publishedAt: new Date() }),
          ...(status === 'ditutup' && { closedAt: new Date() }),
        }),
        ...(kelasTarget !== undefined && { kelasTarget: JSON.stringify(normalizeArray(kelasTarget)) }),
        ...(rombelTarget !== undefined && { rombelTarget: JSON.stringify(normalizeArray(rombelTarget)) }),
        ...(naskahMengetik !== undefined && { naskahMengetik }),
        ...(bobot && { bobotKebenaran: bobot.bobotKebenaran, bobotKecepatan: bobot.bobotKecepatan }),
      },
    })

    // Saat tugas ditutup, terapkan penalti XP ke siswa yang belum
    // mengumpulkan/mengerjakan tugas ini (aman dipanggil berulang kali).
    if (status === 'ditutup') {
      applyPenaltiTidakKumpul(prisma, updatedTugas).catch(() => {})
    }

    res.json({ message: 'Tugas berhasil diperbarui.', tugas: updatedTugas })
  } catch (error) {
    res.status(500).json({ message: 'Gagal memperbarui tugas.', error: error.message })
  }
})

// DELETE tugas
router.delete('/:id', authMiddleware, async (req, res) => {
  if (req.user.role !== 'guru') return res.status(403).json({ message: 'Akses ditolak.' })
  try {
    await prisma.tugas.delete({ where: { id: req.params.id } })
    res.json({ message: 'Tugas berhasil dihapus.' })
  } catch (error) {
    res.status(500).json({ message: 'Gagal menghapus tugas.', error: error.message })
  }
})

export default router
