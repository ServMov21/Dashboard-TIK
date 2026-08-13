import express from 'express'
import { getXpConfig, computeXpComponents } from '../utils/xpEngine.js'
import { PrismaClient } from '@prisma/client'
import XLSX from 'xlsx'
import { catatAktivitas, JENIS_AKTIVITAS } from '../services/activityService.js'
import authMiddleware from '../middleware/authMiddleware.js'

const prisma = new PrismaClient()
const router = express.Router()

// Bobot penilaian default. Total = 100. Dipakai kalau tugas yang bersangkutan
// tidak mengatur bobot kustomnya sendiri (Tugas.bobotKebenaran / bobotKecepatan
// bernilai null).
const DEFAULT_BOBOT_KEBENARAN = 90
const DEFAULT_BOBOT_KECEPATAN = 10

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value))
}

// Ambil bobot kebenaran & kecepatan efektif untuk satu tugas: pakai nilai
// kustom dari tugas kalau diset guru, kalau tidak pakai default aplikasi.
function ambilBobot(tugas) {
  const bobotKebenaran = typeof tugas?.bobotKebenaran === 'number' ? tugas.bobotKebenaran : DEFAULT_BOBOT_KEBENARAN
  const bobotKecepatan = typeof tugas?.bobotKecepatan === 'number' ? tugas.bobotKecepatan : DEFAULT_BOBOT_KECEPATAN
  return { bobotKebenaran, bobotKecepatan }
}

/**
 * Hitung ulang skor kecepatan seluruh siswa yang SUDAH SELESAI mengerjakan
 * satu tugas mengetik. Siswa tercepat (durasi terkecil) mendapat nilai penuh
 * (sebesar bobot kecepatan tugas ini), siswa lain mendapat nilai proporsional
 * terhadap siswa tercepat:
 *   skorKecepatan = bobotKecepatan * (durasiTercepat / durasiSiswa)
 * Semakin lama durasi siswa dibanding yang tercepat, semakin kecil skornya.
 * Dipanggil setiap kali ada siswa yang menyelesaikan pengerjaan, supaya
 * peringkat & skor kecepatan semua siswa selalu ter-update secara real-time.
 */
async function hitungUlangSkorKecepatan(tugasId) {
  const tugas = await prisma.tugas.findUnique({ where: { id: tugasId } })
  const { bobotKebenaran, bobotKecepatan } = ambilBobot(tugas)

  const selesai = await prisma.pengumpulanMengetik.findMany({
    where: { tugasId, status: 'selesai', durasiDetik: { not: null } },
    orderBy: { durasiDetik: 'asc' },
  })

  if (selesai.length === 0) return []

  const durasiTercepat = selesai[0].durasiDetik

  const updated = []
  for (const item of selesai) {
    const skorKecepatan = durasiTercepat && item.durasiDetik
      ? clamp(Math.round((bobotKecepatan * (durasiTercepat / item.durasiDetik)) * 10) / 10, 0, bobotKecepatan)
      : 0
    const skorKebenaranClamped = clamp(item.skorKebenaran || 0, 0, bobotKebenaran)
    const skorTotal = clamp(Math.round((skorKebenaranClamped + skorKecepatan) * 10) / 10, 0, 100)

    const row = await prisma.pengumpulanMengetik.update({
      where: { id: item.id },
      data: { skorKecepatan, skorTotal },
    })
    updated.push(row)
  }
  return updated
}

async function kirimUpdateStatus(io, tugasId) {
  if (!io) return
  const status = await ambilStatusTugas(tugasId)
  io.emit('pengumpulan-mengetik-update', { tugasId, data: status })
}

