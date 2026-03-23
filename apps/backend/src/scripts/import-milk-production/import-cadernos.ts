/**
 * Import daily milk production from extracted cadernos de leite JSON.
 *
 * Usage:
 *   1. Run extract: python3 extract-cadernos.py
 *   2. Run import:  npx tsx src/scripts/import-milk-production/import-cadernos.ts
 *
 * Env: DATABASE_URL must be set (or .env loaded).
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { randomUUID } from 'crypto';
import { readFileSync } from 'fs';
import { join } from 'path';

interface MilkRecord {
  date: string;
  totalLiters: number;
  cowCount: number | null;
  avgPerCow: number | null;
  morningLiters: number | null;
  afternoonLiters: number | null;
  nightLiters: number | null;
  dawnLiters: number | null;
  collectionLiters: number | null;
  nurseryLiters: number | null;
  discardLiters: number | null;
  calfLiters: number | null;
  source: string;
}

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  const databaseUrl =
    process.env.DATABASE_URL ??
    `postgresql://${process.env.POSTGRES_USER ?? 'protos'}:${process.env.POSTGRES_PASSWORD ?? 'protos'}@${process.env.POSTGRES_HOST ?? 'localhost'}:${process.env.POSTGRES_PORT ?? '5450'}/${process.env.POSTGRES_DB ?? 'protos_farm'}`;

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });

  try {
    // Load JSON
    const jsonPath = join(__dirname, 'cadernos-leite.json');
    const records: MilkRecord[] = JSON.parse(readFileSync(jsonPath, 'utf-8'));
    console.log(`\n── Importação Cadernos de Leite ──`);
    console.log(`  ${records.length} registros no JSON`);

    // Get org + farm (assumes single org/farm setup like Fazenda Limeira)
    const org = await prisma.organization.findFirst({ orderBy: { createdAt: 'asc' } });
    if (!org) throw new Error('Nenhuma organização encontrada');

    const farm = await prisma.farm.findFirst({
      where: { organizationId: org.id },
      orderBy: { createdAt: 'asc' },
    });
    if (!farm) throw new Error('Nenhuma fazenda encontrada');

    console.log(`  Org: ${org.name} (${org.id})`);
    console.log(`  Farm: ${farm.name} (${farm.id})`);

    if (dryRun) {
      console.log('\n  [DRY RUN] Nenhum dado será inserido.');
      console.log(`  ${records.length} registros seriam importados.`);
      await prisma.$disconnect();
      return;
    }

    // Check existing records to avoid duplicates
    const existing = await prisma.dailyMilkProduction.findMany({
      where: { farmId: farm.id },
      select: { productionDate: true },
    });
    const existingDates = new Set(
      existing.map((e) => e.productionDate.toISOString().split('T')[0]),
    );
    console.log(`  ${existingDates.size} registros já existem no banco`);

    let created = 0;
    let skipped = 0;
    const BATCH_SIZE = 500;

    for (let i = 0; i < records.length; i += BATCH_SIZE) {
      const batch = records.slice(i, i + BATCH_SIZE);
      const values: Array<{
        id: string;
        organizationId: string;
        farmId: string;
        productionDate: Date;
        totalLiters: number;
        cowCount: number | null;
        avgPerCow: number | null;
        morningLiters: number | null;
        afternoonLiters: number | null;
        nightLiters: number | null;
        dawnLiters: number | null;
        collectionLiters: number | null;
        nurseryLiters: number | null;
        discardLiters: number | null;
        calfLiters: number | null;
        source: string | null;
      }> = [];

      for (const rec of batch) {
        if (existingDates.has(rec.date)) {
          skipped++;
          continue;
        }

        values.push({
          id: randomUUID(),
          organizationId: org.id,
          farmId: farm.id,
          productionDate: new Date(rec.date + 'T00:00:00Z'),
          totalLiters: rec.totalLiters,
          cowCount: rec.cowCount,
          avgPerCow: rec.avgPerCow,
          morningLiters: rec.morningLiters,
          afternoonLiters: rec.afternoonLiters,
          nightLiters: rec.nightLiters,
          dawnLiters: rec.dawnLiters,
          collectionLiters: rec.collectionLiters,
          nurseryLiters: rec.nurseryLiters,
          discardLiters: rec.discardLiters,
          calfLiters: rec.calfLiters,
          source: rec.source,
        });
      }

      if (values.length > 0) {
        await prisma.dailyMilkProduction.createMany({ data: values });
        created += values.length;
      }

      if ((i + BATCH_SIZE) % 2000 === 0 || i + BATCH_SIZE >= records.length) {
        console.log(`  ... ${created} criados, ${skipped} já existiam`);
      }
    }

    console.log(`\n  ✓ Importação concluída: ${created} criados, ${skipped} já existiam`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('Erro na importação:', err);
  process.exit(1);
});
