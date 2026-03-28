#!/usr/bin/env tsx
/**
 * Import animals from DADOS988.FDB into Fazenda Limeira org/farm.
 *
 * Fields imported:
 *   - NUMERO       → earTag (Brinco)
 *   - NOME         → name
 *   - NOMECOMPLETO → registeredName (Nome Completo)
 *   - SEXO         → sex
 *   - DTNASCIMENTO → birthDate (Data de Nascimento)
 *   - REGASSOCRACA → registrationNumber (Registro na Associação de Raça)
 *   - ANIMALRACA   → breed composition (Raça)
 *   - CDPAI        → sireId (Pai)
 *   - CDMAE        → damId (Mãe)
 *   - PESO (nascimento) → entryWeightKg (Peso de Nascimento)
 *
 * Also imports breeds (RACA) into the org as a prerequisite.
 *
 * Usage:
 *   pnpm --filter @protos-farm/backend exec tsx src/scripts/import-fdb/import-animals-limeira.ts
 */
import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { ensureContainer } from './firebird-client';
import { query, queryBatched } from './firebird-client';
import { resolve } from 'path';

// ─── Config ──────────────────────────────────────────────────────────

const ORG_ID = '0978e72a-5231-45f0-a0cb-600af93c9b09';
const FARM_ID = '028ad457-de35-4e94-af10-a9e6bda52f64';
const USER_ID = '10654602-d384-4bb2-86bd-ff9454aa3205';

// ─── Helpers ─────────────────────────────────────────────────────────

function str(val: string | number | null, maxLen?: number): string | null {
  if (val === null || val === undefined) return null;
  const s = String(val).trim();
  if (s === '' || s === '0') return null;
  return maxLen ? s.substring(0, maxLen) : s;
}

function toDate(val: string | number | null): Date | null {
  if (!val) return null;
  const d = new Date(String(val));
  return isNaN(d.getTime()) ? null : d;
}

function mapSex(sexo: string | null): 'MALE' | 'FEMALE' {
  if (sexo === 'M') return 'MALE';
  if (sexo === 'F') return 'FEMALE';
  return 'FEMALE'; // default for dairy farm
}

function mapCategory(sex: 'MALE' | 'FEMALE') {
  return sex === 'MALE' ? ('NOVILHO' as const) : ('NOVILHA' as const);
}

// ─── Import Breeds ───────────────────────────────────────────────────

async function importBreeds(prisma: PrismaClient): Promise<Map<number, string>> {
  console.log('\n── Raças ──');
  const breedMap = new Map<number, string>();

  const rows = query('SELECT r.CDRACA, r.DESCRICAO, r.SIGLA FROM RACA r ORDER BY r.CDRACA');

  let created = 0;
  let skipped = 0;

  for (const row of rows) {
    const fbId = row.cdraca as number;
    const name = str(row.descricao) || `Raça ${fbId}`;
    const code = str(row.sigla, 10);

    // Check if breed already exists in this org
    const existing = await prisma.breed.findFirst({
      where: { name, organizationId: ORG_ID },
    });

    if (existing) {
      breedMap.set(fbId, existing.id);
      skipped++;
      continue;
    }

    const breed = await prisma.breed.create({
      data: {
        name,
        code,
        species: 'BOVINO',
        category: 'DUPLA_APTIDAO',
        organizationId: ORG_ID,
      },
    });

    breedMap.set(fbId, breed.id);
    created++;
  }

  console.log(`  ✓ Raças: ${created} criadas, ${skipped} já existiam`);
  return breedMap;
}

// ─── Import Animals ──────────────────────────────────────────────────

async function importAnimals(prisma: PrismaClient): Promise<Map<number, string>> {
  console.log('\n── Animais ──');
  const animalMap = new Map<number, string>();
  let created = 0;
  let skipped = 0;

  for (const batch of queryBatched(
    `SELECT a.CDANIMAL, a.NUMERO, a.NOME, a.NOMECOMPLETO, a.SEXO,
            a.DTNASCIMENTO, a.REGASSOCRACA
     FROM ANIMAL a ORDER BY a.CDANIMAL`,
    'ANIMAL',
    1000,
  )) {
    for (const row of batch) {
      const fbId = row.cdanimal as number;
      const earTag = str(row.numero) || String(fbId);

      // Check if already exists by earTag in this farm
      const existing = await prisma.animal.findFirst({
        where: { farmId: FARM_ID, earTag },
      });

      if (existing) {
        animalMap.set(fbId, existing.id);
        skipped++;
        continue;
      }

      const sex = mapSex(row.sexo as string | null);
      const birthDate = toDate(row.dtnascimento);

      try {
        const animal = await prisma.animal.create({
          data: {
            farmId: FARM_ID,
            earTag,
            name: str(row.nome, 100),
            registeredName: str(row.nomecompleto, 200),
            registrationNumber: str(row.regassocraca, 50),
            sex,
            birthDate,
            birthDateEstimated: !birthDate,
            category: mapCategory(sex),
            origin: 'BORN',
            createdBy: USER_ID,
          },
        });

        animalMap.set(fbId, animal.id);
        created++;
      } catch {
        // Duplicate earTag — try with suffix
        try {
          const animal = await prisma.animal.create({
            data: {
              farmId: FARM_ID,
              earTag: `${earTag}-${fbId}`,
              name: str(row.nome, 100),
              registeredName: str(row.nomecompleto, 200),
              registrationNumber: str(row.regassocraca, 50),
              sex,
              birthDate,
              birthDateEstimated: !birthDate,
              category: mapCategory(sex),
              origin: 'BORN',
              createdBy: USER_ID,
            },
          });
          animalMap.set(fbId, animal.id);
          created++;
        } catch (e) {
          console.error(`  ✗ Animal ${fbId} (earTag: ${earTag}): ${e}`);
          skipped++;
        }
      }
    }
  }

  console.log(`  ✓ Animais: ${created} criados, ${skipped} já existiam`);
  return animalMap;
}

// ─── Import Breed Compositions ───────────────────────────────────────

async function importBreedCompositions(
  prisma: PrismaClient,
  animalMap: Map<number, string>,
  breedMap: Map<number, string>,
): Promise<void> {
  console.log('\n── Composições Raciais ──');

  const rows = query(`
    SELECT ar.CDANIMAL, ar.CDRACA, ar.PERCENTUAL
    FROM ANIMALRACA ar ORDER BY ar.CDANIMAL
  `);

  let created = 0;
  let skipped = 0;

  for (const row of rows) {
    const animalId = animalMap.get(row.cdanimal as number);
    const breedId = breedMap.get(row.cdraca as number);

    if (!animalId || !breedId) {
      skipped++;
      continue;
    }

    const existing = await prisma.animalBreedComposition.findFirst({
      where: { animalId, breedId },
    });

    if (existing) {
      skipped++;
      continue;
    }

    await prisma.animalBreedComposition.create({
      data: {
        animalId,
        breedId,
        percentage: row.percentual ? Number(row.percentual) : 100,
      },
    });

    created++;
  }

  console.log(`  ✓ Composições raciais: ${created} criadas, ${skipped} já existiam`);
}

