#!/usr/bin/env tsx
/**
 * Investigate 9 cows that are VACA_LACTACAO in Protos but not in the CSV report.
 */
import { readFileSync } from 'fs';
import { resolve } from 'path';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

async function main() {
  const databaseUrl =
    process.env.DATABASE_URL ??
    `postgresql://${process.env.POSTGRES_USER ?? 'protos'}:${process.env.POSTGRES_PASSWORD ?? 'protos'}@${process.env.POSTGRES_HOST ?? 'localhost'}:${process.env.POSTGRES_PORT ?? '5450'}/${process.env.POSTGRES_DB ?? 'protos_farm'}`;

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });

  try {
    // Build CSV name set
    const csvPath = resolve(__dirname, '../../../../Relatorio_23-03-2026-14-22-24.csv');
    const raw = readFileSync(csvPath, 'latin1');
    const lines = raw.split('\n').filter((l) => l.trim());
    const csvNames = new Set<string>();
    for (let i = 1; i < lines.length; i++) {
      const name = lines[i].split(';')[0]?.trim();
      if (name) csvNames.add(name);
    }

    // Check if they appear anywhere in CSV (any status, not just Lac.)
    const csvAllEntries = new Map<string, string>();
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(';');
      const name = cols[0]?.trim();
      const sitProd = cols[8]?.trim();
      const sitRepro = cols[2]?.trim();
      if (name) csvAllEntries.set(name, `produtiva=${sitProd}, reprodutiva=${sitRepro}`);
    }

    // Get VACA_LACTACAO from Protos not in CSV
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const lactating = await (prisma as any).animal.findMany({
      where: { category: 'VACA_LACTACAO', deletedAt: null },
      select: { id: true, earTag: true, name: true },
    });

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const extras = lactating.filter((a: any) => a.name && !csvNames.has(a.name));
    console.log(`\n${extras.length} vacas VACA_LACTACAO no Protos que não estão no CSV\n`);

    for (const animal of extras) {
      console.log(`${'='.repeat(55)}`);
      console.log(`  ${animal.name} (brinco ${animal.earTag})`);
      console.log(`${'='.repeat(55)}`);

      // Check if name appears anywhere in CSV
      if (csvAllEntries.has(animal.name)) {
        console.log(`  No CSV: ${csvAllEntries.get(animal.name)}`);
      } else {
        console.log(`  Não encontrada no CSV (nenhuma linha)`);
      }

      // Get full animal detail
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const detail = await (prisma as any).animal.findUnique({
        where: { id: animal.id },
        select: {
          birthDate: true, origin: true, sex: true, category: true, createdAt: true,
          lot: { select: { name: true } },
          _count: {
            select: { lactations: true, healthRecords: true, reproductiveRecords: true, weighings: true },
          },
        },
      });

      console.log(`  Nascimento: ${detail.birthDate ?? 'N/A'}`);
      console.log(`  Origem: ${detail.origin}`);
      console.log(`  Lote: ${detail.lot?.name ?? 'sem lote'}`);
      console.log(`  Criado em: ${detail.createdAt}`);
      console.log(`  Relações: lactações=${detail._count.lactations}, saúde=${detail._count.healthRecords}, repro=${detail._count.reproductiveRecords}, pesagens=${detail._count.weighings}`);

      // Check lactations status
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const lacs = await (prisma as any).lactation.findMany({
        where: { animalId: animal.id },
        select: { id: true, status: true, startDate: true, endDate: true, lactationNumber: true },
        orderBy: { startDate: 'desc' },
      });

      if (lacs.length > 0) {
        console.log(`  Lactações:`);
        for (const lac of lacs) {
          console.log(`    #${lac.lactationNumber} status=${lac.status} início=${lac.startDate} fim=${lac.endDate ?? '—'}`);
        }
      } else {
        console.log(`  Nenhuma lactação registrada`);
      }

      // Check recent reproductive records
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const repros = await (prisma as any).animalReproductiveRecord.findMany({
        where: { animalId: animal.id },
        select: { type: true, eventDate: true },
        orderBy: { eventDate: 'desc' },
        take: 3,
      });

      if (repros.length > 0) {
        console.log(`  Últimos eventos reprodutivos:`);
        for (const r of repros) {
          console.log(`    ${r.type} em ${r.eventDate}`);
        }
      }

      console.log();
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('Erro:', err);
  process.exit(1);
});
