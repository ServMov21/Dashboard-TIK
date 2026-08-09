import express from 'express'
import authRoutes from './auth.js'
import userRoutes from './users.js'
import tugasRoutes from './tugas.js'
import pengumpulanRoutes from './pengumpulan.js'
import pengumpulanMengetikRoutes from './pengumpulanMengetik.js'
import riwayatRoutes from './riwayat.js'
import siswaRoutes from './siswa.js'
import pengaturanRoutes from './pengaturan.js'
import fileSharingRoutes from './fileSharing.js'
import quickShareRoutes from './quickShare.js'
import localDiskRoutes from './localDisk.js'
import acakTempatDudukRoutes from './acakTempatDuduk.js'
import aktivitasRoutes from './aktivitas.js'
import systemRoutes from './system.js'
import nilaiRoutes from './nilai.js'
import xpRoutes from './xp.js'
import sampahRoutes from './sampah.js'

const router = express.Router()

router.use('/auth', authRoutes)
router.use('/users', userRoutes)
router.use('/tugas', tugasRoutes)
router.use('/pengumpulan', pengumpulanRoutes)
router.use('/pengumpulan-mengetik', pengumpulanMengetikRoutes)
router.use('/riwayat', riwayatRoutes)
router.use('/siswa', siswaRoutes)
router.use('/pengaturan', pengaturanRoutes)
router.use('/fileshare', fileSharingRoutes)
router.use('/quickshare', quickShareRoutes)
router.use('/localdisk', localDiskRoutes)
router.use('/acak', acakTempatDudukRoutes)
router.use('/aktivitas', aktivitasRoutes)
router.use('/system', systemRoutes)
router.use('/nilai', nilaiRoutes)
router.use('/xp', xpRoutes)
router.use('/sampah', sampahRoutes)

router.get('/', (req, res) => {
  res.json({ message: 'Dashboard TIK API' })
})

export default router