// ─── Set Parent References (Pai / Mãe) ──────────────────────────────

async function setParentReferences(
  prisma: PrismaClient,
  animalMap: Map<number, string>,
): Promise<void> {
  console.log('\n── Pai / Mãe ──');

  const rows = query(`
    SELECT a.CDANIMAL, a.CDMAE, a.CDPAI
    FROM ANIMAL a
    WHERE a.CDMAE IS NOT NULL OR a.CDPAI IS NOT NULL
  `);

  let updated = 0;
  let skipped = 0;

  for (const row of rows) {
    const animalId = animalMap.get(row.cdanimal as number);
    if (!animalId) {
      skipped++;
      continue;
    }

    const damId = animalMap.get(row.cdmae as number);
    const sireId = animalMap.get(row.cdpai as number);

    if (!damId && !sireId) {
      skipped++;
      continue;
    }

    await prisma.animal.update({
      where: { id: animalId },
      data: {
        ...(damId ? { damId } : {}),
        ...(sireId ? { sireId } : {}),
      },
    });
    updated++;
  }

  console.log(`  ✓ Referências pai/mãe: ${updated} atualizados, ${skipped} sem correspondência`);
}

// ─── Set Birth Weight (Peso de Nascimento) ──────────────────────────

async function setBirthWeights(
  prisma: PrismaClient,
  animalMap: Map<number, string>,
): Promise<void> {
  console.log('\n── Peso de Nascimento ──');

  // CDTIPOPESO 1 = Nascimento informado, 2 = Nascimento estimado
  const rows = query(`
    SELECT p.CDANIMAL, p.PESO, p.CDTIPOPESO
    FROM PESO p
    WHERE p.CDTIPOPESO IN (1, 2)
    ORDER BY p.CDANIMAL, p.CDTIPOPESO
  `);

  let updated = 0;
  let skipped = 0;
  const seen = new Set<number>();

  for (const row of rows) {
    const fbAnimalId = row.cdanimal as number;

    // Use first weight found per animal (prefer CDTIPOPESO=1 over 2)
    if (seen.has(fbAnimalId)) {
      skipped++;
      continue;
    }
    seen.add(fbAnimalId);

    const animalId = animalMap.get(fbAnimalId);
    if (!animalId) {
      skipped++;
      continue;
    }

    const weightKg = Number(row.peso);
    if (!weightKg || weightKg <= 0) {
      skipped++;
      continue;
    }

    await prisma.animal.update({
      where: { id: animalId },
      data: { entryWeightKg: weightKg },
    });
    updated++;
  }

  console.log(`  ✓ Peso de nascimento: ${updated} atualizados, ${skipped} sem dados`);
}

// ─── Migrate Semen/Bulls from Animals to Bulls table ─────────────────

async function migrateSemenToBulls(
  prisma: PrismaClient,
  animalMap: Map<number, string>,
  _breedMap: Map<number, string>,
): Promise<void> {
  console.log('\n── Migrar Sêmen/Touros IA → tabela Bulls ──');

  // Get all non-animal records from FDB (TIPOANIMAL I=inseminação, S=sêmen sexado)
  const rows = query(`
    SELECT a.CDANIMAL, a.NUMERO, a.NOME, a.NOMECOMPLETO, a.TIPOANIMAL,
           a.REGASSOCRACA, a.CDCENTRALSEMEN, a.REGNUMSEMEN
    FROM ANIMAL a
    WHERE a.TIPOANIMAL IN ('I', 'S')
    ORDER BY a.CDANIMAL
  `);

  // Get breed info for these animals
  const breedRows = query(`
    SELECT ar.CDANIMAL, ar.CDRACA, r.DESCRICAO
    FROM ANIMALRACA ar
    JOIN RACA r ON r.CDRACA = ar.CDRACA
    WHERE ar.CDANIMAL IN (SELECT CDANIMAL FROM ANIMAL WHERE TIPOANIMAL IN ('I', 'S'))
  `);

  const animalBreedName = new Map<number, string>();
  for (const br of breedRows) {
    animalBreedName.set(br.cdanimal as number, (br.descricao as string) || 'Holandês');
  }

  let bullsCreated = 0;
  let animalsRemoved = 0;
  let skipped = 0;

  for (const row of rows) {
    const fbId = row.cdanimal as number;
    const name = str(row.nome, 100) || str(row.numero, 100) || `Touro ${fbId}`;
    const breedName = animalBreedName.get(fbId) || 'Holandês';
    const registryNumber = str(row.regassocraca, 50);

    // Check if bull already exists by name
    const existingBull = await prisma.bull.findFirst({
      where: { farmId: FARM_ID, name },
    });

    if (existingBull) {
      skipped++;
    } else {
      // Create bull
      await prisma.bull.create({
        data: {
          organizationId: ORG_ID,
          farmId: FARM_ID,
          name,
          registryNumber,
          breedName,
          isOwnAnimal: false,
          status: 'ACTIVE',
          notes: row.tipoanimal === 'S' ? 'Sêmen sexado' : 'Touro de inseminação',
        },
      });
      bullsCreated++;
    }

    // Remove from animals table if it was imported there
    const animalId = animalMap.get(fbId);
    if (animalId) {
      // Verify it exists in this farm before deleting
      const existingAnimal = await prisma.animal.findFirst({
        where: { id: animalId, farmId: FARM_ID },
      });
      if (existingAnimal) {
        // Clear parent references pointing to this animal
        await prisma.animal.updateMany({
          where: { sireId: animalId },
          data: { sireId: null },
        });
        await prisma.animal.updateMany({
          where: { damId: animalId },
          data: { damId: null },
        });
        // Remove breed compositions (FK constraint)
        await prisma.animalBreedComposition.deleteMany({
          where: { animalId },
        });
        // Remove the animal record
        await prisma.animal.delete({
          where: { id: animalId },
        });
        animalsRemoved++;
      }
    }
  }

  console.log(`  ✓ Touros/sêmen: ${bullsCreated} criados na tabela bulls`);
  console.log(`  ✓ Removidos da tabela animals: ${animalsRemoved}`);
  if (skipped > 0) console.log(`  ⊘ Já existiam: ${skipped}`);
}

// ─── Import Weaning Records (Desmama) ────────────────────────────────

