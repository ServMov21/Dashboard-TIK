import express from 'express'
import { PrismaClient } from '@prisma/client'
import fs from 'fs/promises'
import authMiddleware from '../middleware/authMiddleware.js'
import { catatAktivitas, JENIS_AKTIVITAS } from '../services/activityService.js'

const prisma = new PrismaClient()
const router = express.Router()

// GET /api/sampah — Daftar "Recently Deleted" (khusus guru). Bisa difilter per tugas.
router.get('/', authMiddleware, async (req, res) => {
  if (req.user.role !== 'guru') return res.status(403).json({ message: 'Akses ditolak.' })
  try {
    const { tugasId } = req.query
    const rows = await prisma.sampahPengumpulan.findMany({
      where: tugasId ? { tugasId } : {},
      orderBy: { deletedAt: 'desc' },
    })
    res.json(rows.map((r) => {
      let snapshot = {}
      try { snapshot = JSON.parse(r.dataJson) } catch { snapshot = {} }
      return {
        id: r.id,
        jenis: r.jenis,
        tugasId: r.tugasId,
        siswaId: r.siswaId,
        tugasJudul: r.tugasJudul,
        siswaNama: r.siswaNama,
        deletedAt: r.deletedAt,
        namaFile: snapshot.namaFile || null,
        nilai: snapshot.nilai ?? snapshot.skorTotal ?? null,
      }
    }))
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil daftar sampah.', error: error.message })
  }
})

// POST /api/sampah/:id/restore — Pulihkan record yang dihapus (khusus guru).
// Gagal kalau siswa yang bersangkutan sudah mengumpulkan ulang tugas ini
// (supaya tidak menimpa data baru yang lebih relevan).
router.post('/:id/restore', authMiddleware, async (req, res) => {
  if (req.user.role !== 'guru') return res.status(403).json({ message: 'Akses ditolak.' })
  try {
    const trash = await prisma.sampahPengumpulan.findUnique({ where: { id: req.params.id } })
    if (!trash) return res.status(404).json({ message: 'Data sampah tidak ditemukan.' })

    let snapshot
    try { snapshot = JSON.parse(trash.dataJson) } catch { return res.status(500).json({ message: 'Data snapshot rusak, tidak bisa dipulihkan.' }) }

    if (trash.jenis === 'file') {
      const existing = await prisma.pengumpulan.findFirst({ where: { tugasId: trash.tugasId, siswaId: trash.siswaId } })
      if (existing) {
        return res.status(409).json({ message: `${trash.siswaNama} sudah mengumpulkan ulang tugas ini. Hapus pengumpulan baru itu dulu jika ingin memulihkan yang lama.` })
      }
      try { await fs.access(snapshot.path) } catch {
        return res.status(404).json({ message: 'File fisik hasil tugas ini sudah tidak ada di server, tidak bisa dipulihkan.' })
      }
      const restored = await prisma.pengumpulan.create({
        data: {
          id: snapshot.id,
          tugasId: snapshot.tugasId,
          siswaId: snapshot.siswaId,
          namaFile: snapshot.namaFile,
          path: snapshot.path,
          ukuran: snapshot.ukuran,
          nilai: snapshot.nilai,
          keterangan: snapshot.keterangan,
          xpBase: snapshot.xpBase || 0,
          xpNilai: snapshot.xpNilai || 0,
          xpEarly: snapshot.xpEarly || 0,
          xpPerfect: snapshot.xpPerfect || 0,
          xpBonus: snapshot.xpBonus || 0,
          xpTotal: snapshot.xpTotal || 0,
          createdAt: snapshot.createdAt ? new Date(snapshot.createdAt) : undefined,
        },
      })
      await prisma.sampahPengumpulan.delete({ where: { id: trash.id } })
      req.app.get('io').emit('pengumpulan-update', restored)
      await catatAktivitas({
        siswaId: trash.siswaId, tugasId: trash.tugasId, jenis: JENIS_AKTIVITAS.UPLOAD,
        deskripsi: `Hasil tugas ${snapshot.namaFile} dipulihkan oleh guru dari Recently Deleted`,
        io: req.app.get('io'),
      })
      return res.json({ message: 'Hasil tugas berhasil dipulihkan.', data: restored })
    }

    if (trash.jenis === 'mengetik') {
      const existing = await prisma.pengumpulanMengetik.findUnique({
        where: { tugasId_siswaId: { tugasId: trash.tugasId, siswaId: trash.siswaId } },
      })
      if (existing) {
        return res.status(409).json({ message: `${trash.siswaNama} sudah punya data pengerjaan baru untuk tugas ini. Hapus data baru itu dulu jika ingin memulihkan yang lama.` })
      }
      const restored = await prisma.pengumpulanMengetik.create({
        data: {
          id: snapshot.id,
          tugasId: snapshot.tugasId,
          siswaId: snapshot.siswaId,
          hasilKetik: snapshot.hasilKetik,
          status: snapshot.status,
          waktuMulai: snapshot.waktuMulai ? new Date(snapshot.waktuMulai) : null,
          waktuSelesai: snapshot.waktuSelesai ? new Date(snapshot.waktuSelesai) : null,
          durasiDetik: snapshot.durasiDetik,
          skorKebenaran: snapshot.skorKebenaran || 0,
          skorKecepatan: snapshot.skorKecepatan || 0,
          skorTotal: snapshot.skorTotal || 0,
          xpBase: snapshot.xpBase || 0,
          xpNilai: snapshot.xpNilai || 0,
          xpEarly: snapshot.xpEarly || 0,
          xpPerfect: snapshot.xpPerfect || 0,
          xpBonus: snapshot.xpBonus || 0,
          xpTotal: snapshot.xpTotal || 0,
          createdAt: snapshot.createdAt ? new Date(snapshot.createdAt) : undefined,
        },
      })
      await prisma.sampahPengumpulan.delete({ where: { id: trash.id } })
      await catatAktivitas({
        siswaId: trash.siswaId, tugasId: trash.tugasId, jenis: JENIS_AKTIVITAS.UPLOAD,
        deskripsi: 'Hasil tugas mengetik dipulihkan oleh guru dari Recently Deleted',
        io: req.app.get('io'),
      })
      return res.json({ message: 'Hasil tugas mengetik berhasil dipulihkan.', data: restored })
    }

    res.status(400).json({ message: 'Jenis data sampah tidak dikenali.' })
  } catch (error) {
    res.status(500).json({ message: 'Gagal memulihkan data.', error: error.message })
  }
})

// DELETE /api/sampah/:id — Hapus permanen data dari Recently Deleted (khusus guru).
// Untuk jenis 'file', file fisiknya juga dihapus permanen dari server.
router.delete('/:id', authMiddleware, async (req, res) => {
  if (req.user.role !== 'guru') return res.status(403).json({ message: 'Akses ditolak.' })
  try {
    const trash = await prisma.sampahPengumpulan.findUnique({ where: { id: req.params.id } })
    if (!trash) return res.status(404).json({ message: 'Data sampah tidak ditemukan.' })

    if (trash.jenis === 'file') {
      try {
        const snapshot = JSON.parse(trash.dataJson)
        if (snapshot.path) await fs.unlink(snapshot.path)
      } catch { /* file mungkin sudah tidak ada, abaikan */ }
    }

    await prisma.sampahPengumpulan.delete({ where: { id: trash.id } })
    res.json({ message: 'Data berhasil dihapus permanen.' })
  } catch (error) {
    res.status(500).json({ message: 'Gagal menghapus data permanen.', error: error.message })
  }
})

export default router
