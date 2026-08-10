import express from 'express'
import { PrismaClient } from '@prisma/client'
import authMiddleware from '../middleware/authMiddleware.js'
import { getXpConfig, getTitleFromXP, DEFAULT_TITLE_CONFIG, applyPenaltiTidakKumpul } from '../utils/xpEngine.js'

const prisma = new PrismaClient()
const router = express.Router()

// ─── Helper: hitung total XP & stats per siswa (batch) ───────────────────────
async function buildStudentXpStats(siswaIds) {
  const [filePengumpulan, mengetikPengumpulan, penalti] = await Promise.all([
    prisma.pengumpulan.findMany({
      where: { siswaId: { in: siswaIds } },
      select: { siswaId: true, xpTotal: true, nilai: true, createdAt: true },
    }),
    prisma.pengumpulanMengetik.findMany({
      where: { siswaId: { in: siswaIds }, status: 'selesai' },
      select: { siswaId: true, xpTotal: true, skorTotal: true, waktuSelesai: true },
    }),
    prisma.xpPenalti.findMany({
      where: { siswaId: { in: siswaIds } },
      select: { siswaId: true, xp: true },
    }),
  ])

  const stats = {}
  siswaIds.forEach(id => {
    stats[id] = { totalXP: 0, sumNilai: 0, countNilai: 0, countNilaiGe90: 0, tasksCompleted: 0, lastActivity: null }
  })

  filePengumpulan.forEach(p => {
    if (!stats[p.siswaId]) return
    const s = stats[p.siswaId]
    s.totalXP += p.xpTotal || 0
    s.tasksCompleted++
    if (p.nilai !== null && p.nilai !== undefined) { s.sumNilai += p.nilai; s.countNilai++; if (p.nilai >= 90) s.countNilaiGe90++ }
    if (!s.lastActivity || p.createdAt > s.lastActivity) s.lastActivity = p.createdAt
  })
  mengetikPengumpulan.forEach(p => {
    if (!stats[p.siswaId]) return
    const s = stats[p.siswaId]
    s.totalXP += p.xpTotal || 0
    s.tasksCompleted++
    if (p.skorTotal !== null) { s.sumNilai += p.skorTotal; s.countNilai++; if (p.skorTotal >= 90) s.countNilaiGe90++ }
    if (!s.lastActivity || p.waktuSelesai > s.lastActivity) s.lastActivity = p.waktuSelesai
  })
  penalti.forEach(p => {
    if (!stats[p.siswaId]) return
    stats[p.siswaId].totalXP += p.xp || 0
  })

  Object.keys(stats).forEach(id => {
    const s = stats[id]
    s.avgNilai = s.countNilai > 0 ? Math.round((s.sumNilai / s.countNilai) * 10) / 10 : 0
    s.totalXP = Math.round(s.totalXP * 10) / 10
  })
  return stats
}

// ─── Sort leaderboard sesuai 5 kriteria ──────────────────────────────────────
function sortLeaderboard(entries) {
  return [...entries].sort((a, b) => {
    if (b.totalXP !== a.totalXP) return b.totalXP - a.totalXP
    if (b.avgNilai !== a.avgNilai) return b.avgNilai - a.avgNilai
    if (b.tasksCompleted !== a.tasksCompleted) return b.tasksCompleted - a.tasksCompleted
    if (b.countNilaiGe90 !== a.countNilaiGe90) return b.countNilaiGe90 - a.countNilaiGe90
    const aTime = a.lastActivity ? new Date(a.lastActivity).getTime() : Infinity
    const bTime = b.lastActivity ? new Date(b.lastActivity).getTime() : Infinity
    return aTime - bTime  // lebih awal = lebih baik
  })
}