async function importWeaningRecords(
  prisma: PrismaClient,
  animalMap: Map<number, string>,
): Promise<void> {
  console.log('\n── Desmama ──');

  // Pre-load weaning weights (CDTIPOPESO=3) indexed by CDANIMAL
  const weightRows = query(`
    SELECT p.CDANIMAL, p.PESO
    FROM PESO p
    WHERE p.CDTIPOPESO = 3
    ORDER BY p.CDANIMAL
  `);
  const weaningWeights = new Map<number, number>();
  for (const w of weightRows) {
    weaningWeights.set(w.cdanimal as number, Number(w.peso));
  }
  console.log(`  Pesos de desmama carregados: ${weaningWeights.size}`);

  // Get animals with weaning data
  const rows = query(`
    SELECT a.CDANIMAL, a.DTDESMAMA, a.DTNASCIMENTO, a.OBSDESMAMA,
           a.CONSUMODESMAMA, a.TIPOALEITAMENTO
    FROM ANIMAL a
    WHERE a.DTDESMAMA IS NOT NULL AND a.TIPOANIMAL = 'A'
    ORDER BY a.DTDESMAMA
  `);

  let created = 0;
  let skipped = 0;

  for (const row of rows) {
    const fbId = row.cdanimal as number;
    const calfId = animalMap.get(fbId);
    if (!calfId) {
      skipped++;
      continue;
    }

    const weaningDate = toDate(row.dtdesmama);
    if (!weaningDate) {
      skipped++;
      continue;
    }

    // Check if already exists
    const existing = await prisma.weaningRecord.findFirst({
      where: { calfId, weaningDate },
    });
    if (existing) {
      skipped++;
      continue;
    }

    // Calculate age in months
    const birthDate = toDate(row.dtnascimento);
    let ageMonths: number | null = null;
    if (birthDate) {
      const diffMs = weaningDate.getTime() - birthDate.getTime();
      ageMonths = Math.round(diffMs / (1000 * 60 * 60 * 24 * 30.44));
    }

    // Weaning weight from PESO table
    const weightKg = weaningWeights.get(fbId) || null;

    // Concentrate consumption (CONSUMODESMAMA is in kg, model expects grams)
    const consumoKg = row.consumodesmama ? Number(row.consumodesmama) : null;
    const concentrateGrams = consumoKg ? consumoKg * 1000 : null;

    // Build observations with feeding type
    const parts: string[] = [];
    if (row.tipoaleitamento === 'A') parts.push('Aleitamento artificial');
    if (row.tipoaleitamento === 'N') parts.push('Aleitamento natural');
    const obs = str(row.obsdesmama, 2000);
    if (obs) parts.push(obs);
    const observations = parts.length > 0 ? parts.join('. ') : null;

    await prisma.weaningRecord.create({
      data: {
        organizationId: ORG_ID,
        farmId: FARM_ID,
        calfId,
        weaningDate,
        weightKg,
        ageMonths,
        concentrateConsumptionGrams: concentrateGrams,
        observations,
        recordedBy: USER_ID,
      },
    });
    created++;
  }

  console.log(`  ✓ Desmamas: ${created} criadas, ${skipped} já existiam ou sem dados`);
}

// ─── Import Reproductive Releases (Liberação Reprodutiva) ───────────

async function importReproductiveReleases(
  prisma: PrismaClient,
  animalMap: Map<number, string>,
): Promise<void> {
  console.log('\n── Liberação Reprodutiva ──');

  // Pre-load aptidão weights (CDTIPOPESO=4) indexed by CDANIMAL
  const weightRows = query(`
    SELECT p.CDANIMAL, p.PESO
    FROM PESO p
    WHERE p.CDTIPOPESO = 4
    ORDER BY p.CDANIMAL
  `);
  const releaseWeights = new Map<number, number>();
  for (const w of weightRows) {
    releaseWeights.set(w.cdanimal as number, Number(w.peso));
  }
  console.log(`  Pesos de aptidão carregados: ${releaseWeights.size}`);

  // Get user name for responsibleName
  const user = await prisma.user.findUnique({ where: { id: USER_ID } });
  const responsibleName = user?.name || 'Importação FDB';

  const rows = query(`
    SELECT a.CDANIMAL, a.DTAPTIDAO, a.OBSAPTIDAO, a.DTNASCIMENTO, a.SEXO
    FROM ANIMAL a
    WHERE a.DTAPTIDAO IS NOT NULL AND a.TIPOANIMAL = 'A'
    ORDER BY a.DTAPTIDAO
  `);

  let created = 0;
  let skipped = 0;

  for (const row of rows) {
    const fbId = row.cdanimal as number;
    const animalId = animalMap.get(fbId);
    if (!animalId) {
      skipped++;
      continue;
    }

    const releaseDate = toDate(row.dtaptidao);
    if (!releaseDate) {
      skipped++;
      continue;
    }

    // Check if already exists
    const existing = await prisma.reproductiveRelease.findFirst({
      where: { animalId, releaseDate },
    });
    if (existing) {
      skipped++;
      continue;
    }

    // Calculate age in months
    const birthDate = toDate(row.dtnascimento);
    let ageMonths: number | null = null;
    if (birthDate) {
      const diffMs = releaseDate.getTime() - birthDate.getTime();
      ageMonths = Math.round(diffMs / (1000 * 60 * 60 * 24 * 30.44));
    }

    const weightKg = releaseWeights.get(fbId) || null;
    const notes = str(row.obsaptidao, 2000);

    await prisma.reproductiveRelease.create({
      data: {
        organizationId: ORG_ID,
        farmId: FARM_ID,
        animalId,
        releaseDate,
        weightKg,
        ageMonths,
        responsibleName,
        notes,
        recordedBy: USER_ID,
      },
    });

    // Mark animal as reproductively released and update category
    await prisma.animal.update({
      where: { id: animalId },
      data: {
        reproductivelyReleased: true,
        category: row.sexo === 'M' ? 'NOVILHO' : 'NOVILHA',
      },
    });

    created++;
  }

  console.log(
    `  ✓ Liberações reprodutivas: ${created} criadas, ${skipped} já existiam ou sem dados`,
  );
}

// ─── Update Animal Categories ────────────────────────────────────────

