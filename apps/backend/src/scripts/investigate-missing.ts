#!/usr/bin/env tsx
/**
 * Investigate missing cows: Papisa and Pelica
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';

async function main() {
  const databaseUrl =
    process.env.DATABASE_URL ??
    `postgresql://${process.env.POSTGRES_USER ?? 'protos'}:${process.env.POSTGRES_PASSWORD ?? 'protos'}@${process.env.POSTGRES_HOST ?? 'localhost'}:${process.env.POSTGRES_PORT ?? '5450'}/${process.env.POSTGRES_DB ?? 'protos_farm'}`;

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
  });

  const names = ['Papisa', 'Pelica'];

  try {
    for (const name of names) {
      console.log(`\n${'='.repeat(50)}`);
      console.log(`  Investigando: ${name}`);
      console.log(`${'='.repeat(50)}`);

      // Exact match (including soft-deleted)
      const exact = await (prisma as any).animal.findMany({
        where: { name },
        select: {
          id: true, earTag: true, name: true, sex: true, category: true,
          deletedAt: true, origin: true, birthDate: true,
        },
      });
      if (exact.length > 0) {
        console.log(`\n  Match exato (incluindo deletados):`);
        for (const a of exact) {
          console.log(`    Brinco: ${a.earTag}, Categoria: ${a.category}, Sexo: ${a.sex}`);
          console.log(`    Nascimento: ${a.birthDate}, Origem: ${a.origin}`);
          console.log(`    Deletada: ${a.deletedAt ?? 'não'}`);
        }
      } else {
        console.log(`\n  Nenhum match exato para "${name}"`);
      }

      // Fuzzy search: similar names
      const prefix = name.substring(0, 3);
      const fuzzy = await (prisma as any).animal.findMany({
        where: {
          OR: [
            { name: { contains: name, mode: 'insensitive' } },
            { name: { startsWith: prefix, mode: 'insensitive' } },
            { earTag: { contains: name, mode: 'insensitive' } },
          ],
        },
        select: {
          id: true, earTag: true, name: true, sex: true, category: true,
          deletedAt: true,
        },
      });

      const fuzzyFiltered = fuzzy.filter((a: any) => a.name !== name);
      if (fuzzyFiltered.length > 0) {
        console.log(`\n  Nomes similares (prefixo "${prefix}"):`);
        for (const a of fuzzyFiltered) {
          console.log(`    "${a.name}" — Brinco: ${a.earTag}, Cat: ${a.category}, Deletada: ${a.deletedAt ?? 'não'}`);
        }
      } else {
        console.log(`  Nenhum nome similar encontrado`);
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('Erro:', err);
  process.exit(1);
});
