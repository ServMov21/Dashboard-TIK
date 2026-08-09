import React, { useState, useEffect } from 'react'
import { HardDrive, RefreshCw } from 'lucide-react'
import { apiRequest } from '../utils/api'

const LocalDiskPage = () => {
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const fetchUsage = async () => {
    setLoading(true)
    setError('')
    try {
      const res = await apiRequest('/api/localdisk/usage')
      const stats = await res.json()
      if (!res.ok) throw new Error(stats.message || 'Gagal mengakses disk.')
      setData(stats)
    } catch (e) {
      setError(e.message || 'Terjadi kesalahan sistem.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchUsage()
  }, [])

  return (
    <div className="p-8">
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Local Disk</h1>
          <p className="text-gray-500 mt-1">Status penyimpanan dan direktori server.</p>
        </div>
        <button onClick={fetchUsage} disabled={loading} className="p-2.5 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition">
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="max-w-md bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-6">
        <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2"><HardDrive className="w-5 h-5 text-blue-500" /> Detail Penyimpanan</h2>

        {loading ? (
          <p className="text-sm text-gray-500">Sedang memuat data...</p>
        ) : error ? (
          <p className="text-sm text-red-600">{error}</p>
        ) : data ? (
          <div className="space-y-4 text-sm text-gray-700">
            <div>
              <span className="block font-medium text-gray-500">Direktori Penyimpanan</span>
              <span className="font-semibold text-gray-800 break-all">{data.baseDir}</span>
            </div>
            <div>
              <span className="block font-medium text-gray-500">Status Akses</span>
              <span className="inline-flex px-2 py-1 rounded bg-green-50 text-green-600 font-bold uppercase tracking-wider">Dapat Diakses</span>
            </div>
            <div>
              <span className="block font-medium text-gray-500">Terakhir Dimodifikasi</span>
              <span className="font-semibold text-gray-800">{new Date(data.stats.modified).toLocaleString('id-ID')}</span>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

export default LocalDiskPage
