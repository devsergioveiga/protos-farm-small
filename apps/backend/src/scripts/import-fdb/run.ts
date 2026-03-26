#!/usr/bin/env tsx
/**
 * Import data from Firebird legacy database (DADOS988.FDB) into Protos Farm.
 *
 * Usage:
 *   pnpm --filter @protos-farm/backend exec tsx src/scripts/import-fdb/run.ts [options]
 *
 * Options:
 *   --org-id <id>       Organization UUID (required, or uses first org)
 *   --user-id <id>      User UUID for createdBy fields (required, or uses first admin)
 *   --fdb-path <path>   Path to FDB file (default: ../../DADOS988.FDB)
 *   --phase <n>         Run only specific phase (1-4)
 *   --table <name>      Run only a specific table import (e.g. ANIMAL, PESO, FAZENDA)
 *   --list              List all available tables and their phases
 *   --dry-run           Show what would be done without writing
 *
 * Prerequisites:
 *   - Docker running
 *   - PostgreSQL running (docker-compose up -d postgres)
 *   - FDB file accessible
 *
 * The script is idempotent: it tracks imported IDs in .import-data/id-map.json
 * and skips already-imported records on re-run.
 */
import { resolve } from 'path';
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { ensureContainer, stopContainer } from './firebird-client';
import { IdMap } from './id-map';
import {
  importFarms,
  importBreeds,
  importMeasurementUnits,
  importClassifications,
  importDiseases,
  importStorageLocations,
  importSemenCentrals,
  importExitReasons,
  runPhase1,
} from './phase1-master-data';
import {
  importPeople,
  importProducts,
  importActiveIngredients,
  importProductActiveIngredients,
  runPhase2,
} from './phase2-products';
import {
  importAnimals,
  importBreedCompositions,
  importAnimalLots,
  importLotMovements,
  runPhase3,
} from './phase3-animals';
import {
  importWeighings,
  importReproduction,
  importLactations,
  importMilkRecords,
  importMastitis,
  importExams,
  runPhase4,
} from './phase4-events';

// ─── Table registry ──────────────────────────────────────────────────

interface TableEntry {
  phase: number;
  description: string;
  needsUserId: boolean;
  run: (prisma: PrismaClient, orgId: string, userId: string, idMap: IdMap) => Promise<void>;
}

