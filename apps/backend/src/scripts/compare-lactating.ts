#!/usr/bin/env tsx
/**
 * Compare lactating cows between legacy CSV report and Protos Farm DB.
 *
 * Usage:
 *   pnpm --filter @protos-farm/backend exec tsx src/scripts/compare-lactating.ts
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
    // 1. Read CSV (legacy system - all are "Lac.")
    const csvPath = resolve(__dirname, '../../../../Relatorio_23-03-2026-14-22-24.csv');
    const raw = readFileSync(csvPath, 'latin1');
    const lines = raw.split('\n').filter((l) => l.trim());
    const csvNames = new Set<string>();
    for (let i = 1; i < lines.length; i++) {
      const name = lines[i].split(';')[0]?.trim();
      if (name) csvNames.add(name);
    }

    // 2. Get animals from Protos by category
    const [lactating, dry, allFemales] = await Promise.all([
      (prisma as any).animal.findMany({
        where: { category: 'VACA_LACTACAO', deletedAt: null },
        select: { id: true, earTag: true, name: true },
      }),
      (prisma as any).animal.findMany({
        where: { category: 'VACA_SECA', deletedAt: null },
        select: { id: true, earTag: true, name: true },
      }),
      (prisma as any).animal.findMany({
        where: { sex: 'FEMALE', deletedAt: null },
        select: { id: true, earTag: true, name: true, category: true },
      }),
    ]);

    const protosLacNames = new Set<string>(
      lactating.map((a: any) => a.name).filter(Boolean),
    );
    const protosDryNames = new Set<string>(
      dry.map((a: any) => a.name).filter(Boolean),
    );
    const allFemalesByName = new Map<string, any>();
    for (const a of allFemales) {
      if (a.name) allFemalesByName.set(a.name, a);
    }

    // 3. Compare
    const inCsvButDryInProtos: string[] = [];
    const inCsvNotInProtos: string[] = [];
    const inCsvOtherCategory: { name: string; category: string }[] = [];

    for (const name of csvNames) {
      if (protosLacNames.has(name)) continue; // match - ok
      if (protosDryNames.has(name)) {
        inCsvButDryInProtos.push(name);
      } else if (allFemalesByName.has(name)) {
        const animal = allFemalesByName.get(name)!;
        inCsvOtherCategory.push({ name, category: animal.category });
      } else {
        inCsvNotInProtos.push(name);
      }
    }

    const inProtosNotCsv: string[] = [];
    for (const name of protosLacNames) {
      if (!csvNames.has(name)) {
        inProtosNotCsv.push(name);
      }
    }

    // 4. Report
    console.log(`\n${'='.repeat(60)}`);
    console.log(`  COMPARAÇÃO: Vacas em Lactação`);
    console.log(`  CSV (sistema atual) vs Protos Farm`);
    console.log(`${'='.repeat(60)}\n`);

    console.log(`CSV (sistema atual):     ${csvNames.size} vacas em lactação`);
    console.log(`Protos (VACA_LACTACAO):  ${protosLacNames.size} vacas em lactação`);
    console.log(`Protos (VACA_SECA):      ${protosDryNames.size} vacas secas`);
    console.log();

    const matchCount =
      csvNames.size - inCsvButDryInProtos.length - inCsvNotInProtos.length - inCsvOtherCategory.length;
    console.log(`Coincidentes (ambos lactação): ${matchCount}`);
    console.log();

    if (inCsvButDryInProtos.length > 0) {
      console.log(`\n--- LACTAÇÃO no CSV, mas VACA_SECA no Protos (${inCsvButDryInProtos.length}) ---`);
      console.log(`(Essas vacas estão como secas no Protos mas o sistema atual diz que estão em lactação)\n`);
      inCsvButDryInProtos.sort().forEach((n) => console.log(`  ${n}`));
    }

    if (inCsvOtherCategory.length > 0) {
      console.log(
        `\n--- LACTAÇÃO no CSV, mas OUTRA CATEGORIA no Protos (${inCsvOtherCategory.length}) ---\n`,
      );
      inCsvOtherCategory
        .sort((a, b) => a.name.localeCompare(b.name))
        .forEach((item) => console.log(`  ${item.name} → ${item.category}`));
    }

    if (inCsvNotInProtos.length > 0) {
      console.log(
        `\n--- LACTAÇÃO no CSV, NÃO ENCONTRADA no Protos (${inCsvNotInProtos.length}) ---\n`,
      );
      inCsvNotInProtos.sort().forEach((n) => console.log(`  ${n}`));
    }

    if (inProtosNotCsv.length > 0) {
      console.log(
        `\n--- VACA_LACTACAO no Protos, NÃO ESTÁ no CSV (${inProtosNotCsv.length}) ---\n`,
      );
      inProtosNotCsv.sort().forEach((n) => console.log(`  ${n}`));
    }

    console.log(`\n${'='.repeat(60)}\n`);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch((err) => {
  console.error('Erro:', err);
  process.exit(1);
});