async function updateAnimalCategories(
  prisma: PrismaClient,
  animalMap: Map<number, string>,
): Promise<void> {
  console.log('\n── Atualizar Categorias ──');

  // 1. Get FDB category per animal
  const catRows = query(`
    SELECT a.CDANIMAL, a.CDCATEGORIA, a.SEXO, a.MATRIZSECA
    FROM ANIMAL a
    WHERE a.TIPOANIMAL = 'A'
  `);

  // 2. Get animals that had partos (CDTIPOREPRODUCAO=7)
  const partoRows = query(`
    SELECT DISTINCT r.CDANIMAL
    FROM REPRODUCAO r
    WHERE r.CDTIPOREPRODUCAO = 7
  `);
  const hadParto = new Set<number>();
  for (const r of partoRows) {
    hadParto.add(r.cdanimal as number);
  }
  console.log(`  Animais com parto: ${hadParto.size}`);

  let vacaLactacao = 0;
  let vacaSeca = 0;
  let touroReprod = 0;
  let novilha = 0;
  const novilho = 0;
  let skipped = 0;

  for (const row of catRows) {
    const fbId = row.cdanimal as number;
    const animalId = animalMap.get(fbId);
    if (!animalId) {
      skipped++;
      continue;
    }

    const cat = row.cdcategoria as number;
    const _sex = row.sexo as string | null;
    const matrizSeca = row.matrizseca as number;
    let newCategory: string | null = null;

    // Vaca: CDCATEGORIA=7 ou teve parto
    if (cat === 7 || hadParto.has(fbId)) {
      newCategory = matrizSeca === 1 ? 'VACA_SECA' : 'VACA_LACTACAO';
      if (newCategory === 'VACA_LACTACAO') vacaLactacao++;
      else vacaSeca++;
    }
    // Reprodutor: CDCATEGORIA=2
    else if (cat === 2) {
      newCategory = 'TOURO_REPRODUTOR';
      touroReprod++;
    }
    // Novilha: CDCATEGORIA=6
    else if (cat === 6) {
      newCategory = 'NOVILHA';
      novilha++;
    }
    // Em crescimento: depende do sexo e da liberação (já tratado nos steps anteriores)
    else if (cat === 1 || cat === 5) {
      // Mantém a categoria que os steps anteriores definiram
      continue;
    }

    if (newCategory) {
      await prisma.animal.update({
        where: { id: animalId },
        data: { category: newCategory as never },
      });
    }
  }

  console.log(`  ✓ Vaca Lactação: ${vacaLactacao}`);
  console.log(`  ✓ Vaca Seca: ${vacaSeca}`);
  console.log(`  ✓ Touro Reprodutor: ${touroReprod}`);
  console.log(`  ✓ Novilha: ${novilha}`);
  console.log(`  ✓ Novilho: ${novilho}`);
  console.log(`  ⊘ Sem correspondência: ${skipped}`);
}

// ─── Import Inseminations (Inseminações) ────────────────────────────

async function importInseminations(
  prisma: PrismaClient,
  animalMap: Map<number, string>,
): Promise<void> {
  console.log('\n── Inseminações ──');

  // Check existing count to detect re-runs
  const existingCount = await prisma.insemination.count({
    where: { farmId: FARM_ID },
  });
  if (existingCount > 0) {
    console.log(`  ⊘ Já existem ${existingCount} inseminações nesta fazenda, pulando`);
    return;
  }

  // Pre-load inseminator names from PESSOA
  const pessoaRows = query('SELECT p.CDPESSOA, p.NOME FROM PESSOA p');
  const pessoaNames = new Map<number, string>();
  for (const p of pessoaRows) {
    pessoaNames.set(p.cdpessoa as number, (p.nome as string) || 'Desconhecido');
  }
  console.log(`  Inseminadores carregados: ${pessoaNames.size}`);

  // Pre-load bull name map: FDB CDANIMAL → bull name (for TIPOANIMAL I/S)
  const bullAnimalRows = query(`
    SELECT a.CDANIMAL, a.NOME, a.NUMERO
    FROM ANIMAL a
    WHERE a.TIPOANIMAL IN ('I', 'S')
  `);
  const fbIdToBullName = new Map<number, string>();
  for (const b of bullAnimalRows) {
    fbIdToBullName.set(
      b.cdanimal as number,
      (str(b.nome, 100) || str(b.numero, 100) || `Touro ${b.cdanimal}`) as string,
    );
  }

  // Pre-load bulls from DB by name → id
  const dbBulls = await prisma.bull.findMany({
    where: { farmId: FARM_ID },
    select: { id: true, name: true },
  });
  const bullNameToId = new Map<string, string>();
  for (const b of dbBulls) {
    bullNameToId.set(b.name, b.id);
  }
  console.log(`  Touros no banco: ${bullNameToId.size}`);

  // Map CONDICAOIA to insemination type
  const mapInseminationType = (cond: string | null): string => {
    if (cond === 'I') return 'IATF';
    if (cond === 'P') return 'HEAT_DURING_PROTOCOL';
    return 'NATURAL_HEAT';
  };

  let created = 0;
  let skipped = 0;

  for (const batch of queryBatched(
    `SELECT r.CDREPRODUCAO, r.CDANIMAL, r.DATA, r.CDREPRODUTOR,
            r.CDPESSOA, r.NUMDOSES, r.CONDICAOIA, r.OBSERVACAO
     FROM REPRODUCAO r
     WHERE r.CDTIPOREPRODUCAO = 1
     ORDER BY r.DATA, r.CDREPRODUCAO`,
    'REPRODUCAO(IA)',
    2000,
  )) {
    const inserts: Array<{
      organizationId: string;
      farmId: string;
      animalId: string;
      inseminationType: string;
      bullId?: string;
      dosesUsed: number;
      inseminatorName: string;
      inseminationDate: Date;
      observations?: string;
      recordedBy: string;
    }> = [];

    for (const row of batch) {
      const animalId = animalMap.get(row.cdanimal as number);
      if (!animalId) {
        skipped++;
        continue;
      }

      // Verify animal exists in this farm
      const inseminationDate = toDate(row.data);
      if (!inseminationDate) {
        skipped++;
        continue;
      }

      // Resolve bull
      let bullId: string | undefined;
      const reprodutorFbId = row.cdreprodutor as number | null;
      if (reprodutorFbId) {
        const bullName = fbIdToBullName.get(reprodutorFbId);
        if (bullName) {
          bullId = bullNameToId.get(bullName);
        }
      }

      // Resolve inseminator name
      const pessoaId = row.cdpessoa as number | null;
      const inseminatorName = pessoaId
        ? pessoaNames.get(pessoaId) || 'Importação FDB'
        : 'Importação FDB';

      const doses = row.numdoses ? Math.round(Number(row.numdoses)) : 1;
      const obs = str(row.observacao, 500);

      inserts.push({
        organizationId: ORG_ID,
        farmId: FARM_ID,
        animalId,
        inseminationType: mapInseminationType(row.condicaoia as string | null),
        ...(bullId ? { bullId } : {}),
        dosesUsed: doses || 1,
        inseminatorName,
        inseminationDate,
        ...(obs ? { observations: obs } : {}),
        recordedBy: USER_ID,
      });
    }

    if (inserts.length > 0) {
      await prisma.insemination.createMany({ data: inserts });
      created += inserts.length;
    }
  }

  console.log(`  ✓ Inseminações: ${created} criadas, ${skipped} sem animal/dados`);
}

// ─── Import Calvings (Partos) ────────────────────────────────────────

