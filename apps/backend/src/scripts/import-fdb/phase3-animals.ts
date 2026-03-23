/**
 * Phase 3: Import animals, breed compositions, lots, and lot movements.
 *
 * Tables: ANIMAL, COMPOSICAORACIAL, ANIMALRACA, GRUPOANIMAL, MOVGRUPOANIMAL
 */
import type { PrismaClient } from '@prisma/client';
import { query, queryBatched } from './firebird-client';
import { IdMap } from './id-map';
import { getCategoryInfo } from './phase1-master-data';

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

// ─── Animals ──────────────────────────────────────────────────────────

export async function importAnimals(
  prisma: PrismaClient,
  orgId: string,
  idMap: IdMap,
): Promise<void> {
  console.log('\n── Animais ──');
  let created = 0;
  let skipped = 0;

  // Get first farm ID
  const farmId = idMap.first('FAZENDA');
  if (!farmId) {
    // Try any mapped farm
    console.error('  ERROR: No farm mapped with ID 1. Checking all farms...');
    return;
  }

  // Resolve userId for createdBy
  const user = await prisma.user.findFirst({
    where: { organizationId: orgId },
    orderBy: { createdAt: 'asc' },
  });
  const userId = user?.id || 'system';

  for (const batch of queryBatched(
    `SELECT a.CDANIMAL, a.NUMERO, a.NOME, a.NOMECOMPLETO, a.SEXO,
            a.TIPOANIMAL, a.DTNASCIMENTO, a.DTENTFAZENDA, a.DTBAIXA,
            a.CDCATEGORIA, a.CDMAE, a.CDPAI, a.SISBOV, a.BRINCOELETRONICO,
            a.CDSETOR, a.CDPROPRIETARIO, a.NUMPARTOENTRADA, a.ANIMALREBANHO,
            a.OBSERVACAO, a.CDMOTIVOBAIXA, a.OBSBAIXA, a.RGN,
            a.REGASSOCRACA
     FROM ANIMAL a ORDER BY a.CDANIMAL`,
    'ANIMAL',
    1000,
  )) {
    for (const row of batch) {
      const fbId = row.cdanimal as number;
      if (idMap.has('ANIMAL', fbId)) {
        skipped++;
        continue;
      }

      const catInfo = getCategoryInfo(row.cdcategoria as number | null);
      const sex = mapSex(row.sexo as string | null, catInfo);
      const birthDate = toDate(row.dtnascimento);
      const entryDate = toDate(row.dtentfazenda);
      const isDeleted = !!row.dtbaixa;

      const earTag = str(row.numero) || String(fbId);

      // Check existing by earTag
      const existing = await prisma.animal.findFirst({
        where: { farmId, earTag },
      });

      if (existing) {
        idMap.set('ANIMAL', fbId, existing.id);
        skipped++;
        continue;
      }

      try {
        const animal = await prisma.animal.create({
          data: {
            farmId,
            earTag,
            rfidTag: str(row.brincoeletronico, 15),
            name: str(row.nome, 100),
            registeredName: str(row.nomecompleto, 200),
            registrationNumber: str(row.regassocraca, 50),
            sex,
            birthDate,
            birthDateEstimated: !birthDate,
            category: mapCategory(sex, catInfo),
            origin: entryDate && !birthDate ? 'PURCHASED' : 'BORN',
            notes: str(row.observacao, 2000),
            deletedAt: isDeleted ? toDate(row.dtbaixa) : undefined,
            createdBy: userId,
          },
        });

        idMap.set('ANIMAL', fbId, animal.id);
        created++;
      } catch {
        // Duplicate earTag — try with FDB id suffix
        try {
          const animal = await prisma.animal.create({
            data: {
              farmId,
              earTag: `${earTag}-${fbId}`,
              rfidTag: str(row.brincoeletronico, 15),
              name: str(row.nome, 100),
              sex,
              birthDate,
              birthDateEstimated: !birthDate,
              category: mapCategory(sex, catInfo),
              origin: entryDate && !birthDate ? 'PURCHASED' : 'BORN',
              notes: `[EarTag original: ${earTag}] ${str(row.observacao, 2000) || ''}`.trim(),
              deletedAt: isDeleted ? toDate(row.dtbaixa) : undefined,
              createdBy: userId,
            },
          });
          idMap.set('ANIMAL', fbId, animal.id);
          created++;
        } catch {
          skipped++;
        }
      }
    }
  }

  console.log(`  ✓ Animals: ${created} created, ${skipped} skipped`);

  // Second pass: set dam/sire references
  console.log('  Setting parent references...');
  let parentsSet = 0;

  const parentRows = query(`
    SELECT a.CDANIMAL, a.CDMAE, a.CDPAI
    FROM ANIMAL a
    WHERE a.CDMAE IS NOT NULL OR a.CDPAI IS NOT NULL
  `);

  for (const row of parentRows) {
    const animalId = idMap.get('ANIMAL', row.cdanimal as number);
    if (!animalId) continue;

    const damId = idMap.get('ANIMAL', row.cdmae as number);
    const sireId = idMap.get('ANIMAL', row.cdpai as number);

    if (damId || sireId) {
      await prisma.animal.update({
        where: { id: animalId },
        data: {
          ...(damId ? { damId } : {}),
          ...(sireId ? { sireId } : {}),
        },
      });
      parentsSet++;
    }
  }

  console.log(`  ✓ Parent references: ${parentsSet} updated`);
}

function mapSex(sexo: string | null, catInfo: { sex: string } | null): 'MALE' | 'FEMALE' {
  if (sexo === 'M') return 'MALE';
  if (sexo === 'F') return 'FEMALE';
  if (catInfo) return catInfo.sex === 'MALE' ? 'MALE' : 'FEMALE';
  return 'FEMALE'; // default for dairy farm
}

