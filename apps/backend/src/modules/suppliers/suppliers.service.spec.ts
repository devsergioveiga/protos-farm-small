/**
 * Unit tests for suppliers.service.ts
 * Focus: averageRating computation and top3 ranking logic
 */

// ─── Mocks ───────────────────────────────────────────────────────────

jest.mock('../../database/rls', () => ({
  withRlsContext: jest.fn((ctx, fn) => fn(mockTx)),
}));

const mockTx = {
  supplier: {
    findFirst: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    count: jest.fn(),
  },
  supplierRating: {
    create: jest.fn(),
    findMany: jest.fn(),
  },
};

import { withRlsContext } from '../../database/rls';
import { getTop3ByCategory, listRatings, createRating } from './suppliers.service';
import { SupplierError } from './suppliers.types';

const mockWithRlsContext = withRlsContext as jest.MockedFunction<typeof withRlsContext>;

const CTX = { organizationId: 'org-1' };

function makeRatings(
  entries: { deadline: number; quality: number; price: number; service: number }[],
) {
  return entries.map((r, i) => ({
    id: `rat-${i}`,
    supplierId: 'sup-1',
    organizationId: 'org-1',
    ...r,
    comment: null,
    ratedBy: 'user-1',
    createdAt: new Date(),
    updatedAt: new Date(),
  }));
}

function makeSupplier(id: string, ratings: ReturnType<typeof makeRatings>) {
  return {
    id,
    organizationId: 'org-1',
    type: 'PJ' as const,
    name: `Supplier ${id}`,
    tradeName: null,
    document: `${id.padStart(14, '0')}`,
    stateRegistration: null,
    address: null,
    city: 'São Paulo',
    state: 'SP',
    zipCode: null,
    contactName: null,
    contactPhone: null,
    contactEmail: null,
    paymentTerms: null,
    freightType: null,
    notes: null,
    status: 'ACTIVE' as const,
    categories: ['PECUARIO'] as const,
    createdBy: 'admin-1',
    deletedAt: null,
    createdAt: new Date(),
    updatedAt: new Date(),
    ratings,
  };
}

beforeEach(() => {
  jest.clearAllMocks();
  // Default: withRlsContext calls fn with mockTx
  mockWithRlsContext.mockImplementation((_ctx, fn) => fn(mockTx as never));
});

// ─── averageRating computation ────────────────────────────────────────

describe('averageRating computation', () => {
  it('computes weighted average across multiple ratings', async () => {
    // ratings: [{5,3,4,2}, {4,4,3,3}] → sum=28, count=8, avg=3.5
    const ratings = makeRatings([
      { deadline: 5, quality: 3, price: 4, service: 2 },
      { deadline: 4, quality: 4, price: 3, service: 3 },
    ]);
    const sup = makeSupplier('sup-1', ratings);

    mockTx.supplier.findFirst.mockResolvedValue(sup);
    mockTx.supplierRating.findMany.mockResolvedValue(ratings);

    const result = await listRatings(CTX, 'sup-1');
    // Each rating has individualAverage computed
    expect(result[0].individualAverage).toBe((5 + 3 + 4 + 2) / 4); // 3.5
    expect(result[1].individualAverage).toBe((4 + 4 + 3 + 3) / 4); // 3.5
  });

  it('computes different individual averages for different criteria', async () => {
    const ratings = makeRatings([
      { deadline: 5, quality: 5, price: 5, service: 5 },
      { deadline: 1, quality: 1, price: 1, service: 1 },
    ]);
    const sup = makeSupplier('sup-1', ratings);

    mockTx.supplier.findFirst.mockResolvedValue(sup);
    mockTx.supplierRating.findMany.mockResolvedValue(ratings);

    const result = await listRatings(CTX, 'sup-1');
    expect(result[0].individualAverage).toBe(5);
    expect(result[1].individualAverage).toBe(1);
  });
});

// ─── getTop3ByCategory ────────────────────────────────────────────────

