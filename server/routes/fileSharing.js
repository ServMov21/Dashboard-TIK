import express from 'express'
import { PrismaClient } from '@prisma/client'
import path from 'path'
import fs from 'fs/promises'
import multer from 'multer'
import crypto from 'crypto'
import authMiddleware from '../middleware/authMiddleware.js'

const prisma = new PrismaClient()
const router = express.Router()
const upload = multer({ dest: './storage/temp', limits: { fileSize: 200 * 1024 * 1024 } })
const metadataName = '_share.json'

const safeFileName = (value) => path.basename(String(value || '')).replace(/[\\/:*?"<>|]/g, '_')

const getShareDirectory = async (shareId) => {
  const settings = await prisma.pengaturan.findFirst()
  const baseDir = path.resolve(settings?.baseDir || './storage')
  const shareDir = path.resolve(baseDir, 'FileSharing', shareId)
  if (!shareDir.startsWith(`${path.resolve(baseDir, 'FileSharing')}${path.sep}`)) throw new Error('ID link tidak valid.')
  return shareDir
}

const readShare = async (shareId) => {
  const shareDir = await getShareDirectory(shareId)
  const metadataPath = path.join(shareDir, metadataName)
  const metadata = JSON.parse(await fs.readFile(metadataPath, 'utf8'))
  return { shareDir, metadata }
}

router.post('/generate', authMiddleware, upload.array('files', 20), async (req, res) => {
  if (req.user.role !== 'guru') return res.status(403).json({ message: 'Akses ditolak.' })

  try {
    if (!req.files?.length) return res.status(400).json({ message: 'Pilih minimal 1 file.' })

    const shareId = crypto.randomBytes(9).toString('base64url')
    const shareDir = await getShareDirectory(shareId)
    await fs.mkdir(shareDir, { recursive: true })

    const files = []
    for (const file of req.files) {
      const name = safeFileName(file.originalname) || 'file'
      const target = path.join(shareDir, name)
      await fs.copyFile(file.path, target)
      await fs.unlink(file.path)
      files.push({ name, size: file.size })
    }

    const metadata = {
      title: String(req.body.folderName || 'File Sharing').trim().slice(0, 100) || 'File Sharing',
      files,
      createdAt: new Date().toISOString(),
    }
    await fs.writeFile(path.join(shareDir, metadataName), JSON.stringify(metadata), 'utf8')

    res.status(201).json({
      message: 'Link sharing berhasil dibuat.',
      link: `/share/${shareId}`,
      files,
    })
  } catch (error) {
    for (const file of req.files || []) {
      try { await fs.unlink(file.path) } catch { /* temporary file may already be moved */ }
    }
    res.status(500).json({ message: 'Gagal membuat sharing link.', error: error.message })
  }
})

// Informasi share publik — tanpa login.
router.get('/public/:shareId', async (req, res) => {
  try {
    const { metadata } = await readShare(req.params.shareId)
    res.json(metadata)
  } catch (error) {
    res.status(404).json({ message: 'Link sharing tidak ditemukan atau sudah tidak tersedia.' })
  }
})

// Download file publik — tanpa login.
router.get('/public/:shareId/download/:fileName', async (req, res) => {
  try {
    const { shareDir, metadata } = await readShare(req.params.shareId)
    const fileName = safeFileName(req.params.fileName)
    const file = metadata.files.find((item) => item.name === fileName)
    if (!file) return res.status(404).json({ message: 'File tidak ditemukan.' })
    res.download(path.join(shareDir, file.name), file.name)
  } catch (error) {
    res.status(404).json({ message: 'File tidak ditemukan atau link sudah tidak tersedia.' })
  }
})

export default router
