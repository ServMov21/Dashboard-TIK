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
    const untagged = shuffle(activeList.filter((s) => !taggedSet.has(s.id)))

    const taggedPairs = []
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
    const poolMale = shuffle(untagged.filter(isMale))
    const poolFemale = shuffle(untagged.filter((s) => !isMale(s)))
    const slotsNeeded = activeList.length - taggedPairs.length // tiap pair pakai 1 slot
    const pairsNeededFromPool = Math.max(0, slotsNeeded - MAX_DEVICES)

    const { malePairs: malePairCount, femalePairs: femalePairCount } = allocatePairs(
      poolMale.length, poolFemale.length, pairsNeededFromPool, activeList.length > MAX_DEVICES,
    )

    const autoPairsL = []
    for (let i = 0; i < malePairCount; i++) autoPairsL.push({ students: [poolMale.pop(), poolMale.pop()], gender: 'L' })
    const autoPairsP = []
    for (let i = 0; i < femalePairCount; i++) autoPairsP.push({ students: [poolFemale.pop(), poolFemale.pop()], gender: 'P' })

    // Siswa yang tersisa jadi singles
    const singlesM = [...poolMale]
    const singlesF = [...poolFemale]

    // ── 3. Kumpulkan semua grup (pairs + singles) ─────────────────────
    const allPairs = shuffle([...taggedPairs, ...autoPairsL, ...autoPairsP])
    const allSinglesM = shuffle(singlesM)
    const allSinglesF = shuffle(singlesF)

    // Preferensi device: L→kiri, P→kanan
    // Layout: baris r punya kiri=[r*4, r*4+1], kanan=[r*4+2, r*4+3]
    const leftDevices = [0, 1, 4, 5, 8, 9, 12, 13]
    const rightDevices = [2, 3, 6, 7, 10, 11, 14, 15]

    const used = new Set()

    // Tempatkan pairs dulu
    const pairsL = allPairs.filter(p => p.gender === 'L')
    const pairsP = allPairs.filter(p => p.gender === 'P')

    function placeGroup(group, preferred, fallback) {
      for (const idx of preferred) {
        if (!used.has(idx)) { used.add(idx); devices[idx].students = group.students; return }
      }
      for (const idx of fallback) {
        if (!used.has(idx)) { used.add(idx); devices[idx].students = group.students; return }
      }
    }

    for (const p of pairsL) placeGroup(p, shuffle([...leftDevices]), shuffle([...rightDevices]))
    for (const p of pairsP) placeGroup(p, shuffle([...rightDevices]), shuffle([...leftDevices]))

    // Tempatkan singles: L→kiri dulu, P→kanan dulu
    const freeLeft = shuffle(leftDevices.filter(i => !used.has(i)))
    const freeRight = shuffle(rightDevices.filter(i => !used.has(i)))

    // Isi laki-laki ke kiri, lalu sisa ke kanan
    const mQueue = [...allSinglesM]
    const fQueue = [...allSinglesF]

    for (const idx of freeLeft) {
      const s = mQueue.pop() || fQueue.pop()
      if (s) { devices[idx].students = [s]; used.add(idx) }
    }
    for (const idx of freeRight) {
      const s = fQueue.pop() || mQueue.pop()
      if (s) { devices[idx].students = [s]; used.add(idx) }
    }

    // Overflow: siswa yang masih tersisa, masukkan ke device yang baru punya 1
    const overflow = [...mQueue, ...fQueue]
    if (overflow.length > 0) {
      const available = shuffle(
        devices.filter((d) => d.students.length === 1).map(d => d)
      )
      for (const student of overflow) {
        // Cari yang gender sama dulu
        let placed = false
        for (let i = 0; i < available.length; i++) {
          if (available[i].students.length < 2 && sameGender(available[i].students[0], student)) {
            available[i].students.push(student); placed = true; break
          }
        }
        if (!placed) {
          // Gender beda pun boleh, daripada tidak duduk
          for (let i = 0; i < available.length; i++) {
            if (available[i].students.length < 2) {
              available[i].students.push(student); placed = true; break
            }
          }
        }
        if (!placed) {
          // Semua device penuh 2, cari yang masih kosong total
          for (const d of devices) {
            if (d.students.length === 0) { d.students = [student]; break }
          }
        }
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
