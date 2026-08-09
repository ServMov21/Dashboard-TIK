import React, { useState, useEffect, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import {
  Plus, Search, Clock, FileText, Eye, Edit, Trash2, X, Image, File, Video,
  Link as LinkIcon, Upload, Keyboard, Lock, Unlock, Bold, Italic, Underline,
  AlignLeft, AlignCenter, AlignRight, Copy,
} from 'lucide-react'
import { apiRequest } from '../utils/api'

const JENIS_OPTIONS = [
  { value: 'text', label: 'Teks', icon: FileText },
  { value: 'dokumen', label: 'Dokumen', icon: File },
  { value: 'gambar', label: 'Gambar', icon: Image },
  { value: 'video', label: 'Video', icon: Video },
  { value: 'link', label: 'Link', icon: LinkIcon },
  { value: 'mengetik', label: 'Mengetik', icon: Keyboard },
]

const EMPTY_FORM = {
  judul: '', deskripsi: '', jenis: 'text', link: '', deadline: '',
  status: 'draft', kelasTarget: [], rombelTarget: [], lampiran: [], naskahMengetik: '',
  bobotKebenaran: '',
}

const DEFAULT_BOBOT_KEBENARAN = 90
const DEFAULT_BOBOT_KECEPATAN = 10

const TugasPage = () => {
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const isGuru = user.role === 'guru'
  const fileRef = useRef(null)
  const naskahEditorRef = useRef(null)
  const editNaskahRef = useRef(null)
  const editFileRef = useRef(null)

  const [tugasList, setTugasList] = useState([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState('semua')
  const [search, setSearch] = useState('')

  // ── Form Tambah / Edit ──────────────────────────────────────────
  const [showForm, setShowForm] = useState(false)
  const [isEditing, setIsEditing] = useState(false)
  const [editingTugasId, setEditingTugasId] = useState(null)
  const [submitting, setSubmitting] = useState(false)
  const [form, setForm] = useState({ ...EMPTY_FORM })
  const [formError, setFormError] = useState('')
  const [existingLampiran, setExistingLampiran] = useState([]) // lampiran lama saat edit
  const [lampiranPreviews, setLampiranPreviews] = useState([])

  // ── Kelas / Rombel untuk form tambah / edit ─────────────────────
  const [kelasList, setKelasList] = useState([])
  const [rombelMap, setRombelMap] = useState({})

  // ── Clone ────────────────────────────────────────────────────────
  const [showCloneModal, setShowCloneModal] = useState(false)
  const [cloningTugas, setCloningTugas] = useState(null)
  const [cloneKelasTarget, setCloneKelasTarget] = useState([])
  const [cloneRombelTarget, setCloneRombelTarget] = useState([])
  const [cloneRombelMap, setCloneRombelMap] = useState({})
  const [cloning, setCloning] = useState(false)
  const [cloneError, setCloneError] = useState('')

  // Preview gambar lampiran baru
  useEffect(() => {
    const urls = form.lampiran.map((f) => (f.type?.startsWith('image/') ? URL.createObjectURL(f) : null))
    setLampiranPreviews(urls)
    return () => { urls.forEach((u) => u && URL.revokeObjectURL(u)) }
  }, [form.lampiran])

  useEffect(() => { fetchTugas() }, [])

  // Sync editor naskah saat form dibuka (buat tugas baru atau edit)
  useEffect(() => {
    if (showForm && form.jenis === 'mengetik') {
      const ref = isEditing ? editNaskahRef : naskahEditorRef
      if (ref.current) ref.current.innerHTML = form.naskahMengetik || ''
    }
  }, [showForm, form.jenis, isEditing])

  // Fetch daftar kelas saat guru membuka form
  useEffect(() => {
    if (!isGuru) return
    const fetchKelas = async () => {
      try {
        const res = await apiRequest('/api/siswa/login-kelas')
        const data = await res.json()
        if (res.ok) setKelasList(data)
      } catch (e) { console.error(e) }
    }
    fetchKelas()
  }, [isGuru])

  // Fetch rombel berdasarkan kelas yang dipilih (form tambah/edit)
  useEffect(() => {
    if (form.kelasTarget.length === 0) return
    const fetchRombels = async () => {
      const map = {}
      for (const kelas of form.kelasTarget) {
        try {
          const res = await apiRequest(`/api/siswa/login-rombel?kelas=${encodeURIComponent(kelas)}`)
          const data = await res.json()
          if (res.ok) map[kelas] = data
        } catch (e) { console.error(e) }
      }
      setRombelMap(map)
    }
    fetchRombels()
  }, [form.kelasTarget])

  // Fetch rombel untuk modal clone
  useEffect(() => {
    if (cloneKelasTarget.length === 0) { setCloneRombelMap({}); return }
    const fetchRombels = async () => {
      const map = {}
      for (const kelas of cloneKelasTarget) {
        try {
          const res = await apiRequest(`/api/siswa/login-rombel?kelas=${encodeURIComponent(kelas)}`)
          const data = await res.json()
          if (res.ok) map[kelas] = data
        } catch (e) { console.error(e) }
      }
      setCloneRombelMap(map)
    }
    fetchRombels()
  }, [cloneKelasTarget])

  const fetchTugas = async () => {
    setLoading(true)
    try {
      const url = isGuru ? '/api/tugas' : '/api/tugas/siswa'
      const res = await apiRequest(url)
      const data = await res.json()
      if (!res.ok) throw new Error(data.message)
      setTugasList(Array.isArray(data) ? data : [])
    } catch (e) { console.error('Gagal memuat tugas:', e) }
    finally { setLoading(false) }
  }

  const filtered = useMemo(() => {
    let list = tugasList
    if (filter === 'aktif') list = list.filter(t => t.status === 'launch')
    else if (filter === 'berakhir') list = list.filter(t => t.deadline && new Date(t.deadline) < new Date())
    else if (filter === 'ditutup') list = list.filter(t => t.status === 'ditutup')
    else if (filter === 'draft') list = list.filter(t => t.status === 'draft')
    const keyword = search.trim().toLowerCase()
    if (keyword) {
      list = list.filter(t => {
        const kelasTarget = Array.isArray(t.kelasTarget) ? t.kelasTarget : JSON.parse(t.kelasTarget || '[]')
        const rombelTarget = t.rombelTarget ? (Array.isArray(t.rombelTarget) ? t.rombelTarget : JSON.parse(t.rombelTarget || '[]')) : []
        const kelasRombelText = kelasTarget.map(k => rombelTarget.length ? `${k}${rombelTarget.join('')}` : k).join(' ').toLowerCase()
        return t.judul.toLowerCase().includes(keyword) || kelasRombelText.includes(keyword)
      })
    }
    return list
  }, [tugasList, filter, search])

  const matchesTask = (tugas) => {
    const userKelas = user.kelas
    const userRombel = user.rombel
    const kelasTarget = Array.isArray(tugas.kelasTarget) ? tugas.kelasTarget : JSON.parse(tugas.kelasTarget || '[]')
    const rombelTarget = tugas.rombelTarget ? (Array.isArray(tugas.rombelTarget) ? tugas.rombelTarget : JSON.parse(tugas.rombelTarget || '[]')) : []
    const kelasMatch = kelasTarget.length === 0 || kelasTarget.includes(userKelas)
    const rombelMatch = rombelTarget.length === 0 || rombelTarget.includes(userRombel)
    return kelasMatch && rombelMatch
  }

  const toggleKelas = (k) => setForm(p => ({
    ...p, kelasTarget: p.kelasTarget.includes(k) ? p.kelasTarget.filter(x => x !== k) : [...p.kelasTarget, k],
  }))
  const toggleRombel = (r) => setForm(p => ({
    ...p, rombelTarget: p.rombelTarget.includes(r) ? p.rombelTarget.filter(x => x !== r) : [...p.rombelTarget, r],
  }))

  // ──────────────────────────────────────────────────────────────────
  //  Buka form TAMBAH baru
  // ──────────────────────────────────────────────────────────────────
  const openForm = () => {
    setIsEditing(false)
    setEditingTugasId(null)
    setExistingLampiran([])
    setForm({ ...EMPTY_FORM })
    setFormError('')
    setShowForm(true)
  }

  const closeForm = () => {
    setShowForm(false)
    setIsEditing(false)
    setEditingTugasId(null)
    setExistingLampiran([])
    setForm({ ...EMPTY_FORM })
    setFormError('')
  }

  // ──────────────────────────────────────────────────────────────────
  //  Buka form EDIT tugas
  // ──────────────────────────────────────────────────────────────────
  const openEditForm = (tugas) => {
    const kelasTarget = Array.isArray(tugas.kelasTarget) ? tugas.kelasTarget : JSON.parse(tugas.kelasTarget || '[]')
    const rombelTarget = tugas.rombelTarget
      ? (Array.isArray(tugas.rombelTarget) ? tugas.rombelTarget : JSON.parse(tugas.rombelTarget || '[]'))
      : []
    const deadlineValue = tugas.deadline ? new Date(tugas.deadline).toISOString().slice(0, 16) : ''
    const bobotKb = tugas.bobotKebenaran !== null && tugas.bobotKebenaran !== undefined ? tugas.bobotKebenaran : ''

    setIsEditing(true)
    setEditingTugasId(tugas.id)
    setExistingLampiran(tugas.lampiran || [])
    setForm({
      judul: tugas.judul,
      deskripsi: tugas.deskripsi || '',
      jenis: tugas.jenis,
      link: '',
      deadline: deadlineValue,
      status: tugas.status,
      kelasTarget,
      rombelTarget,
      lampiran: [],
      naskahMengetik: tugas.naskahMengetik || '',
      bobotKebenaran: bobotKb,
    })
    setFormError('')
    setShowForm(true)
  }

  // ──────────────────────────────────────────────────────────────────
  //  Submit form TAMBAH atau EDIT
  // ──────────────────────────────────────────────────────────────────
  const handleSubmitForm = async (e) => {
    e.preventDefault()
    if (!form.judul.trim()) return setFormError('Judul tugas wajib diisi.')
    if (form.kelasTarget.length === 0) return setFormError('Pilih minimal 1 kelas target.')
    if (form.jenis === 'mengetik') {
      const editorRef = isEditing ? editNaskahRef : naskahEditorRef
      const plainText = editorRef.current?.innerText?.trim() || ''
      if (!plainText) return setFormError('Isi naskah yang harus diketik siswa wajib diisi.')
    }
    setSubmitting(true)
    setFormError('')

    try {
      const fd = new FormData()
      fd.append('judul', form.judul)
      fd.append('deskripsi', form.deskripsi)
      fd.append('jenis', form.jenis)
      fd.append('status', form.status)
      if (form.deadline) fd.append('deadline', new Date(form.deadline).toISOString())
      else if (isEditing) fd.append('deadline', '') // Bersihkan deadline jika dikosongkan saat edit
      form.kelasTarget.forEach(k => fd.append('kelasTarget', k))
      form.rombelTarget.forEach(r => fd.append('rombelTarget', r))

      if (form.jenis === 'mengetik') {
        const editorRef = isEditing ? editNaskahRef : naskahEditorRef
        fd.append('naskahMengetik', editorRef.current?.innerHTML || '')
        if (form.bobotKebenaran !== '') fd.append('bobotKebenaran', form.bobotKebenaran)
      } else {
        form.lampiran.forEach(f => fd.append('lampiran', f))
      }

      if (isEditing) {
        // Kirim ID lampiran lama yang masih dipertahankan
        existingLampiran.forEach(l => fd.append('keepLampiranIds', l.id))
        const res = await apiRequest(`/api/tugas/${editingTugasId}`, { method: 'PUT', body: fd })
        const data = await res.json()
        if (!res.ok) throw new Error(data.message || 'Gagal menyimpan perubahan.')
      } else {
        if (form.jenis === 'link' && form.link) fd.append('deskripsi', form.deskripsi + '\n\nLink: ' + form.link)
        const res = await apiRequest('/api/tugas', { method: 'POST', body: fd })
        const data = await res.json()
        if (!res.ok) throw new Error(data.message || 'Gagal menyimpan tugas.')
      }

      closeForm()
      fetchTugas()
    } catch (e) { setFormError(e.message) }
    finally { setSubmitting(false) }
  }

  const handleDelete = async (id) => {
    if (!confirm('Yakin ingin menghapus tugas ini? Data pengumpulan siswa juga akan dihapus.')) return
    try {
      const res = await apiRequest(`/api/tugas/${id}`, { method: 'DELETE' })
      if (!res.ok) { const d = await res.json(); throw new Error(d.message) }
      setTugasList(prev => prev.filter(t => t.id !== id))
    } catch (e) { console.error('Gagal menghapus:', e); alert(e.message) }
  }

  const handleStatusChange = async (id, newStatus) => {
    try {
      const res = await apiRequest(`/api/tugas/${id}`, {
        method: 'PUT', body: JSON.stringify({ status: newStatus }),
      })
      if (!res.ok) { const d = await res.json(); throw new Error(d.message) }
      fetchTugas()
    } catch (e) { console.error('Gagal ubah status:', e) }
  }

  // ──────────────────────────────────────────────────────────────────
  //  Clone tugas
  // ──────────────────────────────────────────────────────────────────
  const openCloneModal = (tugas) => {
    setCloningTugas(tugas)
    setCloneKelasTarget([])
    setCloneRombelTarget([])
    setCloneRombelMap({})
    setCloneError('')
    setShowCloneModal(true)
  }

  const toggleCloneKelas = (k) => setCloneKelasTarget(p =>
    p.includes(k) ? p.filter(x => x !== k) : [...p, k]
  )
  const toggleCloneRombel = (r) => setCloneRombelTarget(p =>
    p.includes(r) ? p.filter(x => x !== r) : [...p, r]
  )

  const handleClone = async () => {
    if (cloneKelasTarget.length === 0) return setCloneError('Pilih minimal 1 kelas tujuan.')
    setCloning(true)
    setCloneError('')
    try {
      const res = await apiRequest(`/api/tugas/${cloningTugas.id}/clone`, {
        method: 'POST',
        body: JSON.stringify({ kelasTarget: cloneKelasTarget, rombelTarget: cloneRombelTarget }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Gagal menyalin tugas.')
      setShowCloneModal(false)
      setCloningTugas(null)
      fetchTugas()
    } catch (e) { setCloneError(e.message) }
    finally { setCloning(false) }
  }

  const getTimeLeft = (deadline) => {
    if (!deadline) return null
    const diff = new Date(deadline).getTime() - Date.now()
    if (diff <= 0) return 'Berakhir'
    const days = Math.floor(diff / (1000 * 60 * 60 * 24))
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60))
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60))
    const seconds = Math.floor((diff % (1000 * 60)) / 1000)
    if (days > 0) return `${days} Hari ${hours} Jam`
    return `${hours} Jam ${minutes} Menit ${seconds} Detik`
  }

  const runNaskahCommand = (cmd, ref) => {
    ref.current?.focus()
    document.execCommand(cmd, false, null)
    setForm((p) => ({ ...p, naskahMengetik: ref.current?.innerHTML || '' }))
  }
  const handleNaskahInput = (ref) => {
    setForm((p) => ({ ...p, naskahMengetik: ref.current?.innerHTML || '' }))
  }

  const allRombels = [...new Set(Object.values(rombelMap).flat())]
  const allCloneRombels = [...new Set(Object.values(cloneRombelMap).flat())]

  // ──────────────────────────────────────────────────────────────────
  //  Helper: render form isi (dipakai untuk tambah & edit)
  // ──────────────────────────────────────────────────────────────────
  const activeNaskahRef = isEditing ? editNaskahRef : naskahEditorRef
  const activeFileRef = isEditing ? editFileRef : fileRef

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">{isGuru ? 'Informasi Tugas' : 'Daftar Tugas'}</h1>
          <p className="text-gray-500 mt-1">{isGuru ? 'Kelola tugas yang diberikan kepada siswa' : 'Tugas yang perlu kamu kerjakan'}</p>
        </div>
        {isGuru && (
          <button onClick={openForm} className="bg-blue-600 text-white px-6 py-2.5 rounded-xl font-medium hover:bg-blue-700 transition flex items-center gap-2 shadow-sm shadow-blue-200">
            <Plus className="w-5 h-5" /> Tambah Tugas
          </button>
        )}
      </div>

      {/* ════════════════════════════════════════════════
          MODAL FORM TAMBAH / EDIT TUGAS
      ════════════════════════════════════════════════ */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center pt-10 px-4 overflow-y-auto">
          <form onSubmit={handleSubmitForm} className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-8 relative mb-10">
            <button type="button" onClick={closeForm} className="absolute top-4 right-4 text-gray-400 hover:text-gray-700">
              <X className="w-6 h-6" />
            </button>
            <h2 className="text-xl font-bold text-gray-800 mb-1">
              {isEditing ? 'Edit Tugas' : 'Tambah Tugas Baru'}
            </h2>
            {isEditing && (
              <p className="text-sm text-gray-400 mb-5">Perubahan berlaku untuk seluruh data tugas ini.</p>
            )}

            {formError && (
              <p className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">{formError}</p>
            )}

            <div className="space-y-4">
              {/* Judul */}
              <label className="block text-sm font-medium text-gray-700">Judul Tugas *
                <input
                  type="text"
                  value={form.judul}
                  onChange={e => setForm(p => ({ ...p, judul: e.target.value }))}
                  className="w-full mt-1 px-4 py-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Praktik Microsoft Word"
                  required
                />
              </label>

              {/* Jenis (tidak bisa diubah saat edit agar data pengumpulan tidak rusak) */}
              <label className="block text-sm font-medium text-gray-700">Jenis Tugas
                {isEditing && (
                  <span className="ml-2 text-xs text-gray-400">(tidak dapat diubah setelah tugas dibuat)</span>
                )}
                <div className="flex flex-wrap gap-2 mt-1">
                  {JENIS_OPTIONS.map(opt => (
                    <button
                      type="button"
                      key={opt.value}
                      onClick={() => !isEditing && setForm(p => ({ ...p, jenis: opt.value }))}
                      disabled={isEditing}
                      className={`px-4 py-2 rounded-lg text-sm font-medium flex items-center gap-2 transition
                        ${form.jenis === opt.value ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}
                        ${isEditing ? 'cursor-not-allowed opacity-70' : ''}`}
                    >
                      <opt.icon className="w-4 h-4" /> {opt.label}
                    </button>
                  ))}
                </div>
              </label>

              {/* Deskripsi / Perintah */}
              <label className="block text-sm font-medium text-gray-700">
                {form.jenis === 'mengetik' ? 'Perintah Tugas' : 'Deskripsi'}
                <textarea
                  value={form.deskripsi}
                  onChange={e => setForm(p => ({ ...p, deskripsi: e.target.value }))}
                  rows={3}
                  className="w-full mt-1 px-4 py-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 resize-none"
                  placeholder={form.jenis === 'mengetik' ? 'Ketik ulang teks di bawah ini secepat dan setepat mungkin...' : 'Kerjakan latihan halaman 20...'}
                />
              </label>

              {/* URL (jenis link) */}
              {form.jenis === 'link' && (
                <label className="block text-sm font-medium text-gray-700">URL Link
                  <input
                    type="url"
                    value={form.link}
                    onChange={e => setForm(p => ({ ...p, link: e.target.value }))}
                    className="w-full mt-1 px-4 py-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="https://youtube.com/..."
                  />
                </label>
              )}

              {/* Naskah mengetik */}
              {form.jenis === 'mengetik' && (
                <div>
                  <span className="block text-sm font-medium text-gray-700 mb-1">Naskah yang Harus Diketik Siswa *</span>
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    <div className="flex items-center gap-1 bg-gray-50 border-b border-gray-200 px-2 py-1.5">
                      {[
                        { cmd: 'bold', icon: Bold, title: 'Tebal' },
                        { cmd: 'italic', icon: Italic, title: 'Miring' },
                        { cmd: 'underline', icon: Underline, title: 'Garis Bawah' },
                      ].map(({ cmd, icon: Icon, title }) => (
                        <button
                          key={cmd}
                          type="button"
                          onMouseDown={e => e.preventDefault()}
                          onClick={() => runNaskahCommand(cmd, activeNaskahRef)}
                          title={title}
                          className="p-2 rounded-lg hover:bg-gray-200 text-gray-600"
                        >
                          <Icon className="w-4 h-4" />
                        </button>
                      ))}
                      <span className="w-px h-5 bg-gray-200 mx-1" />
                      {[
                        { cmd: 'justifyLeft', icon: AlignLeft, title: 'Rata Kiri' },
                        { cmd: 'justifyCenter', icon: AlignCenter, title: 'Rata Tengah' },
                        { cmd: 'justifyRight', icon: AlignRight, title: 'Rata Kanan' },
                      ].map(({ cmd, icon: Icon, title }) => (
                        <button
                          key={cmd}
                          type="button"
                          onMouseDown={e => e.preventDefault()}
                          onClick={() => runNaskahCommand(cmd, activeNaskahRef)}
                          title={title}
                          className="p-2 rounded-lg hover:bg-gray-200 text-gray-600"
                        >
                          <Icon className="w-4 h-4" />
                        </button>
                      ))}
                    </div>
                    <div
                      ref={activeNaskahRef}
                      contentEditable
                      suppressContentEditableWarning
                      onInput={() => handleNaskahInput(activeNaskahRef)}
                      className="min-h-[160px] max-h-72 overflow-y-auto px-4 py-3 outline-none text-gray-800 leading-relaxed empty:before:content-[attr(data-placeholder)] empty:before:text-gray-400 empty:before:pointer-events-none"
                      data-placeholder="Ketik atau tempel naskah di sini..."
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-1">Format tebal, miring, garis bawah, dan huruf besar/kecil akan ikut dinilai.</p>

                  <div className="mt-4">
                    <span className="block text-sm font-medium text-gray-700 mb-1">Bobot Penilaian</span>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-2">
                        <input
                          type="number" min={0} max={100} step={1}
                          value={form.bobotKebenaran === '' ? DEFAULT_BOBOT_KEBENARAN : form.bobotKebenaran}
                          onChange={(e) => {
                            const raw = e.target.value
                            if (raw === '') return setForm(p => ({ ...p, bobotKebenaran: '' }))
                            const angka = Math.min(100, Math.max(0, Number(raw)))
                            setForm(p => ({ ...p, bobotKebenaran: angka }))
                          }}
                          className="w-20 px-3 py-2 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                        />
                        <span className="text-sm text-gray-600">% Kebenaran</span>
                      </div>
                      <span className="text-gray-300">+</span>
                      <div className="flex items-center gap-2">
                        <span className="w-20 px-3 py-2 border border-gray-100 bg-gray-50 rounded-xl text-sm text-gray-500 text-center">
                          {Math.round((100 - (form.bobotKebenaran === '' ? DEFAULT_BOBOT_KEBENARAN : form.bobotKebenaran)) * 10) / 10}
                        </span>
                        <span className="text-sm text-gray-600">% Kecepatan</span>
                      </div>
                    </div>
                    <p className="text-xs text-gray-400 mt-1">
                      Default: {DEFAULT_BOBOT_KEBENARAN} kebenaran / {DEFAULT_BOBOT_KECEPATAN} kecepatan.
                    </p>
                  </div>
                </div>
              )}

              {/* Lampiran (untuk tugas selain link & mengetik) */}
              {form.jenis !== 'link' && form.jenis !== 'mengetik' && (
                <div>
                  <span className="block text-sm font-medium text-gray-700 mb-1">
                    Lampiran {isEditing ? '' : '(Opsional)'}
                  </span>

                  {/* Lampiran lama (saat edit) */}
                  {isEditing && existingLampiran.length > 0 && (
                    <div className="mb-2 space-y-1">
                      <p className="text-xs text-gray-400 mb-1">File yang sudah ada:</p>
                      {existingLampiran.map((l) => (
                        <div key={l.id} className="flex items-center justify-between gap-2 px-3 py-2 bg-blue-50 border border-blue-100 rounded-lg text-xs text-gray-700">
                          <span className="flex items-center gap-2 truncate">
                            <File className="w-4 h-4 text-blue-500 shrink-0" />
                            <span className="truncate">{l.namaFile}</span>
                          </span>
                          <button
                            type="button"
                            onClick={() => setExistingLampiran(p => p.filter(x => x.id !== l.id))}
                            className="text-gray-400 hover:text-red-500 shrink-0"
                            title="Hapus lampiran ini"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Upload lampiran baru */}
                  <div
                    className="border-2 border-dashed border-gray-200 rounded-xl p-4 text-center hover:border-blue-300 transition cursor-pointer"
                    onClick={() => activeFileRef.current?.click()}
                  >
                    <input
                      ref={activeFileRef}
                      type="file"
                      multiple
                      onChange={e => setForm(p => ({ ...p, lampiran: Array.from(e.target.files || []) }))}
                      className="hidden"
                    />
                    <Upload className="w-6 h-6 text-gray-400 mx-auto mb-1" />
                    <p className="text-xs text-gray-500">
                      {form.lampiran.length > 0 ? `${form.lampiran.length} file baru dipilih` : 'Klik untuk menambah file baru'}
                    </p>
                  </div>

                  {form.lampiran.length > 0 && (
                    <ul className="mt-2 space-y-1">
                      {form.lampiran.map((f, i) => (
                        <li key={i} className="flex items-center justify-between gap-2 px-3 py-2 bg-gray-50 border border-gray-200 rounded-lg text-xs text-gray-700">
                          <span className="flex items-center gap-2 truncate">
                            {lampiranPreviews[i] ? (
                              <img src={lampiranPreviews[i]} alt={f.name} className="w-8 h-8 rounded object-cover shrink-0 border border-gray-200" />
                            ) : (
                              <File className="w-4 h-4 text-blue-500 shrink-0" />
                            )}
                            <span className="truncate">{f.name}</span>
                          </span>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setForm(p => ({ ...p, lampiran: p.lampiran.filter((_, idx) => idx !== i) })) }}
                            className="text-gray-400 hover:text-red-500 shrink-0"
                          >
                            <X className="w-3.5 h-3.5" />
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              )}

              {/* Deadline */}
              <label className="block text-sm font-medium text-gray-700">Deadline (Opsional)
                <input
                  type="datetime-local"
                  value={form.deadline}
                  onChange={e => setForm(p => ({ ...p, deadline: e.target.value }))}
                  className="w-full mt-1 px-4 py-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                />
              </label>

              {/* Kelas target */}
              <div>
                <span className="block text-sm font-medium text-gray-700 mb-1">Kelas Target *</span>
                <div className="flex flex-wrap gap-2">
                  {kelasList.map(k => (
                    <button
                      type="button"
                      key={k}
                      onClick={() => toggleKelas(k)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition ${form.kelasTarget.includes(k) ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                      Kelas {k}
                    </button>
                  ))}
                </div>
              </div>

              {/* Rombel target */}
              {allRombels.length > 0 && (
                <div>
                  <span className="block text-sm font-medium text-gray-700 mb-1">Rombel Target (Opsional, kosong = semua rombel)</span>
                  <div className="flex flex-wrap gap-2">
                    {allRombels.map(r => (
                      <button
                        type="button"
                        key={r}
                        onClick={() => toggleRombel(r)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition ${form.rombelTarget.includes(r) ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Status */}
              <div>
                <span className="block text-sm font-medium text-gray-700 mb-1">Status</span>
                <div className="flex gap-2">
                  <button type="button" onClick={() => setForm(p => ({ ...p, status: 'draft' }))} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${form.status === 'draft' ? 'bg-yellow-500 text-white' : 'bg-gray-100 text-gray-600'}`}>Draft</button>
                  <button type="button" onClick={() => setForm(p => ({ ...p, status: 'launch' }))} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${form.status === 'launch' ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600'}`}>Aktif</button>
                  <button type="button" onClick={() => setForm(p => ({ ...p, status: 'ditutup' }))} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${form.status === 'ditutup' ? 'bg-red-500 text-white' : 'bg-gray-100 text-gray-600'}`}>Ditutup</button>
                </div>
              </div>
            </div>

            <div className="mt-8 flex gap-3">
              <button type="button" onClick={closeForm} className="flex-1 py-3 border border-gray-200 rounded-xl font-medium text-gray-600 hover:bg-gray-50">Batal</button>
              <button type="submit" disabled={submitting} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50">
                {submitting ? 'Menyimpan...' : isEditing ? 'Simpan Perubahan' : 'Simpan Tugas'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* ════════════════════════════════════════════════
          MODAL CLONE TUGAS
      ════════════════════════════════════════════════ */}
      {showCloneModal && cloningTugas && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 relative">
            <button
              type="button"
              onClick={() => { setShowCloneModal(false); setCloningTugas(null) }}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700"
            >
              <X className="w-6 h-6" />
            </button>
            <div className="flex items-center gap-3 mb-1">
              <div className="w-10 h-10 rounded-xl bg-purple-50 flex items-center justify-center">
                <Copy className="w-5 h-5 text-purple-500" />
              </div>
              <h2 className="text-xl font-bold text-gray-800">Salin Tugas</h2>
            </div>
            <p className="text-sm text-gray-500 mb-1">
              Tugas: <span className="font-semibold text-gray-700">{cloningTugas.judul}</span>
            </p>
            <p className="text-xs text-gray-400 mb-6">
              Salinan akan dibuat sebagai <span className="font-medium text-yellow-600">Draft</span> untuk kelas yang dipilih.
            </p>

            {cloneError && (
              <p className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">{cloneError}</p>
            )}

            <div className="space-y-4">
              <div>
                <span className="block text-sm font-medium text-gray-700 mb-2">Kelas Tujuan *</span>
                <div className="flex flex-wrap gap-2">
                  {kelasList.map(k => (
                    <button
                      key={k}
                      type="button"
                      onClick={() => toggleCloneKelas(k)}
                      className={`px-4 py-2 rounded-lg text-sm font-medium transition ${cloneKelasTarget.includes(k) ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                    >
                      Kelas {k}
                    </button>
                  ))}
                </div>
              </div>

              {allCloneRombels.length > 0 && (
                <div>
                  <span className="block text-sm font-medium text-gray-700 mb-2">Rombel (Opsional, kosong = semua rombel)</span>
                  <div className="flex flex-wrap gap-2">
                    {allCloneRombels.map(r => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => toggleCloneRombel(r)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium transition ${cloneRombelTarget.includes(r) ? 'bg-green-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                      >
                        {r}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="button"
                onClick={() => { setShowCloneModal(false); setCloningTugas(null) }}
                className="flex-1 py-3 border border-gray-200 rounded-xl font-medium text-gray-600 hover:bg-gray-50"
              >
                Batal
              </button>
              <button
                type="button"
                onClick={handleClone}
                disabled={cloning || cloneKelasTarget.length === 0}
                className="flex-1 py-3 bg-purple-600 text-white rounded-xl font-bold hover:bg-purple-700 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                <Copy className="w-4 h-4" />
                {cloning ? 'Menyalin...' : `Salin ke ${cloneKelasTarget.length > 0 ? `Kelas ${cloneKelasTarget.join(', ')}` : '...'}`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Filter & Search (Guru) ─────────────────── */}
      {isGuru && (
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-6 flex flex-wrap gap-4 items-center justify-between">
          <div className="flex gap-2">
            {['semua', 'aktif', 'berakhir', 'ditutup', 'draft'].map(key => (
              <button
                key={key}
                onClick={() => setFilter(key)}
                className={`px-4 py-2 font-medium rounded-lg ${filter === key ? 'bg-blue-50 text-blue-600' : 'text-gray-500 hover:bg-gray-50'}`}
              >
                {key === 'semua' ? 'Semua' : key === 'aktif' ? 'Aktif' : key === 'berakhir' ? 'Berakhir' : key === 'ditutup' ? 'Ditutup' : 'Draft'}
              </button>
            ))}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Cari tugas atau kelas..."
              className="pl-10 pr-4 py-2 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none w-64"
            />
          </div>
        </div>
      )}

      {/* ── Daftar Tugas ──────────────────────────── */}
      {loading ? (
        <p className="text-center text-gray-400 py-16">Memuat daftar tugas...</p>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <div className="text-5xl mb-4">📭</div>
          <p className="font-semibold text-gray-600">Belum Ada Tugas</p>
          <p className="text-sm mt-1">{isGuru ? 'Buat tugas baru untuk memulai.' : 'Guru belum membagikan tugas untuk kelasmu.'}</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filtered.map(tugas => {
            if (!isGuru && !matchesTask(tugas)) return null
            const timeLeft = getTimeLeft(tugas.deadline)
            const isEnded = timeLeft === 'Berakhir'

            return (
              <div key={tugas.id} className="bg-white border border-gray-200 rounded-2xl p-6 shadow-sm hover:shadow-md transition group">
                <div className="flex justify-between items-start mb-4">
                  <div className="w-12 h-12 rounded-xl bg-blue-50 flex items-center justify-center">
                    <FileText className="w-6 h-6 text-blue-500" />
                  </div>
                  <span className={`px-3 py-1 text-xs font-bold rounded-full ${tugas.status === 'ditutup' ? 'bg-red-50 text-red-600' : isEnded ? 'bg-gray-100 text-gray-500' : tugas.status === 'draft' ? 'bg-yellow-50 text-yellow-600' : 'bg-green-50 text-green-600'}`}>
                    {tugas.status === 'ditutup' ? 'Ditutup' : isEnded ? 'Berakhir' : tugas.status === 'draft' ? 'Draft' : 'Aktif'}
                  </span>
                </div>

                <h3 className="font-bold text-gray-800 text-lg mb-1 group-hover:text-blue-600 transition">
                  {tugas.judul}
                  {(() => {
                    const kelasTarget = Array.isArray(tugas.kelasTarget) ? tugas.kelasTarget : JSON.parse(tugas.kelasTarget || '[]')
                    const rombelTarget = tugas.rombelTarget ? (Array.isArray(tugas.rombelTarget) ? tugas.rombelTarget : JSON.parse(tugas.rombelTarget || '[]')) : []
                    if (kelasTarget.length === 0) return null
                    const label = kelasTarget.length === 1 && rombelTarget.length > 0
                      ? `${kelasTarget[0]}${rombelTarget.join('')}`
                      : kelasTarget.join(', ')
                    return <span className="ml-2 text-sm font-medium text-blue-500">[Kelas {label}]</span>
                  })()}
                </h3>
                <p className="text-sm text-gray-500 mb-4 line-clamp-2">{tugas.deskripsi || 'Tidak ada deskripsi.'}</p>

                {timeLeft && !isEnded && (
                  <div className="flex justify-between text-sm mb-4">
                    <span className="text-gray-500">Sisa Waktu</span>
                    <span className="font-semibold flex items-center gap-1 text-orange-500">
                      <Clock className="w-4 h-4" /> {timeLeft}
                    </span>
                  </div>
                )}

                {isGuru && (() => {
                  const progress = Array.isArray(tugas.rombelProgress) ? tugas.rombelProgress[0] : null
                  const collected = progress ? progress.collected : (tugas.totalTerkumpul ?? tugas._count?.pengumpulan ?? 0)
                  const total = progress ? progress.total : 0
                  const percent = progress ? progress.percent : 0
                  return (
                    <div className="mb-4">
                      <div className="flex justify-between text-xs mb-2">
                        <span className="font-medium text-gray-500">Progres Pengumpulan</span>
                        <span className="font-bold text-blue-600">{percent}% ({collected}/{total})</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-2">
                        <div className="bg-blue-500 h-2 rounded-full transition-all" style={{ width: `${percent}%` }} />
                      </div>
                    </div>
                  )
                })()}

                <div className="flex items-center gap-2 border-t border-gray-100 pt-4">
                  <Link
                    to={isGuru ? `/dashboard/tugas/${tugas.id}` : `/siswa/tugas/${tugas.id}`}
                    className="flex-1 py-2 bg-gray-50 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-100 transition flex items-center justify-center gap-2"
                  >
                    <Eye className="w-4 h-4" /> Lihat
                  </Link>

                  {isGuru && (
                    <>
                      {/* Edit */}
                      <button
                        onClick={() => openEditForm(tugas)}
                        className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition"
                        title="Edit tugas"
                      >
                        <Edit className="w-4 h-4" />
                      </button>

                      {/* Clone */}
                      <button
                        onClick={() => openCloneModal(tugas)}
                        className="p-2 text-gray-400 hover:text-purple-600 hover:bg-purple-50 rounded-lg transition"
                        title="Salin tugas ke kelas lain"
                      >
                        <Copy className="w-4 h-4" />
                      </button>

                      {/* Toggle status */}
                      {tugas.status === 'draft' && (
                        <button
                          onClick={() => handleStatusChange(tugas.id, 'launch')}
                          className="p-2 text-gray-400 hover:text-green-600 hover:bg-green-50 rounded-lg transition"
                          title="Aktifkan tugas"
                        >
                          🚀
                        </button>
                      )}
                      {tugas.status === 'launch' && (
                        <button
                          onClick={() => handleStatusChange(tugas.id, 'ditutup')}
                          className="px-3 py-2 text-xs font-bold flex items-center gap-1.5 text-red-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition"
                          title="Tutup tugas"
                        >
                          <Lock className="w-4 h-4" /> Tutup
                        </button>
                      )}
                      {tugas.status === 'ditutup' && (
                        <button
                          onClick={() => handleStatusChange(tugas.id, 'launch')}
                          className="px-3 py-2 text-xs font-bold flex items-center gap-1.5 text-green-600 hover:bg-green-50 rounded-lg transition"
                          title="Buka kembali tugas"
                        >
                          <Unlock className="w-4 h-4" /> Buka
                        </button>
                      )}

                      {/* Hapus */}
                      <button
                        onClick={() => handleDelete(tugas.id)}
                        className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition"
                        title="Hapus tugas"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </>
                  )}
                </div>
              </div>
            )
          })}

          {isGuru && (
            <div
              onClick={openForm}
              className="border-2 border-dashed border-gray-200 rounded-2xl flex flex-col items-center justify-center h-[380px] text-gray-400 hover:border-blue-300 hover:text-blue-500 hover:bg-blue-50 transition cursor-pointer"
            >
              <Plus className="w-8 h-8 mb-2" />
              <p className="font-medium">Tambah Tugas Baru</p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

export default TugasPage
