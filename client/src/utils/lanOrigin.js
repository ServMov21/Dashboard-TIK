import { useState, useEffect } from 'react'
import { apiRequest } from './api'

// Origin yang aman dipakai untuk share link, QR code, dsb. Kalau aplikasi dibuka
// lewat "localhost"/"127.0.0.1" (umum kalau guru menjalankan langsung di
// komputer server), origin otomatis diganti ke alamat IP LAN komputer itu,
// supaya link yang dibagikan ke siswa benar-benar bisa diakses dari perangkat
// lain -- bukan "localhost" yang cuma berarti "perangkat siswa itu sendiri".
export function useLanOrigin() {
  const [origin, setOrigin] = useState(window.location.origin)

  useEffect(() => {
    const hostname = window.location.hostname
    // Sudah diakses lewat IP/hostname LAN yang sebenarnya -> origin saat ini sudah benar.
    if (hostname !== 'localhost' && hostname !== '127.0.0.1') return

    let cancelled = false
    apiRequest('/api/system/network-info')
      .then((res) => res.json())
      .then((data) => {
        if (cancelled || !data?.primaryLanIp) return
        const port = data.port || window.location.port
        setOrigin(`http://${data.primaryLanIp}${port ? ':' + port : ''}`)
      })
      .catch(() => {
        // Kalau gagal mengambil info jaringan, biarkan pakai origin saat ini (localhost)
        // supaya UI tidak rusak; guru tetap bisa lihat peringatan lewat isLocalhost di bawah.
      })

    return () => { cancelled = true }
  }, [])

  return { origin, isLocalhost: window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1' }
}