async function ambilStatusTugas(tugasId) {
  const tugas = await prisma.tugas.findUnique({ where: { id: tugasId } })
  if (!tugas) return []

  let kelasTarget = []
  try { kelasTarget = JSON.parse(tugas.kelasTarget || '[]') } catch { kelasTarget = [] }
  let rombelTarget = []
  try { rombelTarget = tugas.rombelTarget ? JSON.parse(tugas.rombelTarget || '[]') : [] } catch { rombelTarget = [] }

  const allSiswa = await prisma.siswa.findMany({
    where: {
      ...(kelasTarget.length ? { kelas: { in: kelasTarget } } : {}),
      ...(rombelTarget.length ? { rombel: { in: rombelTarget } } : {}),
    },
  })

  const semuaPengumpulan = await prisma.pengumpulanMengetik.findMany({ where: { tugasId } })

  // Urutkan yang sudah selesai berdasarkan durasi untuk menampilkan peringkat kecepatan.
  const selesaiUrut = semuaPengumpulan
    .filter((p) => p.status === 'selesai' && p.durasiDetik != null)
    .sort((a, b) => a.durasiDetik - b.durasiDetik)

  return allSiswa.map((s) => {
    const p = semuaPengumpulan.find((p) => p.siswaId === s.id)
    const peringkat = p && p.status === 'selesai' ? selesaiUrut.findIndex((x) => x.id === p.id) + 1 : null
    return {
      id: p ? p.id : null,
      siswaId: s.id,
      nama: s.nama,
      kelas: s.kelas,
      rombel: s.rombel,
      status: p ? p.status : 'belum_mulai',
      hasilKetik: p ? p.hasilKetik : null,
      waktuMulai: p ? p.waktuMulai : null,
      waktuSelesai: p ? p.waktuSelesai : null,
      durasiDetik: p ? p.durasiDetik : null,
      skorKebenaran: p ? p.skorKebenaran : 0,
      skorKecepatan: p ? p.skorKecepatan : 0,
      skorTotal: p ? p.skorTotal : 0,
      peringkatKecepatan: peringkat,
    }
  })
}

// Siswa menekan tombol "Mulai": catat waktu mulai & buka form pengetikan.
router.post('/mulai', authMiddleware, async (req, res) => {
  if (req.user.role !== 'siswa') return res.status(403).json({ message: 'Hanya untuk siswa.' })
  try {
    const { tugasId } = req.body
    if (!tugasId) return res.status(400).json({ message: 'tugasId wajib diisi.' })

    const tugas = await prisma.tugas.findUnique({ where: { id: tugasId } })
    if (!tugas) return res.status(404).json({ message: 'Tugas tidak ditemukan.' })
    if (tugas.jenis !== 'mengetik') return res.status(400).json({ message: 'Tugas ini bukan tugas mengetik.' })
    if (tugas.status === 'ditutup') return res.status(403).json({ message: 'Tugas ini sudah ditutup oleh guru.' })
    if (tugas.status !== 'launch') return res.status(403).json({ message: 'Tugas ini belum dibuka oleh guru.' })

    const now = new Date()
    const record = await prisma.pengumpulanMengetik.upsert({
      where: { tugasId_siswaId: { tugasId, siswaId: req.user.id } },
      update: {
        status: 'mengerjakan',
        waktuMulai: now,
        waktuSelesai: null,
        durasiDetik: null,
        hasilKetik: null,
        skorKebenaran: 0,
        skorKecepatan: 0,
        skorTotal: 0,
      },
      create: {
        tugasId,
        siswaId: req.user.id,
        status: 'mengerjakan',
        waktuMulai: now,
      },
    })

    await catatAktivitas({
      siswaId: req.user.id,
      tugasId,
      jenis: JENIS_AKTIVITAS.BUKA_TUGAS,
      deskripsi: 'Mulai mengerjakan tugas mengetik',
      io: req.app.get('io'),
    })

    await kirimUpdateStatus(req.app.get('io'), tugasId)
    res.json({ message: 'Timer dimulai.', data: record })
  } catch (error) {
    res.status(500).json({ message: 'Gagal memulai tugas mengetik.', error: error.message })
  }
})

