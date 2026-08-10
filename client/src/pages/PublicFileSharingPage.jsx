import React, { useState, useEffect } from 'react'
import { useParams } from 'react-router-dom'
import { File, Download, AlertTriangle, Loader2, FileImage, FileAudio, FileText, FileSpreadsheet, FileQuestion } from 'lucide-react'
import { apiRequest } from '../utils/api'

const getFileIcon = (fileName) => {
  const ext = fileName.split('.').pop().toLowerCase()
  switch (ext) {
    case 'jpg': case 'jpeg': case 'png': case 'gif': return <FileImage className="w-5 h-5" />
    case 'mp3': case 'wav': return <FileAudio className="w-5 h-5" />
    case 'doc': case 'docx': case 'txt': return <FileText className="w-5 h-5" />
    case 'xls': case 'xlsx': return <FileSpreadsheet className="w-5 h-5" />
    case 'ppt': case 'pptx': return <File className="w-5 h-5" />
    default: return <FileQuestion className="w-5 h-5" />
  }
}

const formatBytes = (bytes) => {
  if (!bytes && bytes !== 0) return '-'
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(1024))
  return `${(bytes / Math.pow(1024, i)).toFixed(1)} ${units[i]}`
}

const PublicFileSharingPage = () => {
  const { shareId } = useParams()
  const [data, setData] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  useEffect(() => { fetchFiles() }, [shareId])

  const fetchFiles = async () => {
    setLoading(true)
    try {
      const res = await apiRequest(`/api/fileshare/public/${shareId}`, { skipAuthRedirect: true })
      if (!res.ok) throw new Error('File tidak ditemukan.')
      setData(await res.json())
    } catch (e) { setError(e.message) }
    finally { setLoading(false) }
  }

  if (loading) return <div className="flex justify-center p-20"><Loader2 className="animate-spin w-10 h-10 text-blue-500" /></div>
  if (error) return <div className="p-8 text-center text-red-500"><AlertTriangle /> {error}</div>

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">{data.title}</h1>
        <p className="text-gray-500 mt-1">{data.files.length} file • {new Date(data.createdAt).toLocaleString('id-ID')}</p>
      </div>
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <ul className="divide-y divide-gray-100">
          {data.files.map((f, idx) => (
            <li key={`${f.name}-${idx}`} className="flex items-center justify-between p-4 hover:bg-gray-50">
              <div className="flex items-center gap-4">
                {getFileIcon(f.name)}
                <div>
                  <p className="font-medium text-gray-800 truncate max-w-xs">{f.name}</p>
                  <p className="text-xs text-gray-400">{formatBytes(f.size)}</p>
                </div>
              </div>
              <a
                href={`/api/fileshare/public/${shareId}/download/${encodeURIComponent(f.name)}`}
                className="px-4 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition flex items-center gap-2"
              >
                <Download className="w-4 h-4" /> Unduh
              </a>
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
export default PublicFileSharingPage
