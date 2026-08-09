import express from 'express'
import { PrismaClient } from '@prisma/client'
import authMiddleware from '../middleware/authMiddleware.js'

const router = express.Router()
const prisma = new PrismaClient()

// Get semua guru
router.get('/', authMiddleware, async (req, res) => {
  try {
    const users = await prisma.guru.findMany({
      select: { id: true, username: true, nama: true },
    })
    res.json(users)
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil data guru.', error: error.message })
  }
})

// Get guru profile
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const guru = await prisma.guru.findUnique({
      where: { id: req.user.id },
      select: { id: true, username: true, nama: true },
    })
    if (!guru) return res.status(404).json({ message: 'Guru tidak ditemukan.' })
    res.json(guru)
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil profil.', error: error.message })
  }
})

// Update profile
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const { nama, username, passwordLama, passwordBaru } = req.body
    const updateData = {}

    if (nama) updateData.nama = nama
    if (username) updateData.username = username

    if (passwordBaru) {
      const guru = await prisma.guru.findUnique({ where: { id: req.user.id } })
      const bcrypt = await import('bcryptjs')
      const valid = await bcrypt.default.compare(passwordLama, guru.password)
      if (!valid) return res.status(400).json({ message: 'Password lama salah.' })
      const salt = await bcrypt.default.genSalt(10)
      updateData.password = await bcrypt.default.hash(passwordBaru, salt)
    }

    const updated = await prisma.guru.update({
      where: { id: req.user.id },
      data: updateData,
      select: { id: true, username: true, nama: true },
    })
    res.json({ message: 'Profil berhasil diperbarui.', user: updated })
  } catch (error) {
    res.status(500).json({ message: 'Gagal memperbarui profil.', error: error.message })
  }
})

export default router
