import React, { useState, useEffect, useMemo } from 'react'
import { Download, RefreshCw, Filter, BarChart2, Search } from 'lucide-react'
import { apiRequest } from '../utils/api'


const RekapNilaiPage = () => {
  const [kelasRombelList, setKelasRombelList] = useState([])
  const [kelasList, setKelasList] = useState([])
  const [rombelList, setRombelList] = useState([])
  const [filterKelas, setFilterKelas] = useState('')
  const [filterRombel, setFilterRombel] = useState('')
  const [search, setSearch] = useState('')
  const [tasks, setTasks] = useState([])
  const [students, setStudents] = useState([])
  const [loading, setLoading] = useState(false)
  const [exporting, setExporting] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => {
    apiRequest('/api/nilai/kelas-list').then(r => r.json()).then(data => {
      if (Array.isArray(data)) {
        setKelasRombelList(data)
        setKelasList([...new Set(data.map(r => r.kelas))].sort())
      }
    }).catch(console.error)
  }, [])

  useEffect(() => {
    if (!filterKelas) { setRombelList([]); setFilterRombel(''); return }
    setRombelList(kelasRombelList.filter(r => r.kelas === filterKelas).map(r => r.rombel).sort())
    setFilterRombel('')
  }, [filterKelas, kelasRombelList])

  const fetchRekap = async () => {
    setLoading(true); setLoaded(false)
    try {
      const params = new URLSearchParams()
      if (filterKelas) params.set('kelas', filterKelas)
      if (filterRombel) params.set('rombel', filterRombel)
      const res = await apiRequest(`/api/nilai/rekap?${params}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.message)
      setTasks(data.tasks || []); setStudents(data.students || []); setLoaded(true)
    } catch (e) { alert('Gagal memuat: ' + e.message) }
    finally { setLoading(false) }
  }

  const handleExport = async () => {
    setExporting(true)
    try {
      const params = new URLSearchParams()
      if (filterKelas) params.set('kelas', filterKelas)
      if (filterRombel) params.set('rombel', filterRombel)
      const res = await apiRequest(`/api/nilai/rekap/export?${params}`)
      if (!res.ok) throw new Error((await res.json()).message)
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      const cd = res.headers.get('content-disposition') || ''
      const match = cd.match(/filename="?([^"]+)"?/)
      a.download = match ? match[1] : 'rekap-nilai.xlsx'
      document.body.appendChild(a); a.click(); a.remove()
      window.URL.revokeObjectURL(url)
    } catch (e) { alert('Gagal ekspor: ' + e.message) }
    finally { setExporting(false) }
  }

  const displayed = useMemo(() =>
    !search.trim() ? students : students.filter(s => s.nama.toLowerCase().includes(search.toLowerCase()))
  , [students, search])

  const stats = useMemo(() => {
    if (!loaded || students.length === 0) return null
    const ns = students.filter(s => s.countDinilai > 0).map(s => s.total)
    if (!ns.length) return null
    return {
      avg: Math.round((ns.reduce((a, b) => a + b, 0) / ns.length) * 10) / 10,
      max: Math.max(...ns), min: Math.min(...ns),
      dinilai: ns.length, belum: students.length - ns.length,
    }
  }, [students, loaded])

  const getNilaiColor = v => {
    if (v === null || v === undefined || v === '') return 'text-gray-200'
    if (v >= 85) return 'text-green-600 font-bold'
    if (v >= 70) return 'text-blue-600 font-semibold'
    if (v >= 55) return 'text-yellow-600 font-semibold'
    return 'text-red-500 font-semibold'
  }

  const rankBadge = p => {
    if (p === '-') return <span className="text-gray-300 text-xs">-</span>
    if (p === 1) return <span className="text-yellow-600 font-black text-xs">🥇 1</span>
    if (p === 2) return <span className="text-gray-500 font-black text-xs">🥈 2</span>
    if (p === 3) return <span className="text-amber-700 font-black text-xs">🥉 3</span>
    return <span className="text-gray-600 text-xs font-medium">{p}</span>
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3">
            <BarChart2 className="w-7 h-7 text-blue-500" /> Rekap Nilai
          </h1>
          <p className="text-gray-500 mt-1">Nilai tugas seluruh siswa dengan filter kelas &amp; rombel</p>
        </div>
        {loaded && students.length > 0 && (
          <button onClick={handleExport} disabled={exporting}
            className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-xl font-medium hover:bg-green-700 disabled:opacity-60 transition shadow-sm">
            {exporting ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
            {exporting ? 'Mengekspor...' : 'Export Excel'}
          </button>
        )}
      </div>

      {/* Filter */}
      <div className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Kelas</label>
            <select value={filterKelas} onChange={e => setFilterKelas(e.target.value)}
              className="px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm min-w-[120px]">
              <option value="">Semua Kelas</option>
              {kelasList.map(k => <option key={k} value={k}>Kelas {k}</option>)}
            </select>
          </div>
          {rombelList.length > 0 && (
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1 uppercase tracking-wide">Rombel</label>
              <select value={filterRombel} onChange={e => setFilterRombel(e.target.value)}
                className="px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm min-w-[120px]">
                <option value="">Semua Rombel</option>
                {rombelList.map(r => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>
          )}
          <button onClick={fetchRekap} disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 disabled:opacity-60 transition">
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Filter className="w-4 h-4" />}
            {loading ? 'Memuat...' : 'Tampilkan'}
          </button>
          {loaded && (
            <div className="relative ml-auto">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Cari nama siswa..."
                className="pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none text-sm w-52" />
            </div>
          )}
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-6">
          {[
            { label: 'Rata-rata', value: stats.avg, color: 'blue' },
            { label: 'Tertinggi', value: stats.max, color: 'green' },
            { label: 'Terendah', value: stats.min, color: 'orange' },
            { label: 'Sudah Dinilai', value: `${stats.dinilai} siswa`, color: 'purple' },
            { label: 'Belum Dinilai', value: `${stats.belum} siswa`, color: 'gray' },
          ].map(item => (
            <div key={item.label} className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 text-center">
              <p className="text-xs text-gray-400 font-medium mb-1">{item.label}</p>
              <p className={`text-2xl font-bold text-${item.color}-600`}>{item.value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Table */}
      {!loaded ? (
        <div className="bg-white rounded-2xl p-16 shadow-sm border border-gray-100 text-center text-gray-400">
          <BarChart2 className="w-16 h-16 mx-auto mb-4 opacity-20" />
          <p className="font-semibold text-gray-500">Pilih filter dan klik <strong>Tampilkan</strong></p>
        </div>
      ) : students.length === 0 ? (
        <div className="bg-white rounded-2xl p-16 shadow-sm border border-gray-100 text-center text-gray-400">
          <p className="font-semibold">Tidak ada data untuk filter ini.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-5 border-b border-gray-100 flex items-center justify-between">
            <h2 className="font-bold text-gray-800">
              Rekap {filterKelas ? `Kelas ${filterKelas}` : 'Semua Kelas'}{filterRombel ? ` — Rombel ${filterRombel}` : ''}
            </h2>
            <span className="text-sm text-gray-500">{displayed.length} siswa · {tasks.length} tugas</span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm min-w-max">
              <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="px-4 py-3 sticky left-0 bg-gray-50 z-10 border-r border-gray-200 min-w-[44px]">#</th>
                  <th className="px-4 py-3 sticky left-[44px] bg-gray-50 z-10 border-r border-gray-200 min-w-[200px]">Nama</th>
                  <th className="px-4 py-3 min-w-[60px]">Kelas</th>
                  <th className="px-4 py-3 min-w-[72px]">Rombel</th>
                  {tasks.map(t => (
                    <th key={t.id} className="px-4 py-3 text-center min-w-[120px] max-w-[160px]" title={t.judul}>
                      <div className="truncate">{t.judul}</div>
                      <div className="text-[10px] text-gray-400 font-normal normal-case tracking-normal">
                        {t.jenis === 'mengetik' ? '⌨️ Mengetik' : '📎 ' + t.jenis}
                      </div>
                    </th>
                  ))}
                  <th className="px-4 py-3 text-center min-w-[76px] bg-blue-50 text-blue-700">Total</th>
                  <th className="px-4 py-3 text-center min-w-[90px] bg-indigo-50 text-indigo-700">Rata-rata</th>
                  <th className="px-4 py-3 text-center min-w-[80px] bg-yellow-50 text-yellow-700">Peringkat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {displayed.map((s, idx) => (
                  <tr key={s.id} className="hover:bg-gray-50 transition">
                    <td className="px-4 py-3 text-gray-400 text-xs sticky left-0 bg-white border-r border-gray-100">{idx + 1}</td>
                    <td className="px-4 py-3 font-semibold text-gray-800 sticky left-[44px] bg-white border-r border-gray-100">{s.nama}</td>
                    <td className="px-4 py-3 text-gray-500">{s.kelas}</td>
                    <td className="px-4 py-3 text-gray-500">{s.rombel}</td>
                    {tasks.map(t => {
                      const g = s.grades[t.id]
                      const v = g?.nilai
                      return (
                        <td key={t.id} className={`px-4 py-3 text-center ${getNilaiColor(v)}`}>
                          {v !== null && v !== undefined ? v : <span className="text-gray-200 text-xs">—</span>}
                        </td>
                      )
                    })}
                    <td className="px-4 py-3 text-center bg-blue-50">
                      <span className="font-bold text-blue-700">{s.total > 0 ? s.total : '—'}</span>
                    </td>
                    <td className="px-4 py-3 text-center bg-indigo-50">
                      <span className="font-bold text-indigo-700">{s.rataRata > 0 ? s.rataRata : '—'}</span>
                    </td>
                    <td className="px-4 py-3 text-center bg-yellow-50">{rankBadge(s.peringkat)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-4 border-t border-gray-100 bg-gray-50 flex flex-wrap gap-4 text-xs text-gray-500">
            <span className="font-semibold text-gray-600">Keterangan nilai:</span>
            <span className="text-green-600 font-bold">≥ 85 (Sangat Baik)</span>
            <span className="text-blue-600 font-semibold">70–84 (Baik)</span>
            <span className="text-yellow-600 font-semibold">55–69 (Cukup)</span>
            <span className="text-red-500 font-semibold">&lt; 55 (Perlu Perhatian)</span>
          </div>
        </div>
      )}
    </div>
  )
}
export default RekapNilaiPage
