import React, { useState, useEffect, useRef } from 'react'
import { io } from 'socket.io-client'
import { Plus, Zap, Clock, Trash2, Copy, QrCode, X, File, Download, Loader2, Users, ExternalLink, FileImage, FileAudio, FileText, FileSpreadsheet, FileQuestion, Eye } from 'lucide-react'
import { apiRequest } from '../utils/api'
import { useLanOrigin } from '../utils/lanOrigin'
import mammoth from 'mammoth'
import * as XLSX from 'xlsx'

const formatBytes = (bytes) => {
  if (!bytes && bytes !== 0) return '-'
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`
}

const sisaWaktuLabel = (batasWaktu) => {
  const diffMs = new Date(batasWaktu).getTime() - Date.now()
  if (diffMs <= 0) return 'Berakhir'
  const menit = Math.round(diffMs / 60000)
  if (menit < 60) return `${menit} menit lagi`
  const jam = Math.floor(menit / 60)
  return `${jam} jam ${menit % 60}m lagi`
}

const EMPTY_FORM = { nama: '', mode: 'terima', password: '', durasiMenit: 60, batasSizeMB: '', batasFile: '' }

const QuickSharePage = () => {
  const [rooms, setRooms] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [submitting, setSubmitting] = useState(false)
  const [formError, setFormError] = useState('')
  const { origin: lanOrigin } = useLanOrigin()

  const [qrKode, setQrKode] = useState(null)
  const [copiedKode, setCopiedKode] = useState(null)

  const [detailRoom, setDetailRoom] = useState(null)
  const [loadingDetail, setLoadingDetail] = useState(false)

  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [previewFile, setPreviewFile] = useState(null)
  const [previewContent, setPreviewContent] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)

  useEffect(() => { fetchRooms() }, [])

  useEffect(() => {
    const socket = io(window.location.origin, { transports: ['websocket', 'polling'] })
    socket.on('quickshare-file-baru', (data) => {
      fetchRooms()
      if (detailRoom && data?.roomId === detailRoom.id) fetchDetail(detailRoom.id)
    })
    return () => socket.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [detailRoom])

  const fetchRooms = async () => {
    try {
      const res = await apiRequest('/api/quickshare/rooms')
      const data = await res.json()
      setRooms(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const fetchDetail = async (id) => {
    setLoadingDetail(true)
    try {
      const res = await apiRequest(`/api/quickshare/rooms/${id}`)
      const data = await res.json()
      setDetailRoom(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingDetail(false)
    }
  }

  const shareLink = (kode) => `${lanOrigin}/s/${kode}`

  const handleCopy = (kode) => {
    navigator.clipboard.writeText(shareLink(kode))
    setCopiedKode(kode)
    setTimeout(() => setCopiedKode(null), 1500)
  }

  const handleCreate = async () => {
    setFormError('')
    if (!form.nama.trim()) { setFormError('Nama room wajib diisi.'); return }
    setSubmitting(true)
    try {
      const res = await apiRequest('/api/quickshare/rooms', {
        method: 'POST',
        body: JSON.stringify(form),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Gagal membuat room.')
      setShowForm(false)
      setForm({ ...EMPTY_FORM })
      fetchRooms()
    } catch (e) {
      setFormError(e.message)
    } finally {
      setSubmitting(false)
    }
  }

  const handleDelete = async (room) => {
    if (!window.confirm(`Tutup room "${room.nama}"? Semua file di dalamnya akan dihapus.`)) return
    try {
      await apiRequest(`/api/quickshare/rooms/${room.id}`, { method: 'DELETE' })
      fetchRooms()
      if (detailRoom?.id === room.id) setDetailRoom(null)
    } catch (e) {
      console.error(e)
    }
  }

  const handleDownload = async (fileId, namaFile) => {
    try {
      const res = await apiRequest(`/api/quickshare/download/${fileId}`)
      if (!res.ok) throw new Error('Gagal mengunduh file.')
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = namaFile || 'file'
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (e) {
      console.error(e)
    }
  }

  const getFileIcon = (fileName) => {
    const ext = fileName.split('.').pop().toLowerCase()
    switch (ext) {
      case 'jpg': case 'jpeg': case 'png': case 'gif': return <FileImage className="w-4 h-4" />
      case 'mp3': case 'wav': return <FileAudio className="w-4 h-4" />
      case 'doc': case 'docx': case 'txt': return <FileText className="w-4 h-4" />
      case 'xls': case 'xlsx': return <FileSpreadsheet className="w-4 h-4" />
      case 'ppt': case 'pptx': return <File className="w-4 h-4" />
      default: return <FileQuestion className="w-4 h-4" />
    }
  }

  const handlePreview = async (file) => {
    setPreviewFile(file)
    setPreviewContent('')
    setPreviewLoading(true)
    setShowPreviewModal(true)

    try {
      const res = await apiRequest(`/api/quickshare/public/${detailRoom.kode}/preview/${file.id}`, { skipAuthRedirect: true })
      if (!res.ok) throw new Error('Gagal menampilkan preview.')
      
      const blob = await res.blob()
      const fileType = blob.type
      const fileExt = file.namaFile.split('.').pop().toLowerCase()

      if (fileType.startsWith('image/')) {
        setPreviewContent(`<img src="${URL.createObjectURL(blob)}" class="max-w-full h-auto mx-auto rounded-lg" />`)
      } else if (fileType.startsWith('audio/')) {
        setPreviewContent(`<audio controls src="${URL.createObjectURL(blob)}" class="w-full"></audio>`)
      } else if (fileType === 'application/pdf') {
        setPreviewContent(`<iframe src="${URL.createObjectURL(blob)}" class="w-full h-96"></iframe>`)
      } else if (['doc', 'docx'].includes(fileExt)) {
        const arrayBuffer = await blob.arrayBuffer()
        const result = await mammoth.convertToHtml({ arrayBuffer: arrayBuffer })
        setPreviewContent(`<div class="doc-preview p-4 border rounded-lg bg-gray-50 overflow-auto max-h-96">${result.value}</div>`)
      } else if (['xls', 'xlsx'].includes(fileExt)) {
        const arrayBuffer = await blob.arrayBuffer()
        const data = new Uint8Array(arrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheetName = workbook.SheetNames[0]
        const html = XLSX.utils.sheet_to_html(workbook.Sheets[sheetName], { id: 'excel-table', raw: true })
        setPreviewContent(`<div class="excel-preview p-4 border rounded-lg bg-gray-50 overflow-auto max-h-96">${html}</div>`)
      } else {
        setPreviewContent('<p class="text-center text-gray-500">Preview tidak tersedia untuk format ini. Silakan unduh.</p>')
      }
    } catch (e) {
      setPreviewContent(`<p class="text-center text-red-500">Error: ${e.message}</p>`)
    } finally {
      setPreviewLoading(false)
    }
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Quick Share</h1>
          <p className="text-gray-500 mt-1">Terima file dari siapa saja (tanpa perlu login) lewat kode room</p>
        </div>
        <button
          onClick={() => { setForm({ ...EMPTY_FORM }); setFormError(''); setShowForm(true) }}
          className="bg-gradient-to-r from-yellow-500 to-orange-500 text-white px-6 py-2.5 rounded-xl font-bold hover:from-yellow-600 hover:to-orange-600 transition shadow-lg shadow-orange-200 flex items-center gap-2"
        >
          <Plus className="w-5 h-5" /> Buat Room Baru
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-16"><Loader2 className="w-6 h-6 animate-spin text-gray-400" /></div>
      ) : rooms.length === 0 ? (
        <div className="text-center py-16 text-gray-400 text-sm">Belum ada room. Buat room baru untuk mulai menerima file dari siapa saja.</div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {rooms.map(room => (
            <div key={room.id} className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 hover:shadow-md transition">
              <div className="flex justify-between items-start mb-4">
                <div className="w-12 h-12 rounded-xl bg-orange-50 flex items-center justify-center">
                  <Zap className="w-6 h-6 text-orange-500" />
                </div>
                <span className={`px-3 py-1 text-xs font-bold rounded-full ${room.status === 'aktif' ? 'bg-green-50 text-green-600' : 'bg-gray-100 text-gray-600'}`}>
                  {room.status === 'aktif' ? 'Aktif' : 'Berakhir'}
                </span>
              </div>

              <button onClick={() => fetchDetail(room.id)} className="text-left w-full">
                <h3 className="font-bold text-gray-800 text-lg mb-1 hover:text-blue-600 transition">{room.nama}</h3>
              </button>
              <p className="text-sm text-gray-500 font-mono mb-6">{room.kode}</p>

              <div className="flex justify-between text-sm text-gray-600 mb-6">
                <div className="flex items-center gap-1.5"><File className="w-4 h-4"/> {room._count?.files ?? 0} File</div>
                <div className="flex items-center gap-1.5"><Clock className="w-4 h-4"/> {sisaWaktuLabel(room.batasWaktu)}</div>
              </div>

              <div className="flex gap-2">
                <button onClick={() => handleCopy(room.kode)} title="Copy Link" className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-lg transition">
                  <Copy className="w-4 h-4" />
                </button>
                <button onClick={() => window.open(shareLink(room.kode), '_blank')} title="Open Link" className="p-2 text-gray-400 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition">
                  <ExternalLink className="w-4 h-4" />
                </button>
                <button onClick={() => setQrKode(room.kode)} className="p-2 text-gray-400 hover:text-orange-500 hover:bg-orange-50 rounded-lg transition">
                  <QrCode className="w-4 h-4" />
                </button>
                <button onClick={() => handleDelete(room)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Modal: Buat Room */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl p-6 max-w-md w-full space-y-4">
            <div className="flex justify-between items-center">
              <h2 className="font-bold text-gray-800 text-lg">Buat Room Quick Share</h2>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>

            <label className="block text-sm font-medium text-gray-700">Nama Room
              <input type="text" value={form.nama} onChange={e => setForm(p => ({ ...p, nama: e.target.value }))}
                placeholder="Contoh: Praktik Word Kelas 5A"
                className="w-full mt-1 px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
            </label>

            <label className="block text-sm font-medium text-gray-700">Mode
              <select value={form.mode} onChange={e => setForm(p => ({ ...p, mode: e.target.value }))}
                className="w-full mt-1 px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm">
                <option value="terima">Terima file dari tamu</option>
                <option value="bagikan">Bagikan file ke tamu (host yang unggah)</option>
                <option value="keduanya">Keduanya</option>
              </select>
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm font-medium text-gray-700">Durasi (menit)
                <input type="number" min="1" value={form.durasiMenit} onChange={e => setForm(p => ({ ...p, durasiMenit: e.target.value }))}
                  className="w-full mt-1 px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
              </label>
              <label className="block text-sm font-medium text-gray-700">Password (opsional)
                <input type="text" value={form.password} onChange={e => setForm(p => ({ ...p, password: e.target.value }))}
                  className="w-full mt-1 px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="block text-sm font-medium text-gray-700">Maks. Ukuran (MB)
                <input type="number" min="1" placeholder="Tanpa batas" value={form.batasSizeMB} onChange={e => setForm(p => ({ ...p, batasSizeMB: e.target.value }))}
                  className="w-full mt-1 px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
              </label>
              <label className="block text-sm font-medium text-gray-700">Maks. Jumlah File
                <input type="number" min="1" placeholder="Tanpa batas" value={form.batasFile} onChange={e => setForm(p => ({ ...p, batasFile: e.target.value }))}
                  className="w-full mt-1 px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm" />
              </label>
            </div>

            {formError && <p className="text-xs text-red-500">{formError}</p>}

            <button onClick={handleCreate} disabled={submitting}
              className="w-full bg-orange-500 text-white font-semibold py-2.5 rounded-xl hover:bg-orange-600 transition disabled:opacity-50">
              {submitting ? 'Membuat...' : 'Buat Room'}
            </button>
          </div>
        </div>
      )}

      {/* Modal: QR Code */}
      {qrKode && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setQrKode(null)}>
          <div className="bg-white rounded-2xl p-6 text-center space-y-3" onClick={e => e.stopPropagation()}>
            <h2 className="font-bold text-gray-800">Scan untuk Bergabung</h2>
            <img
              src={`https://api.qrserver.com/v1/create-qr-code/?size=220x220&data=${encodeURIComponent(shareLink(qrKode))}`}
              alt="QR Code"
              className="mx-auto rounded-lg border border-gray-100"
            />
            <p className="text-xs text-gray-400 font-mono">{shareLink(qrKode)}</p>
            <button onClick={() => setQrKode(null)} className="text-sm text-gray-500 hover:text-gray-700">Tutup</button>
          </div>
        </div>
      )}

      {/* Modal: Detail Room (daftar file yang diterima) */}
      {detailRoom && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setDetailRoom(null)}>
          <div className="bg-white rounded-2xl p-6 max-w-lg w-full max-h-[80vh] overflow-auto" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <div>
                <h2 className="font-bold text-gray-800 text-lg">{detailRoom.nama}</h2>
                <p className="text-xs text-gray-400 font-mono">{detailRoom.kode}</p>
              </div>
              <button onClick={() => setDetailRoom(null)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>

            {loadingDetail ? (
              <div className="flex justify-center py-10"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>
            ) : (detailRoom.files || []).length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-10">Belum ada file yang dikirim ke room ini.</p>
            ) : (
              <ul className="space-y-2">
                {detailRoom.files.map(f => (
                  <li key={f.id} className="flex items-center justify-between gap-3 p-3 bg-gray-50 rounded-xl border border-gray-100">
                    <div className="min-w-0 flex items-center gap-2">
                      {getFileIcon(f.namaFile)}
                      <div>
                        <p className="text-sm font-semibold text-gray-800 truncate">{f.namaFile}</p>
                        <p className="text-xs text-gray-400">
                          <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium ${
                            f.tipePengirim === 'HOST' ? 'bg-blue-100 text-blue-800' :
                            f.tipePengirim === 'SISWA' ? 'bg-green-100 text-green-800' :
                            'bg-gray-100 text-gray-800'
                          }`}>
                            {f.tipePengirim}
                          </span>
                          {' · '}{formatBytes(f.ukuran)}{' · '}{new Date(f.createdAt).toLocaleString('id-ID')}
                        </p>
                      </div>
                    </div>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => handlePreview(f)} className="p-2 text-gray-600 hover:bg-gray-200 rounded-lg transition">
                        <Eye className="w-4 h-4" />
                      </button>
                      <button onClick={() => handleDownload(f.id, f.namaFile)} className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition">
                        <Download className="w-4 h-4" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>
      )}

      {/* Modal: Preview File */}
      {showPreviewModal && previewFile && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowPreviewModal(false)}>
          <div className="bg-white rounded-2xl p-6 max-w-2xl w-full max-h-[90vh] overflow-hidden flex flex-col" onClick={e => e.stopPropagation()}>
            <div className="flex justify-between items-center mb-4">
              <h2 className="font-bold text-gray-800 text-lg truncate">Preview: {previewFile.namaFile}</h2>
              <button onClick={() => setShowPreviewModal(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <div className="flex-grow overflow-auto border rounded-xl bg-gray-50 flex items-center justify-center p-4">
              {previewLoading ? (
                <Loader2 className="w-8 h-8 animate-spin text-gray-400" />
              ) : (
                <div dangerouslySetInnerHTML={{ __html: previewContent }} className="w-full" />
              )}
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <button onClick={() => handleDownload(previewFile.id, previewFile.namaFile)} className="bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-600 transition">Unduh File</button>
              <button onClick={() => setShowPreviewModal(false)} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-300 transition">Tutup</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default QuickSharePage
