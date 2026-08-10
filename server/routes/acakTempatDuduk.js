import express from 'express'
import { PrismaClient } from '@prisma/client'
import authMiddleware from '../middleware/authMiddleware.js'

const prisma = new PrismaClient()
const router = express.Router()

const shuffle = (array) => {
  const arr = [...array]
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]]
  }
  return arr
}

const normalizeGender = (value) => String(value || '').toLowerCase()
const isMale = (student) => normalizeGender(student.jenisKelamin).startsWith('l')

// Jumlah pasangan (berdampingan 1 komputer) minimal/ideal untuk suatu gender,
// proporsional terhadap jumlah siswa gender tersebut. Formula ini dikalibrasi
// dari 2 contoh acuan dari guru:
//   - 16 siswa (gender sama) -> minimal 5 pasang berdampingan (16 * 0.3125 = 5)
//   - 5 siswa (gender sama)  -> maksimal 2 pasang berdampingan (dibatasi supaya
//     grup kecil tidak dipaksa berpasangan semua)
function targetPairsForGender(count) {
  if (count <= 0) return 0
  let pairs = Math.round(count * 0.3125)
  if (count <= 6) pairs = Math.min(pairs, 2) // grup kecil: maksimal 2 pasang
  pairs = Math.min(pairs, Math.floor(count / 2)) // tidak boleh lebih dari kapasitas fisik
  return Math.max(pairs, 0)
}

// Tentukan berapa pasang laki-laki & perempuan yang dibentuk dari sisa siswa
// (di luar yang sudah wajib berpasangan lewat tag), menghormati target rasio
// per-gender, tapi tetap dinaikkan kalau kapasitas 16 komputer memaksa
// (supaya semua siswa kebagian tempat duduk).
function allocatePairs(maleCount, femaleCount, minTotalPairs, exact = false) {
  const maleCap = Math.floor(maleCount / 2)
  const femaleCap = Math.floor(femaleCount / 2)
  let malePairs = 0
  let femalePairs = 0

  if (exact) {
    // Exact mode: build only the minimum pairs needed, no ideal ratio.
    let remaining = minTotalPairs
    while (remaining > 0) {
      if (malePairs < maleCap) {
        malePairs++
        remaining--
      } else if (femalePairs < femaleCap) {
        femalePairs++
        remaining--
      } else {
        break
      }
    }
  } else {
    // Default mode: respect ideal ratio per gender.
    malePairs = Math.min(targetPairsForGender(maleCount), maleCap)
    femalePairs = Math.min(targetPairsForGender(femaleCount), femaleCap)

    let total = malePairs + femalePairs
    while (total < minTotalPairs && (malePairs < maleCap || femalePairs < femaleCap)) {
      const canMale = malePairs < maleCap
      const canFemale = femalePairs < femaleCap
      if (canMale && (!canFemale || maleCount >= femaleCount)) {
        malePairs++
      } else if (canFemale) {
        femalePairs++
      } else break
      total = malePairs + femalePairs
    }
  }

  return { malePairs, femalePairs }
}

