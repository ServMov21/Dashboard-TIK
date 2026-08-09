import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import { createServer } from 'http'
import { Server } from 'socket.io'
import os from 'os'
import apiRoutes from './routes/index.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const httpServer = createServer(app)

// Aplikasi ini dipakai di jaringan LAN sekolah, diakses lewat berbagai alamat
// (localhost di komputer guru, IP LAN seperti 192.168.x.x dari komputer/HP siswa,
// dst). Membatasi CORS ke satu origin tetap (mis. hanya "http://localhost:5000")
// akan membuat Socket.IO ditolak setiap kali diakses lewat alamat lain -- gejalanya
// bisa terlihat seperti "tidak bisa konek" padahal sebenarnya cuma origin-nya beda.
// Karena ini aplikasi internal (bukan diekspos ke internet), aman untuk
// mengizinkan origin apa pun di sini.
const corsOptions = {
  origin: true, // reflect origin pengirim request, bukan dibatasi 1 alamat tetap
  credentials: true,
}

const io = new Server(httpServer, {
  cors: corsOptions,
})

const PORT = process.env.PORT || 5000
const HOST = process.env.HOST || '0.0.0.0'
const clientDistPath = path.resolve(__dirname, '../client/dist')

app.use(cors(corsOptions))
app.use(express.json({ limit: '20mb' }))
app.use(express.urlencoded({ extended: true, limit: '20mb' }))

app.set('io', io)
app.use('/api', apiRoutes)
app.use(express.static(clientDistPath))

app.get('*', (req, res) => {
  res.sendFile(path.join(clientDistPath, 'index.html'))
})

io.on('connection', (socket) => {
  socket.emit('connected', { message: 'Terhubung ke Dashboard TIK' })
})

// Pola nama adapter yang BIASANYA virtual (Docker, WSL2, Hyper-V, VMware,
// VirtualBox, VPN, dll) dan tidak bisa dijangkau perangkat lain di
// WiFi/LAN fisik yang sama. Kalau siswa memakai IP dari adapter semacam ini,
// browser akan menampilkan "ERR_ADDRESS_UNREACHABLE" karena IP itu memang
// hanya hidup di dalam komputer server sendiri.
const POLA_ADAPTER_VIRTUAL = /vethernet|virtual|vmware|virtualbox|hyper-v|docker|wsl|tailscale|zerotier|radmin|npcap|loopback|vpn|tap-|tun\d/i

function getLanAddresses() {
  const semua = []
  for (const [nama, networks] of Object.entries(os.networkInterfaces())) {
    for (const network of networks || []) {
      if (network && network.family === 'IPv4' && !network.internal) {
        semua.push({ nama, address: network.address, kemungkinanVirtual: POLA_ADAPTER_VIRTUAL.test(nama) })
      }
    }
  }
  return {
    disarankan: semua.filter((n) => !n.kemungkinanVirtual),
    lainnya: semua.filter((n) => n.kemungkinanVirtual),
  }
}

httpServer.listen(PORT, HOST, () => {
  const { disarankan, lainnya } = getLanAddresses()

  console.log('\n===============================================')
  console.log(' Dashboard Guru TIK berhasil berjalan')
  console.log('===============================================')
  console.log(`Komputer Guru : http://localhost:${PORT}`)

  if (disarankan.length) {
    console.log('\nAkses dari komputer/HP siswa di jaringan Wi-Fi/LAN yang SAMA (disarankan):')
    disarankan.forEach(({ nama, address }) => {
      console.log(`  http://${address}:${PORT}   (adapter: ${nama})`)
    })
  } else {
    console.log('\nIP Wi-Fi/LAN belum terdeteksi. Pastikan Wi-Fi/LAN tersambung.')
  }

  if (lainnya.length) {
    console.log('\nAlamat lain yang terdeteksi (BIASANYA BUKAN untuk siswa - adapter virtual')
    console.log('seperti Docker/WSL/Hyper-V/VMware/VPN, hanya bisa diakses dari komputer ini sendiri):')
    lainnya.forEach(({ nama, address }) => {
      console.log(`  http://${address}:${PORT}   (adapter: ${nama})`)
    })
  }

  console.log('\nSiswa cukup membuka salah satu link "disarankan" di atas lewat browser.')
  console.log('Kalau siswa dapat error "This site can\'t be reached" / ERR_ADDRESS_UNREACHABLE,')
  console.log('biasanya karena memakai alamat dari daftar "Alamat lain" di atas, atau IP-nya sudah berubah.')
  console.log('Tidak perlu install Node.js atau aplikasi apa pun di komputer siswa.')
  console.log('===============================================\n')
})
