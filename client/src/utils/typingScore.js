// Utility untuk menilai tugas mengetik.
// Naskah (dari guru) dan hasil ketikan (dari siswa) disimpan sebagai HTML supaya
// bisa mempertahankan format tebal/miring/garis bawah. Untuk menilai kebenaran,
// HTML tersebut diuraikan menjadi rangkaian karakter beserta atribut formatnya,
// lalu dibandingkan menggunakan pencocokan berbasis "alignment" (bukan
// posisi-per-posisi mentah) supaya penilaian tetap adil & masuk akal.

// Bobot default (dipakai kalau guru tidak mengatur bobot kustom untuk tugas
// yang bersangkutan). Total selalu 100.
const DEFAULT_BOBOT_KEBENARAN = 90
const DEFAULT_BOBOT_KECEPATAN = 10

function isBoldStyle(style = '') {
  return /font-weight\s*:\s*(bold|[6-9]00)/i.test(style)
}
function isItalicStyle(style = '') {
  return /font-style\s*:\s*italic/i.test(style)
}
function isUnderlineStyle(style = '') {
  return /text-decoration[a-z-]*\s*:\s*[^;]*underline/i.test(style)
}

function getAlignFromStyle(style = '') {
  const m = /text-align\s*:\s*(left|center|right|justify)/i.exec(style)
  return m ? m[1].toLowerCase() : null
}

/**
 * Uraikan string HTML menjadi array karakter dengan atribut format:
 * [{ char, bold, italic, underline, align }, ...]
 * `align` diambil dari elemen blok (div/p/li) terdekat yang mengandung teks
 * tersebut (rata kiri/tengah/kanan), default 'left' kalau tidak diset.
 * Setiap elemen blok (div/p) dianggap diakhiri baris baru ('\n'), begitu juga <br>.
 */
export function extractRuns(html) {
  const container = document.createElement('div')
  container.innerHTML = html || ''
  const runs = []

  const BLOCK_TAGS = new Set(['div', 'p', 'li'])

  function walk(node, fmt, align) {
    if (node.nodeType === Node.TEXT_NODE) {
      const text = node.textContent || ''
      for (const ch of text) {
        if (ch === '\u00A0') { runs.push({ char: ' ', ...fmt, align }); continue } // &nbsp;
        runs.push({ char: ch, ...fmt, align })
      }
      return
    }
    if (node.nodeType !== Node.ELEMENT_NODE) return

    const tag = node.tagName.toLowerCase()
    if (tag === 'br') {
      runs.push({ char: '\n', bold: false, italic: false, underline: false, align })
      return
    }
    if (tag === 'script' || tag === 'style') return

    const style = node.getAttribute ? (node.getAttribute('style') || '') : ''
    const newFmt = {
      bold: fmt.bold || tag === 'b' || tag === 'strong' || isBoldStyle(style),
      italic: fmt.italic || tag === 'i' || tag === 'em' || isItalicStyle(style),
      underline: fmt.underline || tag === 'u' || isUnderlineStyle(style),
    }
    // Rata teks berlaku per blok; kalau blok ini tidak menentukan sendiri, warisi dari induk.
    const newAlign = BLOCK_TAGS.has(tag) ? (getAlignFromStyle(style) || align) : align

    const startLen = runs.length
    node.childNodes.forEach((child) => walk(child, newFmt, newAlign))

    // Anggap blok (div/p/li) sebagai satu baris; tambahkan newline setelah blok
    // jika blok tersebut punya isi dan bukan blok terakhir.
    if (BLOCK_TAGS.has(tag) && node.nextSibling && runs.length > startLen) {
      runs.push({ char: '\n', bold: false, italic: false, underline: false, align: newAlign })
    }
  }

  container.childNodes.forEach((n) => walk(n, { bold: false, italic: false, underline: false }, 'left'))

  // Buang newline berturut-turut di akhir & rapikan
  while (runs.length && runs[runs.length - 1].char === '\n') runs.pop()

  return runs
}

const SEPARATOR_CHARS = new Set([' ', '\n'])

/**
 * Pecah rangkaian karakter (runs) menjadi potongan ("chunk") kata dan pemisah
 * (spasi/baris baru). Ini yang memungkinkan penilaian tetap adil walau ada
 * spasi yang kurang/lebih di suatu tempat: kesalahan itu cuma "memakan" satu
 * chunk pemisah, bukan menggeser & merusak pencocokan seluruh teks sesudahnya.
 */
function tokenize(runs) {
  const chunks = []
  let current = null
  for (const r of runs) {
    if (SEPARATOR_CHARS.has(r.char)) {
      if (current) { chunks.push(current); current = null }
      chunks.push({ type: 'sep', chars: [r] })
    } else {
      if (!current) current = { type: 'word', chars: [] }
      current.chars.push(r)
    }
  }
  if (current) chunks.push(current)
  return chunks
}

function chunkKey(chunk) {
  if (chunk.type === 'sep') return `SEP:${chunk.chars[0].char}`
  return `WORD:${chunk.chars.map((c) => c.char.toLowerCase()).join('')}`
}

/**
 * Longest Common Subsequence antara dua daftar key, mengembalikan daftar
 * pasangan indeks [indexA, indexB] yang cocok, berurutan menaik pada kedua sisi.
 * Dipakai untuk mencocokkan chunk kata/pemisah target vs hasil ketikan siswa,
 * sehingga penambahan/pengurangan satu chunk tidak menggeser & merusak
 * pencocokan chunk-chunk lain yang sebenarnya sudah benar.
 */
