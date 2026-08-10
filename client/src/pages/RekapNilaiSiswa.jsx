import React, { useState, useEffect, useRef } from 'react'
import { FileText, Eye, X, CheckCircle, Clock, Keyboard } from 'lucide-react'
import { apiRequest } from '../utils/api'
import { getTitleFromXP, getNextTitle, TitleHintBar, TitlePopup, DEFAULT_TITLE_CONFIG } from '../utils/titleRank.jsx'
import FilePreviewModal from '../components/FilePreviewModal'

const fmtDurasi = s => { if (!s) return '-'; const m = Math.floor(s/60), sc = Math.round(s%60); return `${m}:${String(sc).padStart(2,'0')}` }
const nilaiColor = v => { if (v===null||v===undefined) return 'text-gray-400'; if(v>=85) return 'text-green-600 font-bold'; if(v>=70) return 'text-blue-600 font-semibold'; if(v>=55) return 'text-yellow-600 font-semibold'; return 'text-red-500 font-semibold' }

export default function RekapNilaiSiswa() {
  const user = JSON.parse(localStorage.getItem('user') || '{}')
  const [nilaiData, setNilaiData] = useState(null)   // from /api/nilai/siswa/rekap
  const [xpData, setXpData] = useState(null)         // from /api/xp/siswa/stats
  const [loading, setLoading] = useState(true)
  const [popup, setPopup] = useState(null)
  const [preview, setPreview] = useState(null)
  const popupShownRef = useRef(false)

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true)
      try {
        const [nilaiRes, xpRes] = await Promise.all([
          apiRequest('/api/nilai/siswa/rekap'),
          apiRequest('/api/xp/siswa/stats'),
        ])
        const nilaiJson = await nilaiRes.json()
        const xpJson = await xpRes.json()

        if (nilaiRes.ok) setNilaiData(nilaiJson)
        if (xpRes.ok) setXpData(xpJson)

        // Popup title (selalu tampil saat buka rekap)
        if (!popupShownRef.current && xpRes.ok) {
          popupShownRef.current = true
          const tc = xpJson.xpCfg?.titleConfig || DEFAULT_TITLE_CONFIG
          const curTitle = getTitleFromXP(xpJson.totalXP || 0, xpJson.tasksCompleted || 0, tc)
          const storageKey = `prevTitle_${xpJson.id || user.id || 'siswa'}`
          const prevTitleName = localStorage.getItem(storageKey)

          if (prevTitleName && prevTitleName !== curTitle.name) {
            const prevTitle = DEFAULT_TITLE_CONFIG.find(t => t.name === prevTitleName) || DEFAULT_TITLE_CONFIG[0]
            const isUp = DEFAULT_TITLE_CONFIG.findIndex(t=>t.name===curTitle.name) > DEFAULT_TITLE_CONFIG.findIndex(t=>t.name===prevTitle.name)
            setPopup({ type: isUp ? 'up' : 'down', nama: user.nama, currentTitle: curTitle, prevTitle })
          } else {
            setPopup({ type: 'info', nama: user.nama, currentTitle: curTitle })
          }
          localStorage.setItem(storageKey, curTitle.name)
        }
      } catch (e) { console.error(e) }
      finally { setLoading(false) }
    }
    fetchAll()
  }, [])

  if (loading) return (
    <div className="p-8 flex items-center justify-center min-h-[60vh]">
      <div className="text-center text-gray-400"><div className="text-4xl mb-3 animate-bounce">📊</div><p>Memuat rekap nilai...</p></div>
    </div>
  )

  const titleConfig = xpData?.xpCfg?.titleConfig || DEFAULT_TITLE_CONFIG
  const curTitle = xpData ? getTitleFromXP(xpData.totalXP||0, xpData.tasksCompleted||0, titleConfig) : DEFAULT_TITLE_CONFIG[0]
  const nextTitle = getNextTitle(curTitle, titleConfig)

  // XP progress bar
  const xpForNext = nextTitle?.xpMin || (curTitle?.xpMax || 5000) + 1
  const xpProgress = xpData ? Math.min(100, Math.round(((xpData.totalXP - curTitle.xpMin) / (xpForNext - curTitle.xpMin)) * 100)) : 0

  const siswa = nilaiData?.siswa
  const grades = nilaiData?.grades || []
  const nilaiStats = nilaiData?.stats || {}

  return (
    <div className="p-8">
      {popup && <TitlePopup data={popup} onClose={() => setPopup(null)} />}

      {/* Preview Popup - hasil ketik (teks langsung dari DB, tidak perlu file preview) */}
      {preview && preview.jenis === 'mengetik' && (
        <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center px-4" onClick={() => setPreview(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] flex flex-col overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
              <h3 className="font-bold text-gray-800 truncate">{preview.judul}</h3>
              <button onClick={() => setPreview(null)} className="text-gray-400 hover:text-gray-600 ml-4 shrink-0"><X className="w-5 h-5" /></button>
            </div>
            <div className="overflow-auto flex-1 p-6">
              <p className="text-xs font-semibold text-gray-400 uppercase mb-3">Hasil Ketikan Kamu</p>
              {preview.hasilKetik
                ? <div className="text-sm text-gray-700 bg-gray-50 rounded-xl p-4 border border-gray-200 leading-relaxed max-h-64 overflow-y-auto"
                    dangerouslySetInnerHTML={{ __html: preview.hasilKetik }} />
                : <p className="text-gray-400 text-center py-8">Belum ada data hasil mengetik.</p>
              }
              {preview.durasiDetik && <p className="mt-3 text-xs text-gray-400">Durasi: {fmtDurasi(preview.durasiDetik)} · Nilai: {preview.nilai ?? '—'}</p>}
            </div>
          </div>
        </div>
      )}

      {/* Preview Popup - file yang dikumpulkan (gambar/PDF/DOCX/XLSX dst) tanpa perlu download */}
      {preview && preview.jenis !== 'mengetik' && preview.pengumpulanId && (
        <FilePreviewModal
          title={preview.judul}
          namaFile={preview.namaFile}
          viewUrl={`/api/pengumpulan/view/${preview.pengumpulanId}`}
          previewHtmlUrl={`/api/pengumpulan/preview-html/${preview.pengumpulanId}`}
          onClose={() => setPreview(null)}
        />
      )}

      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800">Rekap Nilai Saya</h1>
        {siswa && <p className="text-gray-500 mt-1">{siswa.nama} · Kelas {siswa.kelas} Rombel {siswa.rombel}</p>}
      </div>

      {/* XP + Title Banner */}
      {xpData && (
        <div className="rounded-3xl p-6 text-white mb-6 relative overflow-hidden"
          style={{ background: `linear-gradient(135deg, ${curTitle?.hex||'#3b82f6'}cc, ${curTitle?.hex||'#10b981'}88)` }}>
          <div className="relative z-10">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <span className="text-4xl">{curTitle?.emoji}</span>
              <div>
                <p className="text-white/70 text-sm">Title Kamu</p>
                <h2 className="text-2xl font-black tracking-wide">{curTitle?.name}</h2>
              </div>
              {nextTitle && <div className="ml-auto text-right"><p className="text-white/60 text-xs">Target</p><p className="text-white font-bold text-sm">{nextTitle.emoji} {nextTitle.name}</p></div>}
            </div>
            {/* XP Progress */}
            <div className="mb-4">
              <div className="flex justify-between text-xs text-white/70 mb-1">
                <span>⚡ {xpData.totalXP} XP</span>
                {nextTitle && <span>{nextTitle.xpMin} XP</span>}
              </div>
              <div className="w-full bg-white/20 rounded-full h-3">
                <div className="h-3 rounded-full bg-white/80 transition-all" style={{ width: `${xpProgress}%` }} />
              </div>
              {nextTitle && <p className="text-[11px] text-white/60 mt-1">{Math.max(0, nextTitle.xpMin - xpData.totalXP)} XP lagi menuju {nextTitle.emoji} {nextTitle.name}</p>}
            </div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
              {[
                { label: siswa ? `Rank Kelas ${siswa.kelas}-${siswa.rombel}` : 'Rank Rombel', value: xpData.rankRombel ? `#${xpData.rankRombel}/${xpData.totalRombel}` : '—' },
                { label: siswa ? `Rank Kelas ${siswa.kelas}` : 'Rank Kelas', value: xpData.rankKelas ? `#${xpData.rankKelas}/${xpData.totalKelas}` : '—' },
                { label:'Total Nilai', value: nilaiStats.totalNilai ?? '—' },
                { label:'Rata-rata', value: nilaiStats.rataRata ?? '—' },
              ].map(item => (
                <div key={item.label} className="bg-white/20 rounded-2xl p-3 text-center backdrop-blur-sm">
                  <p className="text-white/70 text-xs font-medium">{item.label}</p>
                  <p className="text-xl font-black">{item.value}</p>
                </div>
              ))}
            </div>
          </div>
          <div className="absolute -right-8 -bottom-8 opacity-10 text-[150px] leading-none select-none">{curTitle?.emoji}</div>
        </div>
      )}

      {/* Title Hint */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-gray-100 mb-6">
        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">Perjalanan Title (Rendah → Tinggi)</p>
        <TitleHintBar currentTitle={curTitle} titleConfig={titleConfig} />
        <p className="text-xs text-gray-400 mt-2">Title ditentukan dari total XP. Kumpulkan XP dengan mengerjakan tugas!</p>
      </div>

      {/* Grade Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-5 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-bold text-gray-800">Detail Nilai Per Tugas</h2>
          <span className="text-sm text-gray-500">{grades.length} tugas</span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-gray-50 text-xs uppercase tracking-wider text-gray-500">
              <tr>
                <th className="px-5 py-3 w-10">#</th>
                <th className="px-5 py-3">Nama Tugas</th>
                <th className="px-5 py-3 text-center w-20">Nilai</th>
                <th className="px-5 py-3">Keterangan</th>
                <th className="px-5 py-3 text-center w-32">Hasil Pengerjaan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {grades.map((g, idx) => (
                <tr key={g.tugasId} className="hover:bg-gray-50 transition">
                  <td className="px-5 py-4 text-gray-400 text-xs">{idx+1}</td>
                  <td className="px-5 py-4">
                    <p className="font-semibold text-gray-800">{g.judul}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      <span className={`inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-full font-medium ${g.jenis==='mengetik' ? 'bg-purple-50 text-purple-600' : 'bg-blue-50 text-blue-600'}`}>
                        {g.jenis==='mengetik' ? <Keyboard className="w-3 h-3"/> : <FileText className="w-3 h-3"/>} {g.jenis}
                      </span>
                      {g.sudahDikumpul
                        ? <span className="text-[10px] text-green-600 flex items-center gap-1"><CheckCircle className="w-3 h-3"/> Terkumpul</span>
                        : <span className="text-[10px] text-orange-500 flex items-center gap-1"><Clock className="w-3 h-3"/> Belum</span>
                      }
                    </div>
                  </td>
                  <td className={`px-5 py-4 text-center text-lg ${nilaiColor(g.nilai)}`}>
                    {g.nilai !== null && g.nilai !== undefined ? g.nilai : <span className="text-gray-200 text-sm">—</span>}
                  </td>
                  <td className="px-5 py-4 text-gray-500 text-sm max-w-xs">{g.keterangan || <span className="text-gray-200">—</span>}</td>
                  <td className="px-5 py-4 text-center">
                    {g.sudahDikumpul
                      ? <button onClick={() => setPreview(g)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-blue-50 text-blue-600 rounded-xl text-xs font-semibold hover:bg-blue-100 transition">
                          <Eye className="w-3.5 h-3.5"/> {g.jenis==='mengetik' ? 'Lihat Hasil' : 'Preview'}
                        </button>
                      : <span className="text-xs text-gray-300">—</span>
                    }
                  </td>
                </tr>
              ))}
              {grades.length === 0 && (
                <tr><td colSpan={5} className="px-5 py-12 text-center text-gray-400">Belum ada tugas.</td></tr>
              )}
            </tbody>
          </table>
        </div>
        {grades.length > 0 && (
          <div className="px-5 py-3 bg-gray-50 border-t border-gray-100 flex justify-between text-sm">
            <span className="text-gray-500">Dinilai: <strong>{nilaiStats.countDinilai}</strong>/{grades.length}</span>
            <span className="text-gray-500">Total: <strong className="text-blue-700">{nilaiStats.totalNilai}</strong> · Rata-rata: <strong className="text-indigo-700">{nilaiStats.rataRata||'—'}</strong></span>
          </div>
        )}
      </div>
    </div>
  )
}
