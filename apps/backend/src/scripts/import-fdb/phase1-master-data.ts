/**
 * Phase 1: Import master data (no foreign key dependencies between tables).
 *
 * Tables: FAZENDA, RACA, CATEGORIA, UNIDADEMEDIDA, CLASSIFICACAO,
 *         CENTRALSEMEN, MOTIVOBAIXA, LOCALARMAZENAMENTO, DOENCA, MUNICIPIO
 */
import type { PrismaClient } from '@prisma/client';
import { query, count } from './firebird-client';
import { IdMap } from './id-map';

// ─── Helpers ──────────────────────────────────────────────────────────

function toDate(val: string | number | null): Date | null {
  if (!val) return null;
  const str = String(val);
  // Firebird dates come as "2024-01-15" or "15-JAN-2024"
  const d = new Date(str);
  return isNaN(d.getTime()) ? null : d;
}

function str(val: string | number | null, maxLen?: number): string | null {
  if (val === null || val === undefined) return null;
  const s = String(val).trim();
  if (s === '') return null;
  return maxLen ? s.substring(0, maxLen) : s;
}

// ─── Farm ─────────────────────────────────────────────────────────────

export async function importFarms(
  prisma: PrismaClient,
  orgId: string,
  idMap: IdMap,
): Promise<void> {
  console.log('\n── Fazendas ──');

  // Load municipality lookup for state/city
  const munRows = query('SELECT m.CDMUNICIPIO, m.MUNICIPIO, m.UF FROM MUNICIPIO m');
  const munMap = new Map<number, { city: string; state: string }>();
  for (const m of munRows) {
    munMap.set(m.cdmunicipio as number, {
      city: str(m.municipio) || '',
      state: str(m.uf) || 'SP',
    });
  }

  const rows = query(`
    SELECT f.CDFAZENDA, f.NOME, f.CNPJ, f.INSCESTADUAL, f.AREA,
           f.LATITUDE, f.LONGITUDE, f.LOGRADOURO, f.BAIRRO, f.CEP,
           f.TELEFONE, f.EMAIL, f.CDMUNICIPIO
    FROM FAZENDA f
  `);

  for (const row of rows) {
    const fbId = row.cdfazenda as number;
    if (idMap.has('FAZENDA', fbId)) {
      console.log(`  Skipping farm ${fbId} (already imported)`);
      continue;
    }

    const mun = munMap.get(row.cdmunicipio as number);

    const farm = await prisma.farm.create({
      data: {
        organizationId: orgId,
        name: str(row.nome) || 'Fazenda Importada',
        status: 'ACTIVE',
        totalAreaHa: row.area ? Number(row.area) : 0,
        address: str(row.logradouro),
        city: mun?.city || null,
        state: mun?.state || 'MG',
        zipCode: str(row.cep),
      },
    });

    idMap.set('FAZENDA', fbId, farm.id);
    console.log(`  ✓ Farm: ${farm.name} (${fbId} → ${farm.id})`);
  }
}

// ─── Breeds ───────────────────────────────────────────────────────────

export async function importBreeds(
  prisma: PrismaClient,
  orgId: string,
  idMap: IdMap,
): Promise<void> {
  console.log('\n── Raças ──');
  const rows = query('SELECT r.CDRACA, r.DESCRICAO, r.SIGLA FROM RACA r ORDER BY r.CDRACA');
  let created = 0;
  let skipped = 0;

  for (const row of rows) {
    const fbId = row.cdraca as number;
    if (idMap.has('RACA', fbId)) {
      skipped++;
      continue;
    }

    const name = str(row.descricao) || `Raça ${fbId}`;
    const existing = await prisma.breed.findFirst({
      where: { organizationId: orgId, name },
    });

    if (existing) {
      idMap.set('RACA', fbId, existing.id);
      skipped++;
      continue;
    }

    const breed = await prisma.breed.create({
      data: {
        organizationId: orgId,
        name,
        code: str(row.sigla, 10),
        species: 'BOVINO',
      },
    });

    idMap.set('RACA', fbId, breed.id);
    created++;
  }

  console.log(`  ✓ Breeds: ${created} created, ${skipped} skipped`);
}

// ─── Categories (reference mapping, no table creation) ────────────────