// Siswa menekan tombol "Selesai": simpan hasil ketikan + skor kebenaran (dihitung
// di sisi klien karena butuh parsing HTML/format), lalu server menghitung durasi
// dan skor kecepatan (relatif terhadap siswa lain) secara real-time.
router.post('/selesai', authMiddleware, async (req, res) => {
  if (req.user.role !== 'siswa') return res.status(403).json({ message: 'Hanya untuk siswa.' })
  try {
    const { tugasId, hasilKetik, skorKebenaran } = req.body
    if (!tugasId) return res.status(400).json({ message: 'tugasId wajib diisi.' })

    const tugas = await prisma.tugas.findUnique({ where: { id: tugasId } })
    if (!tugas) return res.status(404).json({ message: 'Tugas tidak ditemukan.' })
    if (tugas.status === 'ditutup') return res.status(403).json({ message: 'Tugas ini sudah ditutup oleh guru.' })

    const existing = await prisma.pengumpulanMengetik.findUnique({
      where: { tugasId_siswaId: { tugasId, siswaId: req.user.id } },
    })
    if (!existing || existing.status !== 'mengerjakan' || !existing.waktuMulai) {
      return res.status(400).json({ message: 'Kamu belum menekan tombol Mulai.' })
    }

    const now = new Date()
    const durasiDetik = Math.max(0, (now.getTime() - new Date(existing.waktuMulai).getTime()) / 1000)
    const { bobotKebenaran } = ambilBobot(tugas)
    const skorKebenaranFinal = clamp(Number(skorKebenaran) || 0, 0, bobotKebenaran)

    await prisma.pengumpulanMengetik.update({
      where: { id: existing.id },
      data: {
        status: 'selesai',
        waktuSelesai: now,
        durasiDetik,
        hasilKetik: hasilKetik || '',
        skorKebenaran: skorKebenaranFinal,
        // skorKecepatan & skorTotal dihitung ulang untuk semua siswa di bawah ini
      },
    })

    // Hitung ulang peringkat & skor kecepatan seluruh siswa yang sudah selesai,
    // supaya kalau ada siswa lain jadi lebih cepat dari sebelumnya, skor semua orang tetap akurat.
    await hitungUlangSkorKecepatan(tugasId)

    const finalRecord = await prisma.pengumpulanMengetik.findUnique({ where: { id: existing.id } })

    // Kolaborasi: Duplikasi ke partner
    const collab = await prisma.collabTugas.findFirst({
      where: { tugasId, OR: [{ siswa1Id: req.user.id }, { siswa2Id: req.user.id }] }
    })
    if (collab) {
      const partnerId = collab.siswa1Id === req.user.id ? collab.siswa2Id : collab.siswa1Id
      await prisma.pengumpulanMengetik.upsert({
        where: { tugasId_siswaId: { tugasId, siswaId: partnerId } },
        update: {
          status: 'selesai',
          waktuSelesai: finalRecord.waktuSelesai,
          durasiDetik: finalRecord.durasiDetik,
          hasilKetik: finalRecord.hasilKetik,
          skorKebenaran: finalRecord.skorKebenaran,
          skorKecepatan: finalRecord.skorKecepatan,
          skorTotal: finalRecord.skorTotal,
        },
        create: {
          tugasId,
          siswaId: partnerId,
          status: 'selesai',
          waktuMulai: finalRecord.waktuMulai,
          waktuSelesai: finalRecord.waktuSelesai,
          durasiDetik: finalRecord.durasiDetik,
          hasilKetik: finalRecord.hasilKetik,
          skorKebenaran: finalRecord.skorKebenaran,
          skorKecepatan: finalRecord.skorKecepatan,
          skorTotal: finalRecord.skorTotal,
        }
      })
      await hitungUlangSkorKecepatan(tugasId)
    }

    await catatAktivitas({
      siswaId: req.user.id,
      tugasId,
      jenis: JENIS_AKTIVITAS.UPLOAD,
      deskripsi: `Menyelesaikan tugas mengetik (skor: ${finalRecord.skorTotal})`,
      io: req.app.get('io'),
    })

    // Hitung XP untuk tugas mengetik yang baru selesai
    try {
      const xpCfg = await getXpConfig(prisma)
      const { xpNilai, xpEarly, xpPerfect } = computeXpComponents(xpCfg, {
        nilai: finalRecord.skorTotal,
        deadline: tugas.deadline,
        waktuKumpul: finalRecord.waktuSelesai,
      })
      const xpBase = xpCfg.xpBase
      const xpBonus = finalRecord.xpBonus || 0
      const xpTotal = Math.round((xpBase + xpNilai + xpEarly + xpPerfect + xpBonus) * 10) / 10
      await prisma.pengumpulanMengetik.update({
        where: { id: existing.id },
        data: { xpBase, xpNilai, xpEarly, xpPerfect, xpTotal },
      })
    } catch (xpErr) { console.error('XP compute error:', xpErr) }

    await kirimUpdateStatus(req.app.get('io'), tugasId)
    res.json({ message: 'Jawaban berhasil dikirim.', data: finalRecord })
  } catch (error) {
    res.status(500).json({ message: 'Gagal menyimpan hasil mengetik.', error: error.message })
  }
})

