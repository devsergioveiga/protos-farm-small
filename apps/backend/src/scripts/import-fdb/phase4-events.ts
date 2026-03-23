/**
 * Phase 4: Import livestock events.
 *
 * Tables: PESO, REPRODUCAO, LACTACAO, LEITE, MAMITE, EXAMEANIMAL
 *
 * Note: Uses Prisma.$executeRawUnsafe for inserts to bypass relation validation
 * issues with Prisma 7's strict connect requirements on required relations.
 */
import type { PrismaClient } from '@prisma/client';
import { query, queryBatched } from './firebird-client';
import { IdMap } from './id-map';
import { randomUUID } from 'crypto';

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

function toDecimal(val: string | number | null): number | null {
  if (val === null || val === undefined) return null;
  const n = Number(val);
  return isNaN(n) ? null : n;
}

// ─── Weighings ────────────────────────────────────────────────────────

export async function importWeighings(
  prisma: PrismaClient,
  orgId: string,
  idMap: IdMap,
): Promise<void> {
  console.log('\n── Pesagens ──');
  let created = 0;
  let skipped = 0;
  const farmId = idMap.first('FAZENDA')!;

  const user = await prisma.user.findFirst({
    where: { organizationId: orgId },
    orderBy: { createdAt: 'asc' },
  });
  const userId = user?.id || 'system';

  for (const batch of queryBatched(
    `SELECT p.CDPESO, p.CDANIMAL, p.DTPESO, p.PESO, p.CDTIPOPESO,
            p.OBSERVACAO
     FROM PESO p ORDER BY p.DTPESO, p.CDPESO`,
    'PESO',
    3000,
  )) {
    for (const row of batch) {
      const animalId = idMap.get('ANIMAL', row.cdanimal as number);
      if (!animalId) {
        skipped++;
        continue;
      }

      const weighDate = toDate(row.dtpeso);
      const weight = toDecimal(row.peso);
      if (!weighDate || !weight) {
        skipped++;
        continue;
      }

      try {
        await prisma.$executeRawUnsafe(
          `INSERT INTO animal_weighings (id, "animalId", "farmId", "weightKg", "measuredAt", notes, "recordedBy", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, NOW(), NOW())`,
          randomUUID(), animalId, farmId, weight, weighDate, str(row.observacao, 500), userId,
        );
        created++;
      } catch {
        skipped++;
      }
    }
  }

  console.log(`  ✓ Weighings: ${created} created, ${skipped} skipped`);
}

// ─── Reproduction Events ──────────────────────────────────────────────

