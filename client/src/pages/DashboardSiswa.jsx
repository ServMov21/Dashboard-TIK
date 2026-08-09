import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { BookOpen, CheckCircle, Clock, ArrowRight, Bell, Trophy } from 'lucide-react'
import { Link } from 'react-router-dom'
import { apiRequest } from '../utils/api'
import { getTitleFromXP, getNextTitle, TitlePopup, TitleHintBar, DEFAULT_TITLE_CONFIG } from '../utils/titleRank.jsx'

export default function DashboardSiswa() {
  const [user] = useState(() => JSON.parse(localStorage.getItem('user') || '{}'))
  const [stats, setStats] = useState({ total: 0, selesai: 0, belum: 0 })
  const [xpStats, setXpStats] = useState(null)
  const [tugasList, setTugasList] = useState([])
  const [loading, setLoading] = useState(true)
  const [popup, setPopup] = useState(null)

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true)
      try {
        const [dashRes, xpRes] = await Promise.all([
          apiRequest('/api/siswa/dashboard-data'),
          apiRequest('/api/xp/siswa/stats'),
        ])
        const dashData = await dashRes.json()
        const xpData = await xpRes.json()

        if (dashRes.ok) {
          setStats(dashData.stats || { total: dashData.tugas?.length || 0, selesai: dashData.pengumpulan?.length || 0, belum: 0 })
          setTugasList(dashData.tugas || [])
        }

        if (xpRes.ok) {
          setXpStats(xpData)
          // Title popup sekali per sesi (setelah login)
          if (!sessionStorage.getItem('titleShown')) {
            sessionStorage.setItem('titleShown', '1')
            const tc = xpData.xpCfg?.titleConfig || DEFAULT_TITLE_CONFIG
            const curTitle = getTitleFromXP(xpData.totalXP || 0, xpData.tasksCompleted || 0, tc)
            setPopup({ type: 'info', nama: user.nama, currentTitle: curTitle })
          }
        }
      } catch (e) { console.error(e) }
      finally { setLoading(false) }
    }
    fetchAll()
  }, [])

  const titleConfig = xpStats?.xpCfg?.titleConfig || DEFAULT_TITLE_CONFIG
  const curTitle = xpStats ? getTitleFromXP(xpStats.totalXP || 0, xpStats.tasksCompleted || 0, titleConfig) : DEFAULT_TITLE_CONFIG[0]
  const nextTitle = getNextTitle(curTitle, titleConfig)

  // XP progress bar
  const xpForCurrent = curTitle?.xpMin || 0
  const xpForNext = nextTitle?.xpMin || (curTitle?.xpMax || 5000) + 1
  const xpProgress = xpStats ? Math.min(100, Math.round(((xpStats.totalXP - xpForCurrent) / (xpForNext - xpForCurrent)) * 100)) : 0

  return (
    <div className="p-8">
      {popup && <TitlePopup data={popup} onClose={() => setPopup(null)} />}

      {/* Welcome Banner */}
      <div className="rounded-3xl p-8 text-white mb-8 relative overflow-hidden"
        style={{ background: `linear-gradient(135deg, ${curTitle?.hex || '#3b82f6'}dd, ${curTitle?.hex || '#10b981'}99)` }}>
        <div className="relative z-10">
          <p className="text-white/80 font-medium">Selamat datang kembali,</p>
          <h1 className="text-3xl font-bold mt-1">{user.nama || 'Siswa'}! 👋</h1>
          {xpStats && (
            <div className="flex flex-wrap items-center gap-3 mt-3">
              <span className="flex items-center gap-1.5 bg-white/20 backdrop-blur-sm rounded-full px-3 py-1 text-sm font-bold">
                {curTitle?.emoji} {curTitle?.name}
              </span>
              <span className="bg-white/20 backdrop-blur-sm rounded-full px-3 py-1 text-sm font-semibold">
                ⚡ {xpStats.totalXP} XP
              </span>
              <span className="bg-white/20 backdrop-blur-sm rounded-full px-3 py-1 text-sm font-semibold">
                🏅 #{xpStats.rankRombel || '?'}/{xpStats.totalRombel} Kelas {user.kelas}-{user.rombel}
              </span>
              <span className="bg-white/20 backdrop-blur-sm rounded-full px-3 py-1 text-sm font-semibold">
                🏆 #{xpStats.rankKelas || '?'}/{xpStats.totalKelas} Kelas {user.kelas}
              </span>
            </div>
          )}
          <p className="mt-3 text-white/70 text-sm max-w-lg">
            {stats.belum > 0 ? `Ada ${stats.belum} tugas yang perlu kamu selesaikan.` : stats.total > 0 ? 'Semua tugas sudah kamu selesaikan! 🎉' : 'Belum ada tugas.'}
            {nextTitle && xpStats && ` Butuh ${Math.max(0, nextTitle.xpMin - xpStats.totalXP)} XP lagi untuk jadi ${nextTitle.emoji} ${nextTitle.name}!`}
          </p>
        </div>
        <div className="absolute -right-8 -bottom-8 opacity-10 text-[160px] leading-none select-none">{curTitle?.emoji}</div>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {[
          { icon: BookOpen, label: 'Total Tugas', value: stats.total, note: 'Semua tugas yang pernah aktif', color: 'blue' },
          { icon: CheckCircle, label: 'Sudah Selesai', value: stats.selesai, note: 'Tugas berhasil dikumpulkan', color: 'green' },
          { icon: Clock, label: 'Belum Selesai', value: stats.belum, note: 'Termasuk tugas yang ditutup guru', color: 'orange' },
        ].map((item, i) => (
          <motion.div key={item.label} initial={{ opacity: 0, y: 15 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.1 }}
            className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
            <div className={`w-12 h-12 bg-${item.color}-50 rounded-xl flex items-center justify-center mb-4`}>
              <item.icon className={`w-6 h-6 text-${item.color}-500`} />
            </div>
            <p className="text-gray-500 text-sm">{item.label}</p>
            <h3 className="text-3xl font-bold text-gray-800">{loading ? '...' : item.value}</h3>
            <p className="text-xs text-gray-400 mt-1">{item.note}</p>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Tugas Mendatang */}
        <div className="md:col-span-2 bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-800">Tugas Mendatang</h2>
            <Link to="/siswa/tugas" className="text-sm text-blue-500 font-semibold hover:text-blue-600 flex items-center gap-1">
              Lihat Semua <ArrowRight className="w-4 h-4" />
            </Link>
          </div>
          {loading ? <p className="text-sm text-center py-10 text-gray-400">Memuat...</p>
          : tugasList.length === 0
            ? <div className="text-center py-10 text-gray-400"><div className="text-4xl mb-2">🎉</div><p className="font-semibold text-gray-600">Tidak Ada Tugas Aktif</p></div>
            : <div className="space-y-3">
                {tugasList.slice(0, 4).map(tugas => (
                  <Link to={`/siswa/tugas/${tugas.id}`} key={tugas.id} className="block p-4 rounded-xl hover:bg-gray-50 border border-gray-100 transition">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="font-bold text-gray-800">{tugas.judul}</p>
                        {tugas.deadline
                          ? <p className="text-xs text-gray-500 mt-1 flex items-center gap-1.5"><Bell className="w-3 h-3" /> Deadline: {new Date(tugas.deadline).toLocaleDateString('id-ID')}</p>
                          : <p className="text-xs text-gray-400 mt-1">Tidak ada batas waktu</p>
                        }
                      </div>
                      <ArrowRight className="w-5 h-5 text-gray-300" />
                    </div>
                  </Link>
                ))}
              </div>
          }
        </div>

        {/* Performance Card */}
        <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm flex flex-col">
          <h2 className="text-lg font-bold text-gray-800 mb-4">📊 PERFORMANCE</h2>
          {xpStats ? (
            <div className="flex-1 space-y-4">
              {/* Title + XP Bar */}
              <div className={`rounded-2xl p-4 ${curTitle?.bg} ${curTitle?.border} border`}>
                <div className="flex items-center justify-between mb-2">
                  <span className={`font-black text-lg ${curTitle?.tw}`}>{curTitle?.emoji} {curTitle?.name}</span>
                  <span className="text-xs text-gray-500">Lv.{curTitle?.level}</span>
                </div>
                <div className="flex justify-between text-xs text-gray-500 mb-1">
                  <span>⚡ {xpStats.totalXP} XP</span>
                  {nextTitle && <span>{nextTitle.xpMin} XP</span>}
                </div>
                <div className="w-full bg-white/60 rounded-full h-3 mb-1">
                  <div className={`h-3 rounded-full transition-all`} style={{ width: `${xpProgress}%`, background: curTitle?.hex }} />
                </div>
                {nextTitle
                  ? <p className="text-[10px] text-gray-500">{Math.max(0, nextTitle.xpMin - xpStats.totalXP)} XP menuju {nextTitle.emoji} {nextTitle.name}</p>
                  : <p className="text-[10px] text-yellow-600 font-bold">Title tertinggi! 🏆</p>
                }
              </div>
              {/* Rank */}
              <div className="flex items-center justify-between text-sm">
                <span className="text-gray-500">Your Rank</span>
                <span className="font-bold">{xpStats.rankRombel ? `🥇 #${xpStats.rankRombel} Kelas ${user.kelas}-${user.rombel}` : '—'}</span>
              </div>
              {[
                { label: 'Average Score', value: xpStats.avgNilai || '—' },
                { label: 'Tasks Completed', value: xpStats.tasksCompleted },
                { label: 'Highest Score', value: xpStats.highestNilai || '—' },
                { label: 'Score ≥ 90', value: `${xpStats.countNilaiGe90} tugas` },
              ].map(item => (
                <div key={item.label} className="flex items-center justify-between text-sm border-t border-gray-100 pt-2">
                  <span className="text-gray-500">{item.label}</span>
                  <strong className="text-gray-800">{item.value}</strong>
                </div>
              ))}
              {/* Title hint */}
              <div className="p-2 bg-gray-50 rounded-xl">
                <TitleHintBar currentTitle={curTitle} titleConfig={titleConfig} />
              </div>
            </div>
          ) : (
            <p className="text-gray-400 text-sm">Kerjakan tugas untuk melihat performa.</p>
          )}
          <div className="mt-4 space-y-2">
            <Link to="/siswa/rekap-nilai" className="flex items-center justify-center gap-2 py-2 bg-blue-600 text-white rounded-xl font-semibold hover:bg-blue-700 transition text-sm">
              📊 Rekap Nilai
            </Link>
            <Link to="/siswa/leaderboard" className="flex items-center justify-center gap-2 py-2 bg-yellow-500 text-white rounded-xl font-semibold hover:bg-yellow-600 transition text-sm">
              <Trophy className="w-4 h-4" /> Leaderboard
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}