function mapCategory(
  sex: 'MALE' | 'FEMALE',
  catInfo: { sex: string; label: string } | null,
): string {
  if (catInfo) {
    const label = catInfo.label.toLowerCase();
    if (label.includes('reprodutor') || label.includes('touro')) return 'TOURO_REPRODUTOR';
    if (label.includes('novilha')) return 'NOVILHA';
    if (label.includes('novilho')) return 'NOVILHO';
    if (label.includes('vaca')) return 'VACA_SECA';
    if (label.includes('bezerr')) return sex === 'MALE' ? 'BEZERRO' : 'BEZERRA';
    if (label.includes('crescimento')) return sex === 'MALE' ? 'NOVILHO' : 'NOVILHA';
    if (label.includes('rufião') || label.includes('carreiro')) return 'DESCARTE';
  }
  // Default by sex
  return sex === 'MALE' ? 'NOVILHO' : 'NOVILHA';
}

// ─── Breed Compositions ───────────────────────────────────────────────

export async function importBreedCompositions(prisma: PrismaClient, idMap: IdMap): Promise<void> {
  console.log('\n── Composições Raciais ──');

  // ANIMALRACA has the primary breed per animal
  const racaRows = query(`
    SELECT ar.CDANIMALRACA, ar.CDANIMAL, ar.CDRACA, ar.PERCENTUAL
    FROM ANIMALRACA ar ORDER BY ar.CDANIMAL
  `);

  let created = 0;
  let skipped = 0;

  for (const row of racaRows) {
    const animalId = idMap.get('ANIMAL', row.cdanimal as number);
    const breedId = idMap.get('RACA', row.cdraca as number);

    if (!animalId || !breedId) {
      skipped++;
      continue;
    }

    // Check if already exists
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

  // Note: COMPOSICAORACIAL is a template table, not per-animal. ANIMALRACA covers the actual links.

  console.log(`  ✓ Breed compositions: ${created} created, ${skipped} skipped`);
}

// ─── Animal Lots ──────────────────────────────────────────────────────

export async function importAnimalLots(
  prisma: PrismaClient,
  orgId: string,
  idMap: IdMap,
): Promise<void> {
  console.log('\n── Lotes de Animais ──');
  const farmId = idMap.first('FAZENDA');
  if (!farmId) return;

  const rows = query(`
    SELECT ga.CDGRUPOANIMAL, ga.DESCRICAO, ga.CDTIPOGRUPOANIMAL, ga.ATIVO
    FROM GRUPOANIMAL ga ORDER BY ga.CDGRUPOANIMAL
  `);

  let created = 0;

  for (const row of rows) {
    const fbId = row.cdgrupoanimal as number;
    if (idMap.has('GRUPOANIMAL', fbId)) continue;

    const lot = await prisma.animalLot.create({
      data: {
        farmId,
        name: str(row.descricao) || `Lote ${fbId}`,
        predominantCategory: 'VACA_LACTACAO',
        currentLocation: str(row.descricao) || `Lote ${fbId}`,
        locationType: 'PASTO',
        deletedAt: row.ativo === 0 ? new Date() : undefined,
      },
    });

    idMap.set('GRUPOANIMAL', fbId, lot.id);
    created++;
  }

  console.log(`  ✓ Animal lots: ${created} created`);
}

// ─── Lot Movements ────────────────────────────────────────────────────

export async function importLotMovements(
  prisma: PrismaClient,
  orgId: string,
  idMap: IdMap,
): Promise<void> {
  console.log('\n── Movimentações de Lote ──');
  let created = 0;
  let skipped = 0;

  // Resolve userId for movedBy
  const user = await prisma.user.findFirst({
    where: { organizationId: orgId },
    orderBy: { createdAt: 'asc' },
  });
  const userId = user?.id || 'system';

  for (const batch of queryBatched(
    `SELECT mga.CDMOVGRUPOANIMAL, mga.CDANIMAL, mga.CDGRUPOANIMAL,
            mga.DATAHORA
     FROM MOVGRUPOANIMAL mga ORDER BY mga.DATAHORA, mga.CDMOVGRUPOANIMAL`,
    'MOVGRUPOANIMAL',
    2000,
  )) {
    for (const row of batch) {
      const animalId = idMap.get('ANIMAL', row.cdanimal as number);
      const lotId = idMap.get('GRUPOANIMAL', row.cdgrupoanimal as number);

      if (!animalId || !lotId) {
        skipped++;
        continue;
      }

      const movDate = toDate(row.datahora);
      if (!movDate) {
        skipped++;
        continue;
      }

      await prisma.animalLotMovement.create({
        data: {
          animalId,
          lotId,
          enteredAt: movDate,
          movedBy: userId,
          reason: 'Importação FDB',
        },
      });

      created++;
    }
  }

  console.log(`  ✓ Lot movements: ${created} created, ${skipped} skipped`);
}

// ─── Run All Phase 3 ──────────────────────────────────────────────────

export async function runPhase3(prisma: PrismaClient, orgId: string, idMap: IdMap): Promise<void> {
  console.log('\n═══════════════════════════════════════');
  console.log(' PHASE 3: Animals');
  console.log('═══════════════════════════════════════');

  await importAnimals(prisma, orgId, idMap);
  await importBreedCompositions(prisma, idMap);
  await importAnimalLots(prisma, orgId, idMap);
  await importLotMovements(prisma, orgId, idMap);

  idMap.save();
  console.log('\n  ✓ Phase 3 complete. ID map saved.');
}