export async function importReproduction(
  prisma: PrismaClient,
  orgId: string,
  userId: string,
  idMap: IdMap,
): Promise<void> {
  console.log('\n── Eventos Reprodutivos ──');

  const tipoRows = query(
    'SELECT tr.CDTIPOREPRODUCAO, tr.DESCRICAO FROM TIPOREPRODUCAO tr ORDER BY tr.CDTIPOREPRODUCAO',
  );
  const tipoMap = new Map<number, string>();
  for (const r of tipoRows) {
    tipoMap.set(r.cdtiporeproducao as number, String(r.descricao || '').toLowerCase());
  }
  console.log(`  Reproduction types: ${[...tipoMap.entries()].map(([k, v]) => `${k}=${v}`).join(', ')}`);

  const farmId = idMap.first('FAZENDA')!;

  // Pre-load ALL animal IDs (including soft-deleted) to validate FK references
  const existingAnimals = await prisma.animal.findMany({
    where: { farmId },
    select: { id: true },
  });
  const validAnimalIds = new Set(existingAnimals.map((a) => a.id));

  let inseminations = 0;
  let calvings = 0;
  let diagnoses = 0;
  let heats = 0;
  let others = 0;
  let skipped = 0;

  for (const batch of queryBatched(
    `SELECT r.CDREPRODUCAO, r.CDTIPOREPRODUCAO, r.CDANIMAL, r.DATA, r.HORA,
            r.CDREPRODUTOR, r.OBSERVACAO, r.CDPESSOA, r.DTPARTOPROVAVEL,
            r.DIAGNOSTICO, r.CDTIPOPARTO, r.NUMCRIA, r.CONDICAOIA,
            r.CIO, r.SEXOCRIA1, r.SEXOCRIA2, r.CDANIMALCRIA1, r.CDANIMALCRIA2,
            r.RETENCAOPLACENTA, r.TEMPERATURARETAL, r.CDPROTOCOLOIATF
     FROM REPRODUCAO r ORDER BY r.DATA, r.CDREPRODUCAO`,
    'REPRODUCAO',
    3000,
  )) {
    for (const row of batch) {
      const animalId = idMap.get('ANIMAL', row.cdanimal as number);
      if (!animalId) {
        skipped++;
        continue;
      }

      const eventDate = toDate(row.data);
      if (!eventDate) {
        skipped++;
        continue;
      }

      const tipo = tipoMap.get(row.cdtiporeproducao as number) || '';

      try {
        if (tipo.includes('insemina') || tipo.includes('ia') || tipo.includes('iatf')) {
          const mappedBullId = idMap.get('ANIMAL', row.cdreprodutor as number) || null;
          const bullId = mappedBullId && validAnimalIds.has(mappedBullId) ? mappedBullId : null;
          await prisma.$executeRawUnsafe(
            `INSERT INTO inseminations (id, "organizationId", "farmId", "animalId", "inseminationDate",
             "inseminationType", "inseminatorName", "bullId", observations, "dosesUsed", "recordedBy", "createdAt", "updatedAt")
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 1, $10, NOW(), NOW())`,
            randomUUID(), orgId, farmId, animalId, eventDate,
            tipo.includes('iatf') ? 'IATF' : 'NATURAL_HEAT',
            str(row.observacao, 100) || 'Importado FDB',
            bullId,
            str(row.observacao, 500),
            userId,
          );
          inseminations++;
        } else if (tipo.includes('parto') || tipo.includes('nasc')) {
          await prisma.$executeRawUnsafe(
            `INSERT INTO calving_events (id, "organizationId", "farmId", "motherId", "eventType",
             "eventDate", "birthType", "attendantName", notes, "recordedBy",
             "placentaRetention", "retentionIntervention", "createdAt", "updatedAt")
             VALUES ($1, $2, $3, $4, 'BIRTH', $5, 'NORMAL', 'Importado FDB', $6, $7, false, false, NOW(), NOW())`,
            randomUUID(), orgId, farmId, animalId, eventDate,
            str(row.observacao, 500), userId,
          );
          calvings++;
        } else if (tipo.includes('diagnos') || tipo.includes('toque')) {
          const result = row.diagnostico === 1 ? 'PREGNANT' : row.diagnostico === 0 ? 'EMPTY' : 'CYCLING';
          await prisma.$executeRawUnsafe(
            `INSERT INTO pregnancy_diagnoses (id, "organizationId", "farmId", "animalId",
             "diagnosisDate", result, method, "veterinaryName", notes, "recordedBy",
             "uterineCondition", "reproductiveRestriction", "isConfirmed", "referredToIatf",
             "createdAt", "updatedAt")
             VALUES ($1, $2, $3, $4, $5, $6::"DgResult", $7::"DgMethod", 'Importado FDB', $8, $9,
             'NONE'::"UterineCondition", false, false, false, NOW(), NOW())`,
            randomUUID(), orgId, farmId, animalId, eventDate,
            result, 'PALPATION',
            str(row.observacao, 500), userId,
          );
          diagnoses++;
        } else if (tipo.includes('cio') || tipo.includes('estro')) {
          const intensity = row.cio ? mapHeatIntensity(row.cio as number) : 'MODERATE';
          await prisma.$executeRawUnsafe(
            `INSERT INTO heat_records (id, "organizationId", "farmId", "animalId",
             "heatDate", intensity, signs, "detectionMethod", notes, "recordedBy",
             status, "isIntervalIrregular", "createdAt", "updatedAt")
             VALUES ($1, $2, $3, $4, $5, $6::"HeatIntensity", '["import_fdb"]'::jsonb,
             $7::"HeatDetectionMethod", $8, $9,
             'AWAITING_AI'::"HeatStatus", false, NOW(), NOW())`,
            randomUUID(), orgId, farmId, animalId, eventDate,
            intensity, 'VISUAL',
            str(row.observacao, 500), userId,
          );
          heats++;
        } else {
          others++;
        }
      } catch (e) {
        skipped++;
      }
    }
  }

  console.log(`  ✓ Inseminations: ${inseminations}`);
  console.log(`  ✓ Calvings: ${calvings}`);
  console.log(`  ✓ Diagnoses: ${diagnoses}`);
  console.log(`  ✓ Heat records: ${heats}`);
  console.log(`  ○ Others (unmapped): ${others}`);
  console.log(`  ○ Skipped: ${skipped}`);
}

function mapHeatIntensity(cio: number): string {
  if (cio >= 3) return 'STRONG';
  if (cio === 2) return 'MODERATE';
  return 'WEAK';
}

// ─── Lactations ───────────────────────────────────────────────────────