async function importCalvings(prisma: PrismaClient, animalMap: Map<number, string>): Promise<void> {
  console.log('\n── Partos ──');

  // Check existing count to detect re-runs
  const existingCount = await prisma.calvingEvent.count({
    where: { farmId: FARM_ID },
  });
  if (existingCount > 0) {
    console.log(`  ⊘ Já existem ${existingCount} partos nesta fazenda, pulando`);
    return;
  }

  // Pre-load attendant names from PESSOA
  const pessoaRows = query('SELECT p.CDPESSOA, p.NOME FROM PESSOA p');
  const pessoaNames = new Map<number, string>();
  for (const p of pessoaRows) {
    pessoaNames.set(p.cdpessoa as number, (p.nome as string) || 'Desconhecido');
  }

  // Pre-load valid animal IDs in this farm
  const existingAnimals = await prisma.animal.findMany({
    where: { farmId: FARM_ID },
    select: { id: true },
  });
  const validAnimalIds = new Set(existingAnimals.map((a) => a.id));

  // Map CDTIPOPARTO → BirthType
  const mapBirthType = (tipo: number | null): string => {
    if (tipo === 2) return 'ASSISTED_EASY';
    if (tipo === 3) return 'ASSISTED_DIFFICULT';
    if (tipo === 4) return 'CESAREAN';
    return 'NORMAL'; // 1 or null
  };

  // Map FDB sex codes → our model
  const mapCalfSex = (sexo: string | null): string => {
    if (sexo === 'M') return 'MALE';
    if (sexo === 'F') return 'FEMALE';
    return 'UNKNOWN';
  };

  let calvingsCreated = 0;
  let calvesCreated = 0;
  let skipped = 0;

  for (const batch of queryBatched(
    `SELECT r.CDREPRODUCAO, r.CDANIMAL, r.DATA, r.HORA,
            r.CDREPRODUTOR, r.CDPESSOA, r.OBSERVACAO,
            r.CDTIPOPARTO, r.NUMCRIA, r.RETENCAOPLACENTA,
            r.SEXOCRIA1, r.SEXOCRIA2, r.CDANIMALCRIA1, r.CDANIMALCRIA2
     FROM REPRODUCAO r
     WHERE r.CDTIPOREPRODUCAO = 7
     ORDER BY r.DATA, r.CDREPRODUCAO`,
    'REPRODUCAO(PARTO)',
    2000,
  )) {
    for (const row of batch) {
      const motherId = animalMap.get(row.cdanimal as number);
      if (!motherId) {
        skipped++;
        continue;
      }

      const eventDate = toDate(row.data);
      if (!eventDate) {
        skipped++;
        continue;
      }

      // Resolve attendant
      const pessoaId = row.cdpessoa as number | null;
      const attendantName = pessoaId
        ? pessoaNames.get(pessoaId) || 'Importação FDB'
        : 'Importação FDB';

      // Resolve father
      const reprodutorFbId = row.cdreprodutor as number | null;
      const mappedFatherId = reprodutorFbId ? animalMap.get(reprodutorFbId) : null;
      const fatherId = mappedFatherId && validAnimalIds.has(mappedFatherId) ? mappedFatherId : null;

      const retencao = row.retencaoplacenta as number | null;
      const obs = str(row.observacao, 500);
      const hora = str(row.hora, 5);

      try {
        // Create CalvingEvent
        const calvingEvent = await prisma.calvingEvent.create({
          data: {
            organizationId: ORG_ID,
            farmId: FARM_ID,
            motherId,
            fatherId,
            eventType: 'BIRTH',
            eventDate,
            eventTime: hora,
            birthType: mapBirthType(row.cdtipoparto as number | null) as never,
            attendantName,
            notes: obs,
            recordedBy: USER_ID,
            placentaRetention: retencao === 1,
            retentionIntervention: false,
          },
        });
        calvingsCreated++;

        // Create CalvingCalf records
        const numCria = (row.numcria as number) || 0;
        const criaEntries: Array<{
          sex: string;
          fbAnimalId: number | null;
        }> = [];

        if (numCria >= 1 || row.sexocria1) {
          criaEntries.push({
            sex: mapCalfSex(row.sexocria1 as string | null),
            fbAnimalId: row.cdanimalcria1 as number | null,
          });
        }
        if (numCria >= 2 || row.sexocria2) {
          criaEntries.push({
            sex: mapCalfSex(row.sexocria2 as string | null),
            fbAnimalId: row.cdanimalcria2 as number | null,
          });
        }

        for (const cria of criaEntries) {
          const createdAnimalId = cria.fbAnimalId ? animalMap.get(cria.fbAnimalId) : null;
          const validCreatedAnimalId =
            createdAnimalId && validAnimalIds.has(createdAnimalId) ? createdAnimalId : null;

          // Get birth weight from PESO table if calf animal exists
          let birthWeightKg: number | null = null;
          if (cria.fbAnimalId) {
            const weightRows = query(
              `SELECT p.PESO FROM PESO p WHERE p.CDANIMAL = ${cria.fbAnimalId} AND p.CDTIPOPESO IN (1, 2) ROWS 1`,
            );
            if (weightRows.length > 0) {
              const w = Number(weightRows[0].peso);
              if (w > 0) birthWeightKg = w;
            }
          }

          // Get earTag from the calf animal record
          let earTag: string | null = null;
          if (validCreatedAnimalId) {
            const calfAnimal = await prisma.animal.findUnique({
              where: { id: validCreatedAnimalId },
              select: { earTag: true },
            });
            earTag = calfAnimal?.earTag || null;
          }

          await prisma.calvingCalf.create({
            data: {
              calvingEventId: calvingEvent.id,
              sex: cria.sex,
              birthWeightKg,
              condition: 'ALIVE',
              createdAnimalId: validCreatedAnimalId,
              earTag,
            },
          });
          calvesCreated++;
        }
      } catch (_e) {
        skipped++;
      }
    }
  }

  console.log(`  ✓ Partos: ${calvingsCreated} criados, ${calvesCreated} crias vinculadas`);
  console.log(`  ⊘ Skipped: ${skipped}`);
}

// ─── Import Pregnancy Diagnoses (Diagnósticos de Gestação) ──────────