function lcsPairs(keysA, keysB) {
  const n = keysA.length
  const m = keysB.length
  const dp = new Int32Array((n + 1) * (m + 1))
  const at = (i, j) => i * (m + 1) + j

  for (let i = 1; i <= n; i++) {
    for (let j = 1; j <= m; j++) {
      if (keysA[i - 1] === keysB[j - 1]) {
        dp[at(i, j)] = dp[at(i - 1, j - 1)] + 1
      } else {
        dp[at(i, j)] = Math.max(dp[at(i - 1, j)], dp[at(i, j - 1)])
      }
    }
  }

  const pairs = []
  let i = n
  let j = m
  while (i > 0 && j > 0) {
    if (keysA[i - 1] === keysB[j - 1]) {
      pairs.push([i - 1, j - 1])
      i--; j--
    } else if (dp[at(i - 1, j)] >= dp[at(i, j - 1)]) {
      i--
    } else {
      j--
    }
  }
  pairs.reverse()
  return pairs
}

/**
 * Nilai satu pasang karakter target vs karakter siswa yang SUDAH dianggap
 * "cocok" (huruf sama, hanya besar/kecil dan/atau format yang mungkin beda).
 * Filosofi: kesalahan kecil (kapitalisasi, format) dapat pengurangan nilai
 * yang wajar, bukan langsung dianggap salah total (0) seperti sebelumnya.
 *   - huruf & besar/kecil & format & rata semua cocok -> nilai penuh (1)
 *   - huruf benar tapi besar/kecil beda              -> potongan sedang (-0.3)
 *   - tiap atribut format (tebal/miring/garis bawah/rata) beda -> potongan kecil (-0.05 masing-masing)
 * Nilai tidak pernah jatuh di bawah 0.4 selama hurufnya sendiri sudah benar,
 * supaya kesalahan format kecil tidak menenggelamkan huruf yang sudah tepat.
 */
function nilaiKarakterCocok(target, siswa) {
  let nilai = 1
  const bedaKapitalisasi = target.char !== siswa.char && target.char.toLowerCase() === siswa.char.toLowerCase()
  if (bedaKapitalisasi) nilai -= 0.3
  if (!!target.bold !== !!siswa.bold) nilai -= 0.05
  if (!!target.italic !== !!siswa.italic) nilai -= 0.05
  if (!!target.underline !== !!siswa.underline) nilai -= 0.05
  if ((target.align || 'left') !== (siswa.align || 'left')) nilai -= 0.05
  return Math.max(0.4, nilai)
}

/**
 * Bandingkan naskah target (dari guru) dengan hasil ketikan siswa.
 *
 * Berbeda dari versi sebelumnya (yang membandingkan karakter berdasarkan
 * posisi index secara mentah), fungsi ini mencocokkan teks per "kata" dan
 * "pemisah" (spasi/baris baru) menggunakan LCS lebih dulu. Dengan begitu:
 *   - kurang/lebih satu spasi hanya membuat SATU chunk pemisah itu yang
 *     dianggap salah, bukan menggeser dan merusak penilaian seluruh teks
 *     setelahnya seperti pada perbandingan posisi-per-posisi biasa.
 *   - huruf besar/kecil yang tertukar di awal kalimat/kata tetap dapat nilai
 *     parsial (bukan langsung 0), karena hurufnya sendiri sudah benar.
 *
 * Nilai kebenaran = (total kredit karakter / total karakter target) * bobotKebenaran
 */
export function computeSkorKebenaran(targetHtml, studentHtml, bobotKebenaran = DEFAULT_BOBOT_KEBENARAN) {
  const bobot = typeof bobotKebenaran === 'number' && !Number.isNaN(bobotKebenaran)
    ? bobotKebenaran
    : DEFAULT_BOBOT_KEBENARAN

  const target = extractRuns(targetHtml)
  const student = extractRuns(studentHtml)
  const total = target.length || 1

  const targetChunks = tokenize(target)
  const studentChunks = tokenize(student)
  const targetKeys = targetChunks.map(chunkKey)
  const studentKeys = studentChunks.map(chunkKey)
  const pairs = lcsPairs(targetKeys, studentKeys)

  let kredit = 0
  for (const [ti, si] of pairs) {
    const tChunk = targetChunks[ti]
    const sChunk = studentChunks[si]
    // Chunk yang key-nya sama sudah pasti sama panjang & sama huruf (case-insensitive),
    // jadi karakter di dalamnya bisa dicocokkan langsung per posisi lokal.
    for (let k = 0; k < tChunk.chars.length; k++) {
      kredit += nilaiKarakterCocok(tChunk.chars[k], sChunk.chars[k])
    }
  }
  // Chunk target yang tidak ketemu pasangannya (kata/pemisah hilang atau
  // salah total) otomatis bernilai 0, tidak perlu ditambahkan.

  const skorKebenaran = Math.round((kredit / total) * bobot * 10) / 10
  return {
    skorKebenaran: Math.min(bobot, Math.max(0, skorKebenaran)),
    totalKarakter: target.length,
    benarKarakter: Math.round(kredit),
  }
}

export function formatDurasi(detik) {
  if (detik == null) return '-'
  const d = Math.round(detik)
  const menit = Math.floor(d / 60)
  const sisaDetik = d % 60
  return `${menit}:${String(sisaDetik).padStart(2, '0')}`
}

export const BOBOT = { KEBENARAN: DEFAULT_BOBOT_KEBENARAN, KECEPATAN: DEFAULT_BOBOT_KECEPATAN }
export const DEFAULT_BOBOT = { KEBENARAN: DEFAULT_BOBOT_KEBENARAN, KECEPATAN: DEFAULT_BOBOT_KECEPATAN }
