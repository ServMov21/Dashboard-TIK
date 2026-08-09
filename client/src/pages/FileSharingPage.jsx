import React, { useState } from 'react'
import { Upload, Share2, File as FileIcon, Link as LinkIcon, Copy, Trash2 } from 'lucide-react'
import { apiRequest } from '../utils/api'
import { useLanOrigin } from '../utils/lanOrigin'

const FileSharingPage = () => {
  const [files, setFiles] = useState([])
  const [folderName, setFolderName] = useState('FileSharing')
  const [shareLink, setShareLink] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const { origin: lanOrigin } = useLanOrigin()

  const handleFiles = (event) => {
    setFiles(Array.from(event.target.files || []))
  }

  const handleRemove = (index) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (files.length === 0) {
      setError('Pilih minimal 1 file.')
      return
    }
    setLoading(true)
    setError('')
    setShareLink('')

    try {
      const formData = new FormData()
      formData.append('folderName', folderName)
      files.forEach((file) => formData.append('files', file))

      const res = await apiRequest('/api/fileshare/generate', {
        method: 'POST',
        body: formData,
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.message || 'Gagal membuat link sharing.')

      const link = `${lanOrigin}${data.link}`
      setShareLink(link)
    } catch (e) {
      setError(e.message || 'Terjadi kesalahan saat membuat link.')
    } finally {
      setLoading(false)
    }
  }

  const handleCopy = async () => {
    if (!shareLink) return
    try {
      await navigator.clipboard.writeText(shareLink)
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <div className="p-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-800">File Sharing</h1>
        <p className="text-gray-500 mt-1">Bagikan file siswa dengan cepat lewat link internal.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        <form onSubmit={handleSubmit} className="lg:col-span-2 bg-white rounded-2xl p-6 shadow-sm border border-gray-100 space-y-4">
          <h2 className="text-lg font-bold text-gray-800 flex items-center gap-2"><Share2 className="w-5 h-5 text-blue-500" /> Buat Link Sharing</h2>

          <label className="block text-sm font-medium text-gray-700">Nama Folder
            <input type="text" value={folderName} onChange={(e) => setFolderName(e.target.value)} className="w-full mt-1 px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition" placeholder="Misal: Materi Word" />
          </label>

          <label className="block text-sm font-medium text-gray-700">File
            <div className="mt-1 border-2 border-dashed border-gray-200 rounded-2xl p-6 text-center hover:border-blue-300 transition">
              <input type="file" multiple onChange={handleFiles} className="hidden" id="file-sharing-input" />
              <label htmlFor="file-sharing-input" className="cursor-pointer flex flex-col items-center justify-center gap-2">
                <Upload className="w-8 h-8 text-blue-500" />
                <span className="font-medium text-gray-700">Klik untuk pilih file</span>
                <span className="text-xs text-gray-400">Maksimal 20 file, 50MB per file</span>
              </label>
            </div>
          </label>

          {files.length > 0 && (
            <ul className="space-y-2">
              {files.map((file, index) => (
                <li key={`${file.name}-${index}`} className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                  <div className="flex items-center gap-2 truncate">
                    <FileIcon className="w-5 h-5 text-gray-500 flex-shrink-0" />
                    <span className="text-sm text-gray-700 truncate">{file.name}</span>
                    <span className="text-xs text-gray-400">{(file.size / 1024).toFixed(1)} KB</span>
                  </div>
                  <button type="button" onClick={() => handleRemove(index)} className="p-2 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {error && <p className="text-sm text-red-600">{error}</p>}

          <button type="submit" disabled={loading} className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed">
            {loading ? 'Membuat link...' : 'Buat Link Sharing'}
          </button>
        </form>

        <aside className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 h-fit">
          <h3 className="font-bold text-gray-800 mb-3 flex items-center gap-2"><LinkIcon className="w-5 h-5 text-green-500" /> Link Aktif</h3>
          {shareLink ? (
            <div className="space-y-3">
              <div className="p-3 bg-green-50 border border-green-200 rounded-xl text-sm text-green-700 break-all">{shareLink}</div>
              <button type="button" onClick={handleCopy} className="w-full py-2 bg-green-600 text-white rounded-xl font-semibold hover:bg-green-700 transition flex items-center justify-center gap-2">
                <Copy className="w-4 h-4" /> Salin Link
              </button>
            </div>
          ) : (
            <p className="text-sm text-gray-500">Belum ada link. Buat link baru untuk membagikan file.</p>
          )}
        </aside>
      </div>
    </div>
  )
}

export default FileSharingPage