async function importPregnancyDiagnoses(
  prisma: PrismaClient,
  animalMap: Map<number, string>,
): Promise<void> {
  console.log('\n── Diagnósticos de Gestação ──');

  // Check existing count
  const existingCount = await prisma.pregnancyDiagnosis.count({
    where: { farmId: FARM_ID },
  });
  if (existingCount > 0) {
    console.log(`  ⊘ Já existem ${existingCount} diagnósticos nesta fazenda, pulando`);
    return;
  }

  // Pre-load vet names from PESSOA
  const pessoaRows = query('SELECT p.CDPESSOA, p.NOME FROM PESSOA p');
  const pessoaNames = new Map<number, string>();
  for (const p of pessoaRows) {
    pessoaNames.set(p.cdpessoa as number, (p.nome as string) || 'Desconhecido');
  }

  const mapResult = (diag: string | null): 'PREGNANT' | 'EMPTY' => {
    if (diag === 'P') return 'PREGNANT';
    return 'EMPTY';
  };

  let created = 0;
  let skipped = 0;

  for (const batch of queryBatched(
    `SELECT r.CDREPRODUCAO, r.CDANIMAL, r.DATA, r.DIAGNOSTICO,
            r.CDPESSOA, r.OBSERVACAO, r.DTPARTOPROVAVEL
     FROM REPRODUCAO r
     WHERE r.CDTIPOREPRODUCAO = 4
     ORDER BY r.DATA, r.CDREPRODUCAO`,
    'REPRODUCAO(DG)',
    3000,
  )) {
    const inserts: Array<{
      organizationId: string;
      farmId: string;
      animalId: string;
      diagnosisDate: Date;
      result: 'PREGNANT' | 'EMPTY';
      method: 'PALPATION';
      expectedCalvingDate?: Date | null;
      veterinaryName: string;
      notes?: string | null;
      recordedBy: string;
    }> = [];

    for (const row of batch) {
      const animalId = animalMap.get(row.cdanimal as number);
      if (!animalId) {
        skipped++;
        continue;
      }

      const diagnosisDate = toDate(row.data);
      if (!diagnosisDate) {
        skipped++;
        continue;
      }

      const pessoaId = row.cdpessoa as number | null;
      const veterinaryName = pessoaId
        ? pessoaNames.get(pessoaId) || 'Importação FDB'
        : 'Importação FDB';

      const expectedCalvingDate = toDate(row.dtpartoprovavel);
      const obs = str(row.observacao, 500);

      inserts.push({
        organizationId: ORG_ID,
        farmId: FARM_ID,
        animalId,
        diagnosisDate,
        result: mapResult(row.diagnostico as string | null),
        method: 'PALPATION',
        ...(expectedCalvingDate ? { expectedCalvingDate } : {}),
        veterinaryName,
        ...(obs ? { notes: obs } : {}),
        recordedBy: USER_ID,
      });
    }

    if (inserts.length > 0) {
      await prisma.pregnancyDiagnosis.createMany({ data: inserts });
      created += inserts.length;
    }
  }

  // Also create entries in animal_reproductive_records timeline
  console.log('  Criando registros na timeline reprodutiva...');
  const dgRecords = await prisma.pregnancyDiagnosis.findMany({
    where: { farmId: FARM_ID },
    select: {
      animalId: true,
      diagnosisDate: true,
      result: true,
      veterinaryName: true,
      notes: true,
      recordedBy: true,
    },
  });

  const timelineInserts = dgRecords.map((dg) => ({
    animalId: dg.animalId,
    farmId: FARM_ID,
    type: 'PREGNANCY' as const,
    eventDate: dg.diagnosisDate,
    confirmationMethod: 'PALPATION' as const,
    notes: `${dg.result === 'PREGNANT' ? 'Positivo' : 'Negativo'}${dg.notes ? '. ' + dg.notes : ''}`,
    recordedBy: dg.recordedBy,
  }));

  // Insert in batches of 5000
  for (let i = 0; i < timelineInserts.length; i += 5000) {
    const chunk = timelineInserts.slice(i, i + 5000);
    await prisma.animalReproductiveRecord.createMany({ data: chunk });
  }

  console.log(`  ✓ Diagnósticos: ${created} criados, ${skipped} sem animal/dados`);
  console.log(`  ✓ Timeline: ${timelineInserts.length} registros criados`);
}

// ─── Import Lactations (Lactações) ──────────────────────────────────

async function importLactations(
  prisma: PrismaClient,
  animalMap: Map<number, string>,
): Promise<void> {
  console.log('\n── Lactações ──');

  // Check existing count to detect re-runs
  const existingCount = await prisma.lactation.count({
    where: { farmId: FARM_ID },
  });
  if (existingCount > 0) {
    console.log(`  ⊘ Já existem ${existingCount} lactações nesta fazenda, pulando`);
    return;
  }

  // Track lactation number per animal (incremental)
  const animalLactationCount = new Map<string, number>();

  let created = 0;
  let skipped = 0;

  for (const batch of queryBatched(
    `SELECT l.CDLACTACAO, l.CDANIMAL, l.DTINICIO, l.DTFIM, l.OBSINICIO, l.OBSFIM
     FROM LACTACAO l ORDER BY l.CDANIMAL, l.DTINICIO, l.CDLACTACAO`,
    'LACTACAO',
    2000,
  )) {
    for (const row of batch) {
      const animalId = animalMap.get(row.cdanimal as number);
      if (!animalId) {
        skipped++;
        continue;
      }

      const startDate = toDate(row.dtinicio);
      if (!startDate) {
        skipped++;
        continue;
      }

      const count = (animalLactationCount.get(animalId) || 0) + 1;
      animalLactationCount.set(animalId, count);

      const endDate = toDate(row.dtfim);
      const obsInicio = str(row.obsinicio, 500);
      const obsFim = str(row.obsfim, 500);
      const notes = [obsInicio, obsFim].filter(Boolean).join('. ') || null;

      // Calculate duration if both dates exist
      let durationDays: number | null = null;
      if (endDate) {
        durationDays = Math.round(
          (endDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24),
        );
      }

      try {
        await prisma.lactation.create({
          data: {
            organizationId: ORG_ID,
            farmId: FARM_ID,
            animalId,
            lactationNumber: count,
            startDate,
            endDate,
            origin: 'BIRTH',
            status: endDate ? 'DRIED' : 'IN_PROGRESS',
            durationDays,
            notes,
            recordedBy: USER_ID,
          },
        });
        created++;
      } catch {
        skipped++;
      }
    }
  }

  console.log(`  ✓ Lactações: ${created} criadas, ${skipped} sem animal/dados`);
}

// ─── Import Milk Records (Pesagens de Leite) ────────────────────────

