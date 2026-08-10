import React, { useState, useEffect, useRef } from 'react'
import { useParams } from 'react-router-dom'
import { Upload, File, X, CheckCircle2, AlertTriangle, Lock, Download, Send, Clock, FileImage, FileAudio, FileText, FileSpreadsheet, FileQuestion, Eye, Loader2 } from 'lucide-react'
import { apiRequest } from '../utils/api'
import mammoth from 'mammoth'
import * as XLSX from 'xlsx'

const formatBytes = (bytes) => {
  if (!bytes && bytes !== 0) return '-'
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`
}

const QuickShareJoinPage = () => {
  const { kode } = useParams()
  const fileRef = useRef(null)

  const [room, setRoom] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const [nama, setNama] = useState('')
  const [password, setPassword] = useState('')
  const [files, setFiles] = useState([])
  const [sending, setSending] = useState(false)
  const [sendError, setSendError] = useState('')
  const [sukses, setSukses] = useState(false)

  const [sharedFiles, setSharedFiles] = useState([])
  const [loadingShared, setLoadingShared] = useState(false)

  const [showPreviewModal, setShowPreviewModal] = useState(false)
  const [previewFile, setPreviewFile] = useState(null)
  const [previewContent, setPreviewContent] = useState('')
  const [previewLoading, setPreviewLoading] = useState(false)

  useEffect(() => { fetchRoom() }, [kode])

  const fetchRoom = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await apiRequest(`/api/quickshare/public/${kode}`, { skipAuthRedirect: true })
      if (!res.ok) {
        const data = await res.json().catch(() => ({}))
        throw new Error(data.message || 'Room tidak ditemukan.')
      }
      const data = await res.json()
      setRoom(data)
      if (data.bisaLihatFile && !data.hasPassword) fetchSharedFiles()
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const fetchSharedFiles = async (pwd) => {
    setLoadingShared(true)
    try {
      const q = pwd ? `?password=${encodeURIComponent(pwd)}` : ''
      const res = await apiRequest(`/api/quickshare/public/${kode}/files${q}`, { skipAuthRedirect: true })
      if (res.ok) setSharedFiles(await res.json())
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingShared(false)
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
      const res = await apiRequest(`/api/quickshare/public/${kode}/preview/${file.id}${password ? `?password=${encodeURIComponent(password)}` : ''}`, { skipAuthRedirect: true })
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

  const handleKirim = async () => {
    setSendError('')
    if (files.length === 0) { setSendError('Pilih minimal 1 file untuk dikirim.'); return }
    if (room.hasPassword && !password) { setSendError('Room ini memerlukan password.'); return }

    setSending(true)
    try {
      const fd = new FormData()
      files.forEach((f) => fd.append('files', f))
      fd.append('pengirim', nama || 'Tamu')
      if (password) fd.append('password', password)

      const res = await apiRequest(`/api/quickshare/public/${kode}/upload`, {
        method: 'POST',
        body: fd,
        skipAuthRedirect: true,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Gagal mengirim file.')

      setSukses(true)
      setFiles([])
      if (room.bisaLihatFile) fetchSharedFiles(password)
    } catch (e) {
      setSendError(e.message)
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8 max-w-sm w-full text-center">
          <AlertTriangle className="w-10 h-10 text-amber-500 mx-auto mb-3" />
          <h1 className="font-bold text-gray-800 mb-1">Room Tidak Tersedia</h1>
          <p className="text-sm text-gray-500">{error}</p>
        </div>
      </div>
    )
  }

  const roomTidakAktif = room.status !== 'aktif'
  const hanyaBagikan = room.mode === 'bagikan'

  return (
    <div className="min-h-screen bg-gray-50 py-8 px-4">
      <div className="max-w-md mx-auto space-y-5">
        <div className="text-center">
          <p className="text-xs font-semibold text-blue-600 tracking-wide uppercase mb-1">Quick Share</p>
          <h1 className="text-xl font-bold text-gray-800">{room.nama}</h1>
          <p className="text-xs text-gray-400 mt-1 flex items-center justify-center gap-1">
            <Clock className="w-3.5 h-3.5" /> Berlaku sampai {new Date(room.batasWaktu).toLocaleString('id-ID')}
          </p>
        </div>

        {roomTidakAktif && (
          <div className="bg-amber-50 border border-amber-200 text-amber-700 text-sm rounded-xl p-4 text-center">
            Room ini sudah berakhir / ditutup oleh pemiliknya.
          </div>
        )}

        {!roomTidakAktif && !hanyaBagikan && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-4">
            <h2 className="font-bold text-gray-800 flex items-center gap-2"><Send className="w-4 h-4 text-blue-600" /> Kirim File ke {room.nama}</h2>

            {sukses && (
              <div className="bg-green-50 border border-green-200 text-green-700 text-sm rounded-xl p-3 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 shrink-0" /> File berhasil dikirim!
              </div>
            )}

            <input
              type="text"
              placeholder="Nama kamu (opsional)"
              value={nama}
              onChange={(e) => setNama(e.target.value)}
              className="w-full px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />

            {room.hasPassword && (
              <div className="relative">
                <Lock className="w-4 h-4 text-gray-400 absolute left-3 top-1/2 -translate-y-1/2" />
                <input
                  type="password"
                  placeholder="Password room"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-10 pr-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                />
              </div>
            )}

            <div
              className="border-2 border-dashed border-gray-200 rounded-xl p-5 text-center hover:border-blue-300 transition cursor-pointer"
              onClick={() => fileRef.current?.click()}
            >
              <input ref={fileRef} type="file" multiple className="hidden" onChange={(e) => setFiles(Array.from(e.target.files || []))} />
              <Upload className="w-6 h-6 text-gray-400 mx-auto mb-1" />
              <p className="text-xs text-gray-500">{files.length > 0 ? `${files.length} file dipilih` : 'Klik untuk memilih file'}</p>
            </div>

            {files.length > 0 && (
              <ul className="space-y-1">
                {files.map((f, i) => (
                  <li key={i} className="flex items-center justify-between gap-2 px-3 py-2 bg-gray-50 border border-gray-100 rounded-lg text-xs text-gray-700">
                    <span className="flex items-center gap-2 truncate"><File className="w-4 h-4 text-blue-500 shrink-0" /><span className="truncate">{f.name}</span></span>
                    <button onClick={() => setFiles((p) => p.filter((_, idx) => idx !== i))} className="text-gray-400 hover:text-red-500 shrink-0">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            {sendError && <p className="text-xs text-red-500">{sendError}</p>}

            <button
              onClick={handleKirim}
              disabled={sending}
              className="w-full bg-blue-600 text-white font-semibold text-sm py-2.5 rounded-xl hover:bg-blue-700 transition disabled:opacity-50"
            >
              {sending ? 'Mengirim...' : 'Kirim File'}
            </button>
          </div>
        )}

        {room.bisaLihatFile && (
          <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-6 space-y-3">
            <h2 className="font-bold text-gray-800 flex items-center gap-2"><Download className="w-4 h-4 text-blue-600" /> File dari Host</h2>
            {room.hasPassword && sharedFiles.length === 0 && (
              <button onClick={() => fetchSharedFiles(password)} className="text-xs text-blue-600 font-semibold hover:underline">
                Muat daftar file (pakai password di atas)
              </button>
            )}
            {loadingShared ? (
              <p className="text-xs text-gray-400">Memuat...</p>
            ) : sharedFiles.length === 0 ? (
              <p className="text-xs text-gray-400">Belum ada file yang dibagikan.</p>
            ) : (
              <ul className="space-y-1">
                {sharedFiles.map((f) => (
                  <li key={f.id} className="flex items-center justify-between gap-2 px-3 py-2 bg-gray-50 border border-gray-100 rounded-lg text-xs text-gray-700">
                    <span className="flex items-center gap-2 truncate">
                      {getFileIcon(f.namaFile)}
                      <span className="truncate">{f.namaFile}</span>
                      <span className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full font-medium ${
                        f.tipePengirim === 'HOST' ? 'bg-blue-100 text-blue-800' :
                        f.tipePengirim === 'SISWA' ? 'bg-green-100 text-green-800' :
                        'bg-gray-100 text-gray-800'
                      }`}>
                        {f.tipePengirim}
                      </span>
                      <span className="text-gray-400 shrink-0">({formatBytes(f.ukuran)})</span>
                    </span>
                    <div className="flex gap-1 shrink-0">
                      <button onClick={() => handlePreview(f)} className="p-1.5 text-gray-600 hover:bg-gray-200 rounded-lg transition">
                        <Eye className="w-4 h-4" />
                      </button>
                      <a
                        href={`/api/quickshare/public/${kode}/download/${f.id}${password ? `?password=${encodeURIComponent(password)}` : ''}`}
                        className="p-1.5 text-blue-600 hover:bg-blue-100 rounded-lg transition shrink-0"
                      >
                        <Download className="w-4 h-4" />
                      </a>
                    </div>
                  </li>
                ))}
              </ul>
            )}
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
                <a
                  href={`/api/quickshare/public/${kode}/download/${previewFile.id}${password ? `?password=${encodeURIComponent(password)}` : ''}`}
                  className="bg-blue-500 text-white px-4 py-2 rounded-xl text-sm font-medium hover:bg-blue-600 transition"
                  download
                >Unduh File</a>
                <button onClick={() => setShowPreviewModal(false)} className="bg-gray-200 text-gray-800 px-4 py-2 rounded-xl text-sm font-medium hover:bg-gray-300 transition">Tutup</button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default QuickShareJoinPage