describe('getTop3ByCategory', () => {
  it('returns top 3 suppliers sorted by averageRating DESC', async () => {
    const suppliers = [
      makeSupplier('a', makeRatings([{ deadline: 3, quality: 3, price: 3, service: 3 }])), // avg 3
      makeSupplier('b', makeRatings([{ deadline: 5, quality: 5, price: 5, service: 5 }])), // avg 5
      makeSupplier('c', makeRatings([{ deadline: 4, quality: 4, price: 4, service: 4 }])), // avg 4
      makeSupplier('d', makeRatings([{ deadline: 2, quality: 2, price: 2, service: 2 }])), // avg 2
    ];

    mockTx.supplier.findMany.mockResolvedValue(suppliers);

    const result = await getTop3ByCategory(CTX, 'PECUARIO');
    expect(result).toHaveLength(3);
    expect(result[0].id).toBe('b'); // avg 5
    expect(result[1].id).toBe('c'); // avg 4
    expect(result[2].id).toBe('a'); // avg 3
  });

  it('excludes suppliers with no ratings', async () => {
    const suppliers = [
      makeSupplier('a', makeRatings([{ deadline: 5, quality: 5, price: 5, service: 5 }])), // has ratings
      makeSupplier('b', []), // no ratings — excluded
      makeSupplier('c', makeRatings([{ deadline: 3, quality: 3, price: 3, service: 3 }])),
    ];

    mockTx.supplier.findMany.mockResolvedValue(suppliers);

    const result = await getTop3ByCategory(CTX, 'PECUARIO');
    expect(result).toHaveLength(2);
    expect(result.every((s) => s.ratingCount > 0)).toBe(true);
  });

  it('returns max 3 even if more than 3 have ratings', async () => {
    const suppliers = [
      makeSupplier('a', makeRatings([{ deadline: 5, quality: 5, price: 5, service: 5 }])),
      makeSupplier('b', makeRatings([{ deadline: 4, quality: 4, price: 4, service: 4 }])),
      makeSupplier('c', makeRatings([{ deadline: 3, quality: 3, price: 3, service: 3 }])),
      makeSupplier('d', makeRatings([{ deadline: 2, quality: 2, price: 2, service: 2 }])),
      makeSupplier('e', makeRatings([{ deadline: 1, quality: 1, price: 1, service: 1 }])),
    ];

    mockTx.supplier.findMany.mockResolvedValue(suppliers);

    const result = await getTop3ByCategory(CTX, 'PECUARIO');
    expect(result).toHaveLength(3);
  });

  it('throws 400 for invalid category', async () => {
    await expect(getTop3ByCategory(CTX, 'INVALIDO')).rejects.toThrow(SupplierError);
    await expect(getTop3ByCategory(CTX, 'INVALIDO')).rejects.toMatchObject({
      statusCode: 400,
    });
  });

  it('breaks ties by ratingCount DESC', async () => {
    const suppliers = [
      makeSupplier(
        'a',
        makeRatings([
          { deadline: 4, quality: 4, price: 4, service: 4 },
          { deadline: 4, quality: 4, price: 4, service: 4 },
        ]),
      ), // avg 4, count 2
      makeSupplier('b', makeRatings([{ deadline: 4, quality: 4, price: 4, service: 4 }])), // avg 4, count 1
    ];

    mockTx.supplier.findMany.mockResolvedValue(suppliers);

    const result = await getTop3ByCategory(CTX, 'PECUARIO');
    expect(result[0].id).toBe('a'); // more ratings wins tie
    expect(result[1].id).toBe('b');
  });
});

// ─── createRating validation ──────────────────────────────────────────

describe('createRating', () => {
  it('throws 400 for rating value out of range', async () => {
    await expect(
      createRating(CTX, 'sup-1', { deadline: 6, quality: 3, price: 3, service: 3 }, 'user-1'),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('throws 400 for non-integer rating value', async () => {
    await expect(
      createRating(CTX, 'sup-1', { deadline: 3.5, quality: 3, price: 3, service: 3 }, 'user-1'),
    ).rejects.toMatchObject({ statusCode: 400 });
  });

  it('creates rating successfully', async () => {
    const supplier = makeSupplier('sup-1', []);
    mockTx.supplier.findFirst.mockResolvedValue(supplier);
    const createdRating = {
      id: 'rat-new',
      supplierId: 'sup-1',
      organizationId: 'org-1',
      deadline: 5,
      quality: 4,
      price: 3,
      service: 4,
      comment: 'Bom',
      ratedBy: 'user-1',
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    mockTx.supplierRating.create.mockResolvedValue(createdRating);

    const result = await createRating(
      CTX,
      'sup-1',
      { deadline: 5, quality: 4, price: 3, service: 4, comment: 'Bom' },
      'user-1',
    );
    expect(result.id).toBe('rat-new');
    expect(mockTx.supplierRating.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ deadline: 5, quality: 4, price: 3, service: 4 }),
      }),
    );
  });
});