router.post('/shuffle', authMiddleware, async (req, res) => {
  if (req.user.role !== 'guru') return res.status(403).json({ message: 'Akses ditolak.' })

  try {
    const { kelas, rombel, mustPairIds = [], tidakMasukIds = [] } = req.body

    const siswaList = await prisma.siswa.findMany({ where: { kelas, rombel } })
    if (siswaList.length === 0) {
      return res.status(400).json({ message: 'Tidak ada siswa di kelas ini.' })
    }

    const tidakMasukSet = new Set(tidakMasukIds || [])
    const tidakMasuk = siswaList.filter((s) => tidakMasukSet.has(s.id))
    const activeList = siswaList.filter((s) => !tidakMasukSet.has(s.id))

    if (activeList.length === 0) {
      return res.status(400).json({ message: 'Semua siswa ditandai tidak masuk.' })
    }
    if (activeList.length > 32) {
      return res.status(400).json({ message: 'Maksimal 32 siswa aktif untuk 16 perangkat.' })
    }

    const MAX_DEVICES = 16
    const devices = Array.from({ length: MAX_DEVICES }, (_, i) => ({ id: i + 1, students: [] }))

    const sameGender = (a, b) => normalizeGender(a.jenisKelamin) === normalizeGender(b.jenisKelamin)

    // Layout baris fisik:
    //   [0](kiri) [1](kiri)   [2](kanan) [3](kanan)
    //   [4](kiri) [5](kiri)   [6](kanan) [7](kanan)
    //   [8](kiri) [9](kiri)   [10](kanan)[11](kanan)
    //   [12](kiri)[13](kiri)  [14](kanan)[15](kanan)
    const rows = [[0, 1, 2, 3], [4, 5, 6, 7], [8, 9, 10, 11], [12, 13, 14, 15]]
    const leftOfRow = (r) => [rows[r][0], rows[r][1]]
    const rightOfRow = (r) => [rows[r][2], rows[r][3]]

    // ── 1. Tagged pairs (wajib berdampingan) ──────────────────────────
    const taggedSet = new Set((mustPairIds || []).filter((id) => !tidakMasukSet.has(id)))
    const tagged = shuffle(activeList.filter((s) => taggedSet.has(s.id)))
    let untagged = shuffle(activeList.filter((s) => !taggedSet.has(s.id)))

    const taggedPairs = [] // { students, gender }
    for (const student of tagged) {
      const partnerIdx = untagged.findIndex((c) => sameGender(student, c))
      if (partnerIdx < 0) {
        return res.status(400).json({
          message: `${student.nama} ditandai wajib berdampingan, tidak ada teman dengan jenis kelamin sama.`,
        })
      }
      const partner = untagged.splice(partnerIdx, 1)[0]
      taggedPairs.push({ students: [student, partner], gender: isMale(student) ? 'L' : 'P' })
    }

    // ── 2. Hitung auto-pairs dari sisa ────────────────────────────────
    const poolMale = untagged.filter(isMale)
    const poolFemale = untagged.filter((s) => !isMale(s))
    const pairsNeededTotal = Math.max(0, activeList.length - MAX_DEVICES)
    const minPoolPairs = Math.max(0, pairsNeededTotal - taggedPairs.length)

    const { malePairs: malePairCount, femalePairs: femalePairCount } = allocatePairs(
      poolMale.length, poolFemale.length, minPoolPairs, activeList.length > MAX_DEVICES,
    )

    const shuffledMale = shuffle(poolMale)
    const shuffledFemale = shuffle(poolFemale)

    const malePairs = []
    for (let i = 0; i < malePairCount; i++) malePairs.push({ students: [shuffledMale.pop(), shuffledMale.pop()], gender: 'L' })
    const femalePairs = []
    for (let i = 0; i < femalePairCount; i++) femalePairs.push({ students: [shuffledFemale.pop(), shuffledFemale.pop()], gender: 'P' })

    const singles = shuffle([...shuffledMale, ...shuffledFemale])
    let maleSinglesRemaining = singles.filter(isMale).length
    let femaleSinglesRemaining = singles.filter((s) => !isMale(s)).length

    // ── 3. Buat slot template (di mana setiap siswa duduk) ─────────────
    //    Aturan:
    //      • Pasangan LAKI → utamakan sisi KIRI
    //      • Pasangan PEREMPUAN → utamakan sisi KANAN
    //      • Dalam satu baris, hindari KEDUA sisi berpasangan (pair di kiri & kanan)
    //      • Siswa sendiri mengisi slot kosong menjaga gender berdekatan
    const slotPlan = [] // { idx, pair, gender }
    const used = new Set()
    const shuffledRows = shuffle([0, 1, 2, 3])

    function claimSlot(side, rowIdx) {
      const indices = side === 'left' ? leftOfRow(rowIdx) : rightOfRow(rowIdx)
      for (const idx of shuffle(indices)) {
        if (!used.has(idx)) { used.add(idx); return idx }
      }
      return null
    }

    function placePair(entry) {
      const preferredSide = entry.gender === 'L' ? 'left' : 'right'
      const otherSide = preferredSide === 'left' ? 'right' : 'left'

      // Coba sisi utama dulu (1 per baris, hindari double-pair)
      for (const r of shuffledRows) {
        const idx = claimSlot(preferredSide, r)
        if (idx !== null) { slotPlan.push({ idx, pair: true, gender: entry.gender }); return }
      }
      // Fallback: sisi lain
      for (const r of shuffledRows) {
        const idx = claimSlot(otherSide, r)
        if (idx !== null) { slotPlan.push({ idx, pair: true, gender: entry.gender }); return }
      }
    }

    // Tempatkan tagged pairs dulu (hormati gender)
    for (const tp of shuffle(taggedPairs)) placePair(tp)
    // Lalu pasangan laki-laki (utamakan kiri)
    for (const mp of shuffle(malePairs)) placePair(mp)
    // Lalu pasangan perempuan (utamakan kanan)
    for (const fp of shuffle(femalePairs)) placePair(fp)

    // Isi slot single — laki di kiri, perempuan di kanan
    const remainingLeft = []
    const remainingRight = []
    for (const r of [0, 1, 2, 3]) {
      for (const idx of leftOfRow(r)) if (!used.has(idx)) remainingLeft.push(idx)
      for (const idx of rightOfRow(r)) if (!used.has(idx)) remainingRight.push(idx)
    }

    for (const idx of shuffle(remainingLeft)) {
      if (maleSinglesRemaining > 0) { slotPlan.push({ idx, pair: false, gender: 'L' }); maleSinglesRemaining--; used.add(idx) }
      else if (femaleSinglesRemaining > 0) { slotPlan.push({ idx, pair: false, gender: 'P' }); femaleSinglesRemaining--; used.add(idx) }
    }
    for (const idx of shuffle(remainingRight)) {
      if (femaleSinglesRemaining > 0) { slotPlan.push({ idx, pair: false, gender: 'P' }); femaleSinglesRemaining--; used.add(idx) }
      else if (maleSinglesRemaining > 0) { slotPlan.push({ idx, pair: false, gender: 'L' }); maleSinglesRemaining--; used.add(idx) }
    }

    // ── 4. Isi devices berdasarkan slotPlan ────────────────────────────
    const malePool = shuffle(singles.filter(isMale))
    const femalePool = shuffle(singles.filter((s) => !isMale(s)))

    for (const slot of slotPlan) {
      if (slot.pair) {
        const pool = slot.gender === 'L' ? malePool : femalePool
        if (pool.length >= 2) {
          devices[slot.idx].students = [pool.pop(), pool.pop()]
        } else {
          // Fallback: ambil dari pool manapun
          const a = malePool.pop() || femalePool.pop()
          const b = malePool.pop() || femalePool.pop()
          devices[slot.idx].students = [a, b].filter(Boolean)
        }
      } else {
        const pool = slot.gender === 'L' ? malePool : femalePool
        const s = pool.pop() || (slot.gender === 'L' ? femalePool.pop() : malePool.pop())
        if (s) devices[slot.idx].students = [s]
      }
    }

    // Overflow: sisa yang belum kebagian slot
    const overflow = [...malePool, ...femalePool]
    if (overflow.length > 0) {
      const available = shuffle(devices.filter((d) => d.students.length === 1))
      for (const student of overflow) {
        const matchIdx = available.findIndex((d) => sameGender(d.students[0], student))
        if (matchIdx >= 0) available.splice(matchIdx, 1)[0].students.push(student)
      }
    }

    devices.sort((a, b) => a.id - b.id)
    res.json({
      devices,
      tidakMasuk: tidakMasuk.map((s) => ({ id: s.id, nama: s.nama, jenisKelamin: s.jenisKelamin })),
      ringkasan: {
        totalAktif: activeList.length,
        totalLaki: activeList.filter(isMale).length,
        totalPerempuan: activeList.filter((s) => !isMale(s)).length,
        pasanganWajibTag: taggedPairs.length,
        pasanganLaki: malePairs.length + taggedPairs.filter((p) => p.gender === 'L').length,
        pasanganPerempuan: femalePairs.length + taggedPairs.filter((p) => p.gender === 'P').length,
      },
    })
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengacak tempat duduk.', error: error.message })
  }
})

export default router