// Status pengerjaan milik siswa yang sedang login (untuk tugas mengetik tertentu)
router.get('/saya/:tugasId', authMiddleware, async (req, res) => {
  if (req.user.role !== 'siswa') return res.status(403).json({ message: 'Hanya untuk siswa.' })
  try {
    const record = await prisma.pengumpulanMengetik.findUnique({
      where: { tugasId_siswaId: { tugasId: req.params.tugasId, siswaId: req.user.id } },
    })
    res.json(record || null)
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil status.', error: error.message })
  }
})

// Status pengerjaan seluruh siswa target (khusus guru) - dipakai untuk menampilkan
// hasil ketik, waktu, skor kebenaran, skor kecepatan, dan skor total secara real-time.
router.get('/status/:tugasId', authMiddleware, async (req, res) => {
  if (req.user.role !== 'guru') return res.status(403).json({ message: 'Akses ditolak.' })
  try {
    const data = await ambilStatusTugas(req.params.tugasId)
    res.json(data)
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil status.', error: error.message })
  }
})

// Status pengerjaan gabungan untuk satu batch tugas mengetik (semua kelas/rombel
// yang dibuat dalam satu kali "Tambah Tugas" digabung jadi satu daftar)
router.get('/status-batch/:batchId', authMiddleware, async (req, res) => {
  if (req.user.role !== 'guru') return res.status(403).json({ message: 'Akses ditolak.' })
  try {
    const tugasRows = await prisma.tugas.findMany({ where: { batchId: req.params.batchId } })
    if (!tugasRows.length) return res.status(404).json({ message: 'Tugas tidak ditemukan.' })

    let gabungan = []
    for (const tugas of tugasRows) {
      const data = await ambilStatusTugas(tugas.id)
      gabungan = gabungan.concat(data)
    }
    res.json(gabungan)
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil status.', error: error.message })
  }
})

