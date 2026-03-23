#!/usr/bin/env tsx
/**
 * Restore Papisa and Pelica: remove soft delete and clean duplicates.
 *
 * Usage:
 *   pnpm --filter @protos-farm/backend exec tsx src/scripts/fix-papisa-pelica.ts [--dry-run]
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

async function main() {
  const dryRun = process.argv.includes('--dry-run');

  const databaseUrl =
    process.env.DATABASE_URL ??
    `postgresql://${process.env.POSTGRES_USER ?? 'protos'}:${process.env.POSTGRES_PASSWORD ?? 'protos'}@${process.env.POSTGRES_HOST ?? 'localhost'}:${process.env.POSTGRES_PORT ?? '5450'}/${process.env.POSTGRES_DB ?? 'protos_farm'}`;

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });

  const targets = [
    { name: 'Papisa', earTag: '1509' },
    { name: 'Pelica', earTag: '1535' },
  ];

  try {
    for (const { name, earTag } of targets) {
      console.log(`\n--- ${name} (brinco ${earTag}) ---`);

      const rows = await (prisma as any).animal.findMany({
        where: { name, earTag },
        select: {
          id: true, earTag: true, name: true, category: true, deletedAt: true, createdAt: true,
          _count: {
            select: {
              lactations: true,
              healthRecords: true,
              reproductiveRecords: true,
              weighings: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      });

      console.log(`  ${rows.length} registros encontrados`);

      if (rows.length === 0) continue;

      if (rows.length === 1) {
        // Just restore
        const row = rows[0];
        if (dryRun) {
          console.log(`  [DRY-RUN] Restaurar id=${row.id}, cat=${row.category}`);
        } else {
          await (prisma as any).animal.update({
            where: { id: row.id },
            data: { deletedAt: null, category: 'VACA_LACTACAO' },
          });
          console.log(`  ✓ Restaurada (cat → VACA_LACTACAO)`);
        }
        continue;
      }

      // Multiple rows: pick the one with most relations, delete the other
      for (const r of rows) {
        const total = r._count.lactations + r._count.healthRecords + r._count.reproductiveRecords + r._count.weighings;
        console.log(`  id=${r.id} cat=${r.category} deletedAt=${r.deletedAt ? 'sim' : 'não'} created=${r.createdAt} relations=${total}`);
        (r as any)._totalRelations = total;
      }

      // Keep the one with more relations (or the older one if tied)
      rows.sort((a: any, b: any) => {
        const diff = b._totalRelations - a._totalRelations;
        if (diff !== 0) return diff;
        return new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime();
      });

      const keep = rows[0];
      const remove = rows.slice(1);

      console.log(`  Manter: id=${keep.id} (${(keep as any)._totalRelations} relações)`);

      for (const dup of remove) {
        if (dryRun) {
          console.log(`  [DRY-RUN] Hard-delete duplicata id=${dup.id} (${(dup as any)._totalRelations} relações)`);
        } else {
          // Move any orphan relations to the kept record before deleting
          if ((dup as any)._totalRelations > 0) {
            await Promise.all([
              (prisma as any).lactation.updateMany({ where: { animalId: dup.id }, data: { animalId: keep.id } }),
              (prisma as any).animalHealthRecord.updateMany({ where: { animalId: dup.id }, data: { animalId: keep.id } }),
              (prisma as any).animalReproductiveRecord.updateMany({ where: { animalId: dup.id }, data: { animalId: keep.id } }),
              (prisma as any).animalWeighing.updateMany({ where: { animalId: dup.id }, data: { animalId: keep.id } }),
            ]);
            console.log(`  ✓ Relações da duplicata migradas para registro principal`);
          }
          await (prisma as any).animal.delete({ where: { id: dup.id } });
          console.log(`  ✓ Duplicata removida id=${dup.id}`);
        }
      }

      // Restore the kept record
      if (dryRun) {
        console.log(`  [DRY-RUN] Restaurar id=${keep.id}, cat → VACA_LACTACAO`);
      } else {
        await (prisma as any).animal.update({
          where: { id: keep.id },
          data: { deletedAt: null, category: 'VACA_LACTACAO' },
        });
        console.log(`  ✓ Restaurada (cat → VACA_LACTACAO)`);
      }
    }

    console.log(`\n${dryRun ? '[DRY-RUN] ' : ''}Concluído.\n`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('Erro:', err);
  process.exit(1);
});
