/**
 * Phase 2: Import products, people (suppliers/producers), and active ingredients.
 *
 * Tables: PESSOA, PRODUTO, PRINCIPIOATIVO, PRODUTOPRINCIPIOATIVO
 */
import type { PrismaClient } from '@prisma/client';
import { query, queryBatched } from './firebird-client';
import { IdMap } from './id-map';

function str(val: string | number | null, maxLen?: number): string | null {
  if (val === null || val === undefined) return null;
  const s = String(val).trim();
  if (s === '' || s === '0') return null;
  return maxLen ? s.substring(0, maxLen) : s;
}

// ─── People → Supplier + Producer ─────────────────────────────────────

export async function importPeople(
  prisma: PrismaClient,
  orgId: string,
  userId: string,
  idMap: IdMap,
): Promise<void> {
  console.log('\n── Pessoas (→ Supplier + Producer) ──');

  // First, determine who is a supplier (referenced in NOTA) vs producer (animal owner)
  const supplierIds = new Set<number>();
  const producerIds = new Set<number>();

  const notaPessoas = query('SELECT DISTINCT n.CDPESSOA FROM NOTA n WHERE n.CDPESSOA IS NOT NULL');
  for (const r of notaPessoas) {
    if (r.cdpessoa) supplierIds.add(r.cdpessoa as number);
  }

  const ownerAnimals = query(
    'SELECT DISTINCT a.CDPROPRIETARIO FROM ANIMAL a WHERE a.CDPROPRIETARIO IS NOT NULL',
  );
  for (const r of ownerAnimals) {
    if (r.cdproprietario) producerIds.add(r.cdproprietario as number);
  }

  console.log(`  Suppliers: ${supplierIds.size} people referenced in NOTA`);
  console.log(`  Producers: ${producerIds.size} people referenced as animal owners`);

  // Get all people
  let created = 0;
  let skipped = 0;

  for (const batch of queryBatched(
    `SELECT p.CDPESSOA, p.NOME, p.CNPJ_CPF, p.PR_IE,
            p.ENDERECO, p.BAIRRO, p.CEP, p.TELEFONE, p.EMAIL,
            p.CDMUNICIPIO, p.NATUREZAPESSOA
     FROM PESSOA p ORDER BY p.CDPESSOA`,
    'PESSOA',
    2000,
  )) {
    for (const row of batch) {
      const fbId = row.cdpessoa as number;
      if (idMap.has('PESSOA', fbId)) {
        skipped++;
        continue;
      }

      const name = str(row.nome) || `Pessoa ${fbId}`;
      const doc = str(row.cnpj_cpf)?.replace(/\D/g, '') || null;
      const isSupplier = supplierIds.has(fbId);
      const isProducer = producerIds.has(fbId);

      // Create as Supplier if referenced in notas
      if (isSupplier && doc) {
        const existing = await prisma.supplier.findFirst({
          where: { organizationId: orgId, document: doc },
        });

        if (existing) {
          idMap.set('PESSOA', fbId, `S:${existing.id}`);
        } else {
          const supplier = await prisma.supplier.create({
            data: {
              organizationId: orgId,
              name,
              document: doc,
              type: doc.length > 11 ? 'PJ' : 'PF',
              stateRegistration: str(row.pr_ie),
              address: str(row.endereco),
              zipCode: str(row.cep),
              contactPhone: str(row.telefone),
              contactEmail: str(row.email),
              status: 'ACTIVE',
              createdBy: userId,
            },
          });
          idMap.set('PESSOA', fbId, `S:${supplier.id}`);
        }
      }

      // Create as Producer if animal owner
      if (isProducer) {
        const existing = doc
          ? await prisma.producer.findFirst({ where: { organizationId: orgId, document: doc } })
          : null;

        if (existing) {
          idMap.set('PESSOA', fbId, `P:${existing.id}`);
        } else {
          const producer = await prisma.producer.create({
            data: {
              organizationId: orgId,
              name,
              type: doc && doc.length > 11 ? 'PJ' : 'PF',
              document: doc,
              status: 'ACTIVE',
            },
          });
          idMap.set('PESSOA', fbId, `P:${producer.id}`);
        }
      }

      // If neither, store name for reference
      if (!isSupplier && !isProducer) {
        idMap.set('PESSOA', fbId, `REF:${name}`);
      }

      created++;
    }
  }

  console.log(`  ✓ People: ${created} processed, ${skipped} skipped`);
}