const CATEGORY_MAP: Record<number, { sex: string; label: string }> = {
  1: { sex: 'MALE', label: 'Em crescimento' },
  2: { sex: 'MALE', label: 'Reprodutor' },
  3: { sex: 'MALE', label: 'Boi carreiro' },
  4: { sex: 'MALE', label: 'Rufião' },
  5: { sex: 'FEMALE', label: 'Em crescimento' },
  6: { sex: 'FEMALE', label: 'Novilha' },
  7: { sex: 'FEMALE', label: 'Vaca' },
};

export function getCategoryInfo(cdCategoria: number | null): { sex: string; label: string } | null {
  if (!cdCategoria) return null;
  return CATEGORY_MAP[cdCategoria] || null;
}

// ─── Measurement Units ────────────────────────────────────────────────

export async function importMeasurementUnits(
  prisma: PrismaClient,
  orgId: string,
  idMap: IdMap,
): Promise<void> {
  console.log('\n── Unidades de Medida ──');
  const rows = query(
    'SELECT u.CDUNIDADEMEDIDA, u.NOME, u.SIMBOLO FROM UNIDADEMEDIDA u ORDER BY u.CDUNIDADEMEDIDA',
  );
  let created = 0;
  let skipped = 0;

  for (const row of rows) {
    const fbId = row.cdunidademedida as number;
    if (idMap.has('UNIDADEMEDIDA', fbId)) {
      skipped++;
      continue;
    }

    const name = str(row.nome) || `Unidade ${fbId}`;
    const symbol = str(row.simbolo, 10) || '?';

    // Check by name or abbreviation (unique constraint on orgId+abbreviation)
    const existing = await prisma.measurementUnit.findFirst({
      where: { organizationId: orgId, OR: [{ name }, { abbreviation: symbol }] },
    });

    if (existing) {
      idMap.set('UNIDADEMEDIDA', fbId, existing.id);
      skipped++;
      continue;
    }

    try {
      const unit = await prisma.measurementUnit.create({
        data: {
          organizationId: orgId,
          name,
          abbreviation: symbol,
          category: guessUnitCategory(name, symbol),
        },
      });

      idMap.set('UNIDADEMEDIDA', fbId, unit.id);
      created++;
    } catch {
      // Duplicate abbreviation — find existing and map
      const dup = await prisma.measurementUnit.findFirst({
        where: { organizationId: orgId, abbreviation: symbol },
      });
      if (dup) {
        idMap.set('UNIDADEMEDIDA', fbId, dup.id);
        skipped++;
      }
    }
  }

  console.log(`  ✓ Measurement units: ${created} created, ${skipped} skipped`);
}

function guessUnitCategory(name: string, symbol: string): string {
  const n = name.toLowerCase();
  const s = symbol.toLowerCase();
  if (['kg', 'g', 'mg', 'ton', 't', '@'].includes(s) || n.includes('quilo') || n.includes('grama') || n.includes('arroba') || n.includes('tonelada'))
    return 'WEIGHT';
  if (['l', 'ml', 'lt'].includes(s) || n.includes('litro')) return 'VOLUME';
  if (['ha', 'm²', 'm2'].includes(s) || n.includes('hectare') || n.includes('alqueire'))
    return 'AREA';
  return 'COUNT';
}

// ─── Product Classifications ──────────────────────────────────────────

export async function importClassifications(idMap: IdMap): Promise<void> {
  console.log('\n── Classificações de Produto ──');
  const rows = query(
    'SELECT c.CDCLASSIFICACAO, c.DESCRICAO, c.ESTRUTURA FROM CLASSIFICACAO c ORDER BY c.CDCLASSIFICACAO',
  );

  // Store as reference only (maps to Product.category/type)
  for (const row of rows) {
    const fbId = row.cdclassificacao as number;
    const name = str(row.descricao) || '';
    const tipo = str(row.estrutura) || '';
    // Store name as the mapped value (not a UUID, but the category string)
    idMap.set('CLASSIFICACAO', fbId, name + '|' + tipo);
  }

  console.log(`  ✓ Classifications: ${rows.length} mapped`);
}

// ─── Diseases ─────────────────────────────────────────────────────────

export async function importDiseases(
  prisma: PrismaClient,
  orgId: string,
  idMap: IdMap,
): Promise<void> {
  console.log('\n── Doenças ──');
  const total = count('DOENCA');
  if (total === 0) {
    console.log('  (nenhuma doença)');
    return;
  }

  const rows = query('SELECT d.CDDOENCA, d.NOMERESUMIDO FROM DOENCA d ORDER BY d.CDDOENCA');
  let created = 0;

  for (const row of rows) {
    const fbId = row.cddoenca as number;
    if (idMap.has('DOENCA', fbId)) continue;

    const name = str(row.nomeresumido) || `Doença ${fbId}`;
    const existing = await prisma.disease.findFirst({
      where: { organizationId: orgId, name },
    });

    if (existing) {
      idMap.set('DOENCA', fbId, existing.id);
      continue;
    }

    const disease = await prisma.disease.create({
      data: {
        organizationId: orgId,
        name,
        category: 'OTHER',
      },
    });

    idMap.set('DOENCA', fbId, disease.id);
    created++;
  }

  console.log(`  ✓ Diseases: ${created} created`);
}

