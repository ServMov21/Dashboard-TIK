import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

export const JENIS_AKTIVITAS = {
  LOGIN: 'LOGIN',
  BUKA_TUGAS: 'BUKA_TUGAS',
  UPLOAD: 'UPLOAD',
  DOWNLOAD: 'DOWNLOAD',
}

export async function catatAktivitas({ siswaId, tugasId, jenis, deskripsi, io }) {
  try {
    const aktivitas = await prisma.aktivitasSiswa.create({
      data: {
        siswaId,
        tugasId: tugasId || null,
        jenis,
        deskripsi,
      },
      include: {
        siswa: {
          select: { id: true, nama: true, kelas: true, rombel: true }
        },
        tugas: {
          select: { id: true, judul: true }
        }
      }
    })

    // Emit socket event for real-time updates
    if (io) {
      io.emit('aktivitas-baru', aktivitas)
    }

    return aktivitas
  } catch (error) {
    console.error('Gagal mencatat aktivitas:', error)
    return null
  }
}

export async function getAktivitasTerbaru(limit = 10) {
  return prisma.aktivitasSiswa.findMany({
    take: limit,
    orderBy: { createdAt: 'desc' },
    include: {
      siswa: { select: { id: true, nama: true, kelas: true, rombel: true } },
      tugas: { select: { id: true, judul: true } }
    }
  })
}