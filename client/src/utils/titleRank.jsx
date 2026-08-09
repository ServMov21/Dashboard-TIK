import React from 'react'

// ─── Konfigurasi 10 Title (dari terendah ke tertinggi) ────────────────────────
export const DEFAULT_TITLE_CONFIG = [
  { level:1,  name:'ROOKIE',    emoji:'🌱', xpMin:0,    xpMax:399,    minTugas:0,  hex:'#6b7280', tw:'text-gray-500',   bg:'bg-gray-100',   border:'border-gray-300' },
  { level:2,  name:'SCOUT',     emoji:'🎯', xpMin:400,  xpMax:899,    minTugas:0,  hex:'#10b981', tw:'text-emerald-500', bg:'bg-emerald-50', border:'border-emerald-300' },
  { level:3,  name:'EXPLORER',  emoji:'🚀', xpMin:900,  xpMax:1499,   minTugas:0,  hex:'#14b8a6', tw:'text-teal-500',   bg:'bg-teal-50',    border:'border-teal-300' },
  { level:4,  name:'GUARDIAN',  emoji:'🛡️', xpMin:1500, xpMax:2099,   minTugas:0,  hex:'#3b82f6', tw:'text-blue-500',   bg:'bg-blue-50',    border:'border-blue-300' },
  { level:5,  name:'RANGER',    emoji:'🏹', xpMin:2100, xpMax:2699,   minTugas:0,  hex:'#6366f1', tw:'text-indigo-500', bg:'bg-indigo-50',  border:'border-indigo-300' },
  { level:6,  name:'WARRIOR',   emoji:'⚔️', xpMin:2700, xpMax:3299,   minTugas:15, hex:'#a855f7', tw:'text-purple-500', bg:'bg-purple-50',  border:'border-purple-300' },
  { level:7,  name:'COMMANDER', emoji:'🛡️', xpMin:3300, xpMax:3899,   minTugas:20, hex:'#f97316', tw:'text-orange-500', bg:'bg-orange-50',  border:'border-orange-300' },
  { level:8,  name:'ELITE',     emoji:'⚡', xpMin:3900, xpMax:4499,   minTugas:25, hex:'#ef4444', tw:'text-red-500',    bg:'bg-red-50',     border:'border-red-300' },
  { level:9,  name:'MASTER',    emoji:'💎', xpMin:4500, xpMax:4999,   minTugas:30, hex:'#d97706', tw:'text-amber-600',  bg:'bg-amber-50',   border:'border-amber-300' },
  { level:10, name:'LEGEND',    emoji:'👑', xpMin:5000, xpMax:999999, minTugas:35, hex:'#f59e0b', tw:'text-yellow-500', bg:'bg-yellow-50',  border:'border-yellow-400' },
]

/** Ambil title dari XP total + jumlah tugas selesai. Default: ROOKIE. */
export function getTitleFromXP(totalXP = 0, tasksCompleted = 0, titleConfig = DEFAULT_TITLE_CONFIG) {
  for (let i = titleConfig.length - 1; i >= 0; i--) {
    const t = titleConfig[i]
    // Merge style dari DEFAULT_TITLE_CONFIG jika tidak ada
    const full = DEFAULT_TITLE_CONFIG.find(d => d.name === t.name) || DEFAULT_TITLE_CONFIG[0]
    if (totalXP >= (t.xpMin ?? 0) && tasksCompleted >= (t.minTugas ?? 0)) return { ...full, ...t }
  }
  return DEFAULT_TITLE_CONFIG[0]
}

/** Ambil title berikutnya. null jika sudah LEGEND. */
export function getNextTitle(currentTitle, titleConfig = DEFAULT_TITLE_CONFIG) {
  const idx = titleConfig.findIndex(t => t.name === currentTitle?.name)
  if (idx < 0 || idx >= titleConfig.length - 1) return null
  const t = titleConfig[idx + 1]
  const full = DEFAULT_TITLE_CONFIG.find(d => d.name === t.name) || DEFAULT_TITLE_CONFIG[1]
  return { ...full, ...t }
}

/** Pill kecil untuk nama title. */
export function TitlePill({ title, size = 'sm' }) {
  if (!title) return null
  const cls = size === 'lg'
    ? 'px-4 py-1.5 text-base font-black rounded-full border-2'
    : 'px-2.5 py-0.5 text-xs font-bold rounded-full border'
  return (
    <span className={`${cls} ${title.bg || 'bg-gray-100'} ${title.tw || 'text-gray-500'} ${title.border || 'border-gray-300'} inline-flex items-center gap-1`}>
      {title.emoji} {title.name}
    </span>
  )
}

