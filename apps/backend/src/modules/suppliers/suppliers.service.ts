import type { SupplierCategory, SupplierStatus, Prisma } from '@prisma/client';
import { withRlsContext, type RlsContext } from '../../database/rls';
import { isValidCPF, isValidCNPJ, cleanDocument } from '../../shared/utils/document-validator';
import {
  SupplierError,
  SUPPLIER_CATEGORIES,
  SUPPLIER_CATEGORY_LABELS,
  type CreateSupplierInput,
  type UpdateSupplierInput,
  type ListSuppliersQuery,
  type CreateRatingInput,
  type PerformanceReportOutput,
} from './suppliers.types';
import { parseSupplierFile } from './supplier-file-parser';

// ─── Helpers ────────────────────────────────────────────────────────

function validateCategories(categories: string[]): SupplierCategory[] {
  for (const cat of categories) {
    if (!(SUPPLIER_CATEGORIES as readonly string[]).includes(cat)) {
      throw new SupplierError(
        `Categoria inválida: ${cat}. Valores permitidos: ${SUPPLIER_CATEGORIES.join(', ')}`,
        400,
      );
    }
  }
  return categories as SupplierCategory[];
}

function computeAverageRating(
  ratings: { deadline: number; quality: number; price: number; service: number }[],
): number | null {
  if (ratings.length === 0) return null;
  const sum = ratings.reduce((acc, r) => acc + r.deadline + r.quality + r.price + r.service, 0);
  return Math.round((sum / (ratings.length * 4)) * 100) / 100;
}

// ─── Create Supplier ────────────────────────────────────────────────

export async function createSupplier(
  ctx: RlsContext,
  input: CreateSupplierInput,
  createdBy: string,
) {
  // Validate document
  const cleanedDoc = cleanDocument(input.document);
  if (input.type === 'PJ') {
    if (!isValidCNPJ(cleanedDoc)) {
      throw new SupplierError('CNPJ inválido. Verifique o número e tente novamente.', 400);
    }
  } else {
    if (!isValidCPF(cleanedDoc)) {
      throw new SupplierError('CPF inválido. Verifique o número e tente novamente.', 400);
    }
  }

  // Validate categories
  const validCategories = validateCategories(input.categories);

  return withRlsContext(ctx, async (tx) => {
    // Check duplicate
    const existing = await tx.supplier.findFirst({
      where: {
        document: cleanedDoc,
        organizationId: ctx.organizationId,
        deletedAt: null,
      },
    });
    if (existing) {
      throw new SupplierError(`Fornecedor já cadastrado: ${existing.name}`, 409, {
        existingId: existing.id,
      });
    }

    const supplier = await tx.supplier.create({
      data: {
        organizationId: ctx.organizationId,
        type: input.type,
        name: input.name,
        tradeName: input.tradeName ?? null,
        document: cleanedDoc,
        stateRegistration: input.stateRegistration ?? null,
        address: input.address ?? null,
        city: input.city ?? null,
        state: input.state ?? null,
        zipCode: input.zipCode ?? null,
        contactName: input.contactName ?? null,
        contactPhone: input.contactPhone ?? null,
        contactEmail: input.contactEmail ?? null,
        paymentTerms: input.paymentTerms ?? null,
        freightType: input.freightType ?? null,
        notes: input.notes ?? null,
        status: (input.status as 'ACTIVE' | 'INACTIVE' | 'BLOCKED' | undefined) ?? 'ACTIVE',
        categories: validCategories,
        createdBy,
      },
    });

    return supplier;
  });
}

// ─── Get Supplier By ID ──────────────────────────────────────────────

export async function getSupplierById(ctx: RlsContext, id: string) {
  return withRlsContext(ctx, async (tx) => {
    const supplier = await tx.supplier.findFirst({
      where: { id, organizationId: ctx.organizationId, deletedAt: null },
      include: {
        documents: true,
        ratings: { orderBy: { createdAt: 'desc' } },
      },
    });

    if (!supplier) {
      throw new SupplierError('Fornecedor não encontrado', 404);
    }

    const averageRating = computeAverageRating(supplier.ratings);
    const ratingCount = supplier.ratings.length;

    return { ...supplier, averageRating, ratingCount };
  });
}

