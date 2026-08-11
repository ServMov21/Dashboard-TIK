export const DEFAULT_TITLE_CONFIG = [
  { level: 1,  name: 'ROOKIE',    emoji: '🌱', xpMin: 0,    xpMax: 399,    minTugas: 0  },
  { level: 2,  name: 'SCOUT',     emoji: '🎯', xpMin: 400,  xpMax: 899,    minTugas: 0  },
  { level: 3,  name: 'EXPLORER',  emoji: '🚀', xpMin: 900,  xpMax: 1499,   minTugas: 0  },
  { level: 4,  name: 'GUARDIAN',  emoji: '🛡️', xpMin: 1500, xpMax: 2099,   minTugas: 0  },
  { level: 5,  name: 'RANGER',    emoji: '🏹', xpMin: 2100, xpMax: 2699,   minTugas: 0  },
  { level: 6,  name: 'WARRIOR',   emoji: '⚔️',  xpMin: 2700, xpMax: 3299,   minTugas: 15 },
  { level: 7,  name: 'COMMANDER', emoji: '🛡️', xpMin: 3300, xpMax: 3899,   minTugas: 20 },
  { level: 8,  name: 'ELITE',     emoji: '⚡', xpMin: 3900, xpMax: 4499,   minTugas: 25 },
  { level: 9,  name: 'MASTER',    emoji: '💎', xpMin: 4500, xpMax: 4999,   minTugas: 30 },
  { level: 10, name: 'LEGEND',    emoji: '👑', xpMin: 5000, xpMax: 999999, minTugas: 35 },
]

export async function getXpConfig(prisma) {
  try {
    let cfg = await prisma.xpSetting.findFirst()
    if (!cfg) cfg = await prisma.xpSetting.create({ data: {} })
    let titleConfig = DEFAULT_TITLE_CONFIG
    try { const p = JSON.parse(cfg.titleConfig); if (Array.isArray(p) && p.length) titleConfig = p } catch {}
    return { ...cfg, titleConfig }
  } catch {
    return { xpBase:80, xpNilai70:20, xpNilai80:40, xpNilai90:70, xpNilai100:100, xpEarly:25, xpPerfect:70, xpBonusMax:20, xpPenaltiTidakKumpul:-50, titleConfig: DEFAULT_TITLE_CONFIG }
  }
}

export function computeXpComponents(cfg, { nilai, deadline, waktuKumpul }) {
  let xpNilai = 0, xpEarly = 0, xpPerfect = 0
  if (nilai !== null && nilai !== undefined && nilai >= 0) {
    if (nilai >= 100)     { xpNilai = cfg.xpNilai100; xpPerfect = cfg.xpPerfect }
    else if (nilai >= 90) { xpNilai = cfg.xpNilai90 }
    else if (nilai >= 80) { xpNilai = cfg.xpNilai80 }
    else if (nilai >= 70) { xpNilai = cfg.xpNilai70 }
    if (deadline && waktuKumpul && new Date(waktuKumpul) < new Date(deadline)) xpEarly = cfg.xpEarly
  }
  return { xpNilai, xpEarly, xpPerfect }
}

// Terapkan penalti XP (default -50) ke siswa target tugas yang tidak
// mengumpulkan/tidak mengerjakan tugas. Dipanggil saat guru menutup tugas.
// Aman dipanggil berulang kali: memakai constraint unik [siswaId, tugasId]
// pada XpPenalti sehingga tidak akan menduplikasi penalti untuk tugas yang sama.
export async function applyPenaltiTidakKumpul(prisma, tugas) {
  if (!tugas) return { applied: 0 }
  try {
    let kelasTarget = []
    try { kelasTarget = JSON.parse(tugas.kelasTarget || '[]') } catch { kelasTarget = [] }
    let rombelTarget = []
    try { rombelTarget = tugas.rombelTarget ? JSON.parse(tugas.rombelTarget || '[]') : [] } catch { rombelTarget = [] }

    const siswaTarget = await prisma.siswa.findMany({
      where: {
        ...(kelasTarget.length ? { kelas: { in: kelasTarget } } : {}),
        ...(rombelTarget.length ? { rombel: { in: rombelTarget } } : {}),
      },
      select: { id: true },
    })
    if (!siswaTarget.length) return { applied: 0 }

    let sudahIds = new Set()
    if (tugas.jenis === 'mengetik') {
      const done = await prisma.pengumpulanMengetik.findMany({
        where: { tugasId: tugas.id, status: 'selesai' }, select: { siswaId: true },
      })
      sudahIds = new Set(done.map(d => d.siswaId))
    } else {
      const done = await prisma.pengumpulan.findMany({ where: { tugasId: tugas.id }, select: { siswaId: true } })
      sudahIds = new Set(done.map(d => d.siswaId))
    }

    const xpCfg = await getXpConfig(prisma)
    const penaltiXp = xpCfg.xpPenaltiTidakKumpul ?? -50
    const belum = siswaTarget.filter(s => !sudahIds.has(s.id))

    let applied = 0
    for (const s of belum) {
      // Logic baru: cek status kehadiran dan aktivitas buka tugas
      const sudahBuka = await prisma.aktivitasSiswa.findFirst({
        where: { siswaId: s.id, tugasId: tugas.id, jenis: 'BUKA_TUGAS' }
      })
      if (sudahBuka) {
        // Sudah buka tugas tapi tidak mengumpulkan, tetap penalti
      } else {
        // Belum pernah buka, cek kehadiran di rentang publish - close
        const absen = await prisma.kehadiran.findFirst({
          where: {
            siswaId: s.id,
            tanggal: { gte: tugas.publishedAt || new Date(0), lte: tugas.closedAt || new Date() },
            status: { in: ['IZIN', 'SAKIT'] }
          }
        })
        if (absen) continue // Aman, lewati
      }

      try {
        await prisma.xpPenalti.upsert({
          where: { siswaId_tugasId: { siswaId: s.id, tugasId: tugas.id } },
          update: {},
          create: {
            siswaId: s.id, tugasId: tugas.id, xp: penaltiXp,
            keterangan: `Tidak mengumpulkan/tidak mengerjakan tugas "${tugas.judul}"`,
          },
        })
        applied++
      } catch { /* sudah pernah diterapkan, lewati */ }
    }
    return { applied }
  } catch {
    return { applied: 0 }
  }
}

export function getTitleFromXP(totalXP, tasksCompleted = 0, titleConfig = DEFAULT_TITLE_CONFIG) {
  for (let i = titleConfig.length - 1; i >= 0; i--) {
    const t = titleConfig[i]
    if (totalXP >= (t.xpMin ?? 0) && tasksCompleted >= (t.minTugas ?? 0)) return t
  }
  return titleConfig[0]
}
