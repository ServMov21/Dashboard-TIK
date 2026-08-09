import express from 'express'
import bcrypt from 'bcryptjs'
import jwt from 'jsonwebtoken'
import { PrismaClient } from '@prisma/client'
import { catatAktivitas, JENIS_AKTIVITAS } from '../services/activityService.js'

const router = express.Router()
const prisma = new PrismaClient()
const JWT_SECRET = process.env.JWT_SECRET
if (!JWT_SECRET) {
  console.error('FATAL: JWT_SECRET environment variable is not set. Exiting.')
  process.exit(1)
}

// Login Guru
router.post('/login-guru', async (req, res) => {
  try {
    const { username, password } = req.body

    if (!username || !password) {
      return res.status(400).json({ message: 'Username dan password harus diisi.' })
    }

    const guru = await prisma.guru.findUnique({ where: { username } })

    if (!guru) {
      return res.status(401).json({ message: 'Username atau password salah.' })
    }

    const validPassword = await bcrypt.compare(password, guru.password)

    if (!validPassword) {
      return res.status(401).json({ message: 'Username atau password salah.' })
    }

    const token = jwt.sign(
      { id: guru.id, role: 'guru', nama: guru.nama },
      JWT_SECRET,
      { expiresIn: '30d' }
    )

    res.json({
      message: 'Login berhasil.',
      token,
      user: { id: guru.id, nama: guru.nama, role: 'guru' },
    })
  } catch (error) {
    res.status(500).json({ message: 'Terjadi kesalahan server.', error: error.message })
  }
})

// Login Siswa
router.post('/login-siswa', async (req, res) => {
  try {
    const { siswaId, password } = req.body

    if (!siswaId || !password) {
      return res.status(400).json({ message: 'Nama siswa dan password harus diisi.' })
    }

    const siswa = await prisma.siswa.findUnique({ where: { id: siswaId } })

    if (!siswa) {
      return res.status(401).json({ message: 'Data siswa tidak ditemukan.' })
    }

    // Bandingkan password langsung dari string yang disimpan di database
    if (password !== siswa.password) {
      return res.status(401).json({ message: 'Password salah.' })
    }

    const token = jwt.sign(
      { id: siswa.id, role: 'siswa', nama: siswa.nama, kelas: siswa.kelas, rombel: siswa.rombel },
      JWT_SECRET,
      { expiresIn: '1h' }
    )

    res.json({
      message: 'Login berhasil.',
      token,
      user: { id: siswa.id, nama: siswa.nama, kelas: siswa.kelas, rombel: siswa.rombel, role: 'siswa' },
    })

    // Catat aktivitas login
    try {
      await catatAktivitas({
        siswaId: siswa.id,
        tugasId: null,
        jenis: JENIS_AKTIVITAS.LOGIN,
        deskripsi: 'Login ke dashboard',
        io: req.app.get('io')
      })
    } catch (e) {
      console.error('Gagal catat aktivitas login:', e)
    }
  } catch (error) {
    res.status(500).json({ message: 'Terjadi kesalahan server.', error: error.message })
  }
})

// Logout
router.post('/logout', (req, res) => {
  res.json({ message: 'Logout berhasil.' })
})

export default router
