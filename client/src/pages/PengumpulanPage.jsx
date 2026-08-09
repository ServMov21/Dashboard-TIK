import React, { useState, useEffect, useMemo, useRef } from 'react'
import { io } from 'socket.io-client'
import { apiRequest } from '../utils/api'
import { Download, CheckCircle, XCircle, FileSpreadsheet, RefreshCw, Eye, Keyboard, X, Trophy } from 'lucide-react'
import { formatDurasi } from '../utils/typingScore'
import FilePreviewModal from '../components/FilePreviewModal'

// Bentuk label "TUGAS A [KELAS 5B]" dari judul + kelasTarget + rombelTarget
const formatTugasLabel = (t) => {
  const kelasTarget = Array.isArray(t.kelasTarget) ? t.kelasTarget : JSON.parse(t.kelasTarget || '[]')
  const rombelTarget = t.rombelTarget ? (Array.isArray(t.rombelTarget) ? t.rombelTarget : JSON.parse(t.rombelTarget || '[]')) : []
  if (kelasTarget.length === 0) return t.judul
  const label = kelasTarget.length === 1 && rombelTarget.length > 0
    ? `${kelasTarget[0]}${rombelTarget.join('')}`
    : kelasTarget.join(', ')
  return `${t.judul} [KELAS ${label}]`
}

// Kelompokkan daftar tugas per batchId (satu kali "Tambah Tugas" bisa membuat
// beberapa baris tugas, satu per kelas/rombel target). Tugas lama tanpa
// batchId tetap ditampilkan sebagai entri tersendiri (fallback ke id-nya sendiri).
const groupTugasList = (list) => {
  const groups = new Map()
  list.forEach((t) => {
    const key = t.batchId || `single:${t.id}`
    if (!groups.has(key)) {
      groups.set(key, { key, batchId: t.batchId || null, judul: t.judul, rows: [] })
    }
    groups.get(key).rows.push(t)
  })
  return Array.from(groups.values()).map((g) => {
    const kelasSet = new Set()
    const rombelSet = new Set()
    g.rows.forEach((t) => {
      const kelasTarget = Array.isArray(t.kelasTarget) ? t.kelasTarget : JSON.parse(t.kelasTarget || '[]')
      const rombelTarget = t.rombelTarget ? (Array.isArray(t.rombelTarget) ? t.rombelTarget : JSON.parse(t.rombelTarget || '[]')) : []
      kelasTarget.forEach((k) => kelasSet.add(k))
      rombelTarget.forEach((r) => rombelSet.add(r))
    })
    const kelasLabel = Array.from(kelasSet).join(', ')
    const rombelLabel = Array.from(rombelSet).join('')
    const label = g.rows.length > 1
      ? `${g.judul} [KELAS ${kelasLabel}${rombelLabel ? ` - ${rombelLabel}` : ''}]`
      : formatTugasLabel(g.rows[0])
    return { ...g, label }
  })
}