// ─── Storage Locations ────────────────────────────────────────────────

export async function importStorageLocations(
  prisma: PrismaClient,
  orgId: string,
  idMap: IdMap,
): Promise<void> {
  console.log('\n── Locais de Armazenamento ──');
  const rows = query(`
    SELECT l.CDLOCALARMAZENAMENTO, l.SIGLA, l.DESCRICAO, l.ATIVO, l.PADRAO
    FROM LOCALARMAZENAMENTO l ORDER BY l.CDLOCALARMAZENAMENTO
  `);
  let created = 0;

  for (const row of rows) {
    const fbId = row.cdlocalarmazenamento as number;
    if (idMap.has('LOCALARMAZENAMENTO', fbId)) continue;

    const loc = await prisma.storageLocation.create({
      data: {
        organizationId: orgId,
        name: str(row.descricao) || `Local ${fbId}`,
        code: str(row.sigla, 20),
        isDefault: row.padrao === 1,
        isActive: row.ativo !== 0,
      },
    });

    idMap.set('LOCALARMAZENAMENTO', fbId, loc.id);
    created++;
  }

  console.log(`  ✓ Storage locations: ${created} created`);
}

// ─── Semen Centrals → Bulls seed data ─────────────────────────────────

export async function importSemenCentrals(idMap: IdMap): Promise<void> {
  console.log('\n── Centrais de Sêmen ──');
  const rows = query(
    'SELECT cs.CDCENTRALSEMEN, cs.DESCRICAO FROM CENTRALSEMEN cs ORDER BY cs.CDCENTRALSEMEN',
  );

  for (const row of rows) {
    const fbId = row.cdcentralsemen as number;
    const name = str(row.descricao) || `Central ${fbId}`;
    // Store as reference — will be used when importing bulls/semen batches
    idMap.set('CENTRALSEMEN', fbId, name);
  }

  console.log(`  ✓ Semen centrals: ${rows.length} mapped`);
}

// ─── Exit Reasons ─────────────────────────────────────────────────────

export async function importExitReasons(idMap: IdMap): Promise<void> {
  console.log('\n── Motivos de Baixa ──');
  const rows = query(
    'SELECT m.CDMOTIVOBAIXA, m.DESCRICAO FROM MOTIVOBAIXA m ORDER BY m.CDMOTIVOBAIXA',
  );

  for (const row of rows) {
    const fbId = row.cdmotivobaixa as number;
    const desc = str(row.descricao) || '';
    // Map to AnimalExitType enum
    idMap.set('MOTIVOBAIXA', fbId, mapExitReason(desc));
  }

  console.log(`  ✓ Exit reasons: ${rows.length} mapped`);
}

function mapExitReason(desc: string): string {
  const d = desc.toLowerCase();
  if (d.includes('mort') || d.includes('obit')) return 'MORTE';
  if (d.includes('vend')) return 'VENDA';
  if (d.includes('abat')) return 'ABATE';
  if (d.includes('doac') || d.includes('doação')) return 'DOACAO';
  if (d.includes('transf')) return 'TRANSFERENCIA';
  return 'PERDA';
}

// ─── Run All Phase 1 ──────────────────────────────────────────────────

export async function runPhase1(
  prisma: PrismaClient,
  orgId: string,
  idMap: IdMap,
): Promise<void> {
  console.log('\n═══════════════════════════════════════');
  console.log(' PHASE 1: Master Data');
  console.log('═══════════════════════════════════════');

  await importFarms(prisma, orgId, idMap);
  await importBreeds(prisma, orgId, idMap);
  await importMeasurementUnits(prisma, orgId, idMap);
  await importClassifications(idMap);
  await importDiseases(prisma, orgId, idMap);
  await importStorageLocations(prisma, orgId, idMap);
  await importSemenCentrals(idMap);
  await importExitReasons(idMap);

  idMap.save();
  console.log('\n  ✓ Phase 1 complete. ID map saved.');
}
