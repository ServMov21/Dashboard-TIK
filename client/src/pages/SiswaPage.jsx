import React, { useEffect, useRef, useState } from 'react'
import { Upload, Download, FileSpreadsheet, RefreshCw, Edit, X, Save } from 'lucide-react'
import { apiRequest } from '../utils/api'

const SiswaPage = () => {
  const fileInputRef = useRef(null)
  const [siswa, setSiswa] = useState([])
  const [selectedFile, setSelectedFile] = useState(null)
  const [loading, setLoading] = useState(true)
  const [uploading, setUploading] = useState(false)
  const [message, setMessage] = useState('')
  const [error, setError] = useState('')

  // State untuk modal edit siswa
  const [editingSiswa, setEditingSiswa] = useState(null)
  const [editForm, setEditForm] = useState({ nama: '', kelas: '', rombel: '', tanggalLahir: '' })
  const [editError, setEditError] = useState('')
  const [editSaving, setEditSaving] = useState(false)
  const [editSuccess, setEditSuccess] = useState('')

  const fetchSiswa = async () => {
    setLoading(true)
    try {
      const res = await apiRequest('/api/siswa')
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Gagal memuat data siswa.')
      setSiswa(Array.isArray(data) ? data : [])
    } catch (e) {
      setError(e.message || 'Gagal memuat data siswa.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchSiswa()
  }, [])

  const handleFileChange = (event) => {
    setSelectedFile(event.target.files?.[0] || null)
    setMessage('')
    setError('')
  }

  const handleUpload = async () => {
    if (!selectedFile) {
      setError('Pilih file Excel terlebih dahulu.')
      return
    }

    setUploading(true)
    setError('')
    setMessage('')

    try {
      const formData = new FormData()
      formData.append('file', selectedFile)
      const res = await apiRequest('/api/siswa/import', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Gagal mengimpor data siswa.')

      setMessage(data.message)
      setSelectedFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ''
      fetchSiswa()
    } catch (e) {
      setError(e.message || 'Gagal mengimpor data siswa.')
    } finally {
      setUploading(false)
    }
  }

  const handleDownloadTemplate = async () => {
    setError('')
    try {
      const res = await apiRequest('/api/siswa/template/download')
      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.message || 'Gagal mengunduh template.')
      }
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const link = document.createElement('a')
      link.href = url
      link.download = 'template-data-siswa.xlsx'
      document.body.appendChild(link)
      link.click()
      link.remove()
      window.URL.revokeObjectURL(url)
    } catch (e) {
      setError(e.message || 'Gagal mengunduh template.')
    }
  }

  // Buka modal edit untuk siswa tertentu
  const openEditModal = (item) => {
    setEditingSiswa(item)
    // Format tanggalLahir ke YYYY-MM-DD untuk input type="date"
    let tgl = ''
    if (item.tanggalLahir) {
      const d = new Date(item.tanggalLahir)
      const y = d.getUTCFullYear()
      const m = String(d.getUTCMonth() + 1).padStart(2, '0')
      const day = String(d.getUTCDate()).padStart(2, '0')
      tgl = `${y}-${m}-${day}`
    }
    setEditForm({
      nama: item.nama || '',
      kelas: item.kelas || '',
      rombel: item.rombel || '',
      tanggalLahir: tgl,
    })
    setEditError('')
    setEditSuccess('')
  }

  const closeEditModal = () => {
    setEditingSiswa(null)
    setEditError('')
    setEditSuccess('')
  }

  const handleSaveEdit = async (e) => {
    e.preventDefault()
    if (!editForm.nama.trim()) return setEditError('Nama tidak boleh kosong.')
    if (!editForm.kelas.trim()) return setEditError('Kelas tidak boleh kosong.')
    if (!editForm.rombel.trim()) return setEditError('Rombel tidak boleh kosong.')

    setEditSaving(true)
    setEditError('')
    setEditSuccess('')
    try {
      const res = await apiRequest(`/api/siswa/${editingSiswa.id}`, {
        method: 'PUT',
        body: JSON.stringify({
          nama: editForm.nama.trim(),
          kelas: editForm.kelas.trim(),
          rombel: editForm.rombel.trim(),
          tanggalLahir: editForm.tanggalLahir || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Gagal menyimpan.')

      setEditSuccess('Data siswa berhasil diperbarui.')
      // Perbarui list tanpa reload penuh
      setSiswa(prev => prev.map(s =>
        s.id === editingSiswa.id ? { ...s, ...data.siswa } : s
      ))
      // Tutup modal setelah 1 detik
      setTimeout(() => closeEditModal(), 1000)
    } catch (e) {
      setEditError(e.message || 'Gagal menyimpan perubahan.')
    } finally {
      setEditSaving(false)
    }
  }

  return (
    <div className="p-8">
      {/* ===== MODAL EDIT SISWA ===== */}
      {editingSiswa && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center px-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-8 relative">
            <button
              type="button"
              onClick={closeEditModal}
              className="absolute top-4 right-4 text-gray-400 hover:text-gray-700"
            >
              <X className="w-6 h-6" />
            </button>
            <h2 className="text-xl font-bold text-gray-800 mb-1">Edit Data Siswa</h2>
            <p className="text-sm text-gray-500 mb-6">Perubahan tanggal lahir akan memperbarui password siswa.</p>

            {editError && (
              <p className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">{editError}</p>
            )}
            {editSuccess && (
              <p className="mb-4 p-3 bg-green-50 border border-green-200 text-green-700 rounded-xl text-sm">{editSuccess}</p>
            )}

            <form onSubmit={handleSaveEdit} className="space-y-4">
              <label className="block text-sm font-medium text-gray-700">
                Nama Lengkap *
                <input
                  type="text"
                  value={editForm.nama}
                  onChange={e => setEditForm(p => ({ ...p, nama: e.target.value }))}
                  className="w-full mt-1 px-4 py-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Nama lengkap siswa"
                  required
                />
              </label>

              <div className="grid grid-cols-2 gap-4">
                <label className="block text-sm font-medium text-gray-700">
                  Kelas *
                  <input
                    type="text"
                    value={editForm.kelas}
                    onChange={e => setEditForm(p => ({ ...p, kelas: e.target.value }))}
                    className="w-full mt-1 px-4 py-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Mis. 10"
                    required
                  />
                </label>
                <label className="block text-sm font-medium text-gray-700">
                  Rombel *
                  <input
                    type="text"
                    value={editForm.rombel}
                    onChange={e => setEditForm(p => ({ ...p, rombel: e.target.value }))}
                    className="w-full mt-1 px-4 py-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                    placeholder="Mis. A"
                    required
                  />
                </label>
              </div>

              <label className="block text-sm font-medium text-gray-700">
                Tanggal Lahir
                <input
                  type="date"
                  value={editForm.tanggalLahir}
                  onChange={e => setEditForm(p => ({ ...p, tanggalLahir: e.target.value }))}
                  className="w-full mt-1 px-4 py-3 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500"
                />
                <span className="text-xs text-gray-400 mt-1 block">
                  Jika diubah, password siswa akan disetel ulang ke format DDMMYYYY sesuai tanggal lahir baru.
                </span>
              </label>

              <div className="flex gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeEditModal}
                  className="flex-1 py-3 border border-gray-200 rounded-xl font-medium text-gray-600 hover:bg-gray-50"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={editSaving}
                  className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {editSaving ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
                  {editSaving ? 'Menyimpan...' : 'Simpan'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== HEADER ===== */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Data Siswa</h1>
          <p className="text-gray-500 mt-1">Impor atau edit data siswa</p>
        </div>
        <button
          type="button"
          onClick={handleDownloadTemplate}
          className="bg-blue-600 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-blue-700 transition flex items-center gap-2"
        >
          <Download className="w-4 h-4" /> Download Template
        </button>
      </div>

      {/* ===== UPLOAD AREA ===== */}
      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-8">
        <div className="border-2 border-dashed border-gray-200 rounded-2xl p-10 text-center hover:border-blue-300 transition">
          <div className="w-16 h-16 bg-blue-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Upload className="w-8 h-8 text-blue-500" />
          </div>
          <h3 className="text-lg font-bold text-gray-800 mb-2">Upload File Excel</h3>
          <p className="text-gray-500 mb-4">Format kolom: NAMA, KELAS, ROMBEL, TANGGAL LAHIR, JENIS KELAMIN</p>
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls"
            onChange={handleFileChange}
            className="hidden"
            id="siswa-file-input"
          />
          <label
            htmlFor="siswa-file-input"
            className="inline-flex cursor-pointer bg-blue-600 text-white px-5 py-2.5 rounded-xl font-medium hover:bg-blue-700 transition"
          >
            Pilih File
          </label>
          {selectedFile && (
            <div className="mt-4 flex flex-wrap items-center justify-center gap-3">
              <span className="text-sm text-gray-600 flex items-center gap-2">
                <FileSpreadsheet className="w-4 h-4 text-green-600" /> {selectedFile.name}
              </span>
              <button
                type="button"
                onClick={handleUpload}
                disabled={uploading}
                className="bg-green-600 text-white px-4 py-2 rounded-xl text-sm font-bold hover:bg-green-700 disabled:opacity-50 flex items-center gap-2"
              >
                {uploading && <RefreshCw className="w-4 h-4 animate-spin" />}
                {uploading ? 'Mengimpor...' : 'Import Data'}
              </button>
            </div>
          )}
          {message && <p className="mt-4 text-sm text-green-600 font-medium">{message}</p>}
          {error && <p className="mt-4 text-sm text-red-600 font-medium">{error}</p>}
        </div>
      </div>

      {/* ===== TABEL DATA SISWA ===== */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-gray-800">Daftar Siswa</h2>
          <span className="text-sm text-gray-500">Total: {siswa.length} siswa</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
              <tr>
                <th className="px-6 py-4">Nama</th>
                <th className="px-6 py-4">Kelas</th>
                <th className="px-6 py-4">Rombel</th>
                <th className="px-6 py-4">Tanggal Lahir</th>
                <th className="px-6 py-4">Jenis Kelamin</th>
                <th className="px-6 py-4 text-center">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {loading ? (
                <tr>
                  <td colSpan="6" className="px-6 py-10 text-center text-gray-400">Memuat data siswa...</td>
                </tr>
              ) : siswa.length === 0 ? (
                <tr>
                  <td colSpan="6" className="px-6 py-10 text-center text-gray-400">Belum ada data siswa.</td>
                </tr>
              ) : siswa.map((item) => (
                <tr key={item.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 font-medium text-gray-800">{item.nama}</td>
                  <td className="px-6 py-4 text-gray-600">{item.kelas}</td>
                  <td className="px-6 py-4 text-gray-600">{item.rombel}</td>
                  <td className="px-6 py-4 text-gray-600">
                    {item.tanggalLahir
                      ? new Date(item.tanggalLahir).toLocaleDateString('id-ID', { timeZone: 'UTC' })
                      : '-'}
                  </td>
                  <td className="px-6 py-4 text-gray-600">{item.jenisKelamin}</td>
                  <td className="px-6 py-4 text-center">
                    <button
                      type="button"
                      onClick={() => openEditModal(item)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold text-blue-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition"
                      title="Edit data siswa"
                    >
                      <Edit className="w-3.5 h-3.5" /> Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default SiswaPage
