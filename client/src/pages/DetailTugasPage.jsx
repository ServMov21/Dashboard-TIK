import React, { useState, useEffect, useRef } from 'react'
import { useParams, Link } from 'react-router-dom'
import { io } from 'socket.io-client'
import { Calendar, Clock, FileText, Upload, AlertCircle, ArrowLeft, Download, CheckCircle, Eye, Image as ImageIcon, FileCheck2, Keyboard, Bold, Italic, Underline, Lock, Timer, RotateCcw, Trophy, X, AlignLeft, AlignCenter, AlignRight, PenLine, Save, Trash2 } from 'lucide-react'
import { apiRequest } from '../utils/api'
import { computeSkorKebenaran, formatDurasi, BOBOT } from '../utils/typingScore'
import FilePreviewModal from '../components/FilePreviewModal'

const IMAGE_EXT = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg']
const isImageFile = (namaFile = '') => IMAGE_EXT.some((ext) => namaFile.toLowerCase().endsWith(ext))

const formatTanggal = (value) => {
  if (!value) return ''
  return new Date(value).toLocaleString('id-ID', { dateStyle: 'medium', timeStyle: 'short' })
}

const DetailTugasPage = () => {
  const { id } = useParams()
  const [tugas, setTugas] = useState(null)
  const [file, setFile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState('')
  const [countdown, setCountdown] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0, ended: false })

  // Status pengumpulan milik siswa yang sedang login
  const [mySubmission, setMySubmission] = useState(null)
  const [checkingSubmission, setCheckingSubmission] = useState(true)

  // Daftar status pengumpulan seluruh siswa (khusus guru)
  const [submissionList, setSubmissionList] = useState([])
  const [loadingSubmissionList, setLoadingSubmissionList] = useState(true)

  // State penilaian per pengumpulan: { [pengumpulanId]: { nilai, keterangan, saving, saved } }
  const [nilaiMap, setNilaiMap] = useState({})

  // Object URL untuk thumbnail gambar: { [key]: objectUrl }
  const [thumbs, setThumbs] = useState({})
  const objectUrlsRef = useRef([])

  // ==== State khusus tugas jenis "mengetik" ====
  const [myTyping, setMyTyping] = useState(null) // status pengerjaan milik siswa
  const [loadingMyTyping, setLoadingMyTyping] = useState(true)
  const [typingList, setTypingList] = useState([]) // daftar status seluruh siswa (guru)
  const [loadingTypingList, setLoadingTypingList] = useState(true)
  const [typingElapsed, setTypingElapsed] = useState(0)
  const [editorState, setEditorState] = useState({
    bold: false,
    italic: false,
    underline: false,
    justifyLeft: false,
    justifyCenter: false,
    justifyRight: false
  }) // detik berjalan (live) selama mengerjakan
  const [typingBusy, setTypingBusy] = useState(false)
  const [typingError, setTypingError] = useState('')
  const [previewHasil, setPreviewHasil] = useState(null) // hasil ketik siswa yang sedang dipratinjau guru
  const [previewFile, setPreviewFile] = useState(null) // { namaFile, viewUrl, previewHtmlUrl, downloadUrl, title }
  const typingEditorRef = useRef(null)

  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const isSiswa = user.role === 'siswa'

  useEffect(() => {
    fetchDetail()
    if (isSiswa) fetchMySubmission()
    if (!isSiswa) fetchSubmissionList()

    // Bersihkan object URL saat pindah halaman/unmount
    return () => {
      objectUrlsRef.current.forEach((url) => URL.revokeObjectURL(url))
      objectUrlsRef.current = []
    }
  }, [id])

  // Auto-refresh daftar pengumpulan (khusus guru) saat ada siswa upload/update
  useEffect(() => {
    if (isSiswa) return
    const socket = io(window.location.origin, { transports: ['websocket', 'polling'] })
    const handleUpdate = (data) => {
      if (data?.tugasId === id) fetchSubmissionList()
    }
    socket.on('pengumpulan-baru', handleUpdate)
    socket.on('pengumpulan-update', handleUpdate)
    return () => socket.disconnect()
  }, [id, isSiswa])

  // ==== Efek khusus tugas jenis "mengetik" ====
  useEffect(() => {
    if (!tugas || tugas.jenis !== 'mengetik') return
    if (isSiswa) fetchMyTyping()
    else fetchTypingList()
  }, [tugas?.jenis, id, isSiswa])

  // Guru: dapatkan update skor/hasil ketik secara real-time saat siswa mengerjakan/selesai.
  // Siswa: skor kecepatan miliknya juga ikut ter-update saat siswa lain menyelesaikan (peringkat berubah).
  useEffect(() => {
    if (!tugas || tugas.jenis !== 'mengetik') return
    const socket = io(window.location.origin, { transports: ['websocket', 'polling'] })
    const handleTypingUpdate = (payload) => {
      if (payload?.tugasId !== id) return
      const list = Array.isArray(payload.data) ? payload.data : []
      if (!isSiswa) {
        setTypingList(list)
      } else {
        const mine = list.find((d) => d.siswaId === user.id)
        if (mine) {
          setMyTyping((prev) => (prev ? { ...prev, ...mine } : prev))
        }
      }
    }
    socket.on('pengumpulan-mengetik-update', handleTypingUpdate)
    return () => socket.disconnect()
  }, [id, isSiswa, tugas?.jenis])

  // Timer berjalan (live) selama siswa sedang mengerjakan
  useEffect(() => {
    if (!myTyping || myTyping.status !== 'mengerjakan' || !myTyping.waktuMulai) return
    const startTime = new Date(myTyping.waktuMulai).getTime()
    const tick = () => setTypingElapsed(Math.max(0, (Date.now() - startTime) / 1000))
    tick()
    const interval = setInterval(tick, 500)
    return () => clearInterval(interval)
  }, [myTyping?.status, myTyping?.waktuMulai])

  // Kosongkan editor setiap kali siswa mulai attempt baru
  useEffect(() => {
    if (myTyping?.status === 'mengerjakan' && typingEditorRef.current) {
      typingEditorRef.current.innerHTML = ''
      typingEditorRef.current.focus()
    }
  }, [myTyping?.waktuMulai])

  // Tampilkan hasil ketikan terakhir (read-only) setelah siswa menekan Selesai
  useEffect(() => {
    if (myTyping?.status === 'selesai' && typingEditorRef.current) {
      typingEditorRef.current.innerHTML = myTyping.hasilKetik || ''
    }
  }, [myTyping?.status, myTyping?.hasilKetik])

  const fetchDetail = async () => {
    try {
      const res = await apiRequest(`/api/tugas/${id}`)
      const data = await res.json()
      setTugas(data)
      setLoading(false)
    } catch (e) {
      console.error(e)
      setLoading(false)
    }
  }

  const fetchMySubmission = async () => {
    setCheckingSubmission(true)
    try {
      const res = await apiRequest(`/api/pengumpulan/saya/${id}`)
      const data = await res.json()
      setMySubmission(data || null)
    } catch (e) {
      console.error(e)
    } finally {
      setCheckingSubmission(false)
    }
  }

  const fetchSubmissionList = async () => {
    setLoadingSubmissionList(true)
    try {
      const res = await apiRequest(`/api/pengumpulan/status/${id}`)
      const data = await res.json()
      const list = Array.isArray(data) ? data : []
      setSubmissionList(list)
      // Inisialisasi nilaiMap dari data yang sudah ada di server
      const initialMap = {}
      list.forEach(s => {
        if (s.pengumpulanId) {
          initialMap[s.pengumpulanId] = {
            nilai: s.nilai !== null && s.nilai !== undefined ? String(s.nilai) : '',
            keterangan: s.keterangan || '',
            saving: false,
            saved: false,
          }
        }
      })
      setNilaiMap(initialMap)
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingSubmissionList(false)
    }
  }

  const saveNilai = async (pengumpulanId) => {
    const entry = nilaiMap[pengumpulanId]
    if (!entry) return
    const nilaiVal = entry.nilai === '' ? null : parseFloat(entry.nilai)
    if (nilaiVal !== null && (isNaN(nilaiVal) || nilaiVal < 0 || nilaiVal > 100)) {
      alert('Nilai harus antara 0 dan 100.')
      return
    }
    setNilaiMap(prev => ({ ...prev, [pengumpulanId]: { ...prev[pengumpulanId], saving: true, saved: false } }))
    try {
      const res = await apiRequest(`/api/pengumpulan/nilai/${pengumpulanId}`, {
        method: 'PUT',
        body: JSON.stringify({ nilai: nilaiVal, keterangan: entry.keterangan }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.message) }
      setNilaiMap(prev => ({ ...prev, [pengumpulanId]: { ...prev[pengumpulanId], saving: false, saved: true } }))
      setTimeout(() => setNilaiMap(prev => ({ ...prev, [pengumpulanId]: { ...prev[pengumpulanId], saved: false } })), 2000)
    } catch (e) {
      alert('Gagal menyimpan nilai: ' + e.message)
      setNilaiMap(prev => ({ ...prev, [pengumpulanId]: { ...prev[pengumpulanId], saving: false } }))
    }
  }

  // Guru: hapus hasil tugas (file) milik seorang siswa, supaya siswa bisa mengumpulkan ulang.
  const deleteSubmission = async (pengumpulanId, namaSiswa) => {
    if (!window.confirm(`Hapus hasil tugas ${namaSiswa || 'siswa ini'}? Siswa akan bisa mengumpulkan ulang tugasnya.`)) return
    try {
      const res = await apiRequest(`/api/pengumpulan/${pengumpulanId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message)
      fetchSubmissionList()
    } catch (e) {
      alert('Gagal menghapus hasil tugas: ' + e.message)
    }
  }

  // ==== Fungsi khusus tugas jenis "mengetik" ====
  const fetchMyTyping = async () => {
    setLoadingMyTyping(true)
    try {
      const res = await apiRequest(`/api/pengumpulan-mengetik/saya/${id}`)
      const data = await res.json()
      setMyTyping(data || null)
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingMyTyping(false)
    }
  }

  const fetchTypingList = async () => {
    setLoadingTypingList(true)
    try {
      const res = await apiRequest(`/api/pengumpulan-mengetik/status/${id}`)
      const data = await res.json()
      setTypingList(Array.isArray(data) ? data : [])
    } catch (e) {
      console.error(e)
    } finally {
      setLoadingTypingList(false)
    }
  }

  const startTyping = async () => {
    setTypingBusy(true); setTypingError('')
    try {
      const res = await apiRequest('/api/pengumpulan-mengetik/mulai', {
        method: 'POST',
        body: JSON.stringify({ tugasId: id }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message)
      setMyTyping(data.data)
      setTypingElapsed(0)
    } catch (e) {
      setTypingError(e.message)
    } finally {
      setTypingBusy(false)
    }
  }

  const finishTyping = async () => {
    setTypingBusy(true); setTypingError('')
    try {
      const hasilKetik = typingEditorRef.current?.innerHTML || ''
      // Pakai bobot kustom tugas ini kalau guru mengaturnya, kalau tidak pakai default (90).
      const bobotKebenaranTugas = tugas.bobotKebenaran ?? BOBOT.KEBENARAN
      const { skorKebenaran } = computeSkorKebenaran(tugas.naskahMengetik, hasilKetik, bobotKebenaranTugas)
      const res = await apiRequest('/api/pengumpulan-mengetik/selesai', {
        method: 'POST',
        body: JSON.stringify({ tugasId: id, hasilKetik, skorKebenaran }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message)
      setMyTyping(data.data)
      // Pemicu pengecekan title global
      console.log('[DEBUG] dispatching xp-updated event from typing finish')
      window.dispatchEvent(new CustomEvent('xp-updated'))
    } catch (e) {
      setTypingError(e.message)
    } finally {
      setTypingBusy(false)
    }
  }

  // Guru: hapus hasil tugas mengetik milik seorang siswa, supaya siswa bisa mengulang dari awal.
  const deleteTyping = async (pengumpulanMengetikId, namaSiswa) => {
    if (!window.confirm(`Hapus hasil ketikan ${namaSiswa || 'siswa ini'}? Siswa akan bisa mengulang tugas ini dari awal.`)) return
    try {
      const res = await apiRequest(`/api/pengumpulan-mengetik/${pengumpulanMengetikId}`, { method: 'DELETE' })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message)
      fetchTypingList()
    } catch (e) {
      alert('Gagal menghapus hasil tugas mengetik: ' + e.message)
    }
  }

  const runTypingCommand = (cmd) => {
    if (myTyping?.status !== 'mengerjakan') return
    typingEditorRef.current?.focus()
    document.execCommand(cmd, false, null)
    updateEditorState()
  }

  const updateEditorState = () => {
    setEditorState({
      bold: document.queryCommandState('bold'),
      italic: document.queryCommandState('italic'),
      underline: document.queryCommandState('underline'),
      justifyLeft: document.queryCommandState('justifyLeft'),
      justifyCenter: document.queryCommandState('justifyCenter'),
      justifyRight: document.queryCommandState('justifyRight')
    })
  }

  // Ambil file sebagai blob (pakai token auth) lalu buat object URL untuk thumbnail/preview
  const loadThumb = async (key, url) => {
    if (thumbs[key]) return
    try {
      const res = await apiRequest(url)
      if (!res.ok) return
      const blob = await res.blob()
      const objectUrl = URL.createObjectURL(blob)
      objectUrlsRef.current.push(objectUrl)
      setThumbs((prev) => ({ ...prev, [key]: objectUrl }))
    } catch (e) {
      console.error('Gagal memuat pratinjau', e)
    }
  }

  const downloadFile = async (url, namaFile) => {
    try {
      const res = await apiRequest(url)
      if (!res.ok) throw new Error('Gagal mengunduh file')
      const blob = await res.blob()
      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = namaFile || 'file'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(objectUrl)
    } catch (e) {
      console.error(e)
      setError('Gagal mengunduh file.')
    }
  }

  useEffect(() => {
    let interval = null;
    if (tugas && tugas.deadline) {
      interval = setInterval(() => {
        const dest = new Date(tugas.deadline).getTime()
        const now = new Date().getTime()
        const diff = dest - now

        if (diff <= 0) {
          setCountdown({ days: 0, hours: 0, minutes: 0, seconds: 0, ended: true })
          if (interval) clearInterval(interval)
        } else {
          const days = Math.floor(diff / (1000 * 60 * 60 * 24))
          const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
          const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
          const seconds = Math.floor((diff % (1000 * 60)) / 1000)
          setCountdown({ days, hours, minutes, seconds, ended: false })
        }
      }, 1000)
    }

    return () => {
      if (interval) clearInterval(interval)
    }
  }, [tugas])

  const handleUpload = async (e) => {
    e.preventDefault()
    if (!file) return

    setUploading(true)
    setError('')
    setSuccess('')

    const formData = new FormData()
    formData.append('file', file)
    formData.append('tugasId', id)

    try {
      const res = await apiRequest('/api/pengumpulan/upload', {
        method: 'POST',
        body: formData
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message)
      setSuccess('Tugas berhasil diunggah!')
      setFile(null)
      fetchMySubmission()
      // Pemicu pengecekan title global
      console.log('[DEBUG] dispatching xp-updated event from file upload')
      window.dispatchEvent(new CustomEvent('xp-updated'))
    } catch (err) {
      setError(err.message)
    } finally {
      setUploading(false)
    }
  }

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Memuat detail tugas...</div>
  }

  if (!tugas) {
    return <div className="p-8 text-center text-red-500">Tugas tidak ditemukan.</div>
  }

  const isMengetik = tugas.jenis === 'mengetik'
  const isDitutup = tugas.status === 'ditutup'

  // Tentukan warna countdown berdasarkan sisa waktu
  const getCountdownColor = () => {
    if (countdown.ended) return 'text-red-500 bg-red-50 border-red-200'
    const totalHours = (countdown.days * 24) + countdown.hours
    if (totalHours < 1) return 'text-red-600 bg-red-50 border-red-100 animate-pulse'
    if (totalHours < 24) return 'text-yellow-600 bg-yellow-50 border-yellow-100'
    return 'text-blue-600 bg-blue-50 border-blue-100'
  }

  return (
    <div className="p-8 max-w-[1600px] mx-auto">
      <div className="mb-6">
        <Link
          to={isSiswa ? '/siswa/tugas' : '/dashboard/tugas'}
          className="inline-flex items-center gap-2 text-sm text-gray-500 hover:text-gray-800 transition"
        >
          <ArrowLeft className="w-4 h-4" /> Kembali
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Kolom Detail */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
            <span className="px-3 py-1 bg-blue-50 text-blue-600 text-xs font-bold rounded-full uppercase tracking-wider">
              {tugas.jenis}
            </span>
            {isDitutup && (
              <span className="ml-2 px-3 py-1 bg-red-50 text-red-600 text-xs font-bold rounded-full uppercase tracking-wider inline-flex items-center gap-1">
                <Lock className="w-3 h-3" /> Ditutup
              </span>
            )}
            <h1 className="text-2xl font-bold text-gray-800 mt-3">{tugas.judul}</h1>
              <p className="text-gray-500 text-sm mt-1 flex items-center gap-1.5">
                <Calendar className="w-4 h-4" /> Dibuat pada: {new Date(tugas.createdAt).toLocaleDateString('id-ID')}
              </p>
              
              {isSiswa && (
                <CollabWidget tugasId={tugas.id} />
              )}

            <div className="mt-6 border-t border-gray-100 pt-6">
              <h3 className="font-bold text-gray-800 mb-2">{isMengetik ? 'Perintah Tugas' : 'Deskripsi Tugas'}</h3>
              <p className="text-gray-600 leading-relaxed whitespace-pre-wrap">{tugas.deskripsi || 'Tidak ada deskripsi.'}</p>
            </div>

            {isMengetik && (
              <div className="mt-6 border-t border-gray-100 pt-6">
                <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                  <Keyboard className="w-4 h-4 text-blue-500" /> Naskah yang Harus Diketik
                </h3>
                <div
                  className="bg-blue-50/60 border border-blue-100 rounded-xl px-5 py-4 text-gray-800 leading-relaxed select-none"
                  onCopy={(e) => e.preventDefault()}
                  onCut={(e) => e.preventDefault()}
                  onContextMenu={(e) => e.preventDefault()}
                  onDragStart={(e) => e.preventDefault()}
                  dangerouslySetInnerHTML={{ __html: tugas.naskahMengetik || '<p class="text-gray-400">Naskah belum diisi guru.</p>' }}
                />
                <p className="text-xs text-gray-400 mt-2">Naskah ini tidak bisa disalin (copy-paste). Ketik ulang persis: termasuk huruf tebal, miring, garis bawah, huruf besar/kecil, dan rata teks (kiri/tengah/kanan).</p>
              </div>
            )}

            {/* Form isian tugas mengetik: sengaja ditaruh di kolom lebar ini (bukan sidebar
                kanan yang sempit) supaya area mengetik siswa lega. */}
            {isSiswa && isMengetik && !loadingMyTyping && (
              <div className="mt-6 border-t border-gray-100 pt-6">
                <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2">
                  <Keyboard className="w-4 h-4 text-blue-500" /> Formulir Jawaban
                </h3>

                {typingError && (
                  <div className="mb-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-sm flex items-center gap-2">
                    <AlertCircle className="w-4 h-4 flex-shrink-0" /> {typingError}
                  </div>
                )}

                {isDitutup ? (
                  <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-center text-red-700 font-bold text-sm flex items-center justify-center gap-2">
                    <Lock className="w-4 h-4" /> Tugas Ditutup oleh Guru
                  </div>
                ) : (
                  <>
                    {/* Timer - selalu terlihat di atas form supaya siswa tahu waktu ketiknya */}
                    <div className="flex items-center justify-between bg-gray-50 border border-gray-100 rounded-xl px-4 py-3 mb-4">
                      <span className="text-xs font-bold uppercase tracking-wider text-gray-500 flex items-center gap-1.5">
                        <Timer className="w-4 h-4" /> Waktu Mengetik
                      </span>
                      <span className="text-xl font-bold text-gray-800 tabular-nums">
                        {formatDurasi(myTyping?.status === 'mengerjakan' ? typingElapsed : myTyping?.durasiDetik)}
                      </span>
                    </div>

                    {/* Toolbar format - aktif hanya saat sedang mengerjakan */}
                    <div className={`flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-t-xl px-2 py-1.5 ${myTyping?.status !== 'mengerjakan' ? 'opacity-40 pointer-events-none' : ''}`}>
                      <button 
                        type="button" 
                        onMouseDown={(e) => e.preventDefault()} 
                        onClick={() => runTypingCommand('bold')} 
                        title="Tebal" 
                        className={`p-2 rounded-lg transition-colors ${editorState.bold ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-200 text-gray-600'}`}
                      >
                        <Bold className="w-4 h-4" />
                      </button>
                      <button 
                        type="button" 
                        onMouseDown={(e) => e.preventDefault()} 
                        onClick={() => runTypingCommand('italic')} 
                        title="Miring" 
                        className={`p-2 rounded-lg transition-colors ${editorState.italic ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-200 text-gray-600'}`}
                      >
                        <Italic className="w-4 h-4" />
                      </button>
                      <button 
                        type="button" 
                        onMouseDown={(e) => e.preventDefault()} 
                        onClick={() => runTypingCommand('underline')} 
                        title="Garis Bawah" 
                        className={`p-2 rounded-lg transition-colors ${editorState.underline ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-200 text-gray-600'}`}
                      >
                        <Underline className="w-4 h-4" />
                      </button>
                      <span className="w-px h-5 bg-gray-200 mx-1" />
                      <button 
                        type="button" 
                        onMouseDown={(e) => e.preventDefault()} 
                        onClick={() => runTypingCommand('justifyLeft')} 
                        title="Rata Kiri" 
                        className={`p-2 rounded-lg transition-colors ${editorState.justifyLeft ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-200 text-gray-600'}`}
                      >
                        <AlignLeft className="w-4 h-4" />
                      </button>
                      <button 
                        type="button" 
                        onMouseDown={(e) => e.preventDefault()} 
                        onClick={() => runTypingCommand('justifyCenter')} 
                        title="Rata Tengah" 
                        className={`p-2 rounded-lg transition-colors ${editorState.justifyCenter ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-200 text-gray-600'}`}
                      >
                        <AlignCenter className="w-4 h-4" />
                      </button>
                      <button 
                        type="button" 
                        onMouseDown={(e) => e.preventDefault()} 
                        onClick={() => runTypingCommand('justifyRight')} 
                        title="Rata Kanan" 
                        className={`p-2 rounded-lg transition-colors ${editorState.justifyRight ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-200 text-gray-600'}`}
                      >
                        <AlignRight className="w-4 h-4" />
                      </button>
                    </div>
                    <div
                      ref={typingEditorRef}
                      contentEditable={myTyping?.status === 'mengerjakan'}
                      suppressContentEditableWarning
                      onPaste={(e) => e.preventDefault()}
                      onKeyUp={updateEditorState}
                      onMouseUp={updateEditorState}
                      onClick={updateEditorState}
                      className={`min-h-[280px] max-h-[420px] overflow-y-auto border border-t-0 border-gray-200 rounded-b-xl px-5 py-4 outline-none leading-relaxed mb-4 text-base empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400 empty:before:pointer-events-none ${
                        myTyping?.status === 'mengerjakan' ? 'bg-white text-gray-800' : 'bg-gray-50 text-gray-500'
                      }`}
                      data-placeholder={myTyping?.status === 'mengerjakan' ? 'Mulai mengetik di sini...' : "Klik 'Mulai Mengetik' untuk membuka kolom ini"}
                    />

                    {(!myTyping || myTyping.status === 'belum_mulai') && (
                      <button
                        onClick={startTyping}
                        disabled={typingBusy}
                        className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition disabled:opacity-50"
                      >
                        {typingBusy ? 'Memulai...' : 'Mulai Mengetik'}
                      </button>
                    )}

                    {myTyping?.status === 'mengerjakan' && (
                      <button
                        onClick={finishTyping}
                        disabled={typingBusy}
                        className="w-full py-3 bg-green-600 text-white rounded-xl font-bold hover:bg-green-700 transition disabled:opacity-50"
                      >
                        {typingBusy ? 'Menyimpan...' : 'Selesai'}
                      </button>
                    )}

                    {myTyping?.status === 'selesai' && (
                      <div className="space-y-3">
                        <div className="grid grid-cols-3 gap-2 text-center">
                          <div className="bg-blue-50 rounded-xl py-3">
                            <div className="text-lg font-bold text-blue-600">{myTyping.skorKebenaran}<span className="text-xs font-normal text-blue-400">/{tugas.bobotKebenaran ?? BOBOT.KEBENARAN}</span></div>
                            <div className="text-[10px] uppercase font-bold text-gray-400 mt-0.5">Kebenaran</div>
                          </div>
                          <div className="bg-purple-50 rounded-xl py-3">
                            <div className="text-lg font-bold text-purple-600">{myTyping.skorKecepatan}<span className="text-xs font-normal text-purple-400">/{tugas.bobotKecepatan ?? BOBOT.KECEPATAN}</span></div>
                            <div className="text-[10px] uppercase font-bold text-gray-400 mt-0.5">Kecepatan</div>
                          </div>
                          <div className="bg-green-50 rounded-xl py-3">
                            <div className="text-lg font-bold text-green-600">{myTyping.skorTotal}</div>
                            <div className="text-[10px] uppercase font-bold text-gray-400 mt-0.5">Total</div>
                          </div>
                        </div>
                        <p className="text-xs text-gray-400 text-center">Skor kecepatan bisa berubah jika ada teman sekelas yang menyelesaikan lebih cepat.</p>
                        <button
                          onClick={startTyping}
                          disabled={typingBusy}
                          className="w-full py-2.5 border border-gray-200 rounded-xl font-medium text-gray-600 hover:bg-gray-50 transition flex items-center justify-center gap-2 disabled:opacity-50"
                        >
                          <RotateCcw className="w-4 h-4" /> Ulangi Mengetik
                        </button>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {!isMengetik && tugas.lampiran && tugas.lampiran.length > 0 && (
              <div className="mt-6 border-t border-gray-100 pt-6">
                <h3 className="font-bold text-gray-800 mb-3">Lampiran Materi</h3>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  {tugas.lampiran.map((lampiran) => {
                    const viewUrl = `/api/tugas/lampiran/${lampiran.id}/view`
                    const downloadUrl = `/api/tugas/lampiran/${lampiran.id}/download`
                    const previewHtmlUrl = `/api/tugas/lampiran/${lampiran.id}/preview-html`
                    const thumbKey = `lampiran-${lampiran.id}`
                    const isImg = isImageFile(lampiran.namaFile)

                    if (isImg && !thumbs[thumbKey]) loadThumb(thumbKey, viewUrl)
                    const openLampiranPreview = () => setPreviewFile({ namaFile: lampiran.namaFile, viewUrl, previewHtmlUrl, downloadUrl, title: lampiran.namaFile })

                    return (
                      <div key={lampiran.id} className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                        {isImg ? (
                          <button
                            type="button"
                            onClick={openLampiranPreview}
                            className="block w-full h-32 mb-2 rounded-lg overflow-hidden bg-gray-100 border border-gray-200"
                          >
                            {thumbs[thumbKey] ? (
                              <img src={thumbs[thumbKey]} alt={lampiran.namaFile} className="w-full h-full object-cover" />
                            ) : (
                              <div className="w-full h-full flex items-center justify-center text-gray-300">
                                <ImageIcon className="w-8 h-8" />
                              </div>
                            )}
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={openLampiranPreview}
                            className="w-full h-32 mb-2 rounded-lg bg-gray-100 border border-gray-200 flex flex-col items-center justify-center gap-1 hover:bg-gray-200 transition"
                          >
                            <FileText className="w-8 h-8 text-gray-400" />
                            <span className="text-[11px] text-gray-400">Klik untuk pratinjau</span>
                          </button>
                        )}
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm text-gray-700 truncate">{lampiran.namaFile}</span>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button
                              onClick={openLampiranPreview}
                              title="Pratinjau"
                              className="p-2 text-gray-500 hover:bg-gray-200 rounded-lg transition"
                            >
                              <Eye className="w-4 h-4" />
                            </button>
                            <button
                              onClick={() => downloadFile(downloadUrl, lampiran.namaFile)}
                              title="Unduh"
                              className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition"
                            >
                              <Download className="w-4 h-4" />
                            </button>
                          </div>
                        </div>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}
          </div>

          {/* Daftar siswa yang sudah mengumpulkan (khusus guru, tugas non-mengetik) */}
          {!isSiswa && !isMengetik && (
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-800">Siswa yang Sudah Mengumpulkan</h3>
                {!loadingSubmissionList && (
                  <span className="px-3 py-1 bg-green-50 text-green-600 text-xs font-bold rounded-full">
                    {submissionList.filter((s) => s.sudahUpload).length}/{submissionList.length} siswa
                  </span>
                )}
              </div>

              {loadingSubmissionList ? (
                <p className="text-sm text-gray-400">Memuat data pengumpulan...</p>
              ) : submissionList.filter((s) => s.sudahUpload).length === 0 ? (
                <p className="text-sm text-gray-400">Belum ada siswa yang mengumpulkan tugas ini.</p>
              ) : (
                <div className="space-y-2">
                  {submissionList.filter((s) => s.sudahUpload).map((s) => {
                    const viewUrl = `/api/pengumpulan/view/${s.pengumpulanId}`
                    const downloadUrl = `/api/pengumpulan/download/${s.pengumpulanId}`
                    const previewHtmlUrl = `/api/pengumpulan/preview-html/${s.pengumpulanId}`
                    const nilaiEntry = nilaiMap[s.pengumpulanId] || { nilai: '', keterangan: '', saving: false, saved: false }
                    return (
                      <div key={s.siswaId} className="p-3 bg-gray-50 rounded-xl border border-gray-100">
                        {/* Baris atas: info siswa + tombol preview/download */}
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <div className="min-w-0">
                            <p className="text-sm font-bold text-gray-800 truncate">
                              {s.nama} <span className="font-normal text-gray-400">({s.kelas}{s.rombel})</span>
                            </p>
                            <p className="text-xs text-gray-500 truncate">{s.namaFile}</p>
                            <p className="text-[11px] text-gray-400">Dikirim: {formatTanggal(s.jamUpload)}</p>
                          </div>
                          <div className="flex items-center gap-1 flex-shrink-0">
                            <button onClick={() => setPreviewFile({ namaFile: s.namaFile, viewUrl, previewHtmlUrl, downloadUrl, title: `File: ${s.nama}` })} title="Pratinjau" className="p-2 text-gray-500 hover:bg-gray-200 rounded-lg transition">
                              <Eye className="w-4 h-4" />
                            </button>
                            <button onClick={() => downloadFile(downloadUrl, s.namaFile)} title="Unduh" className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition">
                              <Download className="w-4 h-4" />
                            </button>
                            <button onClick={() => deleteSubmission(s.pengumpulanId, s.nama)} title="Hapus hasil tugas" className="p-2 text-red-500 hover:bg-red-100 rounded-lg transition">
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </div>
                        </div>

                        {/* Baris bawah: input nilai + keterangan + simpan */}
                        <div className="flex items-center gap-2 mt-1.5 pt-2 border-t border-gray-200">
                          <PenLine className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                          <div className="flex items-center gap-1.5 shrink-0">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              step={0.5}
                              placeholder="Nilai"
                              value={nilaiEntry.nilai}
                              onChange={e => setNilaiMap(prev => ({ ...prev, [s.pengumpulanId]: { ...prev[s.pengumpulanId], nilai: e.target.value, saved: false } }))}
                              className="w-16 text-center px-2 py-1.5 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                            />
                            <span className="text-xs text-gray-400 shrink-0">/100</span>
                          </div>
                          <input
                            type="text"
                            placeholder="Keterangan (opsional)"
                            value={nilaiEntry.keterangan}
                            onChange={e => setNilaiMap(prev => ({ ...prev, [s.pengumpulanId]: { ...prev[s.pengumpulanId], keterangan: e.target.value, saved: false } }))}
                            className="flex-1 min-w-0 px-3 py-1.5 text-sm border border-gray-200 rounded-lg outline-none focus:ring-2 focus:ring-blue-500 bg-white"
                          />
                          <button
                            onClick={() => saveNilai(s.pengumpulanId)}
                            disabled={nilaiEntry.saving}
                            title="Simpan nilai"
                            className={`shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition
                              ${nilaiEntry.saved ? 'bg-green-500 text-white' : 'bg-blue-600 text-white hover:bg-blue-700'}
                              disabled:opacity-60`}
                          >
                            {nilaiEntry.saving ? (
                              <span className="animate-pulse">...</span>
                            ) : nilaiEntry.saved ? (
                              <><CheckCircle className="w-3.5 h-3.5" /> Tersimpan</>
                            ) : (
                              <><Save className="w-3.5 h-3.5" /> Simpan</>
                            )}
                          </button>
                        </div>
                      </div>
                    )
                  })}
                </div>
              )}
            </div>
          )}

          {/* Hasil tugas mengetik (khusus guru) - update real-time lewat socket */}
          {!isSiswa && isMengetik && (
            <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-bold text-gray-800 flex items-center gap-2">
                  <Keyboard className="w-4 h-4 text-blue-500" /> Hasil Tugas Mengetik
                </h3>
                {!loadingTypingList && (
                  <span className="px-3 py-1 bg-green-50 text-green-600 text-xs font-bold rounded-full">
                    {typingList.filter((s) => s.status === 'selesai').length}/{typingList.length} selesai
                  </span>
                )}
              </div>

              {loadingTypingList ? (
                <p className="text-sm text-gray-400">Memuat data hasil mengetik...</p>
              ) : typingList.length === 0 ? (
                <p className="text-sm text-gray-400">Belum ada siswa target untuk tugas ini.</p>
              ) : (
                <div className="overflow-x-auto -mx-2">
                  <table className="w-full text-sm min-w-[640px]">
                    <thead>
                      <tr className="text-left text-gray-400 text-xs uppercase tracking-wider">
                        <th className="px-2 py-2 font-semibold">Siswa</th>
                        <th className="px-2 py-2 font-semibold">Status</th>
                        <th className="px-2 py-2 font-semibold">Waktu</th>
                        <th className="px-2 py-2 font-semibold text-right">Kebenaran (maks {tugas.bobotKebenaran ?? BOBOT.KEBENARAN})</th>
                        <th className="px-2 py-2 font-semibold text-right">Kecepatan (maks {tugas.bobotKecepatan ?? BOBOT.KECEPATAN})</th>
                        <th className="px-2 py-2 font-semibold text-right">Total</th>
                        <th className="px-2 py-2 font-semibold text-center">Hasil</th>
                      </tr>
                    </thead>
                    <tbody>
                      {[...typingList]
                        .sort((a, b) => (b.skorTotal || 0) - (a.skorTotal || 0))
                        .map((s) => (
                          <tr key={s.siswaId} className="border-t border-gray-100">
                            <td className="px-2 py-2">
                              <p className="font-semibold text-gray-800">{s.nama}</p>
                              <p className="text-[11px] text-gray-400">{s.kelas}{s.rombel}</p>
                            </td>
                            <td className="px-2 py-2">
                              <span className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                                s.status === 'selesai' ? 'bg-green-50 text-green-600'
                                  : s.status === 'mengerjakan' ? 'bg-yellow-50 text-yellow-600 animate-pulse'
                                  : 'bg-gray-100 text-gray-400'
                              }`}>
                                {s.status === 'selesai' ? 'Selesai' : s.status === 'mengerjakan' ? 'Mengerjakan' : 'Belum Mulai'}
                              </span>
                              {s.peringkatKecepatan === 1 && (
                                <Trophy className="inline w-3.5 h-3.5 text-yellow-500 ml-1" />
                              )}
                            </td>
                            <td className="px-2 py-2 text-gray-600">{formatDurasi(s.durasiDetik)}</td>
                            <td className="px-2 py-2 text-right text-gray-700">{s.status === 'selesai' ? s.skorKebenaran : '-'}</td>
                            <td className="px-2 py-2 text-right text-gray-700">{s.status === 'selesai' ? s.skorKecepatan : '-'}</td>
                            <td className="px-2 py-2 text-right font-bold text-blue-600">{s.status === 'selesai' ? s.skorTotal : '-'}</td>
                            <td className="px-2 py-2 text-center">
                              {s.status === 'selesai' && (
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    onClick={() => setPreviewHasil(s)}
                                    title="Lihat hasil ketikan"
                                    className="p-1.5 text-gray-500 hover:bg-gray-100 rounded-lg transition"
                                  >
                                    <Eye className="w-4 h-4" />
                                  </button>
                                  <button
                                    onClick={() => deleteTyping(s.id, s.nama)}
                                    title="Hapus hasil tugas"
                                    className="p-1.5 text-red-500 hover:bg-red-100 rounded-lg transition"
                                  >
                                    <Trash2 className="w-4 h-4" />
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Kolom Aksi / Status */}
        <div className="space-y-6">
          {/* Countdown Card */}
          {tugas.deadline && (
            <div className={`bg-white rounded-2xl p-6 shadow-sm border ${getCountdownColor()} transition duration-300`}>
              <h3 className="font-bold text-sm uppercase tracking-wider mb-3">Sisa Waktu</h3>
              {countdown.ended ? (
                <div className="flex items-center gap-2 font-bold text-lg">
                  <AlertCircle className="w-5 h-5" /> TUGAS TELAH BERAKHIR
                </div>
              ) : (
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div>
                    <div className="text-xl font-bold">{countdown.days}</div>
                    <div className="text-[10px] uppercase font-bold text-gray-400 mt-0.5">Hari</div>
                  </div>
                  <div>
                    <div className="text-xl font-bold">{countdown.hours}</div>
                    <div className="text-[10px] uppercase font-bold text-gray-400 mt-0.5">Jam</div>
                  </div>
                  <div>
                    <div className="text-xl font-bold">{countdown.minutes}</div>
                    <div className="text-[10px] uppercase font-bold text-gray-400 mt-0.5">Menit</div>
                  </div>
                  <div>
                    <div className="text-xl font-bold">{countdown.seconds}</div>
                    <div className="text-[10px] uppercase font-bold text-gray-400 mt-0.5">Detik</div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Status pengumpulan khusus siswa (tugas non-mengetik) */}
          {isSiswa && !isMengetik && !checkingSubmission && mySubmission && (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-green-200">
              <div className="flex items-center gap-2 mb-3 text-green-700">
                <FileCheck2 className="w-5 h-5" />
                <h3 className="font-bold text-sm uppercase tracking-wider">Sudah Mengumpulkan</h3>
              </div>
              <p className="text-xs text-gray-400 mb-3">
                Dikirim: {formatTanggal(mySubmission.updatedAt)}
              </p>

              {(() => {
                const viewUrl = `/api/pengumpulan/view/${mySubmission.id}`
                const previewHtmlUrl = `/api/pengumpulan/preview-html/${mySubmission.id}`
                const thumbKey = `submission-${mySubmission.id}`
                const isImg = isImageFile(mySubmission.namaFile)
                if (isImg && !thumbs[thumbKey]) loadThumb(thumbKey, viewUrl)

                return (
                  <>
                    {isImg ? (
                      <button
                        type="button"
                        onClick={() => setPreviewFile({ namaFile: mySubmission.namaFile, viewUrl, previewHtmlUrl, downloadUrl: viewUrl, title: 'File Kamu' })}
                        className="block w-full h-36 mb-3 rounded-lg overflow-hidden bg-gray-100 border border-gray-200"
                      >
                        {thumbs[thumbKey] ? (
                          <img src={thumbs[thumbKey]} alt={mySubmission.namaFile} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center text-gray-300">
                            <ImageIcon className="w-8 h-8" />
                          </div>
                        )}
                      </button>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setPreviewFile({ namaFile: mySubmission.namaFile, viewUrl, previewHtmlUrl, downloadUrl: viewUrl, title: 'File Kamu' })}
                        className="w-full h-24 mb-3 rounded-lg bg-gray-50 border border-gray-200 flex flex-col items-center justify-center gap-1 hover:bg-gray-100 transition"
                      >
                        <FileText className="w-7 h-7 text-gray-400" />
                        <span className="text-[11px] text-gray-400">Klik untuk pratinjau</span>
                      </button>
                    )}
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-sm text-gray-700 truncate">{mySubmission.namaFile}</span>
                      <div className="flex items-center gap-1 flex-shrink-0">
                        <button
                          onClick={() => setPreviewFile({ namaFile: mySubmission.namaFile, viewUrl, previewHtmlUrl, downloadUrl: viewUrl, title: 'File Kamu' })}
                          title="Pratinjau"
                          className="p-2 text-gray-500 hover:bg-gray-100 rounded-lg transition"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                        <button
                          onClick={() => downloadFile(viewUrl, mySubmission.namaFile)}
                          title="Unduh"
                          className="p-2 text-blue-600 hover:bg-blue-100 rounded-lg transition"
                        >
                          <Download className="w-4 h-4" />
                        </button>
                      </div>
                    </div>
                  </>
                )
              })()}

              <p className="text-xs text-gray-400 mt-3">Kamu masih bisa mengunggah ulang jawaban sebelum deadline berakhir.</p>
            </div>
          )}

          {/* Upload Card khusus siswa (tugas non-mengetik) */}
          {isSiswa && !isMengetik && (
            <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
              <h3 className="font-bold text-gray-800 mb-4">
                {mySubmission ? 'Kirim Ulang Jawaban' : 'Unggah Jawaban'}
              </h3>

              {success && (
                <div className="mb-4 p-3 bg-green-50 text-green-700 border border-green-200 rounded-xl text-sm flex items-center gap-2">
                  <CheckCircle className="w-4 h-4 flex-shrink-0" /> {success}
                </div>
              )}

              {error && (
                <div className="mb-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-sm flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
                </div>
              )}

              {isDitutup ? (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-center text-red-700 font-bold text-sm flex items-center justify-center gap-2">
                  <Lock className="w-4 h-4" /> Tugas Ditutup oleh Guru
                </div>
              ) : countdown.ended ? (
                <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-center text-red-700 font-bold text-sm">
                  ❌ Masa Pengumpulan Telah Berakhir
                </div>
              ) : (
                <form onSubmit={handleUpload} className="space-y-4">
                  <div className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center hover:border-blue-300 transition relative">
                    <input
                      type="file"
                      onChange={(e) => setFile(e.target.files[0])}
                      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                      required
                    />
                    <Upload className="w-8 h-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-xs text-gray-500 font-medium">
                      {file ? file.name : 'Pilih atau drop file jawaban di sini'}
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={uploading || !file}
                    className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {uploading ? 'Mengunggah...' : 'Kirim Jawaban'}
                  </button>
                </form>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Modal pratinjau hasil ketik siswa (khusus guru) */}
      {previewHasil && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center pt-10 px-4 overflow-y-auto" onClick={() => setPreviewHasil(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-8 relative mb-10" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => setPreviewHasil(null)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-700">
              <X className="w-6 h-6" />
            </button>
            <h2 className="text-lg font-bold text-gray-800 mb-1">Hasil Ketik: {previewHasil.nama}</h2>
            <p className="text-sm text-gray-500 mb-4">
              Waktu: {formatDurasi(previewHasil.durasiDetik)} &middot; Skor: {previewHasil.skorKebenaran} + {previewHasil.skorKecepatan} = <span className="font-bold text-blue-600">{previewHasil.skorTotal}</span>
            </p>
            <div className="border border-gray-200 rounded-xl px-5 py-4 leading-relaxed text-gray-800 max-h-[50vh] overflow-y-auto"
              dangerouslySetInnerHTML={{ __html: previewHasil.hasilKetik || '<p class="text-gray-400">Tidak ada hasil.</p>' }}
            />
          </div>
        </div>
      )}

      {previewFile && (
        <FilePreviewModal
          title={previewFile.title}
          namaFile={previewFile.namaFile}
          viewUrl={previewFile.viewUrl}
          previewHtmlUrl={previewFile.previewHtmlUrl}
          downloadUrl={previewFile.downloadUrl}
          onClose={() => setPreviewFile(null)}
        />
      )}
    </div>
  )
}

const CollabWidget = ({ tugasId }) => {
  const [collab, setCollab] = useState({ isCollab: false })
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(false)
  const [temanList, setTemanList] = useState([])
  const [selectedKelas, setSelectedKelas] = useState('')
  const [selectedRombel, setSelectedRombel] = useState('')
  const [selectedPartnerId, setSelectedPartnerId] = useState('')
  const [tanggalLahir, setTanggalLahir] = useState('')
  const [error, setError] = useState('')
  const [joining, setJoining] = useState(false)
  const [searching, setSearching] = useState(false)

  const KELAS_OPTIONS = ['1', '2', '3', '4', '5', '6']
  const ROMBEL_OPTIONS = ['A', 'B', 'C', 'D']

  useEffect(() => {
    fetchCollabStatus()
  }, [tugasId])

  const fetchCollabStatus = async () => {
    try {
      const res = await apiRequest(`/api/collab/${tugasId}`)
      const data = await res.json()
      setCollab(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const handleOpenCollab = async () => {
    console.log('handleOpenCollab triggered')
    setError('')
    setSelectedKelas('')
    setSelectedRombel('')
    setTemanList([])
    setSelectedPartnerId('')
    setTanggalLahir('')
    setShowModal(true)
  }

  const handleSearchSiswa = async () => {
    if (!selectedKelas || !selectedRombel) {
      setError('Pilih kelas dan rombel terlebih dahulu.')
      return
    }
    setError('')
    setSearching(true)
    setTemanList([])
    setSelectedPartnerId('')
    try {
      const res = await apiRequest(`/api/collab/manual/search-siswa?kelas=${selectedKelas}&rombel=${selectedRombel}&tugasId=${tugasId}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.message)
      setTemanList(Array.isArray(data) ? data : [])
      if (data.length === 0) {
        setError('Tidak ada teman tersedia di kelas/rombel tersebut.')
      }
    } catch (e) {
      console.error('Error fetching teman list:', e)
      setError(e.message)
    } finally {
      setSearching(false)
    }
  }

  const handleJoin = async (e) => {
    e.preventDefault()
    if (!selectedPartnerId || !tanggalLahir) {
      setError('Pilih teman dan masukkan tanggal lahir.')
      return
    }
    setJoining(true)
    setError('')
    try {
      const res = await apiRequest('/api/collab/join', {
        method: 'POST',
        body: JSON.stringify({
          tugasId,
          partnerId: selectedPartnerId,
          tanggalLahir
        })
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message)
      setCollab(data)
      setShowModal(false)
      // Save info to localStorage so submission functions know who partner is
      localStorage.setItem(`collab_tugas_${tugasId}`, JSON.stringify(data.partner))
    } catch (err) {
      setError(err.message)
    } finally {
      setJoining(false)
    }
  }

  const handleLeave = async () => {
    if (!window.confirm('Batal kolaborasi? Kamu akan mengerjakan tugas ini secara individu.')) return
    try {
      const res = await apiRequest(`/api/collab/${collab.collabId}`, {
        method: 'DELETE'
      })
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.message)
      }
      setCollab({ isCollab: false })
      localStorage.removeItem(`collab_tugas_${tugasId}`)
    } catch (err) {
      alert(err.message)
    }
  }

  if (loading) return null

  return (
    <div className="mt-4 p-4 rounded-xl border border-blue-100 bg-blue-50/50 flex flex-wrap items-center justify-between gap-4">
      {collab.isCollab ? (
        <>
          <div className="flex items-center gap-2">
            <span className="w-2.5 h-2.5 rounded-full bg-green-500 animate-pulse" />
            <span className="text-sm font-semibold text-blue-900">
              Dikerjakan Bersama <span className="font-bold underline text-blue-700">{collab.partner?.nama}</span>
            </span>
          </div>
          <button
            onClick={handleLeave}
            className="px-4 py-1.5 bg-red-100 text-red-700 font-bold text-xs rounded-lg hover:bg-red-200 transition"
          >
            Keluar Collab
          </button>
        </>
      ) : (
        <>
          <span className="text-xs text-gray-500 font-medium">Bekerja bersama teman sekelas di PC yang sama?</span>
          <button
            onClick={handleOpenCollab}
            type="button" // Add type="button" to prevent default submit behavior
            className="px-4 py-1.5 bg-blue-600 text-white font-bold text-xs rounded-lg hover:bg-blue-700 transition"
          >
            Collab / Join
          </button>
        </>
      )}

      {showModal && (
        <div className="fixed inset-0 bg-black/40 z-[100] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-6 w-full max-w-md shadow-2xl relative">
            <button
              onClick={() => { setShowModal(false); setError('') }} // Clear error on close
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-600"
            >
              <X className="w-5 h-5" />
            </button>
            <h3 className="font-bold text-lg text-gray-800 mb-4">Pilih Teman Collab</h3>
            
            {error && (
              <div className="mb-4 p-3 bg-red-50 text-red-700 border border-red-200 rounded-xl text-sm flex items-center gap-2">
                <AlertCircle className="w-4 h-4 flex-shrink-0" /> {error}
              </div>
            )}

            <form onSubmit={handleJoin} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Kelas</label>
                  <select
                    value={selectedKelas}
                    onChange={(e) => {
                      setSelectedKelas(e.target.value)
                      setTemanList([])
                      setSelectedPartnerId('')
                    }}
                    className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500 transition text-sm bg-white"
                  >
                    <option value="">-- Kelas --</option>
                    {KELAS_OPTIONS.map(k => <option key={k} value={k}>{k}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Rombel</label>
                  <select
                    value={selectedRombel}
                    onChange={(e) => {
                      setSelectedRombel(e.target.value)
                      setTemanList([])
                      setSelectedPartnerId('')
                    }}
                    className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500 transition text-sm bg-white"
                  >
                    <option value="">-- Rombel --</option>
                    {ROMBEL_OPTIONS.map(r => <option key={r} value={r}>{r}</option>)}
                  </select>
                </div>
              </div>

              <button
                type="button"
                onClick={handleSearchSiswa}
                disabled={searching || !selectedKelas || !selectedRombel}
                className="w-full py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-xl font-semibold transition disabled:opacity-50 text-sm border border-gray-200"
              >
                {searching ? 'Mencari...' : 'Cari Teman'}
              </button>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Pilih Teman</label>
                <select
                  value={selectedPartnerId}
                  onChange={(e) => setSelectedPartnerId(e.target.value)}
                  className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500 transition text-sm bg-white"
                  required
                  disabled={temanList.length === 0}
                >
                  <option value="">-- Pilih Teman --</option>
                  {temanList && temanList.map((t) => (
                    <option key={t.id} value={t.id}>{t.nama}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-2">Konfirmasi Tanggal Lahir Teman</label>
                <input
                  type="text"
                  placeholder="DDMMYYYY (Contoh: 17081945)"
                  value={tanggalLahir}
                  onChange={(e) => setTanggalLahir(e.target.value)}
                  className="w-full p-3 border border-gray-200 rounded-xl outline-none focus:border-blue-500 transition text-sm"
                  maxLength={8}
                  required
                />
              </div>

              <button
                type="submit"
                disabled={joining}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-xl font-bold transition disabled:opacity-50 text-sm"
              >
                {joining ? 'Memproses...' : 'Konfirmasi & Collab'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}

export default DetailTugasPage