const TABLE_REGISTRY: Record<string, TableEntry> = {
  // Phase 1
  FAZENDA: {
    phase: 1,
    description: 'Fazendas',
    needsUserId: false,
    run: (prisma, orgId, _userId, idMap) => importFarms(prisma, orgId, idMap),
  },
  RACA: {
    phase: 1,
    description: 'Raças',
    needsUserId: false,
    run: (prisma, orgId, _userId, idMap) => importBreeds(prisma, orgId, idMap),
  },
  UNIDADEMEDIDA: {
    phase: 1,
    description: 'Unidades de medida',
    needsUserId: false,
    run: (prisma, orgId, _userId, idMap) => importMeasurementUnits(prisma, orgId, idMap),
  },
  CLASSIFICACAO: {
    phase: 1,
    description: 'Classificações de produto (referência)',
    needsUserId: false,
    run: (_prisma, _orgId, _userId, idMap) => importClassifications(idMap),
  },
  DOENCA: {
    phase: 1,
    description: 'Doenças',
    needsUserId: false,
    run: (prisma, orgId, _userId, idMap) => importDiseases(prisma, orgId, idMap),
  },
  LOCALARMAZENAMENTO: {
    phase: 1,
    description: 'Locais de armazenamento',
    needsUserId: false,
    run: (prisma, orgId, _userId, idMap) => importStorageLocations(prisma, orgId, idMap),
  },
  CENTRALSEMEN: {
    phase: 1,
    description: 'Centrais de sêmen (referência)',
    needsUserId: false,
    run: (_prisma, _orgId, _userId, idMap) => importSemenCentrals(idMap),
  },
  MOTIVOBAIXA: {
    phase: 1,
    description: 'Motivos de baixa (referência)',
    needsUserId: false,
    run: (_prisma, _orgId, _userId, idMap) => importExitReasons(idMap),
  },

  // Phase 2
  PESSOA: {
    phase: 2,
    description: 'Pessoas (fornecedores e produtores)',
    needsUserId: true,
    run: (prisma, orgId, userId, idMap) => importPeople(prisma, orgId, userId, idMap),
  },
  PRODUTO: {
    phase: 2,
    description: 'Produtos e insumos',
    needsUserId: false,
    run: (prisma, orgId, _userId, idMap) => importProducts(prisma, orgId, idMap),
  },
  PRINCIPIOATIVO: {
    phase: 2,
    description: 'Princípios ativos',
    needsUserId: false,
    run: (prisma, orgId, _userId, idMap) => importActiveIngredients(prisma, orgId, idMap),
  },
  PRODUTOPRINCIPIOATIVO: {
    phase: 2,
    description: 'Vínculos produto <> princípio ativo',
    needsUserId: false,
    run: (prisma, _orgId, _userId, idMap) => importProductActiveIngredients(prisma, idMap),
  },

  // Phase 3
  ANIMAL: {
    phase: 3,
    description: 'Animais (cadastro + parentesco)',
    needsUserId: false,
    run: (prisma, orgId, _userId, idMap) => importAnimals(prisma, orgId, idMap),
  },
  ANIMALRACA: {
    phase: 3,
    description: 'Composições raciais',
    needsUserId: false,
    run: (prisma, _orgId, _userId, idMap) => importBreedCompositions(prisma, idMap),
  },
  GRUPOANIMAL: {
    phase: 3,
    description: 'Lotes de animais',
    needsUserId: false,
    run: (prisma, orgId, _userId, idMap) => importAnimalLots(prisma, orgId, idMap),
  },
  MOVGRUPOANIMAL: {
    phase: 3,
    description: 'Movimentações de lote',
    needsUserId: false,
    run: (prisma, orgId, _userId, idMap) => importLotMovements(prisma, orgId, idMap),
  },

  // Phase 4
  PESO: {
    phase: 4,
    description: 'Pesagens',
    needsUserId: false,
    run: (prisma, orgId, _userId, idMap) => importWeighings(prisma, orgId, idMap),
  },
  REPRODUCAO: {
    phase: 4,
    description: 'Eventos reprodutivos (IA, parto, diagnóstico, cio)',
    needsUserId: true,
    run: (prisma, orgId, userId, idMap) => importReproduction(prisma, orgId, userId, idMap),
  },
  LACTACAO: {
    phase: 4,
    description: 'Lactações',
    needsUserId: false,
    run: (prisma, orgId, _userId, idMap) => importLactations(prisma, orgId, idMap),
  },
  LEITE: {
    phase: 4,
    description: 'Registros de leite (ordenhas)',
    needsUserId: false,
    run: (prisma, orgId, _userId, idMap) => importMilkRecords(prisma, orgId, idMap),
  },
  MAMITE: {
    phase: 4,
    description: 'Casos de mastite',
    needsUserId: false,
    run: (prisma, orgId, _userId, idMap) => importMastitis(prisma, orgId, idMap),
  },
  EXAMEANIMAL: {
    phase: 4,
    description: 'Exames de animais',
    needsUserId: false,
    run: (prisma, orgId, _userId, idMap) => importExams(prisma, orgId, idMap),
  },
};

// ─── Parse CLI args ───────────────────────────────────────────────────

function parseArgs() {
  const args = process.argv.slice(2);
  const opts: Record<string, string> = {};

  for (let i = 0; i < args.length; i++) {
    if (args[i].startsWith('--')) {
      const key = args[i].replace('--', '');
      if (args[i + 1] && !args[i + 1].startsWith('--')) {
        opts[key] = args[++i];
      } else {
        opts[key] = 'true';
      }
    }
  }

  return opts;
}

// ─── List tables ─────────────────────────────────────────────────────

function listTables(): void {
  console.log('╔═══════════════════════════════════════════════════════════╗');
  console.log('║  Tabelas disponíveis para importação                     ║');
  console.log('╚═══════════════════════════════════════════════════════════╝');

  let currentPhase = 0;
  for (const [name, entry] of Object.entries(TABLE_REGISTRY)) {
    if (entry.phase !== currentPhase) {
      currentPhase = entry.phase;
      console.log(`\n  Phase ${currentPhase}:`);
    }
    console.log(`    --table ${name.padEnd(24)} ${entry.description}`);
  }

  console.log('\n  Dica: tabelas de fases anteriores devem ser importadas antes.');
  console.log('  Ex: ANIMAL (phase 3) depende de FAZENDA e RACA (phase 1).\n');
}

// ─── Main ─────────────────────────────────────────────────────────────