// ─── List Suppliers ──────────────────────────────────────────────────

export async function listSuppliers(ctx: RlsContext, query: ListSuppliersQuery) {
  const page = Number(query.page) || 1;
  const limit = Math.min(Number(query.limit) || 20, 100);
  const skip = (page - 1) * limit;

  const where: Prisma.SupplierWhereInput = {
    organizationId: ctx.organizationId,
    deletedAt: null,
  };

  if (query.search) {
    const cleanedSearch = cleanDocument(query.search);
    where.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { tradeName: { contains: query.search, mode: 'insensitive' } },
      ...(cleanedSearch.length > 0 ? [{ document: { contains: cleanedSearch } }] : []),
    ];
  }

  if (query.status) {
    where.status = query.status as SupplierStatus;
  }

  if (query.category) {
    where.categories = { has: query.category as SupplierCategory };
  }

  if (query.city) {
    where.city = { contains: query.city, mode: 'insensitive' };
  }

  if (query.state) {
    where.state = query.state;
  }

  return withRlsContext(ctx, async (tx) => {
    const [suppliers, total] = await Promise.all([
      tx.supplier.findMany({
        where,
        include: { ratings: true },
        skip,
        take: limit,
        orderBy: { name: 'asc' },
      }),
      tx.supplier.count({ where }),
    ]);

    const data = suppliers.map((s) => ({
      ...s,
      averageRating: computeAverageRating(s.ratings),
      ratingCount: s.ratings.length,
    }));

    return { data, total, page, limit };
  });
}

// ─── Update Supplier ─────────────────────────────────────────────────

export async function updateSupplier(ctx: RlsContext, id: string, input: UpdateSupplierInput) {
  return withRlsContext(ctx, async (tx) => {
    // Find existing
    const existing = await tx.supplier.findFirst({
      where: { id, organizationId: ctx.organizationId, deletedAt: null },
    });
    if (!existing) {
      throw new SupplierError('Fornecedor não encontrado', 404);
    }

    // Validate document if changed
    let cleanedDoc: string | undefined;
    if (input.document !== undefined) {
      cleanedDoc = cleanDocument(input.document);
      if (existing.type === 'PJ') {
        if (!isValidCNPJ(cleanedDoc)) {
          throw new SupplierError('CNPJ inválido. Verifique o número e tente novamente.', 400);
        }
      } else {
        if (!isValidCPF(cleanedDoc)) {
          throw new SupplierError('CPF inválido. Verifique o número e tente novamente.', 400);
        }
      }

      // Check duplicate (excluding current supplier)
      if (cleanedDoc !== existing.document) {
        const duplicate = await tx.supplier.findFirst({
          where: {
            document: cleanedDoc,
            organizationId: ctx.organizationId,
            deletedAt: null,
            id: { not: id },
          },
        });
        if (duplicate) {
          throw new SupplierError(`Fornecedor já cadastrado: ${duplicate.name}`, 409, {
            existingId: duplicate.id,
          });
        }
      }
    }

    // Validate categories if provided
    let validCategories: SupplierCategory[] | undefined;
    if (input.categories !== undefined) {
      validCategories = validateCategories(input.categories);
    }

    const updated = await tx.supplier.update({
      where: { id },
      data: {
        ...(input.name !== undefined && { name: input.name }),
        ...(input.tradeName !== undefined && { tradeName: input.tradeName }),
        ...(cleanedDoc !== undefined && { document: cleanedDoc }),
        ...(input.stateRegistration !== undefined && {
          stateRegistration: input.stateRegistration,
        }),
        ...(input.address !== undefined && { address: input.address }),
        ...(input.city !== undefined && { city: input.city }),
        ...(input.state !== undefined && { state: input.state }),
        ...(input.zipCode !== undefined && { zipCode: input.zipCode }),
        ...(input.contactName !== undefined && { contactName: input.contactName }),
        ...(input.contactPhone !== undefined && { contactPhone: input.contactPhone }),
        ...(input.contactEmail !== undefined && { contactEmail: input.contactEmail }),
        ...(input.paymentTerms !== undefined && { paymentTerms: input.paymentTerms }),
        ...(input.freightType !== undefined && { freightType: input.freightType }),
        ...(input.notes !== undefined && { notes: input.notes }),
        ...(input.status !== undefined && { status: input.status }),
        ...(validCategories !== undefined && { categories: validCategories }),
      },
    });

    return updated;
  });
}

