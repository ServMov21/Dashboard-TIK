import express from 'express'
import os from 'os'

const router = express.Router()

function getLanAddresses() {
  return Object.values(os.networkInterfaces())
    .flat()
    .filter((network) => network && network.family === 'IPv4' && !network.internal)
    .map((network) => network.address)
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
