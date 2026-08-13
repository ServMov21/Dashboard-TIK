import 'dotenv/config'
import express from 'express'
import cors from 'cors'
import path from 'path'
import { fileURLToPath } from 'url'
import { createServer } from 'http'
import { Server } from 'socket.io'
import os from 'os'
import apiRoutes from './routes/index.js'
import { startAutoBackup } from './services/backupService.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const app = express()
const httpServer = createServer(app)

const corsOptions = {
  origin: true,
  credentials: true,
}

const io = new Server(httpServer, {
  cors: corsOptions,
})

const DEFAULT_PORT = process.platform === 'darwin' ? 5001 : 5000
const PORT = Number(process.env.PORT || DEFAULT_PORT)
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

function tampilkanAlamatAkses() {
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

  // Start auto-backup scheduler on server start
  startAutoBackup()
}

httpServer.on('error', (error) => {
  if (error.code === 'EADDRINUSE') {
    console.error(`\nPort ${PORT} sedang dipakai aplikasi lain.`)
    console.error('Tutup aplikasi/server lain yang memakai port itu, atau jalankan dengan PORT berbeda.')
    console.error('Mac contoh: PORT=5002 npm start\n')
    process.exit(1)
  }

  throw error
})

httpServer.listen(PORT, HOST, tampilkanAlamatAkses)