// GET /api/xp/leaderboard?kelas=X&rombel=Y  (type=rombel|kelas ditentukan dari filter)
router.get('/leaderboard', authMiddleware, async (req, res) => {
  try {
    const { kelas, rombel } = req.query
    const xpCfg = await getXpConfig(prisma)

    const whereClause = {}
    if (kelas) whereClause.kelas = kelas
    if (rombel) whereClause.rombel = rombel

    const siswaList = await prisma.siswa.findMany({
      where: whereClause,
      orderBy: [{ kelas: 'asc' }, { rombel: 'asc' }, { nama: 'asc' }],
    })
    if (!siswaList.length) return res.json([])

    const xpStats = await buildStudentXpStats(siswaList.map(s => s.id))

    const entries = siswaList.map(s => ({
      id: s.id, nama: s.nama, kelas: s.kelas, rombel: s.rombel,
      ...xpStats[s.id],
      title: getTitleFromXP(xpStats[s.id].totalXP, xpStats[s.id].tasksCompleted, xpCfg.titleConfig),
    }))

    const sorted = sortLeaderboard(entries)
    let rank = 1
    sorted.forEach((e, i) => {
      if (i > 0 && sorted[i].totalXP !== sorted[i - 1].totalXP) rank = i + 1
      e.rank = rank
    })

    res.json(sorted)
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil leaderboard.', error: error.message })
  }
})

// GET /api/xp/siswa/stats — Statistik XP siswa yang sedang login
router.get('/siswa/stats', authMiddleware, async (req, res) => {
  if (req.user.role !== 'siswa') return res.status(403).json({ message: 'Hanya untuk siswa.' })
  try {
    const siswa = await prisma.siswa.findUnique({ where: { id: req.user.id } })
    if (!siswa) return res.status(404).json({ message: 'Siswa tidak ditemukan.' })

    const xpCfg = await getXpConfig(prisma)

    const [filePengumpulan, mengetikPengumpulan, penalti] = await Promise.all([
      prisma.pengumpulan.findMany({ where: { siswaId: siswa.id }, select: { xpTotal: true, nilai: true, createdAt: true } }),
      prisma.pengumpulanMengetik.findMany({ where: { siswaId: siswa.id, status: 'selesai' }, select: { xpTotal: true, skorTotal: true } }),
      prisma.xpPenalti.findMany({ where: { siswaId: siswa.id }, select: { xp: true } }),
    ])

    let totalXP = 0, sumNilai = 0, countNilai = 0, countNilaiGe90 = 0, highestNilai = 0
    const tasksCompleted = filePengumpulan.length + mengetikPengumpulan.length

    filePengumpulan.forEach(p => {
      totalXP += p.xpTotal || 0
      if (p.nilai !== null && p.nilai !== undefined) {
        sumNilai += p.nilai; countNilai++
        if (p.nilai >= 90) countNilaiGe90++
        if (p.nilai > highestNilai) highestNilai = p.nilai
      }
    })
    mengetikPengumpulan.forEach(p => {
      totalXP += p.xpTotal || 0
      if (p.skorTotal !== null) {
        sumNilai += p.skorTotal; countNilai++
        if (p.skorTotal >= 90) countNilaiGe90++
        if (p.skorTotal > highestNilai) highestNilai = p.skorTotal
      }
    })

    penalti.forEach(p => { totalXP += p.xp || 0 })
    totalXP = Math.round(totalXP * 10) / 10
    const avgNilai = countNilai > 0 ? Math.round((sumNilai / countNilai) * 10) / 10 : 0
    const title = getTitleFromXP(totalXP, tasksCompleted, xpCfg.titleConfig)

    // Rank dalam rombel dan kelas
    const [rombelIds, kelasIds] = await Promise.all([
      prisma.siswa.findMany({ where: { kelas: siswa.kelas, rombel: siswa.rombel }, select: { id: true } }).then(r => r.map(s => s.id)),
      prisma.siswa.findMany({ where: { kelas: siswa.kelas }, select: { id: true } }).then(r => r.map(s => s.id)),
    ])

    async function getRankIn(ids) {
      if (!ids.length) return { rank: null, total: 0 }
      const xStats = await buildStudentXpStats(ids)
      const sorted = sortLeaderboard(ids.map(id => ({ id, ...xStats[id] })))
      let rank = 1
      for (let i = 0; i < sorted.length; i++) {
        if (i > 0 && sorted[i].totalXP !== sorted[i-1].totalXP) rank = i + 1
        if (sorted[i].id === siswa.id) return { rank, total: ids.length }
      }
      return { rank: ids.length, total: ids.length }
    }

    const [rankRombel, rankKelas] = await Promise.all([getRankIn(rombelIds), getRankIn(kelasIds)])

    // Nextitle info
    const curIdx = xpCfg.titleConfig.findIndex(t => t.name === title.name)
    const nextTitle = curIdx < xpCfg.titleConfig.length - 1 ? xpCfg.titleConfig[curIdx + 1] : null

    res.json({
      totalXP, avgNilai, tasksCompleted, countNilaiGe90, highestNilai,
      title, nextTitle,
      rankRombel: rankRombel.rank, totalRombel: rankRombel.total,
      rankKelas: rankKelas.rank, totalKelas: rankKelas.total,
      xpCfg: { titleConfig: xpCfg.titleConfig },
    })
  } catch (error) {
    res.status(500).json({ message: 'Gagal.', error: error.message })
  }
})