/** Bar semua title dengan highlight pada yang aktif. */
export function TitleHintBar({ currentTitle, titleConfig = DEFAULT_TITLE_CONFIG }) {
  return (
    <div className="flex flex-wrap items-center gap-1 text-[10px]">
      {titleConfig.map((t, i) => {
        const full = DEFAULT_TITLE_CONFIG.find(d => d.name === t.name) || t
        const isCurrent = currentTitle?.name === t.name
        return (
          <span key={t.name} className="flex items-center gap-0.5">
            <span className={`px-1.5 py-0.5 rounded font-bold transition-all ${
              isCurrent ? `${full.bg} ${full.tw} ${full.border} border ring-2 ring-offset-1` : 'bg-gray-100 text-gray-400'
            }`} title={`${t.xpMin} XP${t.minTugas ? ` · ≥${t.minTugas} tugas` : ''}`}>
              {t.emoji} {t.name}
            </span>
            {i < titleConfig.length - 1 && <span className="text-gray-300">→</span>}
          </span>
        )
      })}
    </div>
  )
}

/** Pop-up notifikasi title (info/up/down). */
export function TitlePopup({ data, onClose }) {
  if (!data) return null
  const { type, nama, currentTitle, prevTitle } = data
  const nextT = currentTitle ? getNextTitle(currentTitle) : null

  return (
    <div className="fixed inset-0 bg-black/50 z-[9999] flex items-center justify-center px-4" onClick={onClose}>
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-sm p-8 text-center relative" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute top-3 right-3 text-gray-300 hover:text-gray-500 text-xl">✕</button>

        {type === 'up' && <>
          <div className="text-5xl mb-3">🎉</div>
          <h2 className="text-2xl font-black text-gray-800 mb-1">TITLE UP!</h2>
          <p className="text-gray-500 font-semibold mb-4">Selamat, <span className="text-gray-800">{nama}</span>!</p>
          <div className="flex items-center justify-center gap-3 mb-5">
            <div className={`px-3 py-2 rounded-xl ${prevTitle?.bg} ${prevTitle?.tw} font-black text-lg border ${prevTitle?.border}`}>{prevTitle?.emoji} {prevTitle?.name}</div>
            <span className="text-2xl">→</span>
            <div className={`px-3 py-2 rounded-xl ${currentTitle?.bg} ${currentTitle?.tw} font-black text-xl border-2 ${currentTitle?.border} ring-2 ring-offset-1`}>{currentTitle?.emoji} {currentTitle?.name}</div>
          </div>
          <p className="text-sm text-gray-400">Kamu naik title! Pertahankan terus prestasi ini 🔥</p>
        </>}

        {type === 'down' && <>
          <div className="text-5xl mb-3">😔</div>
          <h2 className="text-2xl font-black text-gray-800 mb-1">Title Turun</h2>
          <p className="text-gray-500 font-semibold mb-4">Sayang sekali, <span className="text-gray-800">{nama}</span>...</p>
          <div className="flex items-center justify-center gap-3 mb-5">
            <div className={`px-3 py-2 rounded-xl ${prevTitle?.bg} ${prevTitle?.tw} font-black text-lg border ${prevTitle?.border}`}>{prevTitle?.emoji} {prevTitle?.name}</div>
            <span className="text-2xl text-red-400">↓</span>
            <div className={`px-3 py-2 rounded-xl ${currentTitle?.bg} ${currentTitle?.tw} font-black text-lg border ${currentTitle?.border}`}>{currentTitle?.emoji} {currentTitle?.name}</div>
          </div>
          <p className="text-sm text-gray-400">Semangat mengerjakan tugasnya dan tetap konsisten untuk naik lagi! 💪</p>
        </>}

        {type === 'info' && <>
          <div className="text-6xl mb-3">{currentTitle?.emoji}</div>
          <p className="text-gray-500 font-medium mb-1">Title kamu saat ini</p>
          <div className={`inline-flex items-center gap-2 px-5 py-2 rounded-2xl ${currentTitle?.bg} ${currentTitle?.tw} font-black text-2xl border-2 ${currentTitle?.border} mb-4`}>
            {currentTitle?.emoji} {currentTitle?.name}
          </div>
          {nextT
            ? <p className="text-sm text-gray-500 mb-4">Kumpulkan lebih banyak XP untuk menjadi <span className={`font-bold ${nextT.tw}`}>{nextT.emoji} {nextT.name}</span></p>
            : <p className="text-sm text-yellow-600 font-bold mb-4">Kamu sudah di title tertinggi! 🏆</p>
          }
          <div className="mt-2 p-3 bg-gray-50 rounded-xl">
            <TitleHintBar currentTitle={currentTitle} />
          </div>
        </>}

        <button onClick={onClose} className="mt-5 w-full py-2.5 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition">Oke!</button>
      </div>
    </div>
  )
}
