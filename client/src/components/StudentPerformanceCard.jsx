import React from 'react'
import { motion } from 'framer-motion'
import { DEFAULT_TITLE_CONFIG } from '../utils/titleRank.jsx'

/**
 * Hover card premium 3D untuk menampilkan performa siswa lengkap.
 * Design: card eksklusif dengan header, academic stats, dan perjalanan title
 * dengan animasi panah shiny menuju title berikutnya.
 */
export default function StudentPerformanceCard({ student, x, y }) {
  if (!student || x == null || y == null) return null

  const title = student.title || DEFAULT_TITLE_CONFIG[0]
  const xpMin = title?.xpMin ?? 0
  const xpMax = title?.xpMax ?? 5000
  const totalXP = student.totalXP ?? 0
  const currentIdx = DEFAULT_TITLE_CONFIG.findIndex(t => t.name === title.name)
  const xpProgress = totalXP >= xpMax ? 100 : Math.max(0, Math.min(100, Math.round(((totalXP - xpMin) / Math.max(1, xpMax - xpMin)) * 100)))

  return (
    <>
      <style>{`
        @keyframes arrowShine {
          0%   { background-position: 200% center; }
          100% { background-position: -200% center; }
        }
        .shine-arrow {
          background: linear-gradient(90deg, #64748b 20%, #fbbf24 45%, #ffffff 50%, #fbbf24 55%, #64748b 80%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          background-clip: text;
          color: transparent;
          animation: arrowShine 1.1s linear infinite;
        }
        @keyframes titleGlow {
          0%, 100% { box-shadow: 0 0 4px var(--glow); }
          50%      { box-shadow: 0 0 16px var(--glow), 0 0 28px var(--glow); }
        }
        .title-glow { animation: titleGlow 1.6s ease-in-out infinite; }
        @keyframes cardFloat {
          0%, 100% { transform: translateZ(0) rotateX(0deg) rotateY(0deg); }
          50%      { transform: translateZ(24px) rotateX(1.5deg) rotateY(-1.5deg); }
        }
      `}</style>

      <motion.div
        initial={{ opacity: 0, rotateX: 40, rotateY: -25, scale: 0.85, y: 30, z: -60 }}
        animate={{ opacity: 1, rotateX: [0, -2, 0], rotateY: [0, 2, 0], scale: 1, y: 0, z: 0 }}
        exit={{ opacity: 0, rotateX: 25, rotateY: 12, scale: 0.9, y: 18, z: -40 }}
        transition={{
          opacity: { duration: 0.3, ease: 'easeOut' },
          scale: { duration: 0.3, ease: 'easeOut' },
          y: { duration: 0.3, ease: 'easeOut' },
          rotateX: { duration: 4, repeat: Infinity, ease: 'easeInOut' },
          rotateY: { duration: 5, repeat: Infinity, ease: 'easeInOut' },
        }}
        style={{ transformPerspective: 1100, left: x + 16, top: y + 16 }}
        className="fixed z-[100] pointer-events-none"
      >
        {/* Glow belakang card - lebih soft */}
        <div
          className="absolute -inset-2 rounded-[2rem] blur-2xl opacity-15"
          style={{ background: `radial-gradient(circle at 30% 20%, ${title.hex || '#3b82f6'}, transparent 70%)` }}
        />

        <div
          className="relative bg-white/80 backdrop-blur-xl text-slate-800 rounded-3xl shadow-[0_20px_50px_rgba(0,0,0,0.15)] p-6 min-w-[340px] max-w-[380px] border"
          style={{ borderColor: `${title.hex || '#3b82f6'}44` }}
        >
          {/* SECTION 1: HEADER & IDENTITY */}
          <div className="flex flex-col items-center text-center pb-4 border-b border-slate-100">
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.12, duration: 0.3 }}
              className="text-sm font-semibold text-slate-400 flex items-center gap-1.5 mb-2"
            >
              <span>👤</span>
              <span className="tracking-wide uppercase font-bold text-slate-700">{student.nama}</span>
            </motion.div>

            <motion.div
              initial={{ scale: 0.7, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.18, type: 'spring', stiffness: 300, damping: 15 }}
              className="text-2xl font-black tracking-wider flex items-center gap-2 mt-1"
              style={{ color: title.hex || '#3b82f6', textShadow: `0 2px 10px ${title.hex}22` }}
            >
              <span>{title.emoji}</span>
              <span>{title.name}</span>
            </motion.div>
            <div className="text-xs font-semibold text-slate-400 mt-0.5">LEVEL {title.level}</div>

            <div className="w-full mt-4">
              <div className="flex justify-between text-[11px] text-slate-500 mb-1.5 font-medium">
                <span>⚡ {totalXP} XP</span>
                <span>{xpMax} XP</span>
              </div>
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${xpProgress}%` }}
                  transition={{ delay: 0.25, duration: 0.8, ease: 'easeOut' }}
                  className="h-full rounded-full"
                  style={{
                    backgroundColor: title.hex || '#3b82f6',
                    boxShadow: `0 0 8px ${title.hex || '#3b82f6'}55`
                  }}
                />
              </div>
            </div>

            <div className="flex justify-center gap-4 w-full mt-4 text-xs font-bold">
              <motion.div
                initial={{ opacity: 0, x: -12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3, duration: 0.3 }}
                className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100 text-slate-600"
              >
                <span>🏆</span>
                <span>#{student.rankKelas || student.rank || '?'} KELAS {student.kelas}</span>
              </motion.div>
              <motion.div
                initial={{ opacity: 0, x: 12 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.34, duration: 0.3 }}
                className="flex items-center gap-1.5 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100 text-slate-600"
              >
                <span>🏆</span>
                <span>#{student.rankRombel || student.rank || '?'} KELAS {student.kelas}-{student.rombel}</span>
              </motion.div>
            </div>
          </div>

          {/* SECTION 2: ACADEMIC PERFORMANCE */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.38, duration: 0.3 }}
            className="py-4 border-b border-slate-100"
          >
            <div className="text-xs font-bold text-slate-400 tracking-wider flex items-center gap-1.5 mb-3">
              <span>📊</span>
              <span>ACADEMIC PERFORMANCE</span>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between text-slate-600">
                <span>Total Score</span>
                <strong className="text-slate-800 font-bold">{student.total ?? '—'}</strong>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Rata-Rata Score</span>
                <strong className="text-slate-800 font-bold">{student.rataRata ?? student.avgNilai ?? '—'}</strong>
              </div>
              <div className="flex justify-between text-slate-600">
                <span>Perfect Score</span>
                <strong className="text-slate-800 font-bold">{student.countNilaiGe90 ?? 0}</strong>
              </div>
            </div>
          </motion.div>

          {/* SECTION 3: TITLE JOURNEY */}
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.46, duration: 0.3 }}
            className="pt-4"
          >
            <div className="text-xs font-bold text-slate-400 tracking-wider flex items-center gap-1.5 mb-3">
              <span>⚡</span>
              <span>PERJALANAN TITLE</span>
            </div>
            <div className="flex flex-wrap items-center gap-y-2 text-[9px] font-bold">
              {DEFAULT_TITLE_CONFIG.map((t, i) => {
                const isCurrent = i === currentIdx
                const isNext = i === currentIdx + 1
                return (
                  <React.Fragment key={t.name}>
                    <div
                      className={`px-1.5 py-0.5 rounded border transition-all duration-300 ${
                        isCurrent ? 'bg-slate-800 text-white' : 'bg-slate-50 text-slate-400 border-transparent'
                      } ${isCurrent ? 'title-glow' : ''}`}
                      style={isCurrent ? ({ '--glow': t.hex, borderColor: t.hex }) : {}}
                    >
                      {t.emoji} {t.name}
                    </div>
                    {i < DEFAULT_TITLE_CONFIG.length - 1 && (
                      <span className={`mx-1 text-sm leading-none ${isNext ? 'shine-arrow' : 'text-slate-300'}`}>→</span>
                    )}
                  </React.Fragment>
                )
              })}
            </div>
          </motion.div>
        </div>
      </motion.div>
    </>
  )
}
