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
    // Siswa yang ditag "tidak masuk" tidak ikut diacak sama sekali.
    const activeList = siswaList.filter((s) => !tidakMasukSet.has(s.id))

    if (activeList.length === 0) {
      return res.status(400).json({ message: 'Semua siswa ditandai tidak masuk, tidak ada yang bisa diacak.' })
    }
    if (activeList.length > 32) {
      return res.status(400).json({ message: 'Maksimal 32 siswa aktif untuk 16 perangkat (2 siswa per perangkat).' })
    }

    const MAX_DEVICES = 16
    const devices = Array.from({ length: MAX_DEVICES }, (_, i) => ({ id: i + 1, students: [] }))
    const rightDeviceIndexes = [2, 3, 6, 7, 10, 11, 14, 15]
    const leftDeviceIndexes = [0, 1, 4, 5, 8, 9, 12, 13]

    const sameGender = (a, b) => normalizeGender(a.jenisKelamin) === normalizeGender(b.jenisKelamin)

    const taggedSet = new Set((mustPairIds || []).filter((id) => !tidakMasukSet.has(id)))
    const tagged = shuffle(activeList.filter((s) => taggedSet.has(s.id)))
    let untagged = shuffle(activeList.filter((s) => !taggedSet.has(s.id)))

    // Siswa yang ditag "wajib berdampingan" HARUS dipasangkan dengan teman
    // acak yang TIDAK ditag (bukan sesama siswa yang ditag), supaya distribusi
    // pasangan wajib tetap tersebar dan tidak mengelompok sesama tag.
    const pairs = []
    for (const student of tagged) {
      const partnerIndex = untagged.findIndex((candidate) => sameGender(student, candidate))
      if (partnerIndex < 0) {
        return res.status(400).json({
          message: `${student.nama} ditandai wajib berdampingan, tetapi tidak ada teman (yang tidak ditag) dengan jenis kelamin sama untuk dipasangkan.`,
        })
      }
      const partner = untagged.splice(partnerIndex, 1)[0]
      pairs.push([student, partner])
    }
    const taggedPairsCount = pairs.length

    // Sisa siswa (di luar pasangan wajib) yang akan diacak & dipasangkan
    // secara proporsional sesuai rasio gender.
    const pool = untagged
    const poolMale = pool.filter(isMale)
    const poolFemale = pool.filter((s) => !isMale(s))

    // Berapa pasang TOTAL yang wajib terbentuk supaya semua siswa muat di 16 komputer.
    const pairsNeededTotal = Math.max(0, activeList.length - MAX_DEVICES)
    const minPoolPairs = Math.max(0, pairsNeededTotal - taggedPairsCount)

    const { malePairs: malePairCount, femalePairs: femalePairCount } = allocatePairs(
      poolMale.length, poolFemale.length, minPoolPairs, activeList.length > MAX_DEVICES
    )

    const shuffledMale = shuffle(poolMale)
    const shuffledFemale = shuffle(poolFemale)

    const poolMalePairs = []
    for (let i = 0; i < malePairCount; i++) {
      poolMalePairs.push([shuffledMale.pop(), shuffledMale.pop()])
    }
    const poolFemalePairs = []
    for (let i = 0; i < femalePairCount; i++) {
      poolFemalePairs.push([shuffledFemale.pop(), shuffledFemale.pop()])
    }

    const singles = shuffle([...shuffledMale, ...shuffledFemale])
    const maleSingles = singles.filter(isMale)
    const femaleSingles = singles.filter((s) => !isMale(s))
    const orderedSingles = [...maleSingles, ...femaleSingles]

    // Campurkan semua indeks secara acak supaya pasangan menyebar ke kiri & kanan
    const deviceOrder = shuffle([...leftDeviceIndexes, ...rightDeviceIndexes])
    let cursor = 0

    // Tempatkan pasangan wajib (tag) dulu, lalu pasangan laki-laki, lalu pasangan perempuan.
    const malePairsAll = shuffle([...pairs.filter((p) => isMale(p[0])), ...poolMalePairs])
    const femalePairsAll = shuffle([...pairs.filter((p) => !isMale(p[0])), ...poolFemalePairs])
    const orderedPairs = shuffle([...malePairsAll, ...femalePairsAll])

    for (const pair of orderedPairs) {
      if (cursor >= deviceOrder.length) break
      const idx = deviceOrder[cursor]
      devices[idx].students = pair
      cursor++
    }

    // Isi device kosong dengan 1 siswa dulu.
    for (const student of orderedSingles) {
      if (cursor >= deviceOrder.length) break
      const idx = deviceOrder[cursor]
      if (devices[idx].students.length === 0) {
        devices[idx].students.push(student)
        cursor++
      }
    }

    // Overflow (kalau masih ada sisa siswa tapi device sudah habis dipakai untuk single),
    // masukkan ke device yang baru terisi 1 siswa dengan gender sama.
    const placedIds = new Set(devices.flatMap((d) => d.students.map((s) => s.id)))
    const overflow = orderedSingles.filter((s) => !placedIds.has(s.id))
    if (overflow.length > 0) {
      const available = shuffle(devices.filter((d) => d.students.length === 1))
      for (const student of overflow) {
        const matchIndex = available.findIndex((device) => sameGender(device.students[0], student))
        if (matchIndex < 0) continue
        const device = available.splice(matchIndex, 1)[0]
        device.students.push(student)
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
        pasanganWajibTag: taggedPairsCount,
        pasanganLaki: malePairsAll.length,
        pasanganPerempuan: femalePairsAll.length,
      },
    })
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengacak tempat duduk.', error: error.message })
  }
})

export default router
