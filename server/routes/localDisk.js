import express from 'express'
import { PrismaClient } from '@prisma/client'
import authMiddleware from '../middleware/authMiddleware.js'
import fs from 'fs/promises'
import path from 'path'

const prisma = new PrismaClient()
const router = express.Router()

// Get disk usage info
router.get('/usage', authMiddleware, async (req, res) => {
  if (req.user.role !== 'guru') return res.status(403).json({ message: 'Akses ditolak.' })
  try {
    const settings = await prisma.pengaturan.findFirst()
    const baseDir = settings?.baseDir || './storage'
    const stats = await fs.stat(baseDir)
    // Sederhana: kirim info direktori dasar.
    // Di produksi bisa pakai library 'diskusage'
    res.json({
      baseDir,
      isAccessible: true,
      stats: {
        size: stats.size,
        modified: stats.mtime
      }
    })
  } catch (error) {
    res.status(500).json({ message: 'Gagal akses disk.', error: error.message })
  }
})

export default router
