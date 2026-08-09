import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'

const prisma = new PrismaClient()

async function main() {
  // Seed Pengaturan
  await prisma.pengaturan.upsert({
    where: { id: '1' },
    update: {},
    create: {
      id: '1',
      namaSekolah: 'SMP Negeri Lab TIK',
      baseDir: './storage',
      tema: 'light',
      jamLogout: 60,
    },
  })

  // Seed Guru awal (admin / admin123)
  const salt = await bcrypt.genSalt(10)
  const hashedPassword = await bcrypt.hash('admin123', salt)

  await prisma.guru.upsert({
    where: { username: 'admin' },
    update: {},
    create: {
      username: 'admin',
      password: hashedPassword,
      nama: 'Guru TIK',
    },
  })

  console.log('Seeding data berhasil.')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
