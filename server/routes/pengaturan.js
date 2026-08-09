import express from 'express'
import { PrismaClient } from '@prisma/client'
import authMiddleware from '../middleware/authMiddleware.js'

const prisma = new PrismaClient()
const router = express.Router()

router.get('/', authMiddleware, async (req, res) => {
  if (req.user.role !== 'guru') return res.status(403).json({ message: 'Akses ditolak.' })
  try {
    const peng = await prisma.pengaturan.findFirst() || {}
    res.json(peng)
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil pengaturan.', error: error.message })
  }
})

router.put('/', authMiddleware, async (req, res) => {
  if (req.user.role !== 'guru') return res.status(403).json({ message: 'Akses ditolak.' })
  try {
    const data = req.body
    const updated = await prisma.pengaturan.update({
      where: { id: '1' },
      data: {
        namaSekolah: data.namaSekolah,
        alamat: data.alamat,
        baseDir: data.baseDir,
        tema: data.tema,
        jamLogout: parseInt(data.jamLogout),
        submissionFolderPattern: data.submissionFolderPattern,
        duplicateFileHandling: data.duplicateFileHandling,
      },
    })
    res.json(updated)
  } catch (error) {
    res.status(500).json({ message: 'Gagal memperbarui pengaturan.', error: error.message })
  }
})

export default router
