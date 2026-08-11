import React from 'react'
import { motion } from 'framer-motion'

const MEDAL = { 1: '🥇', 2: '🥈', 3: '🥉' }

/**
 * Hover card menampilkan performa siswa (xp, title, rank, rata-rata, dll).
 * Props: student (object), x (number), y (number)
 */
export default function StudentPerformanceCard({ student, x, y }) {
  if (!student || x == null || y == null) return null
  const t = student.title || {}
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.15 }}
      className="fixed z-[100] pointer-events-none"
      style={{ left: x + 16, top: y + 16 }}
    >
      <div className="bg-white rounded-2xl shadow-xl border border-gray-100 p-4 min-w-[230px] max-w-[280px]">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <span className="font-bold text-gray-800 text-sm truncate">{student.nama}</span>
          {student.rank && <span className="text-lg ml-2 shrink-0">{MEDAL[student.rank] || `#${student.rank}`}</span>}
        </div>

        {/* Title pill */}
        {t.name && (
          <div className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold border mb-3 ${t.bg || 'bg-blue-50'} ${t.tw || 'text-blue-600'} ${t.border || 'border-blue-300'}`}>
            {t.emoji} {t.name}
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2 text-xs">
          <div className="bg-gray-50 rounded-lg p-2 text-center">
            <p className="text-gray-400 font-medium">Total XP</p>
            <p className="font-bold text-blue-600">{student.totalXP ?? '—'}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-2 text-center">
            <p className="text-gray-400 font-medium">Rata-rata</p>
            <p className="font-bold text-green-600">{student.avgNilai ?? '—'}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-2 text-center">
            <p className="text-gray-400 font-medium">Tugas</p>
            <p className="font-bold text-indigo-600">{student.tasksCompleted ?? '—'}</p>
          </div>
          <div className="bg-gray-50 rounded-lg p-2 text-center">
            <p className="text-gray-400 font-medium">Nilai ≥ 90</p>
            <p className="font-bold text-amber-600">{student.countNilaiGe90 ?? '—'}</p>
          </div>
        </div>
      </div>
    </motion.div>
  )
}
