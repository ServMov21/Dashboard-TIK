import express from 'express'
import XLSX from 'xlsx'
import { PrismaClient } from '@prisma/client'
import authMiddleware from '../middleware/authMiddleware.js'

const prisma = new PrismaClient()
const router = express.Router()

// ─── Helper: hitung total + rata-rata per siswa ───────────────────────────────
async function buildRekapData(kelas, rombel) {
  const whereClause = {}
  if (kelas) whereClause.kelas = kelas
  if (rombel) whereClause.rombel = rombel
  const siswaList = await prisma.siswa.findMany({
    where: whereClause,
    orderBy: [{ kelas: 'asc' }, { rombel: 'asc' }, { nama: 'asc' }],
  })
  if (siswaList.length === 0) return { tasks: [], students: [] }

  const kelasSet = [...new Set(siswaList.map(s => s.kelas))]
  const rombelSet = [...new Set(siswaList.map(s => s.rombel))]

  const allTugas = await prisma.tugas.findMany({
    where: { status: { in: ['launch', 'ditutup'] } },
    orderBy: { createdAt: 'asc' },
    select: { id: true, judul: true, jenis: true, kelasTarget: true, rombelTarget: true },
  })
  const relevantTugas = allTugas.filter(t => {
    const kt = JSON.parse(t.kelasTarget || '[]')
    const rt = t.rombelTarget ? JSON.parse(t.rombelTarget || '[]') : []
    return kt.some(k => kelasSet.includes(k)) && (rt.length === 0 || rt.some(r => rombelSet.includes(r)))
  })

  // Group tasks by judul — same judul = one column
  const judulMap = new Map()
  for (const t of relevantTugas) {
    if (!judulMap.has(t.judul)) {
      judulMap.set(t.judul, { judul: t.judul, jenis: t.jenis, ids: [t.id] })
    } else {
      judulMap.get(t.judul).ids.push(t.id)
    }
  }
  const mergedTasks = [...judulMap.values()]

  const siswaIds = siswaList.map(s => s.id)
  const tugasIds = relevantTugas.map(t => t.id)

  const pengumpulanList = await prisma.pengumpulan.findMany({
    where: { siswaId: { in: siswaIds }, tugasId: { in: tugasIds } },
    select: { id: true, siswaId: true, tugasId: true, nilai: true, keterangan: true },
  })
  const mengetikList = await prisma.pengumpulanMengetik.findMany({
    where: { siswaId: { in: siswaIds }, tugasId: { in: tugasIds }, status: 'selesai' },
    select: { siswaId: true, tugasId: true, skorTotal: true },
  })

  const nilaiIndex = {}
  pengumpulanList.forEach(p => {
    nilaiIndex[`${p.siswaId}_${p.tugasId}`] = { nilai: p.nilai, keterangan: p.keterangan, source: 'file' }
  })
  mengetikList.forEach(p => {
    nilaiIndex[`${p.siswaId}_${p.tugasId}`] = { nilai: p.skorTotal, keterangan: null, source: 'mengetik' }
  })

  const students = siswaList.map(s => {
    const grades = {}
    let totalNilai = 0
    let countDinilai = 0
    mergedTasks.forEach(mt => {
      // Find grade from any tugasId that has same judul
      let entry = null
      for (const tid of mt.ids) {
        const e = nilaiIndex[`${s.id}_${tid}`]
        if (e && e.nilai !== null && e.nilai !== undefined) { entry = e; break }
      }
      if (!entry) {
        for (const tid of mt.ids) {
          const e = nilaiIndex[`${s.id}_${tid}`]
          if (e) { entry = e; break }
        }
      }
      grades[mt.judul] = entry || null
      if (entry && entry.nilai !== null && entry.nilai !== undefined) {
        totalNilai += entry.nilai
        countDinilai++
      }
    })
    const total = countDinilai > 0 ? Math.round(totalNilai * 10) / 10 : 0
    const rataRata = countDinilai > 0 ? Math.round((totalNilai / countDinilai) * 10) / 10 : 0
    return { id: s.id, nama: s.nama, kelas: s.kelas, rombel: s.rombel, grades, total, rataRata, countDinilai }
  })

  const sorted = [...students].sort((a, b) => b.total - a.total || a.nama.localeCompare(b.nama))
  let rank = 1
  sorted.forEach((s, i) => {
    if (i > 0 && s.total !== sorted[i - 1].total) rank = i + 1
    s.peringkat = s.total === 0 ? '-' : rank
  })

  return { tasks: mergedTasks, students: sorted }
}

