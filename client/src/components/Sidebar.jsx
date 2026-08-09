import React from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { motion } from 'framer-motion'
import {
  Home, Layout, ClipboardList, Upload, Users,
  Settings, LogOut, HardDrive, Share2, Zap,
  Menu, X, GraduationCap, Trash2, BarChart2, Trophy, TrendingUp
} from 'lucide-react'

const Sidebar = ({ user }) => {
  const navigate = useNavigate()
  const location = useLocation()
  const isGuru = user?.role === 'guru'

  const menuItems = isGuru ? [
    { icon: Home, label: 'Dashboard', path: '/dashboard' },
    { icon: ClipboardList, label: 'Informasi Tugas', path: '/dashboard/tugas' },
    { icon: Upload, label: 'Pengumpulan', path: '/dashboard/pengumpulan' },
    { icon: BarChart2, label: 'Rekap Nilai', path: '/dashboard/rekap-nilai' },
    { icon: Trophy, label: 'Leaderboard', path: '/dashboard/leaderboard' },
    { icon: TrendingUp, label: 'Riwayat XP', path: '/dashboard/riwayat-xp' },
    { icon: Trash2, label: 'Recently Deleted', path: '/dashboard/sampah' },
    { icon: Layout, label: 'Acak Tempat Duduk', path: '/dashboard/acak' },
    { icon: Users, label: 'Data Siswa', path: '/dashboard/siswa' },
    { icon: Share2, label: 'File Sharing', path: '/dashboard/sharing' },
    { icon: Zap, label: 'Quick Share', path: '/dashboard/quick' },
    { icon: HardDrive, label: 'Local Disk', path: '/dashboard/disk' },
    { icon: Settings, label: 'Pengaturan', path: '/dashboard/settings' },
  ] : [
    { icon: Home, label: 'Beranda', path: '/siswa' },
    { icon: ClipboardList, label: 'Tugas', path: '/siswa/tugas' },
    { icon: BarChart2, label: 'Rekap Nilai', path: '/siswa/rekap-nilai' },
    { icon: Trophy, label: 'Leaderboard', path: '/siswa/leaderboard' },
    { icon: TrendingUp, label: 'Riwayat XP', path: '/siswa/riwayat-xp' },
    { icon: Share2, label: 'File Sharing', path: '/siswa/sharing' },
    { icon: Zap, label: 'Quick Share', path: '/siswa/quick' },
  ]

  const handleLogout = () => {
    localStorage.removeItem('token')
    localStorage.removeItem('user')
    navigate('/login')
  }

  return (
    <div className="w-64 bg-white border-r border-gray-200 flex flex-col h-screen sticky top-0">
      <div className="p-6 border-b border-gray-100">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-green-500 flex items-center justify-center text-white shadow-lg shadow-blue-100">
            <GraduationCap className="w-6 h-6" />
          </div>
          <div>
            <h2 className="font-bold text-gray-800 leading-tight">LAB TIK</h2>
            <p className="text-xs text-gray-400 font-medium">{isGuru ? 'Admin Panel' : 'Student Panel'}</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto p-4 space-y-1">
        {menuItems.map((item) => (
          <Link
            key={item.path}
            to={item.path}
            className={`flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-200 group ${
              location.pathname === item.path
                ? 'bg-blue-50 text-blue-600 shadow-sm'
                : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'
            }`}
          >
            <item.icon className={`w-5 h-5 ${location.pathname === item.path ? 'text-blue-600' : 'text-gray-400 group-hover:text-gray-600'}`} />
            <span className="font-medium">{item.label}</span>
          </Link>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-100">
        <div className="bg-gray-50 rounded-2xl p-4 mb-4">
          <div className="flex items-center gap-3 mb-1">
            <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center text-blue-600 font-bold text-xs">
              {user?.nama?.charAt(0)}
            </div>
            <div className="truncate">
              <p className="text-sm font-bold text-gray-800 truncate">{user?.nama}</p>
              <p className="text-[10px] text-gray-400 font-bold uppercase">{user?.role === 'siswa' ? `${user.kelas}${user.rombel}` : 'Guru'}</p>
            </div>
          </div>
        </div>

        <button
          onClick={handleLogout}
          className="flex items-center gap-3 px-4 py-3 w-full rounded-xl text-red-500 hover:bg-red-50 transition-colors group"
        >
          <LogOut className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
          <span className="font-bold">Keluar</span>
        </button>
      </div>
    </div>
  )
}

export default Sidebar