// GET/PUT /api/xp/settings — Pengaturan XP (hanya guru)
router.get('/settings', authMiddleware, async (req, res) => {
  if (req.user.role !== 'guru') return res.status(403).json({ message: 'Akses ditolak.' })
  try {
    const cfg = await getXpConfig(prisma)
    res.json(cfg)
  } catch (e) { res.status(500).json({ message: 'Gagal.', error: e.message }) }
})

router.put('/settings', authMiddleware, async (req, res) => {
  if (req.user.role !== 'guru') return res.status(403).json({ message: 'Akses ditolak.' })
  try {
    const { xpBase, xpNilai70, xpNilai80, xpNilai90, xpNilai100, xpEarly, xpPerfect, xpBonusMax, xpPenaltiTidakKumpul, titleConfig } = req.body
    const updateData = {}
    if (xpBase !== undefined) updateData.xpBase = parseFloat(xpBase)
    if (xpNilai70 !== undefined) updateData.xpNilai70 = parseFloat(xpNilai70)
    if (xpNilai80 !== undefined) updateData.xpNilai80 = parseFloat(xpNilai80)
    if (xpNilai90 !== undefined) updateData.xpNilai90 = parseFloat(xpNilai90)
    if (xpNilai100 !== undefined) updateData.xpNilai100 = parseFloat(xpNilai100)
    if (xpEarly !== undefined) updateData.xpEarly = parseFloat(xpEarly)
    if (xpPerfect !== undefined) updateData.xpPerfect = parseFloat(xpPerfect)
    if (xpBonusMax !== undefined) updateData.xpBonusMax = parseFloat(xpBonusMax)
    if (xpPenaltiTidakKumpul !== undefined) updateData.xpPenaltiTidakKumpul = parseFloat(xpPenaltiTidakKumpul)
    if (titleConfig !== undefined) updateData.titleConfig = typeof titleConfig === 'string' ? titleConfig : JSON.stringify(titleConfig)

    const existing = await prisma.xpSetting.findFirst()
    const result = existing
      ? await prisma.xpSetting.update({ where: { id: existing.id }, data: updateData })
      : await prisma.xpSetting.create({ data: { id: '1', ...updateData } })
    res.json({ message: 'Pengaturan XP berhasil disimpan.', settings: result })
  } catch (e) { res.status(500).json({ message: 'Gagal.', error: e.message }) }
})

// PUT /api/xp/bonus/:pengumpulanId — Guru beri bonus XP ke submission file
router.put('/bonus/:id', authMiddleware, async (req, res) => {
  if (req.user.role !== 'guru') return res.status(403).json({ message: 'Akses ditolak.' })
  try {
    const xpCfg = await getXpConfig(prisma)
    const { xpBonus } = req.body
    const bonus = Math.min(xpCfg.xpBonusMax, Math.max(0, parseFloat(xpBonus) || 0))
    const p = await prisma.pengumpulan.findUnique({ where: { id: req.params.id } })
    if (!p) return res.status(404).json({ message: 'Tidak ditemukan.' })
    const xpTotal = (p.xpBase || 0) + (p.xpNilai || 0) + (p.xpEarly || 0) + (p.xpPerfect || 0) + bonus
    const updated = await prisma.pengumpulan.update({
      where: { id: req.params.id }, data: { xpBonus: bonus, xpTotal: Math.round(xpTotal * 10) / 10 }
    })
    res.json({ message: 'Bonus XP disimpan.', pengumpulan: updated })
  } catch (e) { res.status(500).json({ message: 'Gagal.', error: e.message }) }
})

