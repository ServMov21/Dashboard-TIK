import React, { useState, useEffect, useRef } from 'react'
import { FileText, X, ExternalLink, Download as DownloadIcon } from 'lucide-react'
import { apiRequest } from '../utils/api'

const isImg = (n) => n && ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.svg'].some((e) => n.toLowerCase().endsWith(e))
const isPdf = (n) => n && n.toLowerCase().endsWith('.pdf')
const isOffice = (n) => n && ['.doc', '.docx', '.xls', '.xlsx'].some((e) => n.toLowerCase().endsWith(e))

/**
 * Modal preview file, dipakai di halaman guru (Pengumpulan, Detail Tugas) maupun
 * siswa (Rekap Nilai) supaya tidak perlu download dulu untuk melihat isi file.
 * - Gambar & PDF: dirender langsung di browser (blob + <img>/<iframe>).
 * - DOCX & XLSX: dikonversi ke HTML di server (endpoint previewHtmlUrl) lalu
 *   dirender inline, karena browser tidak bisa membuka file office secara native.
 * - Tipe lain: fallback tombol "Buka di Tab Baru" / download.
 *
 * Props:
 *   title        - judul di header modal
 *   namaFile     - nama file (dipakai untuk deteksi tipe & sebagai nama download)
 *   viewUrl      - endpoint streaming file mentah (butuh header Authorization)
 *   previewHtmlUrl - endpoint yang mengembalikan { type, html } untuk docx/xlsx
 *   downloadUrl  - endpoint download (fallback ke viewUrl kalau tidak diisi)
 *   onClose      - callback tutup modal
 */
export default function FilePreviewModal({ title, namaFile, viewUrl, previewHtmlUrl, downloadUrl, onClose }) {
  const [fileUrl, setFileUrl] = useState(null)
  const [officeHtml, setOfficeHtml] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const objectUrlsRef = useRef([])

  const office = isOffice(namaFile)

  useEffect(() => {
    let cancelled = false
    setFileUrl(null)
    setOfficeHtml(null)
    setError('')
    setLoading(true)

    async function load() {
      try {
        if (office && previewHtmlUrl) {
          const res = await apiRequest(previewHtmlUrl)
          const json = await res.json()
          if (!res.ok) throw new Error(json.message || 'Gagal memuat pratinjau file.')
          if (!cancelled) setOfficeHtml(json)
        } else if (viewUrl) {
          const res = await apiRequest(viewUrl)
          if (!res.ok) throw new Error('Gagal memuat file.')
          const blob = await res.blob()
          if (cancelled) return
          const objectUrl = URL.createObjectURL(blob)
          objectUrlsRef.current.push(objectUrl)
          setFileUrl(objectUrl)
        }
      } catch (e) {
        if (!cancelled) setError(e.message || 'Gagal memuat pratinjau.')
      } finally {
        if (!cancelled) setLoading(false)
      }
    }
    load()
    return () => { cancelled = true }
  }, [viewUrl, previewHtmlUrl, office])

  useEffect(() => () => {
    objectUrlsRef.current.forEach((u) => URL.revokeObjectURL(u))
    objectUrlsRef.current = []
  }, [])

  const handleDownload = async () => {
    try {
      const res = await apiRequest(downloadUrl || viewUrl)
      if (!res.ok) throw new Error('Gagal mengunduh file.')
      const blob = await res.blob()
      const objectUrl = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = objectUrl
      a.download = namaFile || 'file'
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(objectUrl)
    } catch (e) {
      alert('Gagal mengunduh file: ' + e.message)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center px-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="min-w-0">
            <h3 className="font-bold text-gray-800 truncate">{title || namaFile}</h3>
            {namaFile && <p className="text-xs text-gray-400 truncate">{namaFile}</p>}
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 ml-4 shrink-0"><X className="w-5 h-5" /></button>
        </div>

        <div className="overflow-auto flex-1 p-6">
          {loading ? (
            <div className="flex items-center justify-center gap-2 py-16 text-gray-400 text-sm">
              <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-500 rounded-full animate-spin" /> Memuat pratinjau...
            </div>
          ) : error ? (
            <div className="text-center py-10">
              <p className="text-red-500 text-sm mb-4">{error}</p>
              <button
                type="button"
                onClick={handleDownload}
                className="inline-flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition"
              >
                <DownloadIcon className="w-4 h-4" /> Download Saja
              </button>
            </div>
          ) : office && officeHtml ? (
            <div
              className="office-preview text-sm text-gray-800 leading-relaxed [&_table]:border-collapse [&_table]:w-full [&_td]:border [&_td]:border-gray-200 [&_td]:px-2 [&_td]:py-1 [&_th]:border [&_th]:border-gray-200 [&_th]:px-2 [&_th]:py-1 [&_th]:bg-gray-50 [&_h4]:font-bold [&_h4]:text-gray-600 [&_h4]:mt-4 [&_h4]:mb-2 [&_img]:max-w-full"
              dangerouslySetInnerHTML={{ __html: officeHtml.html }}
            />
          ) : fileUrl ? (
            isImg(namaFile) ? (
              <img src={fileUrl} alt={namaFile}
                className="max-w-full rounded-xl border border-gray-200 cursor-pointer hover:opacity-90 mx-auto"
                onClick={() => window.open(fileUrl, '_blank')} />
            ) : isPdf(namaFile) ? (
              <iframe src={fileUrl} className="w-full h-[70vh] rounded-xl border border-gray-200" title={namaFile} />
            ) : (
              <div className="flex flex-col items-center justify-center gap-4 py-10 bg-gray-50 rounded-xl border border-gray-200">
                <FileText className="w-14 h-14 text-gray-300" />
                <p className="text-gray-600 font-medium">{namaFile}</p>
                <p className="text-xs text-gray-400">Tipe file ini tidak bisa dipratinjau langsung di browser.</p>
                <button type="button" onClick={() => window.open(fileUrl, '_blank')}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-xl font-medium hover:bg-blue-700 transition">
                  <ExternalLink className="w-4 h-4" /> Buka File
                </button>
              </div>
            )
          ) : (
            <p className="text-gray-400 text-center py-10">Tidak ada file untuk dipratinjau.</p>
          )}
        </div>

        {!loading && !error && (
          <div className="px-6 py-4 border-t border-gray-100 shrink-0 flex gap-2">
            {fileUrl && (
              <button type="button" onClick={() => window.open(fileUrl, '_blank')}
                className="flex-1 flex items-center justify-center gap-2 py-2 bg-gray-100 text-gray-700 rounded-xl text-sm font-medium hover:bg-gray-200 transition">
                <ExternalLink className="w-4 h-4" /> Buka di Tab Baru
              </button>
            )}
            <button type="button" onClick={handleDownload}
              className="flex-1 flex items-center justify-center gap-2 py-2 bg-blue-600 text-white rounded-xl text-sm font-medium hover:bg-blue-700 transition">
              <DownloadIcon className="w-4 h-4" /> Download
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
