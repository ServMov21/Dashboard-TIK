import path from 'path'
import mammoth from 'mammoth'
import XLSX from 'xlsx'

// Ekstensi yang tidak bisa dirender langsung oleh browser (butuh konversi ke HTML
// dulu di server) supaya bisa dipratinjau tanpa harus didownload.
export const OFFICE_PREVIEW_EXTENSIONS = ['.doc', '.docx', '.xls', '.xlsx']

export function isOfficePreviewable(namaFile) {
  const ext = path.extname(namaFile || '').toLowerCase()
  return OFFICE_PREVIEW_EXTENSIONS.includes(ext)
}

// Ubah file .docx/.doc menjadi HTML (mempertahankan heading, bold/italic, list,
// tabel sederhana) menggunakan mammoth. File .doc lama (format binary) tidak
// selalu didukung penuh oleh mammoth, tapi tetap dicoba sebagai upaya terbaik.
async function docxToHtml(filePath) {
  const result = await mammoth.convertToHtml({ path: filePath }, {
    styleMap: [
      "p[style-name='Heading 1'] => h2:fresh",
      "p[style-name='Heading 2'] => h3:fresh",
      "p[style-name='Heading 3'] => h4:fresh",
    ],
  })
  return result.value
}

// Ubah file .xlsx/.xls menjadi tabel HTML per-sheet menggunakan library xlsx
// yang sudah dipakai proyek ini untuk fitur export, supaya tidak perlu dependency baru.
// sheet_to_html() mengembalikan dokumen HTML lengkap (<html><head>...), jadi kita
// ambil isi <table>...</table> saja supaya aman dirender sebagai fragment (dangerouslySetInnerHTML).
function xlsxToHtml(filePath) {
  const workbook = XLSX.readFile(filePath)
  const sheets = workbook.SheetNames.map((name) => {
    const sheet = workbook.Sheets[name]
    const fullHtml = XLSX.utils.sheet_to_html(sheet, { editable: false })
    const match = fullHtml.match(/<table[\s\S]*<\/table>/i)
    const tableHtml = match ? match[0] : '<p>Sheet kosong.</p>'
    return `<div class="sheet-block"><h4>${escapeHtml(name)}</h4>${tableHtml}</div>`
  })
  return sheets.join('\n')
}

function escapeHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;')
}

// Konversi file office (docx/doc/xlsx/xls) menjadi HTML aman untuk ditampilkan
// inline pada modal preview di browser. Melempar error kalau tipe tidak didukung
// atau file gagal dibaca/dikonversi (caller sebaiknya fallback ke download).
export async function convertOfficeFileToHtml(filePath, namaFile) {
  const ext = path.extname(namaFile || filePath).toLowerCase()
  if (ext === '.docx' || ext === '.doc') {
    return { type: 'docx', html: await docxToHtml(filePath) }
  }
  if (ext === '.xlsx' || ext === '.xls') {
    return { type: 'xlsx', html: xlsxToHtml(filePath) }
  }
  throw new Error('Tipe file tidak didukung untuk pratinjau office.')
}