const PengumpulanPage = () => {
  const [tugasList, setTugasList] = useState([])
  const [groups, setGroups] = useState([])
  const [selectedKey, setSelectedKey] = useState('')
  const [submissions, setSubmissions] = useState([])
  const [loading, setLoading] = useState(false)
  const [previewHasil, setPreviewHasil] = useState(null)
  const [previewFile, setPreviewFile] = useState(null)
  const socketRef = useRef(null)
  const selectedGroupRef = useRef(null)

  const selectedGroup = groups.find((g) => g.key === selectedKey) || null
  const isMengetikGroup = selectedGroup ? selectedGroup.rows.every((r) => r.jenis === 'mengetik') : false
  useEffect(() => { selectedGroupRef.current = selectedGroup }, [selectedGroup])

  useEffect(() => {
    fetchTugas()
  }, [])

  useEffect(() => {
    if (selectedKey) fetchStatus()
  }, [selectedKey])

  // Auto-refresh saat ada siswa yang baru saja mengirimkan/memperbarui tugas
  useEffect(() => {
    socketRef.current = io(window.location.origin, {
      transports: ['websocket', 'polling'],
    })
    const socket = socketRef.current

    const handleUpdate = (data) => {
      const group = selectedGroupRef.current
      if (group && data?.tugasId && group.rows.some((r) => r.id === data.tugasId)) fetchStatus()
    }
    socket.on('pengumpulan-baru', handleUpdate)
    socket.on('pengumpulan-update', handleUpdate)
    socket.on('pengumpulan-mengetik-update', handleUpdate)

    return () => {
      socket.disconnect()
      socketRef.current = null
    }
  }, [])

  const fetchTugas = async () => {
    try {
      const res = await apiRequest('/api/tugas')
      const data = await res.json()
      setTugasList(data)
      const grouped = groupTugasList(data)
      setGroups(grouped)
      if (grouped.length > 0) setSelectedKey(grouped[0].key)
    } catch (e) {
      console.error(e)
    }
  }

  const fetchStatus = async () => {
    const group = groups.find((g) => g.key === selectedKey)
    if (!group) return
    setLoading(true)
    try {
      let data
      const isMengetik = group.rows.every((r) => r.jenis === 'mengetik')
      if (isMengetik && group.batchId) {
        const res = await apiRequest(`/api/pengumpulan-mengetik/status-batch/${group.batchId}`)
        data = await res.json()
      } else if (isMengetik) {
        const res = await apiRequest(`/api/pengumpulan-mengetik/status/${group.rows[0].id}`)
        data = await res.json()
      } else if (group.batchId) {
        const res = await apiRequest(`/api/pengumpulan/status-batch/${group.batchId}`)
        const json = await res.json()
        data = json.siswa || []
      } else {
        const res = await apiRequest(`/api/pengumpulan/status/${group.rows[0].id}`)
        data = await res.json()
      }
      setSubmissions(data)
    } catch (e) {
      console.error(e)
    } finally {
      setLoading(false)
    }
  }

  const progress = useMemo(() => {
    const total = submissions.length
    const collected = isMengetikGroup
      ? submissions.filter((s) => s.status === 'selesai').length
      : submissions.filter((s) => s.sudahUpload).length
    const percent = total > 0 ? Math.round((collected / total) * 100) : 0
    return { total, collected, percent }
  }, [submissions, isMengetikGroup])

  const handleDownload = async (pengumpulanId, namaFile) => {
    try {
      const res = await apiRequest(`/api/pengumpulan/download/${pengumpulanId}`)
      if (!res.ok) throw new Error('Gagal mengunduh file.')
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = namaFile || 'file'
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (e) {
      console.error('Download failed:', e)
    }
  }

  const handleExport = async () => {
    if (!selectedGroup) return
    try {
      const endpoint = isMengetikGroup
        ? (selectedGroup.batchId
          ? `/api/pengumpulan-mengetik/export-batch/${selectedGroup.batchId}`
          : `/api/pengumpulan-mengetik/export/${selectedGroup.rows[0].id}`)
        : selectedGroup.batchId
        ? `/api/pengumpulan/export-batch/${selectedGroup.batchId}`
        : `/api/pengumpulan/export/${selectedGroup.rows[0].id}`
      const res = await apiRequest(endpoint)
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `rekap-pengumpulan.xlsx`
      document.body.appendChild(a)
      a.click()
      a.remove()
      window.URL.revokeObjectURL(url)
    } catch (e) {
      console.error('Export failed:', e)
    }
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800">Daftar Pengumpulan</h1>
        <p className="text-gray-500 mt-1">Pantau status pengerjaan tugas oleh siswa</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center flex-wrap gap-4">
          <div className="flex items-center gap-4">
            <select
              value={selectedKey}
              onChange={(e) => setSelectedKey(e.target.value)}
              className="border border-gray-200 rounded-xl px-4 py-2 bg-white text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500 min-w-[260px]"
            >
              <option value="">Pilih Tugas</option>
              {groups.map(g => <option key={g.key} value={g.key}>{g.label}</option>)}
            </select>
            <button
              onClick={fetchStatus}
              className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition"
              title="Refresh Data"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <button
            onClick={handleExport}
            disabled={!selectedKey || loading}
            className="bg-green-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-green-700 transition flex items-center gap-2 shadow-lg shadow-green-100 disabled:opacity-50"
          >
            <FileSpreadsheet className="w-4 h-4" /> Download Rekap (Excel)
          </button>
        </div>

        {selectedKey && !loading && submissions.length > 0 && (
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
            <div className="flex justify-between text-sm mb-2">
              <span className="font-medium text-gray-600">Progres Pengumpulan (Kelas + Rombel ini)</span>
              <span className="font-bold text-blue-600">{progress.percent}% ({progress.collected}/{progress.total} siswa)</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div className="bg-blue-500 h-2.5 rounded-full transition-all" style={{ width: `${progress.percent}%` }}></div>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50 text-gray-500 text-[10px] font-bold uppercase tracking-widest border-b border-gray-100">
                <th className="px-6 py-4">Nama</th>
                <th className="px-6 py-4">Kelas</th>
                <th className="px-6 py-4">Status</th>
                {isMengetikGroup ? (
                  <>
                    <th className="px-6 py-4">Waktu</th>
                    <th className="px-6 py-4 text-right">Kebenaran</th>
                    <th className="px-6 py-4 text-right">Kecepatan</th>
                    <th className="px-6 py-4 text-right">Total</th>
                  </>
                ) : (
                  <>
                    <th className="px-6 py-4">Jam Upload</th>
                    <th className="px-6 py-4">Nama File</th>
                    <th className="px-6 py-4">Ukuran</th>
                  </>
                )}
                <th className="px-6 py-4">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 text-sm">
              {loading ? (
                <tr>
                  <td colSpan={isMengetikGroup ? 8 : 7} className="px-6 py-10 text-center text-gray-400 font-medium">Memuat data pengumpulan...</td>
                </tr>
              ) : submissions.length === 0 ? (
                <tr>
                  <td colSpan={isMengetikGroup ? 8 : 7} className="px-6 py-10 text-center text-gray-400 font-medium">Belum ada data untuk tugas ini.</td>
                </tr>
              ) : isMengetikGroup ? (
                submissions.map((sub) => (
                  <tr key={`${sub.tugasId || ''}-${sub.siswaId}`} className="hover:bg-gray-50 transition group">
                    <td className="px-6 py-4 font-bold text-gray-800">{sub.nama}</td>
                    <td className="px-6 py-4 text-gray-600 font-medium">{sub.kelas}{sub.rombel}</td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider border ${
                        sub.status === 'selesai' ? 'bg-green-50 text-green-600 border-green-100'
                          : sub.status === 'mengerjakan' ? 'bg-yellow-50 text-yellow-600 border-yellow-100 animate-pulse'
                          : 'bg-red-50 text-red-600 border-red-100'
                      }`}>
                        {sub.status === 'selesai' ? <CheckCircle className="w-3 h-3" /> : <XCircle className="w-3 h-3" />}
                        {sub.status === 'selesai' ? 'Selesai' : sub.status === 'mengerjakan' ? 'Mengerjakan' : 'Belum Mulai'}
                      </span>
                      {sub.peringkatKecepatan === 1 && <Trophy className="inline w-3.5 h-3.5 text-yellow-500 ml-1" />}
                    </td>
                    <td className="px-6 py-4 text-gray-500">{formatDurasi(sub.durasiDetik)}</td>
                    <td className="px-6 py-4 text-right text-gray-700">{sub.status === 'selesai' ? sub.skorKebenaran : '-'}</td>
                    <td className="px-6 py-4 text-right text-gray-700">{sub.status === 'selesai' ? sub.skorKecepatan : '-'}</td>
                    <td className="px-6 py-4 text-right font-bold text-blue-600">{sub.status === 'selesai' ? sub.skorTotal : '-'}</td>
                    <td className="px-6 py-4">
                      {sub.status === 'selesai' && (
                        <button
                          type="button"
                          onClick={() => setPreviewHasil(sub)}
                          className="p-2 text-gray-500 hover:bg-gray-200 rounded-lg transition flex items-center justify-center w-fit"
                          title="Lihat hasil ketikan"
                        >
                          <Eye className="w-4 h-4" />
                        </button>
                      )}
                    </td>
                  </tr>
                ))
              ) : (
                submissions.map((sub) => (
                  <tr key={`${sub.tugasId || ''}-${sub.siswaId || sub.id}`} className="hover:bg-gray-50 transition group">
                    <td className="px-6 py-4 font-bold text-gray-800">{sub.nama}</td>
                    <td className="px-6 py-4 text-gray-600 font-medium">{sub.kelas}{sub.rombel}</td>
                    <td className="px-6 py-4">
                      {sub.sudahUpload ? (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-green-50 text-green-600 uppercase tracking-wider border border-green-100">
                          <CheckCircle className="w-3 h-3" /> Sudah
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[10px] font-bold bg-red-50 text-red-600 uppercase tracking-wider border border-red-100">
                          <XCircle className="w-3 h-3" /> Belum
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-500">{sub.jamUpload ? new Date(sub.jamUpload).toLocaleTimeString('id-ID') : '-'}</td>
                    <td className="px-6 py-4 text-gray-500 truncate max-w-[150px]" title={sub.namaFile}>{sub.namaFile || '-'}</td>
                    <td className="px-6 py-4 text-gray-500">{sub.ukuran ? `${(sub.ukuran / 1024).toFixed(1)} KB` : '-'}</td>
                    <td className="px-6 py-4">
                      {sub.sudahUpload && sub.pengumpulanId && (
                        <div className="flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setPreviewFile(sub)}
                            className="p-2 text-gray-500 hover:bg-gray-200 rounded-lg transition flex items-center justify-center w-fit"
                            title="Pratinjau File"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDownload(sub.pengumpulanId, sub.namaFile)}
                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition flex items-center justify-center w-fit"
                            title="Download File"
                          >
                            <Download className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {previewHasil && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-start justify-center pt-10 px-4 overflow-y-auto" onClick={() => setPreviewHasil(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl p-8 relative mb-10" onClick={(e) => e.stopPropagation()}>
            <button type="button" onClick={() => setPreviewHasil(null)} className="absolute top-4 right-4 text-gray-400 hover:text-gray-700">
              <X className="w-6 h-6" />
            </button>
            <h2 className="text-lg font-bold text-gray-800 mb-1">Hasil Ketik: {previewHasil.nama}</h2>
            <p className="text-sm text-gray-500 mb-4">
              Waktu: {formatDurasi(previewHasil.durasiDetik)} &middot; Skor: {previewHasil.skorKebenaran} + {previewHasil.skorKecepatan} = <span className="font-bold text-blue-600">{previewHasil.skorTotal}</span>
            </p>
            <div
              className="border border-gray-200 rounded-xl px-5 py-4 leading-relaxed text-gray-800 max-h-[50vh] overflow-y-auto"
              dangerouslySetInnerHTML={{ __html: previewHasil.hasilKetik || '<p class="text-gray-400">Tidak ada hasil.</p>' }}
            />
          </div>
        </div>
      )}

      {previewFile && (
        <FilePreviewModal
          title={`File: ${previewFile.nama}`}
          namaFile={previewFile.namaFile}
          viewUrl={`/api/pengumpulan/view/${previewFile.pengumpulanId}`}
          previewHtmlUrl={`/api/pengumpulan/preview-html/${previewFile.pengumpulanId}`}
          downloadUrl={`/api/pengumpulan/download/${previewFile.pengumpulanId}`}
          onClose={() => setPreviewFile(null)}
        />
      )}
    </div>
  )
}

export default PengumpulanPage
