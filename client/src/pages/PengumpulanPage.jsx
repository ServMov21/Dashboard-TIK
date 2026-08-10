import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react'
import { io } from 'socket.io-client'
import { apiRequest } from '../utils/api'
import { Download, CheckCircle, XCircle, FileSpreadsheet, RefreshCw, Eye, X, Trophy } from 'lucide-react'
import { formatDurasi } from '../utils/typingScore'
import FilePreviewModal from '../components/FilePreviewModal'

const parseTargets = (t) => {
  const kelas = Array.isArray(t.kelasTarget) ? t.kelasTarget : JSON.parse(t.kelasTarget || '[]')
  const rombel = t.rombelTarget ? (Array.isArray(t.rombelTarget) ? t.rombelTarget : JSON.parse(t.rombelTarget || '[]')) : []
  return { kelas, rombel }
}

const findMatchedRows = (list, judul, kelas, rombel) => {
  if (!judul) return []
  return list.filter(t => {
    if (t.judul !== judul) return false
    const tgt = parseTargets(t)
    if (kelas && !tgt.kelas.includes(kelas)) return false
    if (rombel && !tgt.rombel.includes(rombel)) return false
    return true
  })
}

const PengumpulanPage = () => {
  const [tugasList, setTugasList] = useState([])
  const [selectedJudul, setSelectedJudul] = useState('')
  const [filterKelas, setFilterKelas] = useState('')
  const [filterRombel, setFilterRombel] = useState('')
  const [submissions, setSubmissions] = useState([])
  const [loading, setLoading] = useState(false)
  const [previewHasil, setPreviewHasil] = useState(null)
  const [previewFile, setPreviewFile] = useState(null)
  const socketRef = useRef(null)
  const matchedRowsRef = useRef([])

  // Derived lists
  const judulList = useMemo(() => {
    const seen = new Set()
    return tugasList.reduce((acc, t) => {
      if (!seen.has(t.judul)) { seen.add(t.judul); acc.push(t.judul) }
      return acc
    }, [])
  }, [tugasList])

  const kelasList = useMemo(() => {
    const set = new Set()
    tugasList.filter(t => t.judul === selectedJudul).forEach(t => {
      parseTargets(t).kelas.forEach(k => set.add(k))
    })
    return [...set].sort()
  }, [selectedJudul, tugasList])

  const rombelList = useMemo(() => {
    if (!filterKelas) return []
    const set = new Set()
    tugasList.filter(t => t.judul === selectedJudul).forEach(t => {
      const tgt = parseTargets(t)
      if (tgt.kelas.includes(filterKelas)) tgt.rombel.forEach(r => set.add(r))
    })
    return [...set].sort()
  }, [selectedJudul, filterKelas, tugasList])

  const matchedRows = useMemo(() =>
    findMatchedRows(tugasList, selectedJudul, filterKelas, filterRombel),
    [tugasList, selectedJudul, filterKelas, filterRombel]
  )

  const isMengetik = matchedRows.length > 0 && matchedRows.every(r => r.jenis === 'mengetik')
  const isNotAssigned = !!(selectedJudul && filterKelas && matchedRows.length === 0)

  useEffect(() => { matchedRowsRef.current = matchedRows }, [matchedRows])

  // --- Fetch helpers ---
  const doFetch = useCallback(async (rows) => {
    if (!rows || rows.length === 0) { setSubmissions([]); return }
    setLoading(true)
    try {
      let allData = []
      const mengetik = rows.every(r => r.jenis === 'mengetik')
      for (const row of rows) {
        const endpoint = mengetik
          ? `/api/pengumpulan-mengetik/status/${row.id}`
          : `/api/pengumpulan/status/${row.id}`
        const res = await apiRequest(endpoint)
        const json = await res.json()
        const arr = Array.isArray(json) ? json : (json?.siswa || [])
        allData = allData.concat(arr)
      }
      setSubmissions(allData)
    } catch (e) { console.error(e) }
    finally { setLoading(false) }
  }, [])

  // --- Handlers (no cascading effects) ---
  const handleJudulChange = (judul) => {
    setSelectedJudul(judul)
    setFilterKelas('')
    setFilterRombel('')
    const rows = findMatchedRows(tugasList, judul, '', '')
    doFetch(rows)
  }

  const handleKelasChange = (kelas) => {
    setFilterKelas(kelas)
    setFilterRombel('')
    const rows = findMatchedRows(tugasList, selectedJudul, kelas, '')
    doFetch(rows)
  }

  const handleRombelChange = (rombel) => {
    setFilterRombel(rombel)
    const rows = findMatchedRows(tugasList, selectedJudul, filterKelas, rombel)
    doFetch(rows)
  }

  const handleRefresh = () => doFetch(matchedRows)

  // --- Init ---
  useEffect(() => {
    const init = async () => {
      try {
        const res = await apiRequest('/api/tugas')
        const data = await res.json()
        setTugasList(data)
        if (data.length > 0) {
          const firstJudul = data[0].judul
          setSelectedJudul(firstJudul)
          const rows = findMatchedRows(data, firstJudul, '', '')
          doFetch(rows)
        }
      } catch (e) { console.error(e) }
    }
    init()
  }, [doFetch])

  // Socket auto-refresh
  useEffect(() => {
    socketRef.current = io(window.location.origin, { transports: ['websocket', 'polling'] })
    const socket = socketRef.current
    const handleUpdate = (data) => {
      const rows = matchedRowsRef.current
      if (rows.length > 0 && data?.tugasId && rows.some(r => r.id === data.tugasId)) doFetch(rows)
    }
    socket.on('pengumpulan-baru', handleUpdate)
    socket.on('pengumpulan-update', handleUpdate)
    socket.on('pengumpulan-mengetik-update', handleUpdate)
    return () => { socket.disconnect(); socketRef.current = null }
  }, [doFetch])

  // --- Progress ---
  const progress = useMemo(() => {
    const total = submissions.length
    const collected = isMengetik
      ? submissions.filter(s => s.status === 'selesai').length
      : submissions.filter(s => s.sudahUpload).length
    const percent = total > 0 ? Math.round((collected / total) * 100) : 0
    return { total, collected, percent }
  }, [submissions, isMengetik])

  // --- Download & Export ---
  const handleDownload = async (pengumpulanId, namaFile) => {
    try {
      const res = await apiRequest(`/api/pengumpulan/download/${pengumpulanId}`)
      if (!res.ok) throw new Error('Gagal mengunduh file.')
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = namaFile || 'file'
      document.body.appendChild(a); a.click(); a.remove()
      window.URL.revokeObjectURL(url)
    } catch (e) { console.error('Download failed:', e) }
  }

  const handleExport = async () => {
    if (matchedRows.length === 0) return
    try {
      // If all matched rows share a batchId, use batch export
      const batchId = matchedRows[0]?.batchId
      const allSameBatch = batchId && matchedRows.every(r => r.batchId === batchId)
      let endpoint
      if (allSameBatch) {
        endpoint = isMengetik
          ? `/api/pengumpulan-mengetik/export-batch/${batchId}`
          : `/api/pengumpulan/export-batch/${batchId}`
      } else {
        endpoint = isMengetik
          ? `/api/pengumpulan-mengetik/export/${matchedRows[0].id}`
          : `/api/pengumpulan/export/${matchedRows[0].id}`
      }
      const res = await apiRequest(endpoint)
      const blob = await res.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url; a.download = 'rekap-pengumpulan.xlsx'
      document.body.appendChild(a); a.click(); a.remove()
      window.URL.revokeObjectURL(url)
    } catch (e) { console.error('Export failed:', e) }
  }

  // --- Render ---
  const filterLabel = filterKelas
    ? (filterRombel ? `Kelas ${filterKelas}-${filterRombel}` : `Kelas ${filterKelas}`)
    : 'Semua Kelas'

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800">Daftar Pengumpulan</h1>
        <p className="text-gray-500 mt-1">Pantau status pengerjaan tugas oleh siswa</p>
      </div>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center flex-wrap gap-4">
          <div className="flex items-center gap-3 flex-wrap">
            {/* Dropdown Judul */}
            <select
              value={selectedJudul}
              onChange={(e) => handleJudulChange(e.target.value)}
              className="border border-gray-200 rounded-xl px-4 py-2 bg-white text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500 min-w-[200px]"
            >
              <option value="">Pilih Tugas</option>
              {judulList.map(j => <option key={j} value={j}>{j}</option>)}
            </select>

            {/* Filter Kelas */}
            {selectedJudul && kelasList.length > 0 && (
              <select
                value={filterKelas}
                onChange={(e) => handleKelasChange(e.target.value)}
                className="border border-gray-200 rounded-xl px-4 py-2 bg-white text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Semua Kelas</option>
                {kelasList.map(k => <option key={k} value={k}>Kelas {k}</option>)}
              </select>
            )}

            {/* Filter Rombel */}
            {filterKelas && rombelList.length > 0 && (
              <select
                value={filterRombel}
                onChange={(e) => handleRombelChange(e.target.value)}
                className="border border-gray-200 rounded-xl px-4 py-2 bg-white text-sm font-medium outline-none focus:ring-2 focus:ring-blue-500"
              >
                <option value="">Semua Rombel</option>
                {rombelList.map(r => <option key={r} value={r}>Rombel {r}</option>)}
              </select>
            )}

            <button
              onClick={handleRefresh}
              className="p-2 text-gray-400 hover:text-blue-500 hover:bg-blue-50 rounded-xl transition"
              title="Refresh Data"
            >
              <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            </button>
          </div>
          <button
            onClick={handleExport}
            disabled={matchedRows.length === 0 || loading}
            className="bg-green-600 text-white px-5 py-2.5 rounded-xl text-sm font-bold hover:bg-green-700 transition flex items-center gap-2 shadow-lg shadow-green-100 disabled:opacity-50"
          >
            <FileSpreadsheet className="w-4 h-4" /> Download Rekap (Excel)
          </button>
        </div>

        {/* Not assigned message */}
        {isNotAssigned && (
          <div className="px-6 py-12 text-center">
            <div className="text-4xl mb-3">🚫</div>
            <p className="text-gray-500 font-semibold text-lg">
              JUDUL TUGAS '{selectedJudul}' TIDAK DIBERIKAN UNTUK KELAS {filterKelas}{filterRombel ? `-${filterRombel}` : ''}
            </p>
          </div>
        )}

        {/* Progress bar */}
        {!isNotAssigned && selectedJudul && !loading && submissions.length > 0 && (
          <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/50">
            <div className="flex justify-between text-sm mb-2">
              <span className="font-medium text-gray-600">Progres Pengumpulan ({filterLabel})</span>
              <span className="font-bold text-blue-600">{progress.percent}% ({progress.collected}/{progress.total} siswa)</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2.5">
              <div className="bg-blue-500 h-2.5 rounded-full transition-all" style={{ width: `${progress.percent}%` }}></div>
            </div>
          </div>
        )}

        {/* Table */}
        {!isNotAssigned && (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-gray-50 text-gray-500 text-[10px] font-bold uppercase tracking-widest border-b border-gray-100">
                  <th className="px-6 py-4">Nama</th>
                  <th className="px-6 py-4">Kelas</th>
                  <th className="px-6 py-4">Status</th>
                  {isMengetik ? (
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
                    <td colSpan={isMengetik ? 8 : 7} className="px-6 py-10 text-center text-gray-400 font-medium">Memuat data pengumpulan...</td>
                  </tr>
                ) : submissions.length === 0 ? (
                  <tr>
                    <td colSpan={isMengetik ? 8 : 7} className="px-6 py-10 text-center text-gray-400 font-medium">Belum ada data untuk tugas ini.</td>
                  </tr>
                ) : isMengetik ? (
                  submissions.map((sub) => (
                    <tr key={`${sub.tugasId || ''}-${sub.siswaId}`} className="hover:bg-gray-50 transition group">
                      <td className="px-6 py-4 font-bold text-gray-800">{sub.nama}</td>
                      <td className="px-6 py-4 text-gray-600 font-medium">{sub.kelas}-{sub.rombel}</td>
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
                          <button type="button" onClick={() => setPreviewHasil(sub)}
                            className="p-2 text-gray-500 hover:bg-gray-200 rounded-lg transition flex items-center justify-center w-fit" title="Lihat hasil ketikan">
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
                      <td className="px-6 py-4 text-gray-600 font-medium">{sub.kelas}-{sub.rombel}</td>
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
                            <button type="button" onClick={() => setPreviewFile(sub)}
                              className="p-2 text-gray-500 hover:bg-gray-200 rounded-lg transition flex items-center justify-center w-fit" title="Pratinjau File">
                              <Eye className="w-4 h-4" />
                            </button>
                            <button type="button" onClick={() => handleDownload(sub.pengumpulanId, sub.namaFile)}
                              className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition flex items-center justify-center w-fit" title="Download File">
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
        )}
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
