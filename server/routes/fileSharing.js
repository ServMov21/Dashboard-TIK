import express from 'express'
import { PrismaClient } from '@prisma/client'
import path from 'path'
import fs from 'fs/promises'
import multer from 'multer'
import authMiddleware from '../middleware/authMiddleware.js'

const prisma = new PrismaClient()
const router = express.Router()
const upload = multer({ dest: './storage/temp' })

router.post('/generate', authMiddleware, upload.array('files', 20), async (req, res) => {
  if (req.user.role !== 'guru') return res.status(403).json({ message: 'Akses ditolak.' })
  try {
    const { folderName = 'FileSharing' } = req.body
    const settings = await prisma.pengaturan.findFirst()
    const baseDir = settings?.baseDir || './storage'
    const dir = path.join(baseDir, folderName)
    await fs.mkdir(dir, { recursive: true })

    const savedFiles = []
    for (const file of req.files) {
      const target = path.join(dir, file.originalname)
      // Gunakan copyFile + unlink untuk menghindari error EXDEV
      await fs.copyFile(file.path, target)
      await fs.unlink(file.path)
      savedFiles.push({ name: file.originalname, path: target })
    }

    res.json({
      message: 'Link sharing berhasil dibuat.',
      link: `/share/${Date.now().toString(36)}`,
      files: savedFiles,
    })
  } catch (error) {
    res.status(500).json({ message: 'Gagal membuat sharing link.', error: error.message })
  }
})

export default router
