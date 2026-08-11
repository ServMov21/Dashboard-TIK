import React, { useState, useEffect, useMemo, useCallback } from 'react'
import { AnimatePresence } from 'framer-motion'
import { Trophy, RefreshCw, Users, School } from 'lucide-react'
import { apiRequest } from '../utils/api'
import { TitlePill, DEFAULT_TITLE_CONFIG, getTitleFromXP } from '../utils/titleRank.jsx'
import StudentPerformanceCard from '../components/StudentPerformanceCard'

const MEDAL = { 1:'🥇', 2:'🥈', 3:'🥉' }

export default function LeaderboardPage() {
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const isGuru = user.role === 'guru'

  const [tab, setTab] = useState('rombel')   // 'rombel' | 'kelas'
  const [kelasList, setKelasList] = useState([])
  const [rombelList, setRombelList] = useState([])
  const [filterKelas, setFilterKelas] = useState(isGuru ? '' : (user.kelas || ''))
  const [filterRombel, setFilterRombel] = useState(isGuru ? '' : (user.rombel || ''))
  const [data, setData] = useState([])
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [hover, setHover] = useState(null)

  // Fetch kelas list
  useEffect(() => {
    apiRequest('/api/siswa/login-kelas').then(r => r.json()).then(d => { if (Array.isArray(d)) setKelasList(d) }).catch(console.error)
  }, [])

  useEffect(() => {
    if (!filterKelas) { setRombelList([]); if (!isGuru) return; setFilterRombel(''); return }
    apiRequest(`/api/siswa/login-rombel?kelas=${encodeURIComponent(filterKelas)}`).then(r => r.json()).then(d => { if (Array.isArray(d)) setRombelList(d) }).catch(console.error)
  }, [filterKelas])

  // Auto-load for siswa / guru
  useEffect(() => {
    if (!isGuru && user.kelas) {
      fetchLeaderboard()
    } else if (isGuru) {
      fetchLeaderboard()
    }
  }, [tab])

  const fetchLeaderboard = async () => {
    setLoading(true); setLoaded(false)
    try {
      const params = new URLSearchParams()
      if (tab === 'rombel') {
        if (filterKelas) params.set('kelas', filterKelas)
        if (filterRombel) params.set('rombel', filterRombel)
      } else {
        if (filterKelas) params.set('kelas', filterKelas)
      }
      const res = await apiRequest(`/api/xp/leaderboard?${params}`)
      const json = await res.json()
      if (!res.ok) throw new Error(json.message)
      setData(Array.isArray(json) ? json : [])
      setLoaded(true)
    } catch (e) { alert('Gagal: ' + e.message) }
    finally { setLoading(false) }
  }

  const myEntry = useMemo(() => data.find(e => e.id === user.id), [data, user.id])

  const xpNeeded = (entry) => {
    if (!entry) return null
    const title = entry.title
    const idx = DEFAULT_TITLE_CONFIG.findIndex(t => t.name === title?.name)
    if (idx >= DEFAULT_TITLE_CONFIG.length - 1) return null
    const next = DEFAULT_TITLE_CONFIG[idx + 1]
    const xpGap = next.xpMin - (entry.totalXP || 0)
    return xpGap > 0 ? { name: next.name, emoji: next.emoji, xpGap } : null
  }

  return (
    <div className="p-8">
      <div className="flex justify-between items-start mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-800 flex items-center gap-3"><Trophy className="w-7 h-7 text-yellow-500" /> Leaderboard</h1>
          <p className="text-gray-500 mt-1">Peringkat siswa berdasarkan total XP, rata-rata nilai, dan konsistensi</p>
        </div>
      </div>

      {/* Tab Rombel / Kelas */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-6">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex gap-2">
            <button onClick={() => { setTab('rombel'); setLoaded(false) }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition ${tab === 'rombel' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              <Users className="w-4 h-4" /> Berdasarkan Rombel
            </button>
            <button onClick={() => { setTab('kelas'); setFilterRombel(''); setLoaded(false) }}
              className={`flex items-center gap-2 px-4 py-2.5 rounded-xl font-semibold text-sm transition ${tab === 'kelas' ? 'bg-blue-600 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              <School className="w-4 h-4" /> Berdasarkan Kelas
            </button>
          </div>

          <select value={filterKelas} onChange={e => { setFilterKelas(e.target.value); setLoaded(false) }}
            className="px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm">
            <option value="">Semua Kelas</option>
            {kelasList.map(k => <option key={k} value={k}>Kelas {k}</option>)}
          </select>

          {tab === 'rombel' && rombelList.length > 0 && (
            <select value={filterRombel} onChange={e => { setFilterRombel(e.target.value); setLoaded(false) }}
              className="px-4 py-2.5 border border-gray-200 rounded-xl outline-none focus:ring-2 focus:ring-blue-500 bg-white text-sm">
              <option value="">Semua Rombel</option>
              {rombelList.map(r => <option key={r} value={r}>{r}</option>)}
            </select>
          )}

          <button onClick={fetchLeaderboard} disabled={loading}
            className="flex items-center gap-2 px-5 py-2.5 bg-yellow-500 text-white rounded-xl font-bold hover:bg-yellow-600 disabled:opacity-60 transition">
            {loading ? <RefreshCw className="w-4 h-4 animate-spin" /> : <Trophy className="w-4 h-4" />}
            {loading ? 'Memuat...' : 'Tampilkan'}
          </button>

          {isGuru && (
            <button
              onClick={async () => {
                setLoading(true)
                try {
                  const res = await apiRequest('/api/xp/refresh', { method: 'POST' })
                  const json = await res.json()
                  if (!res.ok) throw new Error(json.message || json.error || 'Gagal refresh XP')
                  await fetchLeaderboard()
                } catch (e) {
                  alert('Gagal refresh XP: ' + e.message)
                } finally {
                  setLoading(false)
                }
              }}
              disabled={loading}
              className="flex items-center gap-2 px-5 py-2.5 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 disabled:opacity-60 transition"
            >
              <RefreshCw className="w-4 h-4" />
              Refresh XP
            </button>
          )}
        </div>
      </div>

      {/* My Position (siswa) */}
      {!isGuru && myEntry && (
        <div className={`rounded-2xl p-4 mb-6 border-2 ${myEntry.title?.border || 'border-blue-300'} ${myEntry.title?.bg || 'bg-blue-50'}`}>
          <p className="text-xs font-semibold text-gray-500 mb-1">Posisi Kamu</p>
          <div className="flex items-center gap-4">
            <span className="text-3xl font-black">{MEDAL[myEntry.rank] || `#${myEntry.rank}`}</span>
            <div className="flex-1">
              <p className="font-bold text-gray-800">{myEntry.nama}</p>
              <p className="text-sm text-gray-500">{myEntry.totalXP} XP · Avg {myEntry.avgNilai} · {myEntry.tasksCompleted} tugas</p>
            </div>
            <TitlePill title={myEntry.title} size="lg" />
          </div>
          {xpNeeded(myEntry) && (
            <p className="text-xs text-gray-500 mt-2">
              Butuh <strong>{xpNeeded(myEntry).xpGap} XP</strong> lagi untuk naik ke {xpNeeded(myEntry).emoji} {xpNeeded(myEntry).name}
            </p>
          )}
        </div>
      )}

      {/* Leaderboard Table */}
      {!loaded ? (
        <div className="bg-white rounded-2xl p-16 shadow-sm border border-gray-100 text-center text-gray-400">
          <Trophy className="w-16 h-16 mx-auto mb-4 opacity-20" />
          <p className="font-semibold text-gray-500">Pilih filter dan klik <strong>Tampilkan</strong></p>
        </div>
      ) : data.length === 0 ? (
        <div className="bg-white rounded-2xl p-16 shadow-sm border border-gray-100 text-center text-gray-400">
          <p>Tidak ada data untuk filter ini.</p>
        </div>
      ) : (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-5 border-b border-gray-100">
            <h2 className="font-bold text-gray-800">{tab === 'rombel' ? 'Leaderboard Rombel' : 'Leaderboard Kelas'} · {data.length} siswa</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="px-5 py-3 w-16 text-center">Rank</th>
                  <th className="px-5 py-3">Nama</th>
                  {isGuru && <><th className="px-4 py-3">Kelas</th><th className="px-4 py-3">Rombel</th></>}
                  <th className="px-5 py-3 text-center">Title</th>
                  <th className="px-5 py-3 text-center">Total XP</th>
                  <th className="px-5 py-3 text-center">Rata-rata</th>
                  <th className="px-5 py-3 text-center">Tugas</th>
                  <th className="px-5 py-3 text-center">≥ 90</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.map((entry, idx) => {
                  const isMe = entry.id === user.id
                  return (
                    <tr key={entry.id} className={`transition ${isMe ? `${entry.title?.bg || 'bg-blue-50'} font-semibold` : 'hover:bg-gray-50'}`}>
                      <td className="px-5 py-4 text-center">
                        <span className="text-lg">{MEDAL[entry.rank] || `#${entry.rank}`}</span>
                      </td>
                      <td
                        className="px-5 py-4"
                        onMouseEnter={e => setHover({ entry, x: e.clientX, y: e.clientY })}
                        onMouseMove={e => setHover(h => h && h.entry.id === entry.id ? { ...h, x: e.clientX, y: e.clientY } : h)}
                        onMouseLeave={() => setHover(null)}
                      >
                        <span className="font-semibold text-gray-800">{entry.nama}</span>
                        {isMe && <span className="ml-2 text-xs bg-blue-600 text-white px-2 py-0.5 rounded-full">Kamu</span>}
                      </td>
                      {isGuru && <><td className="px-4 py-4 text-gray-500">{entry.kelas}</td><td className="px-4 py-4 text-gray-500">{entry.rombel}</td></>}
                      <td className="px-5 py-4 text-center"><TitlePill title={entry.title} /></td>
                      <td className="px-5 py-4 text-center">
                        <span className="font-bold text-blue-600">{entry.totalXP}</span>
                      </td>
                      <td className="px-5 py-4 text-center text-gray-600">{entry.avgNilai || '—'}</td>
                      <td className="px-5 py-4 text-center text-gray-600">{entry.tasksCompleted}</td>
                      <td className="px-5 py-4 text-center text-gray-600">{entry.countNilaiGe90}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 text-xs text-gray-400">
            Urutan: Total XP → Rata-rata Nilai → Jumlah Tugas → Nilai ≥90 → Pencapaian Lebih Awal
          </div>
        </div>
      )}
      {hover && (
        <AnimatePresence>
          <StudentPerformanceCard student={hover.entry} x={hover.x} y={hover.y} />
        </AnimatePresence>
      )}
    </div>
  )
}