// ─── Riwayat XP ───────────────────────────────────────────────────────────
// Menggabungkan seluruh sumber perolehan/pengurangan XP menjadi satu daftar
// riwayat yang DIRINCI per-komponen (bukan ditumpuk jadi satu baris besar).
// Setiap pengumpulan (file maupun mengetik) bisa menghasilkan BEBERAPA baris
// riwayat sekaligus, satu baris per komponen XP yang didapat, contoh:
//   - Menyelesaikan TUGAS MENGETIK CERITA            -> +80 XP  (xpBase)
//   - Mendapat BONUS NILAI 90 dari TUGAS MENGETIK CERITA -> +80 XP (xpNilai)
//   - Mendapat Early Submission dari TUGAS MENGETIK CERITA -> +90 XP (xpEarly)
//   - Mendapat Nilai Sempurna dari TUGAS MENGETIK CERITA -> +70 XP (xpPerfect)
//   - Mendapat Bonus Tambahan dari Guru untuk TUGAS ... -> +20 XP (xpBonus)
// 4. XpPenalti (tidak mengumpulkan/mengerjakan) -> "Tidak mengumpulkan/mengerjakan ..."
function labelNilaiBonus(nilai) {
  if (nilai === null || nilai === undefined) return null
  if (nilai >= 100) return 100
  if (nilai >= 90) return 90
  if (nilai >= 80) return 80
  if (nilai >= 70) return 70
  return null
}

function buildRiwayatEntries({ filePengumpulan = [], mengetikPengumpulan = [], penalti = [] }) {
  const entries = []

  function pushKomponen(p, { waktu, misi, nilai }) {
    const siswaId = p.siswaId
    const nama = p.siswa?.nama

    if (p.xpBase) {
      entries.push({
        waktu, siswaId, nama, misi, perolehan: p.xpBase,
        deskripsi: `Menyelesaikan ${misi}`,
      })
    }
    if (p.xpNilai) {
      const nilaiLabel = labelNilaiBonus(nilai)
      entries.push({
        waktu, siswaId, nama, misi, perolehan: p.xpNilai,
        deskripsi: nilaiLabel != null ? `Mendapat BONUS NILAI ${nilaiLabel} dari ${misi}` : `Mendapat bonus nilai dari ${misi}`,
      })
    }
    if (p.xpEarly) {
      entries.push({
        waktu, siswaId, nama, misi, perolehan: p.xpEarly,
        deskripsi: `Mendapat Early Submission dari ${misi}`,
      })
    }
    if (p.xpPerfect) {
      entries.push({
        waktu, siswaId, nama, misi, perolehan: p.xpPerfect,
        deskripsi: `Mendapat Nilai Sempurna (100) dari ${misi}`,
      })
    }
    if (p.xpBonus) {
      entries.push({
        waktu, siswaId, nama, misi, perolehan: p.xpBonus,
        deskripsi: `Mendapat Bonus Tambahan dari Guru untuk ${misi}`,
      })
    }
  }

  filePengumpulan.forEach(p => {
    if (!p.xpTotal) return
    pushKomponen(p, { waktu: p.updatedAt, misi: p.tugas?.judul || 'Tugas', nilai: p.nilai })
  })
  mengetikPengumpulan.forEach(p => {
    if (!p.xpTotal) return
    pushKomponen(p, { waktu: p.waktuSelesai, misi: p.tugas?.judul || 'Tugas Mengetik', nilai: p.skorTotal })
  })
  penalti.forEach(p => {
    entries.push({
      waktu: p.createdAt,
      siswaId: p.siswaId,
      nama: p.siswa?.nama,
      misi: p.tugas?.judul || 'Tugas',
      perolehan: p.xp,
      deskripsi: `Tidak mengumpulkan/mengerjakan ${p.tugas?.judul || 'Tugas'}`,
    })
  })
  return entries.sort((a, b) => new Date(b.waktu) - new Date(a.waktu))
}