async function importMilkRecords(
  prisma: PrismaClient,
  animalMap: Map<number, string>,
): Promise<void> {
  console.log('\n── Pesagens de Leite ──');

  // Check existing count to detect re-runs
  const existingCount = await prisma.milkingRecord.count({
    where: { farmId: FARM_ID },
  });
  if (existingCount > 0) {
    console.log(`  ⊘ Já existem ${existingCount} registros de leite nesta fazenda, pulando`);
    return;
  }

  let created = 0;
  let skipped = 0;

  for (const batch of queryBatched(
    `SELECT l.CDLEITE, l.CDLACTACAO, l.CDANIMAL, l.DTLEITE,
            l.PESO1, l.PESO2, l.PESO3, l.PESOTOTAL
     FROM LEITE l ORDER BY l.DTLEITE, l.CDLEITE`,
    'LEITE',
    5000,
  )) {
    const inserts: Array<{
      organizationId: string;
      farmId: string;
      animalId: string;
      milkingDate: Date;
      shift: 'MORNING' | 'AFTERNOON' | 'NIGHT';
      liters: number;
      variationAlert: boolean;
      recordedBy: string;
    }> = [];

    // Track seen (animalId + date + shift) to avoid unique constraint violations within batch
    const seen = new Set<string>();

    for (const row of batch) {
      const animalId = animalMap.get(row.cdanimal as number);
      if (!animalId) {
        skipped++;
        continue;
      }

      const milkingDate = toDate(row.dtleite);
      if (!milkingDate) {
        skipped++;
        continue;
      }

      const dateStr = milkingDate.toISOString().slice(0, 10);

      const shifts: Array<{ shift: 'MORNING' | 'AFTERNOON' | 'NIGHT'; liters: number | null }> = [
        { shift: 'MORNING', liters: row.peso1 != null ? Number(row.peso1) : null },
        { shift: 'AFTERNOON', liters: row.peso2 != null ? Number(row.peso2) : null },
        { shift: 'NIGHT', liters: row.peso3 != null ? Number(row.peso3) : null },
      ];

      let inserted = false;
      for (const s of shifts) {
        if (s.liters && s.liters > 0) {
          const key = `${animalId}:${dateStr}:${s.shift}`;
          if (seen.has(key)) {
            skipped++;
            continue;
          }
          seen.add(key);

          inserts.push({
            organizationId: ORG_ID,
            farmId: FARM_ID,
            animalId,
            milkingDate,
            shift: s.shift,
            liters: s.liters,
            variationAlert: false,
            recordedBy: USER_ID,
          });
          inserted = true;
        }
      }

      // If no individual shifts, use total as MORNING
      if (!inserted) {
        const totalKg = row.pesototal != null ? Number(row.pesototal) : 0;
        if (totalKg > 0) {
          const key = `${animalId}:${dateStr}:MORNING`;
          if (!seen.has(key)) {
            seen.add(key);
            inserts.push({
              organizationId: ORG_ID,
              farmId: FARM_ID,
              animalId,
              milkingDate,
              shift: 'MORNING',
              liters: totalKg,
              variationAlert: false,
              recordedBy: USER_ID,
            });
          } else {
            skipped++;
          }
        } else {
          skipped++;
        }
      }
    }

    // Bulk insert batch
    if (inserts.length > 0) {
      try {
        await prisma.milkingRecord.createMany({ data: inserts, skipDuplicates: true });
        created += inserts.length;
      } catch (_e) {
        // Fallback: insert one by one if batch fails
        for (const record of inserts) {
          try {
            await prisma.milkingRecord.create({ data: record });
            created++;
          } catch {
            skipped++;
          }
        }
      }
    }
  }

  console.log(`  ✓ Registros de leite: ${created} criados, ${skipped} sem animal/dados`);
}

// ─── Import Animal Exits (Baixas) ───────────────────────────────────

async function importAnimalExits(
  prisma: PrismaClient,
  animalMap: Map<number, string>,
): Promise<void> {
  console.log('\n── Baixas de Animais ──');

  // Check existing count to detect re-runs
  const existingCount = await prisma.animalExit.count({
    where: { farmId: FARM_ID },
  });
  if (existingCount > 0) {
    console.log(`  ⊘ Já existem ${existingCount} baixas nesta fazenda, pulando`);
    return;
  }

  // Pre-load TIPOBAIXA (1=Voluntária, 2=Descarte involuntário, 3=Morte)
  const tipoRows = query('SELECT tb.CDTIPOBAIXA, tb.DESCRICAO FROM TIPOBAIXA tb');
  const tipoMap = new Map<number, string>();
  for (const r of tipoRows) {
    tipoMap.set(r.cdtipobaixa as number, String(r.descricao || '').toLowerCase());
  }
  console.log(
    `  Tipos de baixa: ${[...tipoMap.entries()].map(([k, v]) => `${k}=${v}`).join(', ')}`,
  );

  // Pre-load MOTIVOBAIXA
  const motivoRows = query('SELECT mb.CDMOTIVOBAIXA, mb.DESCRICAO FROM MOTIVOBAIXA mb');
  const motivoMap = new Map<number, string>();
  for (const r of motivoRows) {
    motivoMap.set(r.cdmotivobaixa as number, String(r.descricao || ''));
  }
  console.log(`  Motivos de baixa: ${motivoMap.size}`);

  // Map FDB tipo+motivo → AnimalExitType
  const mapExitType = (tipoBaixa: number | null, motivoBaixa: number | null): string => {
    // Specific motivos override tipoBaixa
    if (motivoBaixa === 89) return 'VENDA';
    if (motivoBaixa === 90) return 'ABATE';
    if (motivoBaixa === 1002) return 'DOACAO';
    if (motivoBaixa === 1014) return 'VENDA'; // Romaneio = venda
    if (motivoBaixa === 1013) return 'PERDA'; // Roubo

    // By tipoBaixa
    if (tipoBaixa === 3) return 'MORTE';
    if (tipoBaixa === 1) return 'VENDA'; // Voluntária = venda/descarte
    if (tipoBaixa === 2) return 'PERDA'; // Descarte involuntário

    return 'PERDA'; // fallback
  };

  let created = 0;
  let softDeleted = 0;
  let skipped = 0;

  for (const batch of queryBatched(
    `SELECT a.CDANIMAL, a.DTBAIXA, a.CDTIPOBAIXA, a.CDMOTIVOBAIXA, a.OBSBAIXA
     FROM ANIMAL a
     WHERE a.DTBAIXA IS NOT NULL AND a.TIPOANIMAL = 'A'
     ORDER BY a.DTBAIXA, a.CDANIMAL`,
    'ANIMAL(BAIXA)',
    2000,
  )) {
    for (const row of batch) {
      const animalId = animalMap.get(row.cdanimal as number);
      if (!animalId) {
        skipped++;
        continue;
      }

      const exitDate = toDate(row.dtbaixa);
      if (!exitDate) {
        skipped++;
        continue;
      }

      const tipoBaixa = row.cdtipobaixa as number | null;
      const motivoBaixa = row.cdmotivobaixa as number | null;
      const exitType = mapExitType(tipoBaixa, motivoBaixa);

      // Build notes with motivo description
      const motivoDesc = motivoBaixa ? motivoMap.get(motivoBaixa) || null : null;
      const obs = str(row.obsbaixa, 500);
      const notesParts: string[] = [];
      if (motivoDesc) notesParts.push(`Motivo: ${motivoDesc}`);
      if (obs) notesParts.push(obs);
      const notes = notesParts.length > 0 ? notesParts.join('. ') : null;

      // For MORTE, use motivo as deathCause
      const deathCause = exitType === 'MORTE' ? motivoDesc || null : null;

      try {
        await prisma.animalExit.create({
          data: {
            organizationId: ORG_ID,
            animalId,
            farmId: FARM_ID,
            exitType: exitType as never,
            exitDate,
            deathCause,
            notes,
            createdBy: USER_ID,
          },
        });
        created++;

        // Soft delete the animal (same as the service does)
        await prisma.animal.update({
          where: { id: animalId },
          data: { deletedAt: exitDate },
        });
        softDeleted++;
      } catch {
        skipped++;
      }
    }
  }

  // Summary by exit type
  const summary = await prisma.animalExit.groupBy({
    by: ['exitType'],
    where: { farmId: FARM_ID },
    _count: true,
  });
  for (const s of summary) {
    console.log(`    ${s.exitType}: ${s._count}`);
  }

  console.log(`  ✓ Baixas: ${created} criadas, ${softDeleted} animais soft-deleted`);
  console.log(`  ⊘ Skipped: ${skipped}`);
}

