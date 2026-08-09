import express from 'express'
import os from 'os'

const router = express.Router()

const POLA_ADAPTER_VIRTUAL = /vethernet|virtual|vmware|virtualbox|hyper-v|docker|wsl|tailscale|zerotier|radmin|npcap|loopback|vpn|tap-|tun\d/i

function getLanAddresses() {
  const all = []
  for (const [nama, networks] of Object.entries(os.networkInterfaces())) {
    for (const network of networks || []) {
      if (network && network.family === 'IPv4' && !network.internal) {
        all.push({ nama, address: network.address, virtual: POLA_ADAPTER_VIRTUAL.test(nama) })
      }
    }
  }
  // Prioritaskan adapter non-virtual (WiFi/LAN fisik)
  const fisik = all.filter(n => !n.virtual)
  return fisik.length > 0 ? fisik.map(n => n.address) : all.map(n => n.address)
}

// Info jaringan server: dipakai frontend supaya link yang dibagikan ke siswa
// (Quick Share, File Sharing, dsb) berupa alamat IP LAN, bukan "localhost" --
// karena "localhost" di komputer guru tidak berarti apa-apa buat perangkat lain.
router.get('/network-info', (req, res) => {
  const lanAddresses = getLanAddresses()
  res.json({
    port: process.env.PORT || 5000,
    lanAddresses,
    primaryLanIp: lanAddresses[0] || null,
  })
})

export default router