// GET /api/xp/history — Riwayat XP seluruh siswa (khusus guru)
router.get('/history', authMiddleware, async (req, res) => {
  if (req.user.role !== 'guru') return res.status(403).json({ message: 'Akses ditolak.' })
  try {
    const [filePengumpulan, mengetikPengumpulan, penalti] = await Promise.all([
      prisma.pengumpulan.findMany({
        where: { xpTotal: { gt: 0 } },
        include: { siswa: { select: { nama: true } }, tugas: { select: { judul: true } } },
      }),
      prisma.pengumpulanMengetik.findMany({
        where: { status: 'selesai', xpTotal: { gt: 0 } },
        include: { siswa: { select: { nama: true } }, tugas: { select: { judul: true } } },
      }),
      prisma.xpPenalti.findMany({
        include: { siswa: { select: { nama: true } }, tugas: { select: { judul: true } } },
      }),
    ])
    res.json(buildRiwayatEntries({ filePengumpulan, mengetikPengumpulan, penalti }))
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil riwayat XP.', error: error.message })
  }
})

// GET /api/xp/history/saya — Riwayat XP milik siswa yang sedang login
router.get('/history/saya', authMiddleware, async (req, res) => {
  if (req.user.role !== 'siswa') return res.status(403).json({ message: 'Hanya untuk siswa.' })
  try {
    const siswaId = req.user.id
    const [filePengumpulan, mengetikPengumpulan, penalti] = await Promise.all([
      prisma.pengumpulan.findMany({
        where: { siswaId, xpTotal: { gt: 0 } },
        include: { tugas: { select: { judul: true } } },
      }),
      prisma.pengumpulanMengetik.findMany({
        where: { siswaId, status: 'selesai', xpTotal: { gt: 0 } },
        include: { tugas: { select: { judul: true } } },
      }),
      prisma.xpPenalti.findMany({
        where: { siswaId },
        include: { tugas: { select: { judul: true } } },
      }),
    ])
    res.json(buildRiwayatEntries({
      filePengumpulan: filePengumpulan.map(p => ({ ...p, siswaId })),
      mengetikPengumpulan: mengetikPengumpulan.map(p => ({ ...p, siswaId })),
      penalti: penalti.map(p => ({ ...p, siswaId })),
    }))
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil riwayat XP.', error: error.message })
  }
})

// POST /api/xp/penalti/:tugasId — Terapkan penalti XP ke siswa yang belum
// mengumpulkan/mengerjakan tugas (dipanggil manual atau otomatis saat tugas ditutup)
router.post('/penalti/:tugasId', authMiddleware, async (req, res) => {
  if (req.user.role !== 'guru') return res.status(403).json({ message: 'Akses ditolak.' })
  try {
    const tugas = await prisma.tugas.findUnique({ where: { id: req.params.tugasId } })
    if (!tugas) return res.status(404).json({ message: 'Tugas tidak ditemukan.' })
    const result = await applyPenaltiTidakKumpul(prisma, tugas)
    res.json({ message: `Penalti diterapkan ke ${result.applied} siswa.`, ...result })
  } catch (error) {
    res.status(500).json({ message: 'Gagal menerapkan penalti.', error: error.message })
  }
})

router.post('/refresh', authMiddleware, async (req, res) => {
    if (req.user.role !== 'guru') return res.status(403).json({ message: 'Akses ditolak.' });
    try {
      const xpCfg = await getXpConfig(prisma);
      const allPengumpulan = await prisma.pengumpulan.findMany({
        include: { tugas: true }
      });
      let processed = 0;
      for (const p of allPengumpulan) {
        // Hanya hitung bila nilai ada; jika tidak ada nilai, skip dan biarkan xp tetap 0
        if (p.nilai === null || p.nilai === undefined) {
          continue;
        }
        const { xpNilai, xpEarly, xpPerfect } = computeXpComponents(xpCfg, {
          nilai: p.nilai,
          deadline: p.tugas?.deadline,
          waktuKumpul: p.createdAt,
        });
        const bonus = p.xpBonus ?? 0;
        const newXpTotal = Math.round(((xpCfg.xpBase || 0) + xpNilai + xpEarly + xpPerfect + bonus) * 10) / 10;

        await prisma.pengumpulan.update({
          where: { id: p.id },
          data: {
            xpNilai,
            xpEarly,
            xpPerfect,
            xpTotal: newXpTotal,
          },
        });
        processed++;
      }
      res.json({ message: `Berhasil update ${processed} pengumpulan.` });
    } catch (e) {
      res.status(500).json({ error: e.message });
    }
  });

export default router