async function main() {
  const opts = parseArgs();

  // --list: show available tables and exit
  if (opts['list'] === 'true') {
    listTables();
    return;
  }

  const fdbPath = resolve(opts['fdb-path'] || resolve(__dirname, '..', '..', '..', '..', 'DADOS988.FDB'));
  const phase = opts['phase'] ? parseInt(opts['phase']) : null;
  const table = opts['table']?.toUpperCase() || null;
  const dryRun = opts['dry-run'] === 'true';

  // Validate --table
  if (table && !TABLE_REGISTRY[table]) {
    console.error(`ERROR: Tabela "${table}" não encontrada.`);
    console.error('Use --list para ver as tabelas disponíveis.');
    process.exit(1);
  }

  console.log('╔═══════════════════════════════════════════╗');
  console.log('║  Protos Farm — FDB Import                 ║');
  console.log('╚═══════════════════════════════════════════╝');
  console.log(`  FDB: ${fdbPath}`);
  if (table) {
    console.log(`  Table: ${table} (${TABLE_REGISTRY[table].description})`);
  } else {
    console.log(`  Phase: ${phase || 'all (1-4)'}`);
  }
  console.log(`  Dry run: ${dryRun}`);

  if (dryRun) {
    console.log('\n  ⚠ DRY RUN — no data will be written\n');
    return;
  }

  // Initialize Prisma
  const databaseUrl =
    process.env.DATABASE_URL ||
    'postgresql://protos:protos@localhost:5450/protos_farm?schema=public';

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
    log: ['warn', 'error'],
  });

  try {
    // Ensure Docker container is running
    console.log('\n── Docker ──');
    ensureContainer(fdbPath);

    // Resolve org and user
    let orgId = opts['org-id'];
    let userId = opts['user-id'];

    if (!orgId) {
      const org = await prisma.organization.findFirst({ orderBy: { createdAt: 'asc' } });
      if (!org) {
        console.error('ERROR: No organization found. Create one first or pass --org-id.');
        process.exit(1);
      }
      orgId = org.id;
      console.log(`  Using org: ${org.name} (${orgId})`);
    }

    if (!userId) {
      const user = await prisma.user.findFirst({
        where: { organizationId: orgId, role: 'ADMIN' },
        orderBy: { createdAt: 'asc' },
      });
      if (!user) {
        const anyUser = await prisma.user.findFirst({
          where: { organizationId: orgId },
          orderBy: { createdAt: 'asc' },
        });
        if (!anyUser) {
          console.error('ERROR: No user found. Create one first or pass --user-id.');
          process.exit(1);
        }
        userId = anyUser.id;
      } else {
        userId = user.id;
      }
      console.log(`  Using user: ${userId}`);
    }

    // Initialize ID map
    const idMap = new IdMap();

    // Run
    const startTime = Date.now();

    if (table) {
      // Single table mode
      const entry = TABLE_REGISTRY[table];
      console.log(`\n═══ Importing: ${table} (${entry.description}) ═══`);
      await entry.run(prisma, orgId, userId, idMap);
      idMap.save();
    } else {
      // Phase mode (original behavior)
      if (!phase || phase === 1) await runPhase1(prisma, orgId, idMap);
      if (!phase || phase === 2) await runPhase2(prisma, orgId, userId, idMap);
      if (!phase || phase === 3) await runPhase3(prisma, orgId, idMap);
      if (!phase || phase === 4) await runPhase4(prisma, orgId, userId, idMap);
    }

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log('\n╔═══════════════════════════════════════════╗');
    console.log('║  Import Complete!                         ║');
    console.log('╚═══════════════════════════════════════════╝');
    console.log(`  Time: ${elapsed}s`);
    console.log(`  ID mappings:`);
    console.log(`    Farms:       ${idMap.count('FAZENDA')}`);
    console.log(`    Breeds:      ${idMap.count('RACA')}`);
    console.log(`    Animals:     ${idMap.count('ANIMAL')}`);
    console.log(`    Products:    ${idMap.count('PRODUTO')}`);
    console.log(`    Act.Ingr.:   ${idMap.count('PRINCIPIOATIVO')}`);
    console.log(`    People:      ${idMap.count('PESSOA')}`);
    console.log(`    Lactations:  ${idMap.count('LACTACAO')}`);
  } catch (error) {
    console.error('\n  ✗ Import failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
    // Don't stop container automatically — user might want to re-run
    console.log('\n  Tip: Run `docker stop fb25_reader` when done.');
  }
}

main().catch(console.error);
