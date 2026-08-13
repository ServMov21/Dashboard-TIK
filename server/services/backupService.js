import AdmZip from 'adm-zip'
import fs from 'fs'
import path from 'path'
import { PrismaClient } from '@prisma/client'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const prisma = new PrismaClient()

let autoBackupTimer = null

export async function createBackup(backupDir) {
  if (!backupDir) throw new Error('Backup directory not set')
  if (!fs.existsSync(backupDir)) fs.mkdirSync(backupDir, { recursive: true })

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
  const zipName = `backup-${timestamp}.zip`
  const zipPath = path.join(backupDir, zipName)

  const zip = new AdmZip()
  // Add database
  const dbPath = path.join(__dirname, '../prisma/dev.db')
  if (fs.existsSync(dbPath)) {
    zip.addLocalFile(dbPath)
  } else {
    throw new Error('Database file not found at: ' + dbPath)
  }
  
  // Add storage
  const storagePath = path.join(__dirname, '../storage')
  if (fs.existsSync(storagePath)) {
    zip.addLocalFolder(storagePath, 'storage')
  }

  zip.writeZip(zipPath)
  return zipPath
}

export async function startAutoBackup() {
  const settings = await prisma.pengaturan.findFirst()
  if (settings?.autoBackupEnabled && settings.backupDir) {
    if (autoBackupTimer) clearInterval(autoBackupTimer)
    autoBackupTimer = setInterval(async () => {
      try {
        await createBackup(settings.backupDir)
        console.log('Auto-backup created successfully')
      } catch (err) {
        console.error('Auto-backup failed:', err)
      }
    }, settings.autoBackupIntervalSeconds * 1000)
  } else if (autoBackupTimer) {
    clearInterval(autoBackupTimer)
    autoBackupTimer = null
  }
}