export async function importLactations(
  prisma: PrismaClient,
  orgId: string,
  idMap: IdMap,
): Promise<void> {
  console.log('\n── Lactações ──');
  let created = 0;
  let skipped = 0;
  const farmId = idMap.first('FAZENDA')!;

  const user = await prisma.user.findFirst({
    where: { organizationId: orgId },
    orderBy: { createdAt: 'asc' },
  });
  const userId = user?.id || 'system';

  const animalLactationCount = new Map<string, number>();

  for (const batch of queryBatched(
    `SELECT l.CDLACTACAO, l.CDANIMAL, l.DTINICIO, l.DTFIM, l.OBSINICIO, l.OBSFIM
     FROM LACTACAO l ORDER BY l.CDANIMAL, l.DTINICIO, l.CDLACTACAO`,
    'LACTACAO',
    2000,
  )) {
    for (const row of batch) {
      const fbId = row.cdlactacao as number;
      const animalId = idMap.get('ANIMAL', row.cdanimal as number);
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

      try {
        const id = randomUUID();
        await prisma.$executeRawUnsafe(
          `INSERT INTO lactations (id, "organizationId", "farmId", "animalId",
           "lactationNumber", "startDate", "endDate", origin, status, notes, "recordedBy",
           "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6, $7, $8::"LactationOrigin", $9::"LactationStatus", $10, $11, NOW(), NOW())`,
          id, orgId, farmId, animalId,
          count, startDate, toDate(row.dtfim),
          'BIRTH', row.dtfim ? 'DRIED' : 'IN_PROGRESS',
          str(row.obsinicio, 500), userId,
        );
        idMap.set('LACTACAO', fbId, id);
        created++;
      } catch {
        skipped++;
      }
    }
  }

  console.log(`  ✓ Lactations: ${created} created, ${skipped} skipped`);
}

// ─── Milk Records ─────────────────────────────────────────────────────

export async function importMilkRecords(
  prisma: PrismaClient,
  orgId: string,
  idMap: IdMap,
): Promise<void> {
  console.log('\n── Registros de Leite ──');
  let created = 0;
  let skipped = 0;
  const farmId = idMap.first('FAZENDA')!;

  const user = await prisma.user.findFirst({
    where: { organizationId: orgId },
    orderBy: { createdAt: 'asc' },
  });
  const userId = user?.id || 'system';

  for (const batch of queryBatched(
    `SELECT l.CDLEITE, l.CDLACTACAO, l.CDANIMAL, l.DTLEITE,
            l.PESO1, l.PESO2, l.PESO3, l.PESOTOTAL
     FROM LEITE l ORDER BY l.DTLEITE, l.CDLEITE`,
    'LEITE',
    5000,
  )) {
    for (const row of batch) {
      const animalId = idMap.get('ANIMAL', row.cdanimal as number);
      if (!animalId) {
        skipped++;
        continue;
      }

      const recordDate = toDate(row.dtleite);
      if (!recordDate) {
        skipped++;
        continue;
      }

      const totalKg = toDecimal(row.pesototal) || 0;

      const shifts = [
        { shift: 'MORNING', liters: toDecimal(row.peso1) },
        { shift: 'AFTERNOON', liters: toDecimal(row.peso2) },
        { shift: 'NIGHT', liters: toDecimal(row.peso3) },
      ];

      let inserted = false;
      for (const s of shifts) {
        if (s.liters && s.liters > 0) {
          try {
            await prisma.$executeRawUnsafe(
              `INSERT INTO milking_records (id, "organizationId", "farmId", "animalId",
               "milkingDate", shift, liters, "variationAlert", "recordedBy", "createdAt", "updatedAt")
               VALUES ($1, $2, $3, $4, $5, $6::"MilkingShift", $7, false, $8, NOW(), NOW())`,
              randomUUID(), orgId, farmId, animalId,
              recordDate, s.shift, s.liters, userId,
            );
            created++;
            inserted = true;
          } catch {
            skipped++;
          }
        }
      }

      if (!inserted && totalKg > 0) {
        try {
          await prisma.$executeRawUnsafe(
            `INSERT INTO milking_records (id, "organizationId", "farmId", "animalId",
             "milkingDate", shift, liters, "variationAlert", "recordedBy", "createdAt", "updatedAt")
             VALUES ($1, $2, $3, $4, $5, 'MORNING'::"MilkingShift", $6, false, $7, NOW(), NOW())`,
            randomUUID(), orgId, farmId, animalId,
            recordDate, totalKg, userId,
          );
          created++;
        } catch {
          skipped++;
        }
      }
    }
  }

  console.log(`  ✓ Milk records: ${created} created, ${skipped} skipped`);
}

// ─── Mastitis Cases ───────────────────────────────────────────────────