// ─── Import Body Weighings (Pesagens Corporais) ─────────────────────

const TIPO_PESO_LABELS: Record<number, string> = {
  0: 'Rotina',
  4: 'Aptidão',
  5: 'Parto',
  6: 'Entrada na fazenda',
  7: 'Saída',
  8: 'Entrada confinamento',
  9: 'Saída confinamento',
  10: 'Secagem',
  11: 'Vacina',
  12: 'Embarque para abate',
  13: 'Maternal',
  14: 'Pré-parto',
};

async function importWeighings(
  prisma: PrismaClient,
  animalMap: Map<number, string>,
): Promise<void> {
  console.log('\n── Pesagens Corporais ──');

  // Check existing count to detect re-runs
  const existingCount = await prisma.animalWeighing.count({
    where: { farmId: FARM_ID },
  });
  if (existingCount > 0) {
    console.log(`  ⊘ Já existem ${existingCount} pesagens nesta fazenda, pulando`);
    return;
  }

  let created = 0;
  let skipped = 0;

  // Exclude types 1,2 (nascimento → entryWeightKg) and 3 (desmama → weaning_records)
  for (const batch of queryBatched(
    `SELECT p.CDPESO, p.CDANIMAL, p.DTPESO, p.PESO, p.CDTIPOPESO, p.OBSERVACAO
     FROM PESO p
     WHERE p.CDTIPOPESO NOT IN (1, 2, 3)
     ORDER BY p.DTPESO, p.CDPESO`,
    'PESO',
    2000,
  )) {
    const inserts: Array<{
      animalId: string;
      farmId: string;
      weightKg: number;
      measuredAt: Date;
      notes: string | null;
      recordedBy: string;
    }> = [];

    for (const row of batch) {
      const animalId = animalMap.get(row.cdanimal as number);
      if (!animalId) {
        skipped++;
        continue;
      }

      const measuredAt = toDate(row.dtpeso);
      if (!measuredAt) {
        skipped++;
        continue;
      }

      const weightKg = Number(row.peso);
      if (!weightKg || weightKg <= 0) {
        skipped++;
        continue;
      }

      const tipoPeso = row.cdtipopeso as number;
      const tipoLabel = TIPO_PESO_LABELS[tipoPeso] || `Tipo ${tipoPeso}`;
      const obs = str(row.observacao, 500);
      const notes = obs ? `${tipoLabel}. ${obs}` : tipoLabel;

      inserts.push({
        animalId,
        farmId: FARM_ID,
        weightKg,
        measuredAt,
        notes,
        recordedBy: USER_ID,
      });
    }

    // Bulk insert batch
    if (inserts.length > 0) {
      await prisma.animalWeighing.createMany({ data: inserts });
      created += inserts.length;
    }
  }

  console.log(`  ✓ Pesagens: ${created} criadas, ${skipped} sem animal/dados`);
}

// ─── Main ────────────────────────────────────────────────────────────

async function main() {
  console.log('╔════════════════════════════════════════════════╗');
  console.log('║  Import Animais → Fazenda Limeira              ║');
  console.log('╚════════════════════════════════════════════════╝');
  console.log(`  Org:     ${ORG_ID}`);
  console.log(`  Farm:    ${FARM_ID}`);
  console.log(`  User:    ${USER_ID}`);

  const fdbPath = resolve(__dirname, '..', '..', '..', '..', 'DADOS988.FDB');
  const databaseUrl =
    process.env.DATABASE_URL ||
    'postgresql://protos:protos@localhost:5450/protos_farm?schema=public';

  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: databaseUrl }),
    log: ['warn', 'error'],
  });

  try {
    // Ensure Firebird container
    console.log('\n── Docker ──');
    ensureContainer(fdbPath);

    const startTime = Date.now();

    // Step 1: Import breeds
    const breedMap = await importBreeds(prisma);

    // Step 2: Import animals
    const animalMap = await importAnimals(prisma);

    // Step 3: Link breed compositions
    await importBreedCompositions(prisma, animalMap, breedMap);

    // Step 4: Set parent references (pai/mãe)
    await setParentReferences(prisma, animalMap);

    // Step 5: Set birth weights
    await setBirthWeights(prisma, animalMap);

    // Step 6: Migrate semen/bulls from animals to bulls table
    await migrateSemenToBulls(prisma, animalMap, breedMap);

    // Step 7: Import weaning records
    await importWeaningRecords(prisma, animalMap);

    // Step 8: Import reproductive releases
    await importReproductiveReleases(prisma, animalMap);

    // Step 9: Update animal categories based on FDB data
    await updateAnimalCategories(prisma, animalMap);

    // Step 10: Import inseminations
    await importInseminations(prisma, animalMap);

    // Step 11: Import pregnancy diagnoses
    await importPregnancyDiagnoses(prisma, animalMap);

    // Step 12: Import calvings (partos)
    await importCalvings(prisma, animalMap);

    // Step 13: Import lactations
    await importLactations(prisma, animalMap);

    // Step 14: Import milk records
    await importMilkRecords(prisma, animalMap);

    // Step 15: Import animal exits (baixas)
    await importAnimalExits(prisma, animalMap);

    // Step 16: Import body weighings
    await importWeighings(prisma, animalMap);

    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);

    console.log('\n╔════════════════════════════════════════════════╗');
    console.log('║  Import Completo!                              ║');
    console.log('╚════════════════════════════════════════════════╝');
    console.log(`  Tempo: ${elapsed}s`);
    console.log(`  Raças:       ${breedMap.size}`);
    console.log(`  Animais:     ${animalMap.size}`);
  } catch (error) {
    console.error('\n  ✗ Import falhou:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main().catch(console.error);