// ─── Helper: hitung rank siswa dalam suatu grup ───────────────────────────────
async function computeRankInGroup(targetSiswaId, siswaIds) {
  if (!siswaIds || siswaIds.length === 0) return { rank: null, total: 0 }
  const [filAll, menAll] = await Promise.all([
    prisma.pengumpulan.findMany({
      where: { siswaId: { in: siswaIds }, nilai: { not: null } },
      select: { siswaId: true, nilai: true },
    }),
    prisma.pengumpulanMengetik.findMany({
      where: { siswaId: { in: siswaIds }, status: 'selesai' },
      select: { siswaId: true, skorTotal: true },
    }),
  ])
  const totals = Object.fromEntries(siswaIds.map(id => [id, 0]))
  filAll.forEach(p => { if (p.nilai) totals[p.siswaId] = (totals[p.siswaId] || 0) + p.nilai })
  menAll.forEach(p => { totals[p.siswaId] = (totals[p.siswaId] || 0) + p.skorTotal })

  const sorted = Object.entries(totals).sort((a, b) => b[1] - a[1])
  let rank = 1
  for (let i = 0; i < sorted.length; i++) {
    if (i > 0 && sorted[i][1] < sorted[i - 1][1]) rank = i + 1
    if (sorted[i][0] === targetSiswaId) return { rank, total: siswaIds.length }
  }
  return { rank: siswaIds.length, total: siswaIds.length }
}

// GET /api/nilai/rekap?kelas=X&rombel=Y
router.get('/rekap', authMiddleware, async (req, res) => {
  if (req.user.role !== 'guru') return res.status(403).json({ message: 'Akses ditolak.' })
  try {
    const data = await buildRekapData(req.query.kelas || null, req.query.rombel || null)
    res.json(data)
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil rekap nilai.', error: error.message })
  }
})