/**
 * Helper to resolve PESSOA ID to supplier/producer UUID.
 */
export function resolvePessoa(
  idMap: IdMap,
  cdPessoa: number | null,
): { type: 'supplier' | 'producer' | 'ref'; id: string } | null {
  if (!cdPessoa) return null;
  const val = idMap.get('PESSOA', cdPessoa);
  if (!val) return null;

  if (val.startsWith('S:')) return { type: 'supplier', id: val.substring(2) };
  if (val.startsWith('P:')) return { type: 'producer', id: val.substring(2) };
  return { type: 'ref', id: val.substring(4) };
}

// ─── Products ─────────────────────────────────────────────────────────

export async function importProducts(
  prisma: PrismaClient,
  orgId: string,
  idMap: IdMap,
): Promise<void> {
  console.log('\n── Produtos ──');
  let created = 0;
  let skipped = 0;

  for (const batch of queryBatched(
    `SELECT p.CDPRODUTO, p.NUMERO, p.NOME, p.TIPO, p.CDUNIDADEMEDIDA,
            p.CDCLASSIFICACAO, p.ATIVO, p.ESTOCAVEL, p.MINIMOESTOQUE,
            p.CDFABRICANTE, p.OBSERVACAO, p.COMPOSTO, p.CARENCIA,
            p.CDUNIDADEMEDIDAAPLICACAO, p.PERCENTUALMS
     FROM PRODUTO p ORDER BY p.CDPRODUTO`,
    'PRODUTO',
    2000,
  )) {
    const batchData = [];

    for (const row of batch) {
      const fbId = row.cdproduto as number;
      if (idMap.has('PRODUTO', fbId)) {
        skipped++;
        continue;
      }

      const rawName = str(row.nome) || str(row.numero) || `Produto ${fbId}`;
      const tipo = str(row.tipo) || 'P';

      // Map FDB product type to Protos Farm
      const nature = tipo === 'S' ? 'SERVICE' as const : 'PRODUCT' as const;
      const type = mapProductType(idMap, row.cdclassificacao as number | null);
      const measurementUnitId = idMap.get('UNIDADEMEDIDA', row.cdunidademedida as number);

      // Check for existing by name
      const existing = await prisma.product.findFirst({
        where: { organizationId: orgId, name: rawName, nature },
      });

      if (existing) {
        idMap.set('PRODUTO', fbId, existing.id);
        skipped++;
        continue;
      }

      batchData.push({
        fbId,
        name: rawName,
        data: {
          organizationId: orgId,
          name: rawName,
          nature,
          type,
          status: row.ativo === 0 ? ('INACTIVE' as const) : ('ACTIVE' as const),
          notes: str(row.observacao, 2000),
          measurementUnitId: measurementUnitId || undefined,
        },
      });
    }

    // Create products, handling duplicates by appending FDB id
    for (const item of batchData) {
      try {
        const product = await prisma.product.create({ data: item.data });
        idMap.set('PRODUTO', item.fbId, product.id);
        created++;
      } catch {
        // Duplicate name — try with FDB id suffix
        const altName = `${item.name} (${item.fbId})`;
        try {
          const product = await prisma.product.create({
            data: { ...item.data, name: altName },
          });
          idMap.set('PRODUTO', item.fbId, product.id);
          created++;
        } catch {
          // Already exists, find and map
          const dup = await prisma.product.findFirst({
            where: { organizationId: orgId, name: altName },
          });
          if (dup) idMap.set('PRODUTO', item.fbId, dup.id);
          skipped++;
        }
      }
    }
  }

  console.log(`  ✓ Products: ${created} created, ${skipped} skipped`);
}

