import React, { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { motion } from 'framer-motion'
import { User, Lock, GraduationCap, AlertCircle, Search } from 'lucide-react'
import { apiRequest } from '../utils/api'

const LoginPage = ({ onLoginSuccess }) => {
  const navigate = useNavigate()
  const [role, setRole] = useState('guru')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [kelas, setKelas] = useState('')
  const [rombel, setRombel] = useState('')
  const [siswaId, setSiswaId] = useState('')
  const [kelasList, setKelasList] = useState([])
  const [rombelList, setRombelList] = useState([])
  const [siswaList, setSiswaList] = useState([])
  const [search, setSearch] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  useEffect(() => {
    if (role !== 'siswa') return

    const fetchKelas = async () => {
      try {
        const res = await apiRequest('/api/siswa/login-kelas')
        const data = await res.json()
        if (!res.ok) throw new Error(data.message)
        setKelasList(data)
      } catch (e) {
        setError(e.message || 'Gagal mengambil daftar kelas.')
      }
    }

    fetchKelas()
  }, [role])

  useEffect(() => {
    setRombel('')
    setSiswaId('')
    setSiswaList([])
    setSearch('')

    if (!kelas) {
      setRombelList([])
      return
    }

    const fetchRombel = async () => {
      try {
        const res = await apiRequest(`/api/siswa/login-rombel?kelas=${encodeURIComponent(kelas)}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.message)
        setRombelList(data)
      } catch (e) {
        setError(e.message || 'Gagal mengambil daftar rombel.')
      }
    }

    fetchRombel()
  }, [kelas])

  useEffect(() => {
    setSiswaId('')
    setSearch('')
    setSiswaList([])

    if (!kelas || !rombel) return

    const fetchSiswa = async () => {
      try {
        const query = new URLSearchParams({ kelas, rombel })
        const res = await apiRequest(`/api/siswa/login-list?${query}`)
        const data = await res.json()
        if (!res.ok) throw new Error(data.message)
        setSiswaList(data)
      } catch (e) {
        setError(e.message || 'Gagal mengambil daftar siswa.')
      }
    }

    fetchSiswa()
  }, [kelas, rombel])

  const filteredSiswa = useMemo(() => {
    const keyword = search.trim().toLocaleLowerCase('id-ID')
    if (!keyword) return siswaList
    return siswaList.filter((siswa) => siswa.nama.toLocaleLowerCase('id-ID').includes(keyword))
  }, [search, siswaList])

  const changeRole = (nextRole) => {
    setRole(nextRole)
    setError('')
    setPassword('')
  }

  const handleLogin = async (e) => {
    e.preventDefault()
    setError('')
    setLoading(true)

    try {
      const res = role === 'guru'
        ? await apiRequest('/api/auth/login-guru', {
          method: 'POST',
          body: JSON.stringify({ username, password }),
          skipAuthRedirect: true,
        })
        : await apiRequest('/api/auth/login-siswa', {
          method: 'POST',
          body: JSON.stringify({ siswaId, password }),
          skipAuthRedirect: true,
        })
      const data = await res.json()

      if (!res.ok) throw new Error(data.message || 'Login gagal.')

      localStorage.setItem('token', data.token)
      localStorage.setItem('user', JSON.stringify(data.user))
      if (onLoginSuccess) onLoginSuccess(data.user)
      navigate(data.user.role === 'guru' ? '/dashboard' : '/siswa')
    } catch (e) {
      setError(e.message || 'Login gagal.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 via-white to-green-50 px-4">
      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full max-w-md">
        <div className="bg-white rounded-2xl shadow-xl p-8 border border-gray-100">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-blue-500 to-green-500 mb-4">
              <GraduationCap className="w-8 h-8 text-white" />
            </div>
            <h1 className="text-2xl font-bold text-gray-800">Dashboard Guru TIK</h1>
            <p className="text-gray-500 mt-1">Masuk untuk memulai</p>
          </div>

          <div className="flex gap-2 mb-6">
            <button type="button" onClick={() => changeRole('guru')} className={`flex-1 py-3 rounded-xl font-medium transition-all ${role === 'guru' ? 'bg-blue-500 text-white shadow-lg' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              <User className="w-5 h-5 inline mr-2" /> Guru
            </button>
            <button type="button" onClick={() => changeRole('siswa')} className={`flex-1 py-3 rounded-xl font-medium transition-all ${role === 'siswa' ? 'bg-green-500 text-white shadow-lg' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}>
              <GraduationCap className="w-5 h-5 inline mr-2" /> Siswa
            </button>
          </div>

          {error && (
            <motion.div initial={{ opacity: 0, x: -10 }} animate={{ opacity: 1, x: 0 }} className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl flex items-center gap-2">
              <AlertCircle className="w-5 h-5 flex-shrink-0" />
              <span className="text-sm">{error}</span>
            </motion.div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            {role === 'guru' ? (
              <>
                <label className="block text-sm font-medium text-gray-700">Username
                  <span className="relative block mt-1"><User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" /><input type="text" value={username} onChange={(e) => setUsername(e.target.value)} className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition" placeholder="Masukkan username" required /></span>
                </label>
                <label className="block text-sm font-medium text-gray-700">Password
                  <span className="relative block mt-1"><Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" /><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition" placeholder="Masukkan password" required /></span>
                </label>
              </>
            ) : (
              <>
                <label className="block text-sm font-medium text-gray-700">Kelas
                  <select value={kelas} onChange={(e) => setKelas(e.target.value)} className="w-full mt-1 px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition bg-white" required>
                    <option value="">Pilih kelas</option>
                    {kelasList.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </label>
                <label className="block text-sm font-medium text-gray-700">Rombel
                  <select value={rombel} onChange={(e) => setRombel(e.target.value)} className="w-full mt-1 px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition bg-white" disabled={!kelas} required>
                    <option value="">Pilih rombel</option>
                    {rombelList.map((item) => <option key={item} value={item}>{item}</option>)}
                  </select>
                </label>
                <label className="block text-sm font-medium text-gray-700">Cari nama siswa
                  <span className="relative block mt-1"><Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" /><input type="search" value={search} onChange={(e) => setSearch(e.target.value)} className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition" placeholder="Ketik nama siswa" disabled={!rombel} /></span>
                </label>
                <label className="block text-sm font-medium text-gray-700">Nama Siswa
                  <select value={siswaId} onChange={(e) => setSiswaId(e.target.value)} className="w-full mt-1 px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition bg-white" disabled={!rombel} required>
                    <option value="">{rombel ? 'Pilih nama siswa' : 'Pilih kelas dan rombel dahulu'}</option>
                    {filteredSiswa.map((siswa) => <option key={siswa.id} value={siswa.id}>{siswa.nama}</option>)}
                  </select>
                </label>
                <label className="block text-sm font-medium text-gray-700">Password (Tanggal Lahir DDMMYYYY)
                  <span className="relative block mt-1">
                    <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input type={showPassword ? 'text' : 'password'} value={password} onChange={(e) => setPassword(e.target.value)} className="w-full pl-10 pr-12 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none transition" placeholder="Contoh: 12052015" required maxLength={8} />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3 top-1/2 -translate-y-1/2 text-sm font-semibold text-green-600 hover:text-green-700 pr-1" tabIndex={-1}>{showPassword ? 'Sembunyi' : 'Lihat'}</button>
                  </span>
                </label>
              </>
            )}

            <motion.button whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} type="submit" disabled={loading || (role === 'siswa' && !siswaId)} className={`w-full py-3 rounded-xl font-semibold text-white transition-all ${role === 'guru' ? 'bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700' : 'bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700'} disabled:opacity-50 disabled:cursor-not-allowed`}>
              {loading ? 'Memproses...' : 'Masuk'}
            </motion.button>
          </form>

        </div>
      </motion.div>
    </div>
  )
}

export default LoginPage