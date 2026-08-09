import express from 'express'
import { PrismaClient } from '@prisma/client'
import authMiddleware from '../middleware/authMiddleware.js'

const prisma = new PrismaClient()
const router = express.Router()

// Riwayat tugas milik siswa yang login: menggabungkan tugas yang sudah pernah
// dikumpulkan (file) dan tugas mengetik yang sudah diselesaikan, lengkap dengan
// detail seperti yang dilihat guru di halaman detail tugas.
router.get('/', authMiddleware, async (req, res) => {
  if (req.user.role !== 'siswa') return res.status(403).json({ message: 'Hanya untuk siswa.' })
  try {
    const siswaId = req.user.id

    const fileSubs = await prisma.pengumpulan.findMany({
      where: { siswaId },
      include: { tugas: true },
      orderBy: { updatedAt: 'desc' },
    })

    const typingSubs = await prisma.pengumpulanMengetik.findMany({
      where: { siswaId, status: 'selesai' },
      include: { tugas: true },
      orderBy: { waktuSelesai: 'desc' },
    })

    const riwayat = [
      ...fileSubs.filter((s) => s.tugas).map((s) => ({
        id: `file-${s.id}`,
        tipe: 'file',
        tugasId: s.tugasId,
        judul: s.tugas.judul,
        jenis: s.tugas.jenis,
        statusTugas: s.tugas.status,
        deadline: s.tugas.deadline,
        waktu: s.updatedAt,
        namaFile: s.namaFile,
        ukuran: s.ukuran,
        pengumpulanId: s.id,
      })),
      ...typingSubs.filter((s) => s.tugas).map((s) => ({
        id: `mengetik-${s.id}`,
        tipe: 'mengetik',
        tugasId: s.tugasId,
        judul: s.tugas.judul,
        jenis: s.tugas.jenis,
        statusTugas: s.tugas.status,
        deadline: s.tugas.deadline,
        waktu: s.waktuSelesai,
        hasilKetik: s.hasilKetik,
        durasiDetik: s.durasiDetik,
        skorKebenaran: s.skorKebenaran,
        skorKecepatan: s.skorKecepatan,
        skorTotal: s.skorTotal,
      })),
    ].sort((a, b) => new Date(b.waktu) - new Date(a.waktu))

    res.json(riwayat)
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil riwayat tugas.', error: error.message })
  }
})

export default router