function mapProductType(idMap: IdMap, cdClassificacao: number | null): string {
  if (!cdClassificacao) return 'outros';
  const mapped = idMap.get('CLASSIFICACAO', cdClassificacao);
  if (!mapped) return 'outros';

  const [name] = mapped.split('|');
  const n = name.toLowerCase();

  if (n.includes('medicamento') || n.includes('vacin')) return 'medicamento_veterinario';
  if (n.includes('defensiv') || n.includes('herbicid') || n.includes('inseticid'))
    return 'defensivo';
  if (n.includes('fertiliz') || n.includes('adub')) return 'fertilizante';
  if (n.includes('sement')) return 'semente';
  if (n.includes('ração') || n.includes('racao') || n.includes('aliment'))
    return 'racao_concentrado';
  if (n.includes('sêmen') || n.includes('semen')) return 'semen';
  if (n.includes('combust') || n.includes('diesel') || n.includes('gasol')) return 'combustivel';
  if (n.includes('peça') || n.includes('peca')) return 'peca_reposicao';
  return 'outros';
}

// ─── Active Ingredients ───────────────────────────────────────────────

export async function importActiveIngredients(
  prisma: PrismaClient,
  orgId: string,
  idMap: IdMap,
): Promise<void> {
  console.log('\n── Princípios Ativos ──');

  const rows = query(
    'SELECT pa.CDPRINCIPIOATIVO, pa.NOME FROM PRINCIPIOATIVO pa ORDER BY pa.CDPRINCIPIOATIVO',
  );
  let created = 0;
  let skipped = 0;

  for (const row of rows) {
    const fbId = row.cdprincipioativo as number;
    if (idMap.has('PRINCIPIOATIVO', fbId)) {
      skipped++;
      continue;
    }

    const name = str(row.nome) || `PA ${fbId}`;

    const existing = await prisma.activeIngredient.findFirst({
      where: { organizationId: orgId, name },
    });

    if (existing) {
      idMap.set('PRINCIPIOATIVO', fbId, existing.id);
      skipped++;
      continue;
    }

    const ai = await prisma.activeIngredient.create({
      data: {
        organizationId: orgId,
        name,
        type: 'OTHER', // Will be refined later based on product associations
      },
    });

    idMap.set('PRINCIPIOATIVO', fbId, ai.id);
    created++;
  }

  console.log(`  ✓ Active ingredients: ${created} created, ${skipped} skipped`);
}

// ─── Product ↔ Active Ingredient links ────────────────────────────────

export async function importProductActiveIngredients(
  prisma: PrismaClient,
  idMap: IdMap,
): Promise<void> {
  console.log('\n── Vínculos Produto ↔ Princípio Ativo ──');
  let created = 0;
  let skipped = 0;

  for (const batch of queryBatched(
    `SELECT ppa.CDPRODUTO, ppa.CDPRINCIPIOATIVO, ppa.CONCENTRACAOVALOR
     FROM PRODUTOPRINCIPIOATIVO ppa ORDER BY ppa.CDPRODUTO`,
    'PRODUTOPRINCIPIOATIVO',
    3000,
  )) {
    for (const row of batch) {
      const productId = idMap.get('PRODUTO', row.cdproduto as number);
      const activeIngredientId = idMap.get('PRINCIPIOATIVO', row.cdprincipioativo as number);

      if (!productId || !activeIngredientId) {
        skipped++;
        continue;
      }

      // Check if link already exists
      const existing = await prisma.productActiveIngredient.findUnique({
        where: { productId_activeIngredientId: { productId, activeIngredientId } },
      });

      if (existing) {
        skipped++;
        continue;
      }

      await prisma.productActiveIngredient.create({
        data: {
          productId,
          activeIngredientId,
          concentration: str(row.concentracaovalor),
        },
      });

      created++;
    }
  }

  console.log(`  ✓ Product-ActiveIngredient links: ${created} created, ${skipped} skipped`);
}

// ─── Run All Phase 2 ──────────────────────────────────────────────────

export async function runPhase2(
  prisma: PrismaClient,
  orgId: string,
  userId: string,
  idMap: IdMap,
): Promise<void> {
  console.log('\n═══════════════════════════════════════');
  console.log(' PHASE 2: Products & People');
  console.log('═══════════════════════════════════════');

  await importPeople(prisma, orgId, userId, idMap);
  await importProducts(prisma, orgId, idMap);
  await importActiveIngredients(prisma, orgId, idMap);
  await importProductActiveIngredients(prisma, idMap);

  idMap.save();
  console.log('\n  ✓ Phase 2 complete. ID map saved.');
}
