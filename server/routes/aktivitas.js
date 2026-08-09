import express from 'express'
import authMiddleware from '../middleware/authMiddleware.js'
import { getAktivitasTerbaru } from '../services/activityService.js'

const router = express.Router()

// GET aktivitas terbaru siswa (login, buka tugas, upload, download) - khusus guru
router.get('/terbaru', authMiddleware, async (req, res) => {
  if (req.user.role !== 'guru') {
    return res.status(403).json({ message: 'Akses ditolak.' })
  }
  try {
    const limit = req.query.limit ? parseInt(req.query.limit, 10) : 10
    const aktivitas = await getAktivitasTerbaru(limit)
    res.json(aktivitas)
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil aktivitas terbaru.', error: error.message })
  }
})

export default router