// Export Excel rekap hasil tugas mengetik (khusus guru)
router.get('/export/:tugasId', authMiddleware, async (req, res) => {
  if (req.user.role !== 'guru') return res.status(403).json({ message: 'Akses ditolak.' })
  try {
    const { tugasId } = req.params
    const tugas = await prisma.tugas.findUnique({ where: { id: tugasId } })
    if (!tugas) return res.status(404).json({ message: 'Tugas tidak ditemukan.' })

    const data = await ambilStatusTugas(tugasId)
    const rows = data.map((s) => ({
      Nama: s.nama,
      Kelas: s.kelas,
      Rombel: s.rombel,
      Status: s.status === 'selesai' ? 'Selesai' : s.status === 'mengerjakan' ? 'Mengerjakan' : 'Belum Mulai',
      'Waktu Mulai': s.waktuMulai ? new Date(s.waktuMulai).toLocaleString('id-ID') : '-',
      'Waktu Selesai': s.waktuSelesai ? new Date(s.waktuSelesai).toLocaleString('id-ID') : '-',
      'Durasi (detik)': s.durasiDetik != null ? Math.round(s.durasiDetik) : '-',
      'Skor Kebenaran': s.status === 'selesai' ? s.skorKebenaran : '-',
      'Skor Kecepatan': s.status === 'selesai' ? s.skorKecepatan : '-',
      'Skor Total': s.status === 'selesai' ? s.skorTotal : '-',
      'Peringkat Kecepatan': s.peringkatKecepatan || '-',
    }))

    const worksheet = XLSX.utils.json_to_sheet(rows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Rekap Tugas Mengetik')
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

    res.setHeader('Content-Disposition', `attachment; filename=rekap-mengetik-${tugas.judul.replace(/ /g, '_')}.xlsx`)
    res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').send(buffer)
  } catch (error) {
    res.status(500).json({ message: 'Gagal export data.', error: error.message })
  }
})

// Export Excel rekap gabungan hasil tugas mengetik untuk satu batch (multi-kelas)
router.get('/export-batch/:batchId', authMiddleware, async (req, res) => {
  if (req.user.role !== 'guru') return res.status(403).json({ message: 'Akses ditolak.' })
  try {
    const { batchId } = req.params
    const tugasRows = await prisma.tugas.findMany({ where: { batchId } })
    if (!tugasRows.length) return res.status(404).json({ message: 'Tugas tidak ditemukan.' })

    let rows = []
    for (const tugas of tugasRows) {
      const data = await ambilStatusTugas(tugas.id)
      rows = rows.concat(data.map((s) => ({
        Nama: s.nama,
        Kelas: s.kelas,
        Rombel: s.rombel,
        Status: s.status === 'selesai' ? 'Selesai' : s.status === 'mengerjakan' ? 'Mengerjakan' : 'Belum Mulai',
        'Waktu Mulai': s.waktuMulai ? new Date(s.waktuMulai).toLocaleString('id-ID') : '-',
        'Waktu Selesai': s.waktuSelesai ? new Date(s.waktuSelesai).toLocaleString('id-ID') : '-',
        'Durasi (detik)': s.durasiDetik != null ? Math.round(s.durasiDetik) : '-',
        'Skor Kebenaran': s.status === 'selesai' ? s.skorKebenaran : '-',
        'Skor Kecepatan': s.status === 'selesai' ? s.skorKecepatan : '-',
        'Skor Total': s.status === 'selesai' ? s.skorTotal : '-',
        'Peringkat Kecepatan': s.peringkatKecepatan || '-',
      })))
    }

    const worksheet = XLSX.utils.json_to_sheet(rows)
    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Rekap Tugas Mengetik')
    const buffer = XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' })

    res.setHeader('Content-Disposition', `attachment; filename=rekap-mengetik-${tugasRows[0].judul.replace(/ /g, '_')}.xlsx`)
    res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').send(buffer)
  } catch (error) {
    res.status(500).json({ message: 'Gagal export data.', error: error.message })
  }
})

// Hapus hasil pengetikan siswa (khusus guru) - record dipindah dulu ke
// "Recently Deleted" (SampahPengumpulan) supaya bisa dipulihkan (restore),
// lalu record aslinya dihapus supaya siswa yang bersangkutan bisa mengulang
// tugas mengetik ini dari awal.
router.delete('/:id', authMiddleware, async (req, res) => {
  if (req.user.role !== 'guru') return res.status(403).json({ message: 'Akses ditolak.' })
  try {
    const record = await prisma.pengumpulanMengetik.findUnique({
      where: { id: req.params.id },
      include: { siswa: { select: { nama: true } }, tugas: { select: { judul: true } } },
    })
    if (!record) return res.status(404).json({ message: 'Data hasil mengetik tidak ditemukan.' })

    await prisma.sampahPengumpulan.create({
      data: {
        jenis: 'mengetik',
        originalId: record.id,
        tugasId: record.tugasId,
        siswaId: record.siswaId,
        tugasJudul: record.tugas?.judul || 'Tugas Mengetik',
        siswaNama: record.siswa?.nama || '-',
        dataJson: JSON.stringify(record),
      },
    })

    await prisma.pengumpulanMengetik.delete({ where: { id: record.id } })

    // Hitung ulang peringkat kecepatan siswa lain yang tersisa, lalu broadcast status terbaru.
    await hitungUlangSkorKecepatan(record.tugasId)
    await kirimUpdateStatus(req.app.get('io'), record.tugasId)

    await catatAktivitas({
      siswaId: record.siswaId,
      tugasId: record.tugasId,
      jenis: JENIS_AKTIVITAS.UPLOAD,
      deskripsi: 'Hasil tugas mengetik dihapus oleh guru (dipindahkan ke Recently Deleted)',
      io: req.app.get('io')
    })

    res.json({ message: 'Hasil tugas mengetik siswa dihapus & dipindahkan ke Recently Deleted.' })
  } catch (error) {
    res.status(500).json({ message: 'Gagal menghapus hasil tugas mengetik.', error: error.message })
  }
})

export default router
