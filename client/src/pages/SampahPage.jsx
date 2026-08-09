import React, { useState, useEffect, useMemo } from 'react'
import { Trash2, RefreshCw, RotateCcw, XCircle, FileText, Keyboard, AlertTriangle, X } from 'lucide-react'
import { apiRequest } from '../utils/api'

const formatWaktu = (tanggal) => {
  if (!tanggal) return '-'
  const d = new Date(tanggal)
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}.${pad(d.getMinutes())}.${pad(d.getSeconds())}`
}

const SampahPage = () => {
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [busyId, setBusyId] = useState(null)
  const [confirmPurge, setConfirmPurge] = useState(null)
  const [search, setSearch] = useState('')

  const fetchData = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await apiRequest('/api/sampah')
      const json = await res.json()
      if (!res.ok) throw new Error(json.message || 'Gagal memuat Recently Deleted.')
      setData(Array.isArray(json) ? json : [])
    } catch (e) {
      setError(e.message || 'Gagal memuat Recently Deleted.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const displayed = useMemo(() => {
    if (!search.trim()) return data
    const q = search.toLowerCase()
    return data.filter((r) => r.siswaNama.toLowerCase().includes(q) || r.tugasJudul.toLowerCase().includes(q))
  }, [data, search])

  const handleRestore = async (id) => {
    setBusyId(id)
    try {
      const res = await apiRequest(`/api/sampah/${id}/restore`, { method: 'POST' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message || 'Gagal memulihkan data.')
      setData((prev) => prev.filter((r) => r.id !== id))
    } catch (e) {
      alert(e.message || 'Gagal memulihkan data.')
    } finally {
      setBusyId(null)
    }
  }

  const handlePurge = async (id) => {
    setBusyId(id)
    try {
      const res = await apiRequest(`/api/sampah/${id}`, { method: 'DELETE' })
      const json = await res.json()
      if (!res.ok) throw new Error(json.message || 'Gagal menghapus permanen.')
      setData((prev) => prev.filter((r) => r.id !== id))
      setConfirmPurge(null)
    } catch (e) {
      alert(e.message || 'Gagal menghapus permanen.')
    } finally {
      setBusyId(null)
    }
  }

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Trash2 className="w-6 h-6 text-red-500" /> Recently Deleted
          </h1>
          <p className="text-gray-500 mt-1">
            Hasil tugas siswa yang pernah dihapus. Bisa dipulihkan (Restore) selama siswa belum mengumpulkan ulang.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cari nama siswa / tugas..."
            className="px-4 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:ring-2 focus:ring-blue-500 min-w-[220px]"
          />
          <button
            onClick={fetchData}
            disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition disabled:opacity-50"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Muat Ulang
          </button>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">{error}</div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <p className="text-sm text-gray-400 p-8 text-center">Memuat Recently Deleted...</p>
        ) : displayed.length === 0 ? (
          <div className="p-12 text-center text-gray-400">
            <Trash2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p className="font-medium">Recently Deleted kosong.</p>
            <p className="text-sm mt-1">Hasil tugas yang dihapus guru akan muncul di sini.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs uppercase font-bold">
                  <th className="px-5 py-3 text-left whitespace-nowrap">Dihapus Pada</th>
                  <th className="px-5 py-3 text-left whitespace-nowrap">Siswa</th>
                  <th className="px-5 py-3 text-left">Tugas</th>
                  <th className="px-5 py-3 text-left whitespace-nowrap">Jenis</th>
                  <th className="px-5 py-3 text-left whitespace-nowrap">Nilai / Skor</th>
                  <th className="px-5 py-3 text-right whitespace-nowrap">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {displayed.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50/60 transition">
                    <td className="px-5 py-3 text-gray-500 whitespace-nowrap">{formatWaktu(r.deletedAt)}</td>
                    <td className="px-5 py-3 font-medium text-gray-800 whitespace-nowrap">{r.siswaNama}</td>
                    <td className="px-5 py-3 text-gray-700">
                      {r.tugasJudul}
                      {r.namaFile && <span className="block text-xs text-gray-400 mt-0.5 truncate max-w-[220px]">{r.namaFile}</span>}
                    </td>
                    <td className="px-5 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium ${r.jenis === 'mengetik' ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'}`}>
                        {r.jenis === 'mengetik' ? <Keyboard className="w-3 h-3" /> : <FileText className="w-3 h-3" />} {r.jenis}
                      </span>
                    </td>
                    <td className="px-5 py-3 text-gray-700 whitespace-nowrap">{r.nilai ?? '—'}</td>
                    <td className="px-5 py-3">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => handleRestore(r.id)}
                          disabled={busyId === r.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-green-50 text-green-600 rounded-xl text-xs font-semibold hover:bg-green-100 transition disabled:opacity-50"
                          title="Pulihkan"
                        >
                          <RotateCcw className="w-3.5 h-3.5" /> Restore
                        </button>
                        <button
                          onClick={() => setConfirmPurge(r)}
                          disabled={busyId === r.id}
                          className="flex items-center gap-1.5 px-3 py-1.5 bg-red-50 text-red-600 rounded-xl text-xs font-semibold hover:bg-red-100 transition disabled:opacity-50"
                          title="Hapus Permanen"
                        >
                          <XCircle className="w-3.5 h-3.5" /> Hapus Permanen
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {confirmPurge && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center px-4" onClick={() => setConfirmPurge(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-start gap-3 mb-4">
              <div className="w-10 h-10 rounded-full bg-red-50 text-red-500 flex items-center justify-center shrink-0">
                <AlertTriangle className="w-5 h-5" />
              </div>
              <div>
                <h3 className="font-bold text-gray-800">Hapus Permanen?</h3>
                <p className="text-sm text-gray-500 mt-1">
                  Hasil tugas <strong>{confirmPurge.siswaNama}</strong> untuk <strong>{confirmPurge.tugasJudul}</strong> akan dihapus permanen dan tidak bisa dipulihkan lagi.
                </p>
              </div>
              <button onClick={() => setConfirmPurge(null)} className="text-gray-400 hover:text-gray-600 ml-auto"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex justify-end gap-2">
              <button onClick={() => setConfirmPurge(null)} className="px-4 py-2 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-100 transition">Batal</button>
              <button
                onClick={() => handlePurge(confirmPurge.id)}
                disabled={busyId === confirmPurge.id}
                className="px-4 py-2 rounded-xl text-sm font-bold text-white bg-red-600 hover:bg-red-700 transition disabled:opacity-50"
              >
                {busyId === confirmPurge.id ? 'Menghapus...' : 'Ya, Hapus Permanen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SampahPage
