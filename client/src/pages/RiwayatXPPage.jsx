import React, { useState, useEffect, useMemo } from 'react'
import { Zap, TrendingUp, TrendingDown, RefreshCw } from 'lucide-react'
import { apiRequest } from '../utils/api'

// Format tanggal sesuai contoh: 09/08/2026 15.30.36
const formatWaktu = (tanggal) => {
  if (!tanggal) return '-'
  const d = new Date(tanggal)
  const pad = (n) => String(n).padStart(2, '0')
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}.${pad(d.getMinutes())}.${pad(d.getSeconds())}`
}

const RiwayatXPPage = () => {
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const isGuru = user.role === 'guru'

  const [data, setData] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchData = async () => {
    setLoading(true)
    setError('')
    try {
      const endpoint = isGuru ? '/api/xp/history' : '/api/xp/history/saya'
      const res = await apiRequest(endpoint)
      const json = await res.json()
      if (!res.ok) throw new Error(json.message || 'Gagal memuat riwayat XP.')
      setData(Array.isArray(json) ? json : [])
    } catch (e) {
      setError(e.message || 'Gagal memuat riwayat XP.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { fetchData() }, [])

  const totalXP = useMemo(() => data.reduce((sum, r) => sum + (r.perolehan || 0), 0), [data])

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-2">
            <Zap className="w-6 h-6 text-yellow-500" /> Riwayat XP
          </h1>
          <p className="text-gray-500 mt-1">
            {isGuru
              ? 'Riwayat perolehan & pengurangan XP seluruh siswa.'
              : 'Riwayat perolehan & pengurangan XP milikmu.'}
          </p>
        </div>
        <button
          onClick={fetchData}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-white border border-gray-200 rounded-xl text-sm font-medium text-gray-600 hover:bg-gray-50 transition disabled:opacity-50"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Muat Ulang
        </button>
      </div>

      {!isGuru && !loading && (
        <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-6 flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-yellow-50 text-yellow-500 flex items-center justify-center">
            <Zap className="w-6 h-6" />
          </div>
          <div>
            <p className="text-xs text-gray-400 font-bold uppercase">Total XP dari riwayat ini</p>
            <p className={`text-2xl font-extrabold ${totalXP >= 0 ? 'text-gray-800' : 'text-red-600'}`}>{totalXP} XP</p>
          </div>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">{error}</div>
      )}

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        {loading ? (
          <p className="text-sm text-gray-400 p-8 text-center">Memuat riwayat XP...</p>
        ) : data.length === 0 ? (
          <p className="text-sm text-gray-400 p-10 text-center">Belum ada riwayat XP.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-xs uppercase font-bold">
                  <th className="px-5 py-3 text-left whitespace-nowrap">Waktu</th>
                  {isGuru && <th className="px-5 py-3 text-left whitespace-nowrap">Nama</th>}
                  <th className="px-5 py-3 text-left">Misi</th>
                  <th className="px-5 py-3 text-right whitespace-nowrap">Perolehan</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {data.map((r, i) => {
                  const positif = (r.perolehan || 0) >= 0
                  return (
                    <tr key={i} className="hover:bg-gray-50/60 transition">
                      <td className="px-5 py-3 text-gray-500 whitespace-nowrap">{formatWaktu(r.waktu)}</td>
                      {isGuru && <td className="px-5 py-3 font-medium text-gray-800 whitespace-nowrap">{r.nama || '-'}</td>}
                      <td className="px-5 py-3 text-gray-700">
                        {isGuru && r.nama ? `${r.nama} — ${r.deskripsi || r.misi}` : (r.deskripsi || r.misi)}
                      </td>
                      <td className={`px-5 py-3 text-right font-bold whitespace-nowrap ${positif ? 'text-green-600' : 'text-red-600'}`}>
                        <span className="inline-flex items-center gap-1 justify-end">
                          {positif ? <TrendingUp className="w-3.5 h-3.5" /> : <TrendingDown className="w-3.5 h-3.5" />}
                          {positif ? '+' : ''}{r.perolehan} XP
                        </span>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default RiwayatXPPage
