import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Users, Shuffle, Monitor, RefreshCw, UserCheck, UserX, AlertTriangle } from 'lucide-react'
import { apiRequest } from '../utils/api'

const AcakTempatDudukPage = () => {
  const [kelas, setKelas] = useState('')
  const [rombel, setRombel] = useState('')
  const [listSiswa, setListSiswa] = useState([])
  const [mustPairIds, setMustPairIds] = useState([])
  const [tidakMasukIds, setTidakMasukIds] = useState([])
  const [tagMode, setTagMode] = useState('pair') // 'pair' | 'absent'
  const [devices, setDevices] = useState([])
  const [tidakMasukResult, setTidakMasukResult] = useState([])
  const [ringkasan, setRingkasan] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const [kelasList, setKelasList] = useState([])
  const [rombelList, setRombelList] = useState([])

  useEffect(() => {
    fetchKelasDinamis()
  }, [])

  const fetchKelasDinamis = async () => {
    try {
      const res = await apiRequest('/api/siswa/login-kelas')
      const data = await res.json()
      if (res.ok) setKelasList(data)
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    if (kelas) fetchRombelDinamis()
  }, [kelas])

  const fetchRombelDinamis = async () => {
    try {
      const res = await apiRequest(`/api/siswa/login-rombel?kelas=${encodeURIComponent(kelas)}`)
      const data = await res.json()
      if (res.ok) setRombelList(data)
      setRombel('')
    } catch (e) {
      console.error(e)
    }
  }

  useEffect(() => {
    if (kelas && rombel) fetchSiswa()
  }, [kelas, rombel])

  const fetchSiswa = async () => {
    try {
      const res = await apiRequest('/api/siswa')
      const data = await res.json()
      // Filter lokal untuk demo
      setListSiswa(data.filter(s => s.kelas === kelas && s.rombel === rombel))
      setMustPairIds([])
      setTidakMasukIds([])
    } catch (e) {
      console.error('Error fetch siswa:', e)
    }
  }

  const handleToggleStudent = (id) => {
    if (tagMode === 'pair') {
      // Siswa yang ditandai "tidak masuk" tidak bisa ditandai wajib berdampingan.
      if (tidakMasukIds.includes(id)) return
      setMustPairIds(prev => prev.includes(id) ? prev.filter(pId => pId !== id) : [...prev, id])
    } else {
      // Menandai tidak masuk otomatis melepas tag wajib berdampingan siswa itu.
      setTidakMasukIds(prev => {
        const next = prev.includes(id) ? prev.filter(pId => pId !== id) : [...prev, id]
        return next
      })
      setMustPairIds(prev => prev.filter(pId => pId !== id))
    }
  }

  const handleAcak = async () => {
    setLoading(true)
    setError('')
    setDevices([]) // reset for animation
    try {
      const res = await apiRequest('/api/acak/shuffle', {
        method: 'POST',
        body: JSON.stringify({ kelas, rombel, mustPairIds, tidakMasukIds })
      })

      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Gagal mengacak tempat duduk.')

      if (Array.isArray(data.devices)) {
        setTimeout(() => {
          setDevices(data.devices)
          setTidakMasukResult(data.tidakMasuk || [])
          setRingkasan(data.ringkasan || null)
          setLoading(false)
        }, 800)
      } else {
        throw new Error('Data tidak valid')
      }
    } catch (e) {
      console.error(e)
      setError(e.message || 'Gagal mengacak tempat duduk.')
      setLoading(false)
    }
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800">Acak Tempat Duduk</h1>
        <p className="text-gray-500 mt-1">Atur posisi duduk siswa secara otomatis</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar Pengaturan */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100">
            <h2 className="font-bold text-gray-800 mb-4">Pengaturan Kelas</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Kelas</label>
                <select
                  value={kelas}
                  onChange={(e) => setKelas(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl outline-none"
                >
                  <option value="">Pilih Kelas</option>
                  {kelasList.map(k => <option key={k} value={k}>{k}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Rombel</label>
                <select
                  value={rombel}
                  onChange={(e) => setRombel(e.target.value)}
                  className="w-full px-4 py-2 border border-gray-200 rounded-xl outline-none"
                >
                  <option value="">Pilih Rombel</option>
                  {rombelList.map(r => <option key={r} value={r}>{r}</option>)}
                </select>
              </div>
            </div>
          </div>

          <div className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 flex flex-col h-[440px]">
            <div className="flex items-center justify-between mb-2">
              <h2 className="font-bold text-gray-800">Tandai Siswa</h2>
            </div>
            {/* Toggle mode tag */}
            <div className="grid grid-cols-2 gap-2 mb-3 bg-gray-50 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setTagMode('pair')}
                className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition ${tagMode === 'pair' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'}`}
              >
                <UserCheck className="w-3.5 h-3.5" /> Wajib Berdampingan
              </button>
              <button
                type="button"
                onClick={() => setTagMode('absent')}
                className={`flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition ${tagMode === 'absent' ? 'bg-white shadow-sm text-red-500' : 'text-gray-500'}`}
              >
                <UserX className="w-3.5 h-3.5" /> Tidak Masuk
              </button>
            </div>
            <p className="text-xs text-gray-500 mb-3">
              {tagMode === 'pair'
                ? 'Tandai siswa yang wajib duduk berdampingan (akan dipasangkan dengan teman acak yang tidak ditandai).'
                : 'Tandai siswa yang tidak masuk hari ini — tidak akan ikut diacak/ditempatkan.'}
            </p>

            <div className="flex-1 overflow-y-auto space-y-2 pr-2">
              {listSiswa.length === 0 ? (
                <p className="text-sm text-center text-gray-400 mt-10">Pilih kelas & rombel dulu.</p>
              ) : (
                listSiswa.map(s => {
                  const isPair = mustPairIds.includes(s.id)
                  const isAbsent = tidakMasukIds.includes(s.id)
                  const active = tagMode === 'pair' ? isPair : isAbsent
                  const disabled = tagMode === 'pair' && isAbsent
                  return (
                    <div
                      key={s.id}
                      onClick={() => !disabled && handleToggleStudent(s.id)}
                      className={`p-3 rounded-xl text-sm font-medium flex justify-between items-center transition ${disabled ? 'opacity-40 cursor-not-allowed bg-gray-50 text-gray-400' : 'cursor-pointer'} ${
                        !disabled && active
                          ? (tagMode === 'pair' ? 'bg-blue-50 text-blue-700 border border-blue-200' : 'bg-red-50 text-red-600 border border-red-200')
                          : !disabled ? 'bg-gray-50 text-gray-700 hover:bg-gray-100 border border-transparent' : ''
                      }`}
                    >
                      <span className="flex items-center gap-2">
                        {s.nama}
                        {isAbsent && tagMode === 'pair' && <span className="text-[10px] text-red-400">(tidak masuk)</span>}
                      </span>
                      {tagMode === 'pair' && isPair && <UserCheck className="w-4 h-4 text-blue-600" />}
                      {tagMode === 'absent' && isAbsent && <UserX className="w-4 h-4 text-red-500" />}
                    </div>
                  )
                })
              )}
            </div>
          </div>

          <button
            onClick={handleAcak}
            disabled={!kelas || !rombel || loading}
            className="w-full py-4 bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 text-white rounded-2xl font-bold shadow-lg shadow-blue-200 transition flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? <RefreshCw className="w-5 h-5 animate-spin" /> : <Shuffle className="w-5 h-5" />}
            {devices.length > 0 ? 'Acak Lagi' : 'Mulai Acak'}
          </button>

          {error && (
            <div className="p-3 bg-red-50 border border-red-200 text-red-600 rounded-xl text-xs flex items-start gap-2">
              <AlertTriangle className="w-4 h-4 mt-0.5 shrink-0" /> {error}
            </div>
          )}
        </div>

        {/* Hasil Acak - Layout Ruangan */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 min-h-[600px] flex flex-col">
            {/* Meja Guru */}
            <div className="w-full flex justify-center mb-8">
              <div className="w-64 h-16 bg-gray-800 text-white rounded-b-2xl flex items-center justify-center font-bold text-lg shadow-md">
                MEJA GURU
              </div>
            </div>

            {ringkasan && !loading && (
              <div className="flex flex-wrap items-center justify-center gap-2 mb-8 text-xs">
                <span className="px-3 py-1.5 bg-gray-100 rounded-full text-gray-600 font-medium">Total aktif: {ringkasan.totalAktif}</span>
                <span className="px-3 py-1.5 bg-blue-50 rounded-full text-blue-600 font-medium">Laki-laki: {ringkasan.totalLaki} ({ringkasan.pasanganLaki} pasang)</span>
                <span className="px-3 py-1.5 bg-pink-50 rounded-full text-pink-600 font-medium">Perempuan: {ringkasan.totalPerempuan} ({ringkasan.pasanganPerempuan} pasang)</span>
                {ringkasan.pasanganWajibTag > 0 && (
                  <span className="px-3 py-1.5 bg-yellow-50 rounded-full text-yellow-600 font-medium">Pasangan wajib (tag): {ringkasan.pasanganWajibTag}</span>
                )}
              </div>
            )}

            {loading ? (
              <div className="flex-1 flex flex-col items-center justify-center">
                <RefreshCw className="w-12 h-12 text-blue-500 animate-spin mb-4" />
                <p className="text-gray-500 font-medium">Sedang memproses posisi terbaik...</p>
              </div>
            ) : devices.length === 0 ? (
              <div className="flex-1 flex flex-col items-center justify-center text-gray-400">
                <Users className="w-16 h-16 mb-4 opacity-50" />
                <p className="font-medium text-lg">Layout Ruangan Kosong</p>
                <p className="text-sm mt-1">Pilih pengaturan kelas lalu klik Mulai Acak</p>
              </div>
            ) : (
              <div className="flex-1">
                {/* 16 Device = 8 Kiri, 8 Kanan. 4 Baris. */}
                <div className="grid grid-cols-2 gap-x-20 gap-y-8 max-w-4xl mx-auto">
                  {Array.from({ length: 4 }).map((_, rowIndex) => (
                    <React.Fragment key={rowIndex}>
                      {/* Baris Kiri */}
                      <div className="grid grid-cols-2 gap-4">
                        {[0, 1].map(colIndex => {
                          const deviceIndex = (rowIndex * 4) + colIndex
                          const device = devices[deviceIndex]
                          return (
                            <DeviceCard key={`left-${deviceIndex}`} device={device} delay={deviceIndex * 0.05} />
                          )
                        })}
                      </div>

                      {/* Baris Kanan */}
                      <div className="grid grid-cols-2 gap-4">
                        {[2, 3].map(colIndex => {
                          const deviceIndex = (rowIndex * 4) + colIndex
                          const device = devices[deviceIndex]
                          return (
                            <DeviceCard key={`right-${deviceIndex}`} device={device} delay={deviceIndex * 0.05} />
                          )
                        })}
                      </div>
                    </React.Fragment>
                  ))}
                </div>

                {tidakMasukResult.length > 0 && (
                  <div className="mt-10 max-w-4xl mx-auto">
                    <p className="text-xs font-bold text-gray-400 uppercase tracking-wide mb-2 flex items-center gap-1.5">
                      <UserX className="w-3.5 h-3.5 text-red-400" /> Tidak Masuk ({tidakMasukResult.length})
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {tidakMasukResult.map(s => (
                        <span key={s.id} className="px-3 py-1.5 bg-red-50 text-red-500 rounded-full text-xs font-medium">{s.nama}</span>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

const DeviceCard = ({ device, delay }) => {
  if (!device) return null;

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.8, y: 20 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 200, damping: 15, delay }}
      className="bg-blue-50 border border-blue-100 rounded-xl p-3 flex flex-col items-center justify-center min-h-[100px] shadow-sm relative overflow-hidden"
    >
      <Monitor className="w-5 h-5 text-blue-300 absolute top-2 right-2" />
      <span className="absolute top-2 left-2 text-[10px] font-bold text-blue-300">PC-{device.id}</span>

      <div className="mt-3 w-full space-y-1.5 z-10">
        {device.students.length === 0 ? (
          <div className="text-center text-sm text-blue-300 font-medium">Kosong</div>
        ) : (
          device.students.map((student, idx) => (
            <div
              key={student.id}
              className="bg-white px-2 py-1.5 rounded-lg text-xs font-bold text-gray-800 text-center shadow-sm truncate border border-blue-50"
            >
              {student.nama}
            </div>
          ))
        )}
      </div>
    </motion.div>
  )
}

export default AcakTempatDudukPage
