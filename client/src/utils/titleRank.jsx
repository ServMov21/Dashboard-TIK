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
    <div className="fixed inset-0 bg-black/60 z-[9999] flex items-center justify-center px-4 backdrop-blur-sm" onClick={onClose}>
      <style>{`
        @keyframes shiny-sweep {
          0% { transform: translateX(-200%) skewX(-30deg); }
          100% { transform: translateX(200%) skewX(-30deg); }
        }
        @keyframes float-3d {
          0%, 100% { transform: translateY(0) rotateX(10deg) rotateY(-5deg); }
          50% { transform: translateY(-10px) rotateX(15deg) rotateY(5deg); }
        }
        .shiny-card {
          position: relative;
          overflow: hidden;
          perspective: 1000px;
          transform-style: preserve-3d;
          animation: float-3d 4s ease-in-out infinite;
        }
        .shiny-overlay {
          position: absolute;
          top: 0; left: -100%; width: 100%; height: 100%;
          background: linear-gradient(
            120deg,
            transparent,
            rgba(255, 255, 255, 0.4),
            transparent
          );
          transition: all 0.5s;
          animation: shiny-sweep 3s infinite;
          pointer-events: none;
        }
      `}</style>
      
      <div 
        className="bg-white rounded-[2rem] shadow-[0_20px_50px_rgba(0,0,0,0.3)] w-full max-w-sm p-8 text-center relative border border-gray-100 shiny-card"
        onClick={e => e.stopPropagation()}
      >
        <div className="shiny-overlay" />
        <button onClick={onClose} className="absolute top-4 right-4 text-gray-300 hover:text-gray-500 transition-colors z-10">✕</button>

        {type === 'up' && (
          <div className="relative z-10">
            <div className="text-6xl mb-4 drop-shadow-lg">🎉</div>
            <h2 className="text-3xl font-black bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-indigo-600 mb-1">TITLE UP!</h2>
            <p className="text-gray-500 font-bold mb-6 text-sm">Selamat, <span className="text-gray-900">{nama}</span>!</p>
            
            <div className="flex items-center justify-center gap-4 mb-8">
              <div className={`px-4 py-3 rounded-2xl ${prevTitle?.bg} ${prevTitle?.tw} font-black text-lg border-2 ${prevTitle?.border} opacity-60 scale-90`}>
                {prevTitle?.emoji} {prevTitle?.name}
              </div>
              <div className="text-3xl animate-pulse text-blue-500">→</div>
              <div 
                className={`px-5 py-4 rounded-2xl ${currentTitle?.bg} ${currentTitle?.tw} font-black text-2xl border-4 ${currentTitle?.border} scale-110`}
                style={{ boxShadow: `0 0 20px ${currentTitle?.hex || '#3b82f6'}44` }}
              >
                {currentTitle?.emoji} {currentTitle?.name}
              </div>
            </div>
            
            <p className="text-sm text-gray-400 font-medium leading-relaxed">
              Kamu telah mencapai level baru! <br/>
              Terus tingkatkan prestasimu 🔥
            </p>
          </div>
        )}

        {type === 'down' && (
          <div className="relative z-10">
            <div className="text-6xl mb-4">😔</div>
            <h2 className="text-3xl font-black text-gray-800 mb-1">Yah, Turun...</h2>
            <p className="text-gray-500 font-bold mb-6 text-sm">Tetap semangat, <span className="text-gray-900">{nama}</span>!</p>
            
            <div className="flex items-center justify-center gap-4 mb-8">
              <div className={`px-4 py-3 rounded-2xl ${prevTitle?.bg} ${prevTitle?.tw} font-black text-lg border-2 ${prevTitle?.border}`}>
                {prevTitle?.emoji} {prevTitle?.name}
              </div>
              <div className="text-3xl text-red-400">↓</div>
              <div className={`px-4 py-3 rounded-2xl ${currentTitle?.bg} ${currentTitle?.tw} font-black text-lg border-2 ${currentTitle?.border}`}>
                {currentTitle?.emoji} {currentTitle?.name}
              </div>
            </div>
            
            <p className="text-sm text-gray-400 font-medium leading-relaxed">
              Jangan menyerah! Selesaikan lebih banyak <br/>
              tugas untuk naik lagi 💪
            </p>
          </div>
        )}

        {type === 'info' && (
          <div className="relative z-10">
            <div className="text-7xl mb-4 drop-shadow-xl animate-bounce">{currentTitle?.emoji}</div>
            <p className="text-gray-400 font-bold uppercase tracking-wider text-[10px] mb-2">Title Saat Ini</p>
            <div className={`inline-flex items-center gap-3 px-6 py-3 rounded-2xl ${currentTitle?.bg} ${currentTitle?.tw} font-black text-3xl border-4 ${currentTitle?.border} mb-6 shadow-lg shadow-blue-100`}>
              {currentTitle?.emoji} {currentTitle?.name}
            </div>
            
            {nextT ? (
              <div className="p-4 bg-blue-50 rounded-2xl border border-blue-100 mb-2">
                <p className="text-xs text-blue-700 font-bold mb-1">TARGET BERIKUTNYA</p>
                <p className="text-sm text-blue-600 font-black italic">
                  {nextT.emoji} {nextT.name}
                </p>
              </div>
            ) : (
              <p className="text-sm text-yellow-600 font-black mb-4">👑 LEVEL TERTINGGI DICAPAI! 👑</p>
            )}
            
            <div className="mt-4 p-4 bg-gray-50 rounded-2xl border border-gray-100 overflow-hidden">
              <TitleHintBar currentTitle={currentTitle} />
            </div>
          </div>
        )}

        <button 
          onClick={onClose} 
          className="mt-8 w-full py-4 bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-2xl font-black text-lg shadow-lg shadow-blue-200 hover:shadow-xl hover:-translate-y-0.5 active:translate-y-0 transition-all z-10 relative"
        >
          SIAP! 🚀
        </button>
      </div>
    </div>
  )
}
