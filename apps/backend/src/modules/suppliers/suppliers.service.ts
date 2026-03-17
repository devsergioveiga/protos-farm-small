import type { SupplierCategory, SupplierStatus, Prisma } from '@prisma/client';
import { withRlsContext, type RlsContext } from '../../database/rls';
import { isValidCPF, isValidCNPJ, cleanDocument } from '../../shared/utils/document-validator';
import {
  SupplierError,
  SUPPLIER_CATEGORIES,
  type CreateSupplierInput,
  type UpdateSupplierInput,
  type ListSuppliersQuery,
} from './suppliers.types';

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