export async function importMastitis(
  prisma: PrismaClient,
  orgId: string,
  idMap: IdMap,
): Promise<void> {
  console.log('\n── Mastite ──');
  let created = 0;
  let skipped = 0;
  const farmId = idMap.first('FAZENDA')!;

  const user = await prisma.user.findFirst({
    where: { organizationId: orgId },
    orderBy: { createdAt: 'asc' },
  });
  const userId = user?.id || 'system';

  for (const batch of queryBatched(
    `SELECT m.CDMAMITE, m.CDANIMAL, m.DATA, m.AD, m.AE, m.PD, m.PE,
            m.VIA, m.OBSERVACAO, m.ORDENHA
     FROM MAMITE m ORDER BY m.DATA, m.CDMAMITE`,
    'MAMITE',
    2000,
  )) {
    for (const row of batch) {
      const animalId = idMap.get('ANIMAL', row.cdanimal as number);
      if (!animalId) {
        skipped++;
        continue;
      }

      const diagDate = toDate(row.data);
      if (!diagDate) {
        skipped++;
        continue;
      }

      try {
        await prisma.$executeRawUnsafe(
          `INSERT INTO mastitis_cases (id, "organizationId", "farmId", "animalId",
           "occurrenceDate", "identifiedBy", classification, notes, "recordedBy",
           "temperatureAlert", "cultureSampleCollected", status, "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, $5, $6, 'CLINICAL'::"MastitisClassification", $7, $8,
           false, false, 'OPEN'::"MastitisCaseStatus", NOW(), NOW())`,
          randomUUID(), orgId, farmId, animalId,
          diagDate, userId, str(row.observacao, 500), userId,
        );
        created++;
      } catch {
        skipped++;
      }
    }
  }

  console.log(`  ✓ Mastitis cases: ${created} created, ${skipped} skipped`);
}

// ─── Animal Exams ─────────────────────────────────────────────────────

export async function importExams(
  prisma: PrismaClient,
  orgId: string,
  idMap: IdMap,
): Promise<void> {
  console.log('\n── Exames ──');
  let created = 0;
  let skipped = 0;
  const farmId = idMap.first('FAZENDA')!;

  const user = await prisma.user.findFirst({
    where: { organizationId: orgId },
    orderBy: { createdAt: 'asc' },
  });
  const userId = user?.id || 'system';

  for (const batch of queryBatched(
    `SELECT ea.CDEXAMEANIMAL, ea.CDANIMAL, ea.CDEXAME, ea.DTEXAME,
            ea.VALOR, ea.OBSERVACAO
     FROM EXAMEANIMAL ea ORDER BY ea.DTEXAME, ea.CDEXAMEANIMAL`,
    'EXAMEANIMAL',
    1000,
  )) {
    for (const row of batch) {
      const animalId = idMap.get('ANIMAL', row.cdanimal as number);
      if (!animalId) {
        skipped++;
        continue;
      }

      const examDate = toDate(row.dtexame);
      if (!examDate) {
        skipped++;
        continue;
      }

      try {
        await prisma.$executeRawUnsafe(
          `INSERT INTO animal_exams (id, "organizationId", "farmId", "animalId",
           "examTypeId", "examTypeName", "collectionDate", "responsibleName", notes,
           status, "recordedBy", "createdAt", "updatedAt")
           VALUES ($1, $2, $3, $4, 'imported', $5, $6, 'Importado FDB', $7,
           'COMPLETED'::"ExamStatus", $8, NOW(), NOW())`,
          randomUUID(), orgId, farmId, animalId,
          `Exame ${row.cdexame || 'geral'}`,
          examDate, str(row.observacao, 500), userId,
        );
        created++;
      } catch {
        skipped++;
      }
    }
  }

  console.log(`  ✓ Exams: ${created} created, ${skipped} skipped`);
}

// ─── Run All Phase 4 ──────────────────────────────────────────────────

export async function runPhase4(
  prisma: PrismaClient,
  orgId: string,
  userId: string,
  idMap: IdMap,
): Promise<void> {
  console.log('\n═══════════════════════════════════════');
  console.log(' PHASE 4: Livestock Events');
  console.log('═══════════════════════════════════════');

  await importWeighings(prisma, orgId, idMap);
  await importReproduction(prisma, orgId, userId, idMap);
  await importLactations(prisma, orgId, idMap);
  await importMilkRecords(prisma, orgId, idMap);
  await importMastitis(prisma, orgId, idMap);
  await importExams(prisma, orgId, idMap);

  idMap.save();
  console.log('\n  ✓ Phase 4 complete. ID map saved.');
}
