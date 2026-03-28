#!/usr/bin/env tsx
/**
 * Fix animal categories for cows that were dried off but remained as VACA_LACTACAO.
 *
 * The dryOff function was not updating the animal's category to VACA_SECA.
 * This script finds all animals with an active DRIED lactation (no newer IN_PROGRESS)
 * that are still marked as VACA_LACTACAO and corrects them.
 *
 * Usage:
 *   pnpm --filter @protos-farm/backend exec tsx src/scripts/fix-vaca-seca-category.ts [--dry-run]
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

  try {
    // Find animals that:
    // 1. Have category VACA_LACTACAO
    // 2. Have at least one lactation with status DRIED
    // 3. Do NOT have any lactation with status IN_PROGRESS
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const candidates = await (prisma as any).animal.findMany({
      where: {
        category: 'VACA_LACTACAO',
        deletedAt: null,
        lactations: {
          some: { status: 'DRIED' },
          none: { status: 'IN_PROGRESS' },
        },
      },
      select: {
        id: true,
        earTag: true,
        name: true,
        farmId: true,
        category: true,
      },
    });

    console.log(`\nEncontrados ${candidates.length} animais para corrigir\n`);

    if (candidates.length === 0) {
      console.log('Nenhum animal precisa de correção.');
      return;
    }

    for (const animal of candidates) {
      const label = `${animal.earTag}${animal.name ? ` (${animal.name})` : ''}`;
      if (dryRun) {
        console.log(`[DRY-RUN] ${label} — VACA_LACTACAO → VACA_SECA`);
      } else {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (prisma as any).animal.update({
          where: { id: animal.id },
          data: { category: 'VACA_SECA' },
        });
        console.log(`✓ ${label} — atualizado para VACA_SECA`);
      }
    }

    console.log(`\n${dryRun ? '[DRY-RUN] ' : ''}${candidates.length} animais ${dryRun ? 'seriam atualizados' : 'atualizados com sucesso'}.`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('Erro:', err);
  process.exit(1);
});
