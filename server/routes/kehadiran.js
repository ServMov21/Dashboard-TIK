import express from 'express'
import { PrismaClient } from '@prisma/client'
import authMiddleware from '../middleware/authMiddleware.js'

const prisma = new PrismaClient()
const router = express.Router()

// POST /api/kehadiran - Save/update attendance bulk
router.post('/', authMiddleware, async (req, res) => {
  if (req.user.role !== 'guru') {
    return res.status(403).json({ message: 'Akses ditolak.' })
  }
  try {
    const { data } = req.body // Array of { siswaId, tanggal, status, keterangan }
    if (!Array.isArray(data)) {
      return res.status(400).json({ message: 'Data harus berupa array.' })
    }

    const results = []
    for (const item of data) {
      const { siswaId, tanggal, status, keterangan } = item
      const dateOnly = new Date(new Date(tanggal).setHours(0, 0, 0, 0))

      const record = await prisma.kehadiran.upsert({
        where: {
          siswaId_tanggal: {
            siswaId,
            tanggal: dateOnly
          }
        },
        update: {
          status,
          keterangan: keterangan || null
        },
        create: {
          siswaId,
          tanggal: dateOnly,
          status,
          keterangan: keterangan || null
        }
      })
      results.push(record)
    }

    res.json({ message: 'Kehadiran berhasil disimpan.', count: results.length })
  } catch (error) {
    res.status(500).json({ message: 'Gagal menyimpan kehadiran.', error: error.message })
  }
})

// GET /api/kehadiran/rekap - Rekap kehadiran bulanan per kelas & rombel
router.get('/rekap', authMiddleware, async (req, res) => {
  if (req.user.role !== 'guru') {
    return res.status(403).json({ message: 'Akses ditolak.' })
  }
  try {
    const { kelas, rombel, bulan } = req.query // bulan format: YYYY-MM
    if (!kelas || !rombel || !bulan) {
      return res.status(400).json({ message: 'Kelas, rombel, dan bulan (YYYY-MM) wajib diisi.' })
    }

    const [yearStr, monthStr] = bulan.split('-')
    const year = parseInt(yearStr)
    const month = parseInt(monthStr) - 1

    const startDate = new Date(year, month, 1)
    const endDate = new Date(year, month + 1, 0, 23, 59, 59, 999)

    const siswaList = await prisma.siswa.findMany({
      where: { kelas, rombel },
      orderBy: { nama: 'asc' },
      select: { id: true, nama: true }
    })

    const dataKehadiran = await prisma.kehadiran.findMany({
      where: {
        siswaId: { in: siswaList.map(s => s.id) },
        tanggal: {
          gte: startDate,
          lte: endDate
        }
      }
    })

    // Map data
    const recordsBySiswa = {}
    siswaList.forEach(s => {
      recordsBySiswa[s.id] = {
        id: s.id,
        nama: s.nama,
        HADIR: 0,
        IZIN: 0,
        SAKIT: 0,
        ALPA: 0,
        details: {} // tanggal -> status
      }
    })

    dataKehadiran.forEach(k => {
      const sId = k.siswaId
      if (recordsBySiswa[sId]) {
        const day = new Date(k.tanggal).getDate()
        recordsBySiswa[sId].details[day] = k.status
        recordsBySiswa[sId][k.status]++
      }
    })

    res.json({
      daysInMonth: endDate.getDate(),
      rekap: Object.values(recordsBySiswa)
    })
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil rekap kehadiran.', error: error.message })
  }
})

export default router
