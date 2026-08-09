import React, { useEffect, useMemo, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { io } from 'socket.io-client'
import { Users, ClipboardList, UploadCloud, HardDrive, Clock, LogIn, FolderOpen, Download, UploadCloud as UploadIcon } from 'lucide-react'
import { apiRequest } from '../utils/api'

const AKTIVITAS_ICON = {
  LOGIN: { icon: LogIn, color: 'text-purple-500', bg: 'bg-purple-50' },
  BUKA_TUGAS: { icon: FolderOpen, color: 'text-blue-500', bg: 'bg-blue-50' },
  UPLOAD: { icon: UploadIcon, color: 'text-green-500', bg: 'bg-green-50' },
  DOWNLOAD: { icon: Download, color: 'text-orange-500', bg: 'bg-orange-50' },
}

const formatJamUpload = (tanggal) => {
  const d = new Date(tanggal)
  const jam = String(d.getHours()).padStart(2, '0')
  const menit = String(d.getMinutes()).padStart(2, '0')
  const detik = String(d.getSeconds()).padStart(2, '0')
  return `${jam}.${menit}.${detik}`
}

const formatAktivitasMessage = (a) => {
  const namaSiswa = (a.siswa?.nama || 'Siswa').toUpperCase()
  const judulTugas = a.tugas?.judul ? a.tugas.judul.toUpperCase() : null
  const jam = formatJamUpload(a.createdAt)

  switch (a.jenis) {
    case 'UPLOAD':
      return judulTugas
        ? `${namaSiswa} mengirimkan ${judulTugas} pukul ${jam}`
        : `${namaSiswa} mengirimkan tugas pukul ${jam}`
    case 'BUKA_TUGAS':
      return judulTugas
        ? `${namaSiswa} membuka ${judulTugas} pukul ${jam}`
        : `${namaSiswa} membuka tugas pukul ${jam}`
    case 'DOWNLOAD':
      return `${namaSiswa} mengunduh berkas pukul ${jam}`
    case 'LOGIN':
      return `${namaSiswa} login ke sistem pukul ${jam}`
    default:
      return `${namaSiswa} melakukan aktivitas pukul ${jam}`
  }
}

const DashboardGuru = () => {
  const [siswaList, setSiswaList] = useState([])
  const [tugasList, setTugasList] = useState([])
  const [diskInfo, setDiskInfo] = useState(null)
  const [aktivitasList, setAktivitasList] = useState([])
  const [loading, setLoading] = useState(true)
  const socketRef = useRef(null)

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true)
      try {
        const [siswaRes, tugasRes, diskRes, aktivitasRes] = await Promise.all([
          apiRequest('/api/siswa'),
          apiRequest('/api/tugas'),
          apiRequest('/api/localdisk/usage'),
          apiRequest('/api/aktivitas/terbaru?limit=10'),
        ])

        const siswaData = await siswaRes.json()
        const tugasData = await tugasRes.json()
        const diskData = await diskRes.json()
        const aktivitasData = await aktivitasRes.json()

        setSiswaList(siswaRes.ok && Array.isArray(siswaData) ? siswaData : [])
        setTugasList(tugasRes.ok && Array.isArray(tugasData) ? tugasData : [])
        setDiskInfo(diskRes.ok ? diskData : null)
        setAktivitasList(aktivitasRes.ok && Array.isArray(aktivitasData) ? aktivitasData : [])
      } catch (error) {
        console.error('Gagal memuat dashboard guru:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchData()
  }, [])

  // Update Aktivitas Terbaru secara real-time (mis. saat siswa mengirim tugas)
  useEffect(() => {
    socketRef.current = io(window.location.origin, {
      transports: ['websocket', 'polling'],
    })
    const socket = socketRef.current

    socket.on('aktivitas-baru', (aktivitas) => {
      setAktivitasList((prev) => [aktivitas, ...prev].slice(0, 10))
    })

    socket.on('pengumpulan-baru', () => {
      // Refresh angka pengumpulan pada kartu progress saat ada upload baru
      apiRequest('/api/tugas').then(async (res) => {
        const data = await res.json()
        if (res.ok && Array.isArray(data)) setTugasList(data)
      }).catch(() => {})
    })

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [])

  const activeTasks = useMemo(() => tugasList.filter((tugas) => tugas.status === 'launch'), [tugasList])

  // Tugas yang ditutup ("ditutup") tetap harus muncul di rekap progres, supaya
  // data pengumpulan yang sudah terjadi sebelum ditutup tidak "hilang" dari
  // ringkasan dashboard. Hanya draft yang tidak relevan ditampilkan di sini.
  const tasksForProgress = useMemo(
    () => tugasList.filter((tugas) => tugas.status === 'launch' || tugas.status === 'ditutup'),
    [tugasList]
  )

  const totalPengumpulan = useMemo(() => (
    tugasList.reduce((total, tugas) => total + (tugas.totalTerkumpul ?? tugas._count?.pengumpulan ?? 0), 0)
  ), [tugasList])

  const stats = [
    { title: 'Total Siswa', value: siswaList.length, icon: Users, color: 'text-blue-500', bg: 'bg-blue-50' },
    { title: 'Tugas Aktif', value: activeTasks.length, icon: ClipboardList, color: 'text-purple-500', bg: 'bg-purple-50' },
    { title: 'Tugas Terkumpul', value: totalPengumpulan, icon: UploadCloud, color: 'text-green-500', bg: 'bg-green-50' },
    { title: 'Storage Path', value: diskInfo?.baseDir || '-', icon: HardDrive, color: 'text-orange-500', bg: 'bg-orange-50' },
  ]

  const progressRows = tasksForProgress.slice(0, 5).map((tugas) => {
    // rombelProgress dihitung backend berdasarkan siswa pada kelas+rombel target tugas ini saja
    const progress = Array.isArray(tugas.rombelProgress) ? tugas.rombelProgress[0] : null
    const collected = progress ? progress.collected : (tugas.totalTerkumpul ?? tugas._count?.pengumpulan ?? 0)
    const total = progress ? progress.total : siswaList.length
    const percent = progress ? progress.percent : (total > 0 ? Math.round((collected / total) * 100) : 0)
    const label = progress ? `${progress.kelas}${progress.rombel}` : null
    return { ...tugas, collected, total, percent, label }
  })

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800">Dashboard Utama</h1>
        <p className="text-gray-500 mt-1">Ringkasan data terbaru dari sistem</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat, i) => (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            key={stat.title}
            className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex items-center gap-4"
          >
            <div className={`w-14 h-14 rounded-xl ${stat.bg} flex items-center justify-center flex-shrink-0`}>
              <stat.icon className={`w-7 h-7 ${stat.color}`} />
            </div>
            <div className="min-w-0">
              <p className="text-gray-500 text-sm font-medium">{stat.title}</p>
              <h3 className="text-2xl font-bold text-gray-800 truncate">{loading ? '...' : stat.value}</h3>
            </div>
          </motion.div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <div className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Progress Pengumpulan Tugas</h2>
          {loading ? (
            <p className="text-sm text-gray-400 py-8 text-center">Memuat progress...</p>
          ) : progressRows.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">Belum ada tugas aktif.</p>
          ) : (
            <div className="space-y-6">
              {progressRows.map((tugas) => (
                <div key={tugas.id}>
                  <div className="flex justify-between text-sm mb-2">
                    <span className="font-medium text-gray-600">
                      {tugas.judul}
                      {tugas.label && <span className="ml-1.5 text-xs font-normal text-gray-400">[Kelas {tugas.label}]</span>}
                    </span>
                    <span className="font-bold text-blue-600">{tugas.percent}% ({tugas.collected}/{tugas.total})</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-3">
                    <div className="bg-blue-500 h-3 rounded-full" style={{ width: `${tugas.percent}%` }}></div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
          <h2 className="text-lg font-bold text-gray-800 mb-4">Aktivitas Terbaru</h2>
          {loading ? (
            <p className="text-sm text-gray-400 py-8 text-center">Memuat aktivitas...</p>
          ) : aktivitasList.length === 0 ? (
            <p className="text-sm text-gray-400 py-8 text-center">Belum ada aktivitas.</p>
          ) : (
            <div className="space-y-4">
              {aktivitasList.map((a) => {
                const meta = AKTIVITAS_ICON[a.jenis] || AKTIVITAS_ICON.UPLOAD
                return (
                  <div key={a.id} className="flex items-start gap-3">
                    <div className={`w-8 h-8 rounded-full ${meta.bg} flex items-center justify-center flex-shrink-0 mt-1`}>
                      <meta.icon className={`w-4 h-4 ${meta.color}`} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-800">{formatAktivitasMessage(a)}</p>
                      {a.siswa?.kelas && (
                        <p className="text-xs text-gray-500">Kelas {a.siswa.kelas}{a.siswa.rombel}</p>
                      )}
                      <p className="text-[10px] text-gray-400 mt-0.5 flex items-center gap-1">
                        <Clock className="w-3 h-3" /> {new Date(a.createdAt).toLocaleDateString('id-ID')}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export default DashboardGuru