// ─── Delete Supplier (soft) ──────────────────────────────────────────

export async function deleteSupplier(ctx: RlsContext, id: string) {
  return withRlsContext(ctx, async (tx) => {
    const existing = await tx.supplier.findFirst({
      where: { id, organizationId: ctx.organizationId, deletedAt: null },
    });
    if (!existing) {
      throw new SupplierError('Fornecedor não encontrado', 404);
    }

    await tx.supplier.update({
      where: { id },
      data: { deletedAt: new Date() },
    });

    return { success: true };
  });
}

// ─── Import: Preview ─────────────────────────────────────────────────

export async function importSuppliersPreview(ctx: RlsContext, buffer: Buffer, mimetype: string) {
  const { valid, invalid } = await parseSupplierFile(buffer, mimetype);

  // Check which valid rows have existing documents
  const existingInfo: { row: number; document: string; existingName: string }[] = [];

  if (valid.length > 0) {
    await withRlsContext(ctx, async (tx) => {
      for (let i = 0; i < valid.length; i++) {
        const row = valid[i];
        const existing = await tx.supplier.findFirst({
          where: {
            document: row.document,
            organizationId: ctx.organizationId,
            deletedAt: null,
          },
          select: { name: true },
        });
        if (existing) {
          existingInfo.push({ row: i + 2, document: row.document, existingName: existing.name });
        }
      }
    });
  }

  return { valid, invalid, existing: existingInfo };
}

// ─── Import: Execute ─────────────────────────────────────────────────

export async function importSuppliersExecute(
  ctx: RlsContext,
  buffer: Buffer,
  mimetype: string,
  createdBy: string,
) {
  const { valid, invalid } = await parseSupplierFile(buffer, mimetype);

  let imported = 0;
  let skipped = 0;
  const errors: { row: number; error: string }[] = [];

  // Count pre-parse failures as failed
  const failed = invalid.length;

  await withRlsContext(ctx, async (tx) => {
    for (let i = 0; i < valid.length; i++) {
      const row = valid[i];
      const rowNum = i + 2;

      try {
        // Check for existing
        const existing = await tx.supplier.findFirst({
          where: {
            document: row.document,
            organizationId: ctx.organizationId,
            deletedAt: null,
          },
        });

        if (existing) {
          skipped++;
          continue;
        }

        await tx.supplier.create({
          data: {
            organizationId: ctx.organizationId,
            type: row.type,
            name: row.name,
            tradeName: row.tradeName ?? null,
            document: row.document,
            stateRegistration: row.stateRegistration ?? null,
            address: row.address ?? null,
            city: row.city ?? null,
            state: row.state ?? null,
            zipCode: row.zipCode ?? null,
            contactName: row.contactName ?? null,
            contactPhone: row.contactPhone ?? null,
            contactEmail: row.contactEmail ?? null,
            paymentTerms: row.paymentTerms ?? null,
            freightType: (row.freightType as 'CIF' | 'FOB' | undefined) ?? null,
            status: 'ACTIVE',
            categories: row.categories as SupplierCategory[],
            createdBy,
          },
        });

        imported++;
      } catch (e) {
        errors.push({ row: rowNum, error: e instanceof Error ? e.message : 'Erro desconhecido' });
      }
    }
  });

  return { imported, skipped, failed, errors };
}

// ─── Import: Template ────────────────────────────────────────────────

