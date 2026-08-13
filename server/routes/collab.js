import express from 'express'
import { PrismaClient } from '@prisma/client'
import authMiddleware from '../middleware/authMiddleware.js'

const prisma = new PrismaClient()
const router = express.Router()

// GET: Ambil status collab untuk tugas tertentu
router.get('/:tugasId', authMiddleware, async (req, res) => {
  if (req.user.role !== 'siswa') return res.status(403).json({ message: 'Akses ditolak.' })
  try {
    const { tugasId } = req.params
    const siswaId = req.user.id

    const collab = await prisma.collabTugas.findFirst({
      where: {
        tugasId,
        OR: [{ siswa1Id: siswaId }, { siswa2Id: siswaId }]
      },
      include: {
        siswa1: { select: { id: true, nama: true } },
        siswa2: { select: { id: true, nama: true } }
      }
    })

    if (!collab) {
      return res.json({ isCollab: false })
    }

    const partner = collab.siswa1Id === siswaId ? collab.siswa2 : collab.siswa1
    return res.json({ isCollab: true, partner, collabId: collab.id })
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengecek status kolaborasi.', error: error.message })
  }
})

// GET: Ambil daftar teman sekelas yang BUKAN diri sendiri dan BELUM memiliki collab di tugas ini
router.get('/:tugasId/teman', authMiddleware, async (req, res) => {
  if (req.user.role !== 'siswa') return res.status(403).json({ message: 'Akses ditolak.' })
  try {
    const { tugasId } = req.params
    const myId = req.user.id
    const saya = await prisma.siswa.findUnique({ where: { id: myId } })
    if (!saya) return res.status(404).json({ message: 'Data kamu tidak ditemukan.' })

    const temanSekelas = await prisma.siswa.findMany({
      where: {
        kelas: saya.kelas,
        rombel: saya.rombel,
        id: { not: myId }
      },
      select: { id: true, nama: true }
    })

    // Filter teman yang belum memiliki collab di tugas ini
    const existingCollabs = await prisma.collabTugas.findMany({
      where: { tugasId }
    })

    const unavailableIds = new Set()
    existingCollabs.forEach(c => {
      unavailableIds.add(c.siswa1Id)
      unavailableIds.add(c.siswa2Id)
    })

    const availableTeman = temanSekelas.filter(t => !unavailableIds.has(t.id))
    res.json(availableTeman)
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil daftar teman.', error: error.message })
  }
})

// POST: Join collab (membutuhkan tanggal lahir siswa yang dituju)
router.post('/join', authMiddleware, async (req, res) => {
  if (req.user.role !== 'siswa') return res.status(403).json({ message: 'Akses ditolak.' })
  try {
    const { tugasId, partnerId, tanggalLahir } = req.body
    const myId = req.user.id

    if (!tugasId || !partnerId || !tanggalLahir) {
      return res.status(400).json({ message: 'Data tidak lengkap.' })
    }

    const partner = await prisma.siswa.findUnique({ where: { id: partnerId } })
    if (!partner) return res.status(404).json({ message: 'Siswa tidak ditemukan.' })

    // Validasi tanggal lahir partner (DDMMYYYY sama seperti format login/password bawaan)
    const d = new Date(partner.tanggalLahir)
    const day = String(d.getUTCDate()).padStart(2, '0')
    const month = String(d.getUTCMonth() + 1).padStart(2, '0')
    const year = d.getUTCFullYear()
    const validDob = `${day}${month}${year}`
    const inputDob = String(tanggalLahir).replace(/\D/g, '') // hilangkan non-digit jika ada

    if (validDob !== inputDob) {
      return res.status(400).json({ message: 'Tanggal lahir siswa tidak sesuai.' })
    }

    // Cek jika salah satu sudah punya collab
    const existingCollab = await prisma.collabTugas.findFirst({
      where: {
        tugasId,
        OR: [{ siswa1Id: myId }, { siswa2Id: myId }, { siswa1Id: partnerId }, { siswa2Id: partnerId }]
      }
    })

    if (existingCollab) {
      return res.status(400).json({ message: 'Kamu atau temanmu sudah melakukan kolaborasi di tugas ini.' })
    }

    const collab = await prisma.collabTugas.create({
      data: {
        tugasId,
        siswa1Id: myId,
        siswa2Id: partnerId
      },
      include: {
        siswa1: { select: { id: true, nama: true } },
        siswa2: { select: { id: true, nama: true } }
      }
    })

    const partnerInfo = collab.siswa1Id === myId ? collab.siswa2 : collab.siswa1
    res.json({ message: 'Berhasil bergabung!', isCollab: true, partner: partnerInfo, collabId: collab.id })
  } catch (error) {
    res.status(500).json({ message: 'Gagal join collab.', error: error.message })
  }
})

// DELETE: Keluar dari collab
router.delete('/:collabId', authMiddleware, async (req, res) => {
  if (req.user.role !== 'siswa') return res.status(403).json({ message: 'Akses ditolak.' })
  try {
    const { collabId } = req.params
    const collab = await prisma.collabTugas.findUnique({ where: { id: collabId } })
    if (!collab) return res.status(404).json({ message: 'Kolaborasi tidak ditemukan.' })

    if (collab.siswa1Id !== req.user.id && collab.siswa2Id !== req.user.id) {
      return res.status(403).json({ message: 'Akses ditolak.' })
    }

    await prisma.collabTugas.delete({ where: { id: collabId } })
    res.json({ message: 'Kolaborasi dibatalkan.' })
  } catch (error) {
    res.status(500).json({ message: 'Gagal membatalkan kolaborasi.', error: error.message })
  }
})

export default router
