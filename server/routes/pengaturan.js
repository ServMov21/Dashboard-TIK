import express from 'express'
import { PrismaClient } from '@prisma/client'
import authMiddleware from '../middleware/authMiddleware.js'
import { startAutoBackup } from '../services/backupService.js'
import { exec } from 'child_process'

const prisma = new PrismaClient()
const router = express.Router()

router.get('/', authMiddleware, async (req, res) => {
  if (req.user.role !== 'guru') return res.status(403).json({ message: 'Akses ditolak.' })
  try {
    const peng = await prisma.pengaturan.findFirst() || {}
    res.json(peng)
  } catch (error) {
    res.status(500).json({ message: 'Gagal mengambil pengaturan.', error: error.message })
  }
})

router.put('/', authMiddleware, async (req, res) => {
  if (req.user.role !== 'guru') return res.status(403).json({ message: 'Akses ditolak.' })
  try {
    const data = req.body
    const updated = await prisma.pengaturan.update({
      where: { id: '1' },
      data: {
        namaSekolah: data.namaSekolah,
        alamat: data.alamat,
        baseDir: data.baseDir,
        tema: data.tema,
        jamLogout: parseInt(data.jamLogout),
        submissionFolderPattern: data.submissionFolderPattern,
        duplicateFileHandling: data.duplicateFileHandling,
        backupDir: data.backupDir,
        autoBackupEnabled: data.autoBackupEnabled === undefined ? true : !!data.autoBackupEnabled,
        autoBackupIntervalSeconds: parseInt(data.autoBackupIntervalSeconds) || 10,
      },
    })
    await startAutoBackup()
    res.json(updated)
  } catch (error) {
    res.status(500).json({ message: 'Gagal memperbarui pengaturan.', error: error.message })
  }
})

router.post('/pilih-folder', authMiddleware, async (req, res) => {
  if (req.user.role !== 'guru') return res.status(403).json({ message: 'Akses ditolak.' })
  
  // Deteksi OS dari platform server
  const platform = process.platform
  
  let command = ''
  if (platform === 'darwin') {
    command = "osascript -e 'tell application \"System Events\" to activate' -e 'set folderPath to (choose folder with prompt \"Pilih Folder\") as string' -e 'set posixPath to POSIX path of folderPath' -e 'return posixPath'"
  } else if (platform === 'win32') {
    command = 'powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; $f = New-Object System.Windows.Forms.FolderBrowserDialog; if($f.ShowDialog() -eq \'OK\') { Write-Output $f.SelectedPath }"'
  } else {
    return res.status(501).json({ message: 'Fitur ini hanya didukung di Windows dan macOS.' })
  }

  exec(command, (err, stdout, stderr) => {
    if (err) {
      // Jika user membatalkan (Cancel) di macOS, osascript biasanya mengembalikan error
      if (platform === 'darwin' && err.message.includes('User canceled')) {
        return res.json({ path: null })
      }
      return res.status(500).json({ message: 'Gagal membuka pemilih folder.', error: err.message })
    }
    const selectedPath = stdout.trim()
    res.json({ path: selectedPath || null })
  })
})

export default router