export function getImportTemplate(): string {
  const BOM = '\uFEFF';
  const header =
    'Tipo;Nome/Razão Social;Nome Fantasia;CNPJ/CPF;IE;Endereço;Cidade;UF;CEP;Contato Nome;Contato Telefone;Contato Email;Condição Pagamento;Frete;Categorias';
  const example1 =
    'PJ;Fazenda Boa Vista Ltda;Boa Vista;12345678000195;;Rua Principal 100;Ribeirão Preto;SP;14000-000;João Silva;(16) 99999-0000;joao@example.com;30 dias;CIF;Insumo Agrícola|Pecuário';
  const example2 =
    'PF;Maria Santos;;12345678909;;;;São Paulo;SP;01000-000;Maria Santos;(11) 98888-0000;maria@example.com;À vista;FOB;Serviços';
  return BOM + [header, example1, example2].join('\n');
}

// ─── Export: CSV ─────────────────────────────────────────────────────

export async function exportSuppliersCsv(ctx: RlsContext, query: ListSuppliersQuery) {
  const where: Prisma.SupplierWhereInput = {
    organizationId: ctx.organizationId,
    deletedAt: null,
  };

  if (query.status) {
    where.status = query.status as SupplierStatus;
  }
  if (query.category) {
    where.categories = { has: query.category as SupplierCategory };
  }
  if (query.city) {
    where.city = { contains: query.city, mode: 'insensitive' };
  }
  if (query.state) {
    where.state = query.state;
  }
  if (query.search) {
    const cleanedSearch = cleanDocument(query.search);
    where.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { tradeName: { contains: query.search, mode: 'insensitive' } },
      ...(cleanedSearch.length > 0 ? [{ document: { contains: cleanedSearch } }] : []),
    ];
  }

  return withRlsContext(ctx, async (tx) => {
    const suppliers = await tx.supplier.findMany({
      where,
      include: { ratings: true },
      orderBy: { name: 'asc' },
    });

    const BOM = '\uFEFF';
    const headers = [
      'Nome',
      'CNPJ/CPF',
      'Nome Fantasia',
      'Categorias',
      'Status',
      'Rating',
      'Cidade',
      'UF',
      'Telefone',
      'Email',
    ];

    const rows = suppliers.map((s) => {
      const avg = computeAverageRating(s.ratings);
      const catLabels = s.categories.map((c) => SUPPLIER_CATEGORY_LABELS[c] ?? c).join('|');
      return [
        s.name,
        s.document,
        s.tradeName ?? '',
        catLabels,
        s.status,
        avg !== null ? avg.toFixed(1) : '',
        s.city ?? '',
        s.state ?? '',
        s.contactPhone ?? '',
        s.contactEmail ?? '',
      ].join(';');
    });

    return BOM + [headers.join(';'), ...rows].join('\n');
  });
}

// ─── Export: PDF ─────────────────────────────────────────────────────