// GET /api/nilai/rekap/export?kelas=X&rombel=Y
router.get('/rekap/export', authMiddleware, async (req, res) => {
  if (req.user.role !== 'guru') return res.status(403).json({ message: 'Akses ditolak.' })
  try {
    const { kelas, rombel } = req.query
    const { tasks, students } = await buildRekapData(kelas || null, rombel || null)
    if (students.length === 0) return res.status(404).json({ message: 'Tidak ada data untuk diekspor.' })

    const headers = ['No', 'Nama', 'Kelas', 'Rombel', ...tasks.map(t => t.judul), 'Total', 'Rata-rata', 'Peringkat']
    const rows = students.map((s, idx) => [
      idx + 1, s.nama, s.kelas, s.rombel,
      ...tasks.map(t => { const g = s.grades[t.judul]; return (g && g.nilai !== null && g.nilai !== undefined) ? g.nilai : '' }),
      s.total, s.rataRata, s.peringkat,
    ])

    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows])
    ws['!cols'] = [{ wch: 4 }, { wch: 30 }, { wch: 8 }, { wch: 8 }, ...tasks.map(() => ({ wch: 20 })), { wch: 8 }, { wch: 10 }, { wch: 10 }]
    const wb = XLSX.utils.book_new()
    const sheetName = kelas ? (rombel ? `Kelas ${kelas} ${rombel}` : `Kelas ${kelas}`) : 'Semua Kelas'
    XLSX.utils.book_append_sheet(wb, ws, sheetName)
    const buf = XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' })
    const filename = kelas ? (rombel ? `rekap-nilai-kelas${kelas}-rombel${rombel}.xlsx` : `rekap-nilai-kelas${kelas}.xlsx`) : 'rekap-nilai-semua.xlsx'
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`).type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet').send(buf)
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengekspor.', error: error.message })
  }
})

// GET /api/nilai/kelas-list
router.get('/kelas-list', authMiddleware, async (req, res) => {
  if (req.user.role !== 'guru') return res.status(403).json({ message: 'Akses ditolak.' })
  try {
    const rows = await prisma.siswa.findMany({
      select: { kelas: true, rombel: true }, distinct: ['kelas', 'rombel'],
      orderBy: [{ kelas: 'asc' }, { rombel: 'asc' }],
    })
    res.json(rows)
  } catch (e) {
    res.status(500).json({ message: 'Gagal.', error: e.message })
  }
})

// GET /api/nilai/siswa/rekap — Rekap nilai personal siswa yang sedang login
router.get('/siswa/rekap', authMiddleware, async (req, res) => {
  if (req.user.role !== 'siswa') return res.status(403).json({ message: 'Hanya untuk siswa.' })
  try {
    const siswa = await prisma.siswa.findUnique({ where: { id: req.user.id } })
    if (!siswa) return res.status(404).json({ message: 'Siswa tidak ditemukan.' })

    const allTugas = await prisma.tugas.findMany({
      where: { status: { in: ['launch', 'ditutup'] } },
      include: { lampiran: { select: { id: true, namaFile: true } } },
      orderBy: { createdAt: 'asc' },
    })
    const myTugas = allTugas.filter(t => {
      const kt = JSON.parse(t.kelasTarget || '[]')
      const rt = t.rombelTarget ? JSON.parse(t.rombelTarget || '[]') : []
      return kt.includes(siswa.kelas) && (rt.length === 0 || rt.includes(siswa.rombel))
    })
    const tugasIds = myTugas.map(t => t.id)

    const [filePengumpulan, mengetikPengumpulan] = await Promise.all([
      prisma.pengumpulan.findMany({
        where: { siswaId: siswa.id, tugasId: { in: tugasIds } },
        select: { id: true, tugasId: true, namaFile: true, nilai: true, keterangan: true, updatedAt: true },
      }),
      prisma.pengumpulanMengetik.findMany({
        where: { siswaId: siswa.id, tugasId: { in: tugasIds } },
        select: { id: true, tugasId: true, status: true, hasilKetik: true, skorTotal: true, skorKebenaran: true, skorKecepatan: true, waktuSelesai: true, durasiDetik: true },
      }),
    ])

    const filIdx = Object.fromEntries(filePengumpulan.map(p => [p.tugasId, p]))
    const menIdx = Object.fromEntries(mengetikPengumpulan.map(p => [p.tugasId, p]))

    const grades = myTugas.map(t => {
      if (t.jenis === 'mengetik') {
        const m = menIdx[t.id]
        const selesai = m?.status === 'selesai'
        return {
          tugasId: t.id, judul: t.judul, jenis: t.jenis, deadline: t.deadline,
          nilai: selesai ? Math.round((m.skorTotal || 0) * 10) / 10 : null,
          keterangan: selesai ? `Kebenaran ${Math.round(m.skorKebenaran)}% · Kecepatan ${Math.round(m.skorKecepatan)}%` : null,
          pengumpulanId: m?.id || null, namaFile: null,
          hasilKetik: m?.hasilKetik || null, status: m?.status || null,
          durasiDetik: m?.durasiDetik || null, waktuSelesai: m?.waktuSelesai || null,
          sudahDikumpul: selesai,
        }
      } else {
        const f = filIdx[t.id]
        return {
          tugasId: t.id, judul: t.judul, jenis: t.jenis, deadline: t.deadline,
          nilai: f?.nilai ?? null, keterangan: f?.keterangan || null,
          pengumpulanId: f?.id || null, namaFile: f?.namaFile || null,
          hasilKetik: null, status: f ? 'selesai' : null,
          waktuSelesai: f?.updatedAt || null, sudahDikumpul: !!f,
        }
      }
    })

    const nilaiList = grades.filter(g => g.nilai !== null).map(g => g.nilai)
    const totalNilai = Math.round(nilaiList.reduce((s, n) => s + n, 0) * 10) / 10
    const rataRata = nilaiList.length > 0 ? Math.round((totalNilai / nilaiList.length) * 10) / 10 : 0

    const [rombelSiswaIds, kelasSiswaIds] = await Promise.all([
      prisma.siswa.findMany({ where: { kelas: siswa.kelas, rombel: siswa.rombel }, select: { id: true } }).then(r => r.map(s => s.id)),
      prisma.siswa.findMany({ where: { kelas: siswa.kelas }, select: { id: true } }).then(r => r.map(s => s.id)),
    ])

    const [rankRombel, rankKelas] = await Promise.all([
      computeRankInGroup(siswa.id, rombelSiswaIds),
      computeRankInGroup(siswa.id, kelasSiswaIds),
    ])

    res.json({
      siswa: { id: siswa.id, nama: siswa.nama, kelas: siswa.kelas, rombel: siswa.rombel },
      grades,
      stats: {
        totalNilai, rataRata, countDinilai: nilaiList.length, totalTugas: grades.length,
        rankRombel: rankRombel.rank, totalRombel: rankRombel.total,
        rankKelas: rankKelas.rank, totalKelas: rankKelas.total,
      },
    })
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil rekap nilai siswa.', error: error.message })
  }
})

// GET /api/nilai/siswa/stats — Ringkasan cepat untuk Dashboard
router.get('/siswa/stats', authMiddleware, async (req, res) => {
  if (req.user.role !== 'siswa') return res.status(403).json({ message: 'Hanya untuk siswa.' })
  try {
    const siswa = await prisma.siswa.findUnique({ where: { id: req.user.id } })
    if (!siswa) return res.status(404).json({ message: 'Siswa tidak ditemukan.' })

    const [rombelSiswaIds, kelasSiswaIds] = await Promise.all([
      prisma.siswa.findMany({ where: { kelas: siswa.kelas, rombel: siswa.rombel }, select: { id: true } }).then(r => r.map(s => s.id)),
      prisma.siswa.findMany({ where: { kelas: siswa.kelas }, select: { id: true } }).then(r => r.map(s => s.id)),
    ])

    const [rankRombel, rankKelas, filePengumpulan, mengetikPengumpulan] = await Promise.all([
      computeRankInGroup(siswa.id, rombelSiswaIds),
      computeRankInGroup(siswa.id, kelasSiswaIds),
      prisma.pengumpulan.findMany({ where: { siswaId: siswa.id, nilai: { not: null } }, select: { nilai: true } }),
      prisma.pengumpulanMengetik.findMany({ where: { siswaId: siswa.id, status: 'selesai' }, select: { skorTotal: true } }),
    ])

    const nilaiList = [
      ...filePengumpulan.map(p => p.nilai),
      ...mengetikPengumpulan.map(p => p.skorTotal),
    ]
    const totalNilai = Math.round(nilaiList.reduce((s, n) => s + n, 0) * 10) / 10
    const rataRata = nilaiList.length > 0 ? Math.round((totalNilai / nilaiList.length) * 10) / 10 : 0

    res.json({
      rankRombel: rankRombel.rank, totalRombel: rankRombel.total,
      rankKelas: rankKelas.rank, totalKelas: rankKelas.total,
      totalNilai, rataRata,
    })
  } catch (error) {
    res.status(500).json({ message: 'Gagal.', error: error.message })
  }
})

export default router
