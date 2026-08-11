import React, { useState, useEffect } from 'react'
import { apiRequest } from '../utils/api'
import { Calendar, Users, Filter, Download } from 'lucide-react'

const RekapKehadiranPage = () => {
  const [rekapData, setRekapData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [filters, setFilters] = useState({
    kelas: '',
    rombel: '',
    bulan: new Date().toISOString().slice(0, 7) // YYYY-MM
  })
  const [kelasList, setKelasList] = useState([])
  const [rombelList, setRombelList] = useState([])

  useEffect(() => {
    fetchKelasDinamis()
  }, [])

  const fetchKelasDinamis = async () => {
    try {
      const res = await apiRequest('/api/siswa/login-kelas')
      const data = await res.json()
      if (res.ok) setKelasList(data)
    } catch (e) { console.error(e) }
  }

  useEffect(() => {
    if (filters.kelas) fetchRombelDinamis()
  }, [filters.kelas])

  const fetchRombelDinamis = async () => {
    try {
      const res = await apiRequest(`/api/siswa/login-rombel?kelas=${encodeURIComponent(filters.kelas)}`)
      const data = await res.json()
      if (res.ok) setRombelList(data)
      setFilters(f => ({ ...f, rombel: '' }))
    } catch (e) { console.error(e) }
  }

  const handleFilterChange = (e) => {
    setFilters({ ...filters, [e.target.name]: e.target.value })
  }

  const handleFetchRekap = async () => {
    if (!filters.kelas || !filters.rombel || !filters.bulan) {
      setError('Pilih kelas, rombel, dan bulan.')
      return
    }
    setLoading(true)
    setError('')
    setRekapData(null)
    try {
      const params = new URLSearchParams(filters)
      const res = await apiRequest(`/api/kehadiran/rekap?${params}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.message)
      setRekapData(data)
    } catch (e) {
      setError(e.message)
    } finally {
      setLoading(false)
    }
  }

  const getStatusColor = (status) => {
    switch (status) {
      case 'HADIR': return 'bg-green-100 text-green-800';
      case 'IZIN': return 'bg-blue-100 text-blue-800';
      case 'SAKIT': return 'bg-yellow-100 text-yellow-800';
      case 'ALPA': return 'bg-red-100 text-red-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800">Rekap Kehadiran</h1>
        <p className="text-gray-500 mt-1">Laporan kehadiran siswa per bulan</p>
      </div>

      <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <select name="kelas" value={filters.kelas} onChange={handleFilterChange} className="w-full px-4 py-2 border border-gray-200 rounded-xl">
            <option value="">Pilih Kelas</option>
            {kelasList.map(k => <option key={k} value={k}>{k}</option>)}
          </select>
          <select name="rombel" value={filters.rombel} onChange={handleFilterChange} className="w-full px-4 py-2 border border-gray-200 rounded-xl">
            <option value="">Pilih Rombel</option>
            {rombelList.map(r => <option key={r} value={r}>{r}</option>)}
          </select>
          <input type="month" name="bulan" value={filters.bulan} onChange={handleFilterChange} className="w-full px-4 py-2 border border-gray-200 rounded-xl"/>
          <button onClick={handleFetchRekap} disabled={loading} className="w-full py-2 bg-blue-600 text-white rounded-xl font-bold flex items-center justify-center gap-2">
            {loading ? <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" /> : <Filter className="w-5 h-5"/>} Tampilkan
          </button>
        </div>
        {error && <p className="text-red-500 text-sm mt-4">{error}</p>}
      </div>

      {rekapData ? (
        <div className="overflow-x-auto bg-white rounded-2xl shadow-sm border border-gray-100">
          <table className="w-full text-sm text-left">
            <thead className="bg-gray-50 text-gray-600 uppercase">
              <tr>
                <th className="px-4 py-3 sticky left-0 bg-gray-50 z-10">Nama Siswa</th>
                {Array.from({ length: rekapData.daysInMonth }, (_, i) => i + 1).map(day => (
                  <th key={day} className="px-4 py-3 text-center w-12">{day}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rekapData.rekap.map(siswa => (
                <tr key={siswa.id} className="border-b hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium sticky left-0 bg-white z-10">{siswa.nama}</td>
                  {Array.from({ length: rekapData.daysInMonth }, (_, i) => i + 1).map(day => {
                    const status = siswa.details[day];
                    return (
                      <td key={day} className={`px-4 py-2 text-center font-bold ${getStatusColor(status)}`}>
                        {status ? status.charAt(0) : '-'}
                      </td>
                    )
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="text-center py-20 bg-white rounded-2xl shadow-sm border border-gray-100">
          <Calendar className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">Belum ada data</h3>
          <p className="mt-1 text-sm text-gray-500">Pilih filter di atas untuk melihat rekap.</p>
        </div>
      )}
    </div>
  )
}

export default RekapKehadiranPage