export async function exportSuppliersPdf(
  ctx: RlsContext,
  query: ListSuppliersQuery,
  orgName: string,
): Promise<Buffer> {
  const where: Prisma.SupplierWhereInput = {
    organizationId: ctx.organizationId,
    deletedAt: null,
  };

  if (query.status) {
    where.status = query.status as SupplierStatus;
  }
  if (query.category) {
    where.categories = { has: query.category as SupplierCategory };
  }
  if (query.city) {
    where.city = { contains: query.city, mode: 'insensitive' };
  }
  if (query.state) {
    where.state = query.state;
  }
  if (query.search) {
    const cleanedSearch = cleanDocument(query.search);
    where.OR = [
      { name: { contains: query.search, mode: 'insensitive' } },
      { tradeName: { contains: query.search, mode: 'insensitive' } },
      ...(cleanedSearch.length > 0 ? [{ document: { contains: cleanedSearch } }] : []),
    ];
  }

  const suppliers = await withRlsContext(ctx, async (tx) => {
    return tx.supplier.findMany({
      where,
      include: { ratings: true },
      orderBy: { name: 'asc' },
    });
  });

  const PDFDocument = (await import('pdfkit')).default;
  return new Promise<Buffer>((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: 'A4', margin: 50 });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', reject);

      // Header
      doc.fontSize(18).font('Helvetica-Bold').text(orgName, { align: 'left' });
      doc.fontSize(14).font('Helvetica').text('Fornecedores', { align: 'left' });
      doc
        .fontSize(10)
        .text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')}`, { align: 'left' });

      // Filter description
      const filters: string[] = [];
      if (query.status) filters.push(`Status: ${query.status}`);
      if (query.category)
        filters.push(`Categoria: ${SUPPLIER_CATEGORY_LABELS[query.category] ?? query.category}`);
      if (query.city) filters.push(`Cidade: ${query.city}`);
      if (query.state) filters.push(`UF: ${query.state}`);
      if (filters.length > 0) {
        doc.fontSize(9).text(`Filtros: ${filters.join(' | ')}`);
      }

      doc.moveDown(1);

      // Table headers
      const cols = { nome: 50, cnpj: 220, cats: 310, status: 390, rating: 450, cidade: 490 };
      const colWidths = { nome: 165, cnpj: 85, cats: 75, status: 55, rating: 35, cidade: 70 };

      doc.fontSize(9).font('Helvetica-Bold');
      doc.text('Nome', cols.nome, doc.y, { width: colWidths.nome, continued: false });
      const headerY = doc.y - doc.currentLineHeight();
      doc.text('CNPJ/CPF', cols.cnpj, headerY, { width: colWidths.cnpj });
      doc.text('Categorias', cols.cats, headerY, { width: colWidths.cats });
      doc.text('Status', cols.status, headerY, { width: colWidths.status });
      doc.text('Rating', cols.rating, headerY, { width: colWidths.rating });
      doc.text('Cidade', cols.cidade, headerY, { width: colWidths.cidade });
      doc.moveDown(0.3);

      // Divider
      doc.moveTo(50, doc.y).lineTo(545, doc.y).stroke();
      doc.moveDown(0.3);

      // Rows
      suppliers.forEach((s, idx) => {
        const avg = computeAverageRating(s.ratings);
        const catLabels = s.categories.map((c) => SUPPLIER_CATEGORY_LABELS[c] ?? c).join(', ');

        const rowY = doc.y;

        // Alternating background
        if (idx % 2 === 1) {
          doc
            .rect(50, rowY - 2, 495, 14)
            .fill('#f5f5f5')
            .fillColor('black');
        }

        doc.fontSize(8).font('Helvetica');
        doc.text(s.name.substring(0, 30), cols.nome, rowY, { width: colWidths.nome });
        doc.text(s.document, cols.cnpj, rowY, { width: colWidths.cnpj });
        doc.text(catLabels.substring(0, 20), cols.cats, rowY, { width: colWidths.cats });
        doc.text(s.status, cols.status, rowY, { width: colWidths.status });
        doc.text(avg !== null ? avg.toFixed(1) : '-', cols.rating, rowY, {
          width: colWidths.rating,
        });
        doc.text(s.city ?? '-', cols.cidade, rowY, { width: colWidths.cidade });
        doc.moveDown(0.5);
      });

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

// ─── Ratings: Create ─────────────────────────────────────────────────

export async function createRating(
  ctx: RlsContext,
  supplierId: string,
  input: CreateRatingInput,
  ratedBy: string,
) {
  // Validate all 4 criteria are integers 1-5
  const criteria = ['deadline', 'quality', 'price', 'service'] as const;
  for (const field of criteria) {
    const val = input[field];
    if (!Number.isInteger(val) || val < 1 || val > 5) {
      throw new SupplierError(`Critério "${field}" deve ser um número inteiro entre 1 e 5.`, 400);
    }
  }

  return withRlsContext(ctx, async (tx) => {
    const supplier = await tx.supplier.findFirst({
      where: { id: supplierId, organizationId: ctx.organizationId, deletedAt: null },
    });
    if (!supplier) {
      throw new SupplierError('Fornecedor não encontrado', 404);
    }

    const rating = await tx.supplierRating.create({
      data: {
        supplierId,
        organizationId: ctx.organizationId,
        deadline: input.deadline,
        quality: input.quality,
        price: input.price,
        service: input.service,
        comment: input.comment ?? null,
        ratedBy,
      },
    });

    return rating;
  });
}

// ─── Ratings: List ───────────────────────────────────────────────────

export async function listRatings(ctx: RlsContext, supplierId: string) {
  return withRlsContext(ctx, async (tx) => {
    const supplier = await tx.supplier.findFirst({
      where: { id: supplierId, organizationId: ctx.organizationId, deletedAt: null },
    });
    if (!supplier) {
      throw new SupplierError('Fornecedor não encontrado', 404);
    }

    const ratings = await tx.supplierRating.findMany({
      where: { supplierId },
      orderBy: { createdAt: 'desc' },
    });

    return ratings.map((r) => ({
      ...r,
      individualAverage: (r.deadline + r.quality + r.price + r.service) / 4,
    }));
  });
}

// ─── Performance Report ───────────────────────────────────────────────

export async function getPerformanceReport(
  ctx: RlsContext,
  supplierId: string,
  startDate?: string,
  endDate?: string,
): Promise<PerformanceReportOutput> {
  return withRlsContext(ctx, async (tx) => {
    const supplier = await tx.supplier.findFirst({
      where: { id: supplierId, organizationId: ctx.organizationId, deletedAt: null },
    });
    if (!supplier) throw new SupplierError('Fornecedor nao encontrado', 404);

    const where: Prisma.SupplierRatingWhereInput = { supplierId };
    if (startDate || endDate) {
      where.createdAt = {};
      if (startDate) (where.createdAt as Record<string, Date>).gte = new Date(startDate);
      if (endDate) (where.createdAt as Record<string, Date>).lte = new Date(endDate);
    }

    const ratings = await tx.supplierRating.findMany({
      where,
      orderBy: { createdAt: 'asc' },
    });

    const history = ratings.map((r) => ({
      date: r.createdAt.toISOString().slice(0, 10),
      average: Math.round(((r.deadline + r.quality + r.price + r.service) / 4) * 100) / 100,
    }));

    const breakdown =
      ratings.length === 0
        ? { deadline: 0, quality: 0, price: 0, service: 0 }
        : {
            deadline:
              Math.round((ratings.reduce((s, r) => s + r.deadline, 0) / ratings.length) * 100) /
              100,
            quality:
              Math.round((ratings.reduce((s, r) => s + r.quality, 0) / ratings.length) * 100) / 100,
            price:
              Math.round((ratings.reduce((s, r) => s + r.price, 0) / ratings.length) * 100) / 100,
            service:
              Math.round((ratings.reduce((s, r) => s + r.service, 0) / ratings.length) * 100) / 100,
          };

    return { history, breakdown, totalRatings: ratings.length };
  });
}

// ─── Top 3 by Category ───────────────────────────────────────────────

export async function getTop3ByCategory(ctx: RlsContext, category: string) {
  if (!(SUPPLIER_CATEGORIES as readonly string[]).includes(category)) {
    throw new SupplierError(
      `Categoria inválida: ${category}. Valores permitidos: ${SUPPLIER_CATEGORIES.join(', ')}`,
      400,
    );
  }

  return withRlsContext(ctx, async (tx) => {
    const suppliers = await tx.supplier.findMany({
      where: {
        organizationId: ctx.organizationId,
        deletedAt: null,
        status: 'ACTIVE',
        categories: { has: category as SupplierCategory },
      },
      include: { ratings: true },
    });

    // Filter to only those with at least 1 rating
    const withRatings = suppliers.filter((s) => s.ratings.length > 0);

    // Compute averageRating per supplier
    const ranked = withRatings.map((s) => ({
      ...s,
      averageRating: computeAverageRating(s.ratings)!,
      ratingCount: s.ratings.length,
    }));

    // Sort by averageRating DESC, then ratingCount DESC
    ranked.sort((a, b) => {
      if (b.averageRating !== a.averageRating) return b.averageRating - a.averageRating;
      return b.ratingCount - a.ratingCount;
    });

    return ranked.slice(0, 3);
  });
}
