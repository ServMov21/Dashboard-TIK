import React from 'react'
import { motion } from 'framer-motion'
import { DEFAULT_TITLE_CONFIG } from '../utils/titleRank.jsx'

/**
 * Hover card premium untuk menampilkan performa siswa lengkap.
 * Design: card eksklusif dengan header, academic stats, dan perjalanan title.
 */
export default function StudentPerformanceCard({ student, x, y }) {
  if (!student || x == null || y == null) return null

  const title = student.title || DEFAULT_TITLE_CONFIG[0]
  const xpMin = title?.xpMin ?? 0
  const xpMax = title?.xpMax ?? 5000
  const totalXP = student.totalXP ?? 0
  const xpProgress = totalXP >= xpMax ? 100 : Math.max(0, Math.min(100, Math.round(((totalXP - xpMin) / Math.max(1, xpMax - xpMin)) * 100)))

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95, y: 10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95, y: 10 }}
      transition={{ duration: 0.15 }}
      className="fixed z-[100] pointer-events-none"
      style={{ left: x + 16, top: y + 16 }}
    >
      <div className={`bg-slate-900 text-white rounded-3xl shadow-2xl p-6 min-w-[340px] max-w-[380px] border-2 transition-all duration-300`}
        style={{ borderColor: title.hex || '#3b82f6' }}>
        {/* SECTION 1: HEADER & IDENTITY */}
        <div className="flex flex-col items-center text-center pb-4 border-b border-slate-800">
          <div className="text-sm font-medium text-slate-400 flex items-center gap-1.5 mb-2">
            <span>👤</span>
            <span className="tracking-wide uppercase font-bold text-white">{student.nama}</span>
          </div>

          <div className={`text-2xl font-black tracking-wider flex items-center gap-2 mt-1`} style={{ color: title.hex || '#3b82f6' }}>
            <span>{title.emoji}</span>
            <span>{title.name}</span>
          </div>
          <div className="text-xs font-semibold text-slate-400 mt-0.5">LEVEL {title.level}</div>

          <div className="w-full mt-4">
            <div className="flex justify-between text-[11px] text-slate-400 mb-1.5 font-medium">
              <span>⚡ {totalXP} XP</span>
              <span>{xpMax} XP</span>
            </div>
            <div className="w-full bg-slate-800 rounded-full h-2.5 overflow-hidden">
              <div
                className="h-full rounded-full transition-all duration-500"
                style={{
                  width: `${xpProgress}%`,
                  backgroundColor: title.hex || '#3b82f6',
                  boxShadow: `0 0 8px ${title.hex || '#3b82f6'}`
                }}
              />
            </div>
          </div>

          <div className="flex justify-center gap-6 w-full mt-4 text-xs font-bold">
            <div className="flex items-center gap-1.5 bg-slate-800/50 px-3 py-1.5 rounded-full border border-slate-700/50">
              <span>🏆</span>
              <span>#{student.rankKelas || student.rank || '?'} KELAS {student.kelas}</span>
            </div>
            <div className="flex items-center gap-1.5 bg-slate-800/50 px-3 py-1.5 rounded-full border border-slate-700/50">
              <span>🏆</span>
              <span>#{student.rankRombel || student.rank || '?'} KELAS {student.kelas}-{student.rombel}</span>
            </div>
          </div>
        </div>

        {/* SECTION 2: ACADEMIC PERFORMANCE */}
        <div className="py-4 border-b border-slate-800">
          <div className="text-xs font-bold text-slate-400 tracking-wider flex items-center gap-1.5 mb-3">
            <span>📊</span>
            <span>ACADEMIC PERFORMANCE</span>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between text-slate-300">
              <span>Total Score</span>
              <strong className="text-white font-bold">{student.total ?? '—'}</strong>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Rata-Rata Score</span>
              <strong className="text-white font-bold">{student.rataRata ?? student.avgNilai ?? '—'}</strong>
            </div>
            <div className="flex justify-between text-slate-300">
              <span>Perfect Score</span>
              <strong className="text-white font-bold">{student.countNilaiGe90 ?? 0}</strong>
            </div>
          </div>
        </div>

        {/* SECTION 3: TITLE JOURNEY */}
        <div className="pt-4">
          <div className="text-xs font-bold text-slate-400 tracking-wider flex items-center gap-1.5 mb-3">
            <span>⚡</span>
            <span>PERJALANAN TITLE</span>
          </div>
          <div className="flex flex-wrap gap-1.5 text-[9px] font-bold">
            {DEFAULT_TITLE_CONFIG.map((t) => {
              const isCurrent = t.name === title.name
              return (
                <div
                  key={t.name}
                  className={`px-1.5 py-0.5 rounded transition-all duration-300 ${
                    isCurrent
                      ? 'bg-slate-800 text-white border ring-1'
                      : 'bg-slate-800/25 text-slate-500 border border-transparent'
                  }`}
                  style={isCurrent ? { borderColor: t.hex, boxShadow: `0 0 6px ${t.hex}` } : {}}
                >
                  {t.emoji} {t.name}
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </motion.div>
  )
}
