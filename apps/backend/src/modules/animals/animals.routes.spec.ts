import request from 'supertest';
import { app } from '../../app';
import * as animalsService from './animals.service';
import * as authService from '../auth/auth.service';
import * as auditService from '../../shared/audit/audit.service';
import { AnimalError } from './animals.types';

jest.mock('../../shared/audit/audit.service', () => ({
  logAudit: jest.fn().mockResolvedValue(undefined),
}));

jest.mock('../../shared/rbac/rbac.service', () => ({
  getUserPermissions: jest.fn(),
  hasPermission: jest.fn(),
  invalidatePermissionsCache: jest.fn(),
  invalidatePermissionsCacheForRole: jest.fn(),
}));

import { getUserPermissions } from '../../shared/rbac/rbac.service';
import { DEFAULT_ROLE_PERMISSIONS } from '../../shared/rbac/permissions';

const mockGetUserPermissions = getUserPermissions as jest.MockedFunction<typeof getUserPermissions>;

jest.mock('./animals.service', () => ({
  createAnimal: jest.fn(),
  listAnimals: jest.fn(),
  getAnimal: jest.fn(),
  updateAnimal: jest.fn(),
  softDeleteAnimal: jest.fn(),
  getAnimalsSummary: jest.fn(),
  exportAnimalsCsv: jest.fn(),
  listBreeds: jest.fn(),
  createBreed: jest.fn(),
  deleteBreed: jest.fn(),
  suggestCategory: jest.fn(),
  detectGirolandoGrade: jest.fn(),
  validateBreedComposition: jest.fn(),
  previewBulkImportAnimals: jest.fn(),
  executeBulkImportAnimals: jest.fn(),
  resolveEnumValue: jest.fn(),
  parseDate: jest.fn(),
}));

jest.mock('../auth/auth.service', () => {
  const actual = jest.requireActual('../auth/auth.service');
  return {
    ...actual,
    verifyAccessToken: jest.fn(),
  };
});

jest.mock('../../middleware/check-farm-access', () => ({
  checkFarmAccess: () => (_req: unknown, _res: unknown, next: () => void) => next(),
}));

const mockedService = jest.mocked(animalsService);
const mockedAuth = jest.mocked(authService);
const mockedAudit = jest.mocked(auditService);

const ADMIN_PAYLOAD = {
  userId: 'admin-1',
  email: 'admin@org.com',
  role: 'ADMIN' as const,
  organizationId: 'org-1',
};

const OPERATOR_PAYLOAD = {
  userId: 'user-1',
  email: 'user@org.com',
  role: 'OPERATOR' as const,
  organizationId: 'org-1',
};

const CONSULTANT_PAYLOAD = {
  userId: 'consult-1',
  email: 'consult@org.com',
  role: 'CONSULTANT' as const,
  organizationId: 'org-1',
};

function authAs(
  payload: typeof ADMIN_PAYLOAD | typeof OPERATOR_PAYLOAD | typeof CONSULTANT_PAYLOAD,
) {
  mockedAuth.verifyAccessToken.mockReturnValue(payload);
  mockGetUserPermissions.mockResolvedValue(DEFAULT_ROLE_PERMISSIONS[payload.role]);
}

beforeEach(() => {
  jest.clearAllMocks();
});

const FARM_ID = 'farm-1';
const ANIMAL_ID = 'animal-1';
const BREED_ID = 'breed-1';

const mockAnimal = {
  id: ANIMAL_ID,
  farmId: FARM_ID,
  earTag: 'BR001',
  sex: 'FEMALE',
  category: 'VACA_LACTACAO',
  compositions: [],
};

// ─── POST /org/farms/:farmId/animals ────────────────────────────────

describe('POST /org/farms/:farmId/animals', () => {
  it('should create animal and return 201', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.createAnimal.mockResolvedValue(mockAnimal as never);

    const res = await request(app)
      .post(`/api/org/farms/${FARM_ID}/animals`)
      .set('Authorization', 'Bearer valid')
      .send({ earTag: 'BR001', sex: 'FEMALE' });

    expect(res.status).toBe(201);
    expect(res.body.earTag).toBe('BR001');
    expect(mockedAudit.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'CREATE_ANIMAL' }),
    );
  });

  it('should return 400 when earTag is missing', async () => {
    authAs(ADMIN_PAYLOAD);

    const res = await request(app)
      .post(`/api/org/farms/${FARM_ID}/animals`)
      .set('Authorization', 'Bearer valid')
      .send({ sex: 'MALE' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Brinco');
  });

  it('should return 400 when sex is missing', async () => {
    authAs(ADMIN_PAYLOAD);

    const res = await request(app)
      .post(`/api/org/farms/${FARM_ID}/animals`)
      .set('Authorization', 'Bearer valid')
      .send({ earTag: 'BR001' });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Sexo');
  });

  it('should return 422 on duplicate earTag', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.createAnimal.mockRejectedValue(
      new AnimalError("Brinco 'BR001' já cadastrado", 422),
    );

    const res = await request(app)
      .post(`/api/org/farms/${FARM_ID}/animals`)
      .set('Authorization', 'Bearer valid')
      .send({ earTag: 'BR001', sex: 'MALE' });

    expect(res.status).toBe(422);
  });

  it('should return 401 without auth', async () => {
    const res = await request(app)
      .post(`/api/org/farms/${FARM_ID}/animals`)
      .send({ earTag: 'BR001', sex: 'MALE' });

    expect(res.status).toBe(401);
  });

  it('should return 403 for CONSULTANT (no animals:create)', async () => {
    authAs(CONSULTANT_PAYLOAD);

    const res = await request(app)
      .post(`/api/org/farms/${FARM_ID}/animals`)
      .set('Authorization', 'Bearer valid')
      .send({ earTag: 'BR001', sex: 'MALE' });

    expect(res.status).toBe(403);
  });
});

// ─── GET /org/farms/:farmId/animals ─────────────────────────────────

describe('GET /org/farms/:farmId/animals', () => {
  it('should list animals with pagination', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.listAnimals.mockResolvedValue({
      data: [mockAnimal] as never,
      meta: { page: 1, limit: 20, total: 1, totalPages: 1 },
    });

    const res = await request(app)
      .get(`/api/org/farms/${FARM_ID}/animals?page=1&limit=20`)
      .set('Authorization', 'Bearer valid');

    expect(res.status).toBe(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.meta.total).toBe(1);
  });

  it('should pass filters to service', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.listAnimals.mockResolvedValue({
      data: [],
      meta: { page: 1, limit: 20, total: 0, totalPages: 0 },
    });

    await request(app)
      .get(`/api/org/farms/${FARM_ID}/animals?sex=FEMALE&category=VACA_LACTACAO&search=BR`)
      .set('Authorization', 'Bearer valid');

    expect(mockedService.listAnimals).toHaveBeenCalledWith(
      expect.any(Object),
      FARM_ID,
      expect.objectContaining({ sex: 'FEMALE', category: 'VACA_LACTACAO', search: 'BR' }),
    );
  });
});

// ─── GET /org/farms/:farmId/animals/summary ─────────────────────────

describe('GET /org/farms/:farmId/animals/summary', () => {
  it('should return summary', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getAnimalsSummary.mockResolvedValue({
      total: 10,
      byCategory: { VACA_LACTACAO: 5, BEZERRO: 3 },
      bySex: { FEMALE: 7, MALE: 3 },
    });

    const res = await request(app)
      .get(`/api/org/farms/${FARM_ID}/animals/summary`)
      .set('Authorization', 'Bearer valid');

    expect(res.status).toBe(200);
    expect(res.body.total).toBe(10);
  });
});

// ─── GET /org/farms/:farmId/animals/:animalId ───────────────────────

describe('GET /org/farms/:farmId/animals/:animalId', () => {
  it('should return animal detail', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getAnimal.mockResolvedValue(mockAnimal as never);

    const res = await request(app)
      .get(`/api/org/farms/${FARM_ID}/animals/${ANIMAL_ID}`)
      .set('Authorization', 'Bearer valid');

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(ANIMAL_ID);
  });

  it('should return 404 when animal not found', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.getAnimal.mockRejectedValue(new AnimalError('Animal não encontrado', 404));

    const res = await request(app)
      .get(`/api/org/farms/${FARM_ID}/animals/nonexistent`)
      .set('Authorization', 'Bearer valid');

    expect(res.status).toBe(404);
  });
});

// ─── PATCH /org/farms/:farmId/animals/:animalId ─────────────────────

describe('PATCH /org/farms/:farmId/animals/:animalId', () => {
  it('should update animal', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.updateAnimal.mockResolvedValue({ ...mockAnimal, name: 'Mimosa' } as never);

    const res = await request(app)
      .patch(`/api/org/farms/${FARM_ID}/animals/${ANIMAL_ID}`)
      .set('Authorization', 'Bearer valid')
      .send({ name: 'Mimosa' });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Mimosa');
    expect(mockedAudit.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'UPDATE_ANIMAL' }),
    );
  });

  it('should return 403 for OPERATOR (no animals:update)', async () => {
    authAs(OPERATOR_PAYLOAD);

    const res = await request(app)
      .patch(`/api/org/farms/${FARM_ID}/animals/${ANIMAL_ID}`)
      .set('Authorization', 'Bearer valid')
      .send({ name: 'Test' });

    expect(res.status).toBe(403);
  });
});

// ─── DELETE /org/farms/:farmId/animals/:animalId ────────────────────

describe('DELETE /org/farms/:farmId/animals/:animalId', () => {
  it('should soft-delete animal and return 204', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.softDeleteAnimal.mockResolvedValue(undefined);

    const res = await request(app)
      .delete(`/api/org/farms/${FARM_ID}/animals/${ANIMAL_ID}`)
      .set('Authorization', 'Bearer valid');

    expect(res.status).toBe(204);
    expect(mockedAudit.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'DELETE_ANIMAL' }),
    );
  });

  it('should return 404 when animal not found', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.softDeleteAnimal.mockRejectedValue(new AnimalError('Animal não encontrado', 404));

    const res = await request(app)
      .delete(`/api/org/farms/${FARM_ID}/animals/nonexistent`)
      .set('Authorization', 'Bearer valid');

    expect(res.status).toBe(404);
  });
});

// ─── GET /org/breeds ────────────────────────────────────────────────

describe('GET /org/breeds', () => {
  it('should list breeds', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.listBreeds.mockResolvedValue([
      { id: BREED_ID, name: 'Holandesa', code: 'HOL' },
    ] as never);

    const res = await request(app).get('/api/org/breeds').set('Authorization', 'Bearer valid');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('Holandesa');
  });
});

// ─── POST /org/breeds ───────────────────────────────────────────────

describe('POST /org/breeds', () => {
  it('should create breed and return 201', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.createBreed.mockResolvedValue({
      id: 'new-breed',
      name: 'Raça Custom',
      code: 'CUS',
    } as never);

    const res = await request(app)
      .post('/api/org/breeds')
      .set('Authorization', 'Bearer valid')
      .send({ name: 'Raça Custom', code: 'CUS' });

    expect(res.status).toBe(201);
    expect(res.body.name).toBe('Raça Custom');
  });

  it('should return 400 when name is missing', async () => {
    authAs(ADMIN_PAYLOAD);

    const res = await request(app)
      .post('/api/org/breeds')
      .set('Authorization', 'Bearer valid')
      .send({ code: 'X' });

    expect(res.status).toBe(400);
  });
});

// ─── DELETE /org/breeds/:breedId ────────────────────────────────────

describe('DELETE /org/breeds/:breedId', () => {
  it('should delete breed and return 204', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.deleteBreed.mockResolvedValue(undefined);

    const res = await request(app)
      .delete(`/api/org/breeds/${BREED_ID}`)
      .set('Authorization', 'Bearer valid');

    expect(res.status).toBe(204);
  });

  it('should return 422 when breed is in use', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.deleteBreed.mockRejectedValue(new AnimalError('Raça em uso por animais', 422));

    const res = await request(app)
      .delete(`/api/org/breeds/${BREED_ID}`)
      .set('Authorization', 'Bearer valid');

    expect(res.status).toBe(422);
  });
});

// ─── suggestCategory (unit) ─────────────────────────────────────────

describe('suggestCategory', () => {
  // Import actual (not mocked) for unit testing
  const { suggestCategory: realSuggest } = jest.requireActual('./animals.service');

  it('should return BEZERRO for male without birthDate', () => {
    expect(realSuggest('MALE')).toBe('BEZERRO');
  });

  it('should return BEZERRA for female without birthDate', () => {
    expect(realSuggest('FEMALE')).toBe('BEZERRA');
  });

  it('should return TOURO_REPRODUTOR for male > 24 months', () => {
    const twoYearsAgo = new Date();
    twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 3);
    expect(realSuggest('MALE', twoYearsAgo.toISOString())).toBe('TOURO_REPRODUTOR');
  });

  it('should return NOVILHA for female 12-24 months', () => {
    const eighteenMonthsAgo = new Date();
    eighteenMonthsAgo.setMonth(eighteenMonthsAgo.getMonth() - 18);
    expect(realSuggest('FEMALE', eighteenMonthsAgo.toISOString())).toBe('NOVILHA');
  });
});

// ─── detectGirolandoGrade (unit) ────────────────────────────────────

describe('detectGirolandoGrade', () => {
  const { detectGirolandoGrade: realDetect } = jest.requireActual('./animals.service');

  it('should detect F1 (50% Holandesa + 50% Gir)', () => {
    expect(
      realDetect([
        { breedName: 'Holandesa', percentage: 50 },
        { breedName: 'Gir Leiteiro', percentage: 50 },
      ]),
    ).toBe('F1');
  });

  it('should detect 3/4 (75% Holandesa + 25% Gir)', () => {
    expect(
      realDetect([
        { breedName: 'Holandesa', percentage: 75 },
        { breedName: 'Gir Leiteiro', percentage: 25 },
      ]),
    ).toBe('3/4');
  });

  it('should detect 5/8 (62.5% Holandesa + 37.5% Gir)', () => {
    expect(
      realDetect([
        { breedName: 'Holandesa', percentage: 62.5 },
        { breedName: 'Gir Leiteiro', percentage: 37.5 },
      ]),
    ).toBe('5/8');
  });

  it('should return null for non-Girolando composition', () => {
    expect(
      realDetect([
        { breedName: 'Nelore', percentage: 50 },
        { breedName: 'Angus', percentage: 50 },
      ]),
    ).toBeNull();
  });

  it('should return null for single breed', () => {
    expect(realDetect([{ breedName: 'Holandesa', percentage: 100 }])).toBeNull();
  });
});

// ─── validateBreedComposition (unit) ────────────────────────────────

describe('validateBreedComposition', () => {
  const { validateBreedComposition: realValidate } = jest.requireActual('./animals.service');

  it('should accept valid composition summing to 100', () => {
    expect(() =>
      realValidate([
        { breedId: 'b1', percentage: 75 },
        { breedId: 'b2', percentage: 25 },
      ]),
    ).not.toThrow();
  });

  it('should reject composition not summing to 100', () => {
    expect(() =>
      realValidate([
        { breedId: 'b1', percentage: 60 },
        { breedId: 'b2', percentage: 30 },
      ]),
    ).toThrow('100%');
  });

  it('should reject duplicate breeds', () => {
    expect(() =>
      realValidate([
        { breedId: 'b1', percentage: 50 },
        { breedId: 'b1', percentage: 50 },
      ]),
    ).toThrow('duplicada');
  });

  it('should skip validation for empty array', () => {
    expect(() => realValidate([])).not.toThrow();
  });
});

// ─── POST /org/farms/:farmId/animals/bulk/preview ────────────────────

describe('POST /org/farms/:farmId/animals/bulk/preview', () => {
  const mockPreviewResult = {
    filename: 'test.csv',
    totalRows: 2,
    validCount: 2,
    invalidCount: 0,
    columnHeaders: ['Brinco', 'Sexo'],
    rows: [
      {
        index: 0,
        parsed: { earTag: 'BR001', sex: 'MALE' },
        derived: { suggestedCategory: 'BEZERRO' },
        validation: { valid: true, errors: [], warnings: [] },
      },
    ],
  };

  it('should preview bulk import and return 200', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.previewBulkImportAnimals.mockResolvedValue(mockPreviewResult as never);

    const res = await request(app)
      .post(`/api/org/farms/${FARM_ID}/animals/bulk/preview`)
      .set('Authorization', 'Bearer valid')
      .attach('file', Buffer.from('Brinco;Sexo\nBR001;M'), 'animals.csv');

    expect(res.status).toBe(200);
    expect(res.body.filename).toBe('test.csv');
    expect(res.body.rows).toHaveLength(1);
  });

  it('should return 400 when no file is provided', async () => {
    authAs(ADMIN_PAYLOAD);

    const res = await request(app)
      .post(`/api/org/farms/${FARM_ID}/animals/bulk/preview`)
      .set('Authorization', 'Bearer valid');

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Arquivo');
  });

  it('should return 400 for unsupported file extension', async () => {
    authAs(ADMIN_PAYLOAD);

    const res = await request(app)
      .post(`/api/org/farms/${FARM_ID}/animals/bulk/preview`)
      .set('Authorization', 'Bearer valid')
      .attach('file', Buffer.from('test'), 'animals.txt');

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('não suportado');
  });

  it('should return 403 for CONSULTANT', async () => {
    authAs(CONSULTANT_PAYLOAD);

    const res = await request(app)
      .post(`/api/org/farms/${FARM_ID}/animals/bulk/preview`)
      .set('Authorization', 'Bearer valid')
      .attach('file', Buffer.from('test'), 'animals.csv');

    expect(res.status).toBe(403);
  });
});

// ─── POST /org/farms/:farmId/animals/bulk ────────────────────────────

describe('POST /org/farms/:farmId/animals/bulk', () => {
  const mockImportResult = {
    imported: 2,
    skipped: 0,
    items: [
      { index: 0, status: 'imported', animalId: 'a1', earTag: 'BR001' },
      { index: 1, status: 'imported', animalId: 'a2', earTag: 'BR002' },
    ],
    warnings: [],
  };

  it('should execute bulk import and return 200', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.executeBulkImportAnimals.mockResolvedValue(mockImportResult as never);

    const res = await request(app)
      .post(`/api/org/farms/${FARM_ID}/animals/bulk`)
      .set('Authorization', 'Bearer valid')
      .attach('file', Buffer.from('Brinco;Sexo\nBR001;M'), 'animals.csv')
      .field('columnMapping', '{}')
      .field('selectedIndices', '[0,1]');

    expect(res.status).toBe(200);
    expect(res.body.imported).toBe(2);
    expect(mockedAudit.logAudit).toHaveBeenCalledWith(
      expect.objectContaining({ action: 'BULK_IMPORT_ANIMALS' }),
    );
  });

  it('should return 400 when selectedIndices is empty', async () => {
    authAs(ADMIN_PAYLOAD);

    const res = await request(app)
      .post(`/api/org/farms/${FARM_ID}/animals/bulk`)
      .set('Authorization', 'Bearer valid')
      .attach('file', Buffer.from('Brinco;Sexo\nBR001;M'), 'animals.csv')
      .field('columnMapping', '{}')
      .field('selectedIndices', '[]');

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('selectedIndices');
  });

  it('should return 400 when no file is provided', async () => {
    authAs(ADMIN_PAYLOAD);

    const res = await request(app)
      .post(`/api/org/farms/${FARM_ID}/animals/bulk`)
      .set('Authorization', 'Bearer valid')
      .field('selectedIndices', '[0]');

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Arquivo');
  });

  it('should return 400 for invalid JSON in columnMapping', async () => {
    authAs(ADMIN_PAYLOAD);

    const res = await request(app)
      .post(`/api/org/farms/${FARM_ID}/animals/bulk`)
      .set('Authorization', 'Bearer valid')
      .attach('file', Buffer.from('test'), 'animals.csv')
      .field('columnMapping', 'not-json')
      .field('selectedIndices', '[0]');

    expect(res.status).toBe(400);
  });
});

// ─── GET /org/farms/:farmId/animals — advanced filters ───────────────

describe('GET /org/farms/:farmId/animals — advanced filters', () => {
  const emptyResult = {
    data: [],
    meta: { page: 1, limit: 50, total: 0, totalPages: 0 },
  };

  it('should pass lotId filter to service', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.listAnimals.mockResolvedValue(emptyResult);

    await request(app)
      .get(`/api/org/farms/${FARM_ID}/animals?lotId=lot-1`)
      .set('Authorization', 'Bearer valid');

    expect(mockedService.listAnimals).toHaveBeenCalledWith(
      expect.any(Object),
      FARM_ID,
      expect.objectContaining({ lotId: 'lot-1' }),
    );
  });

  it('should pass locationId filter to service', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.listAnimals.mockResolvedValue(emptyResult);

    await request(app)
      .get(`/api/org/farms/${FARM_ID}/animals?locationId=loc-1`)
      .set('Authorization', 'Bearer valid');

    expect(mockedService.listAnimals).toHaveBeenCalledWith(
      expect.any(Object),
      FARM_ID,
      expect.objectContaining({ locationId: 'loc-1' }),
    );
  });

  it('should pass birthDate range filters to service', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.listAnimals.mockResolvedValue(emptyResult);

    await request(app)
      .get(`/api/org/farms/${FARM_ID}/animals?birthDateFrom=2024-01-01&birthDateTo=2024-12-31`)
      .set('Authorization', 'Bearer valid');

    expect(mockedService.listAnimals).toHaveBeenCalledWith(
      expect.any(Object),
      FARM_ID,
      expect.objectContaining({
        birthDateFrom: '2024-01-01',
        birthDateTo: '2024-12-31',
      }),
    );
  });

  it('should pass weight range filters as numbers', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.listAnimals.mockResolvedValue(emptyResult);

    await request(app)
      .get(`/api/org/farms/${FARM_ID}/animals?minWeightKg=100&maxWeightKg=500`)
      .set('Authorization', 'Bearer valid');

    expect(mockedService.listAnimals).toHaveBeenCalledWith(
      expect.any(Object),
      FARM_ID,
      expect.objectContaining({ minWeightKg: 100, maxWeightKg: 500 }),
    );
  });

  it('should pass age range filters as numbers', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.listAnimals.mockResolvedValue(emptyResult);

    await request(app)
      .get(`/api/org/farms/${FARM_ID}/animals?minAgeDays=30&maxAgeDays=365`)
      .set('Authorization', 'Bearer valid');

    expect(mockedService.listAnimals).toHaveBeenCalledWith(
      expect.any(Object),
      FARM_ID,
      expect.objectContaining({ minAgeDays: 30, maxAgeDays: 365 }),
    );
  });

  it('should pass sortBy and sortOrder to service', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.listAnimals.mockResolvedValue(emptyResult);

    await request(app)
      .get(`/api/org/farms/${FARM_ID}/animals?sortBy=birthDate&sortOrder=asc`)
      .set('Authorization', 'Bearer valid');

    expect(mockedService.listAnimals).toHaveBeenCalledWith(
      expect.any(Object),
      FARM_ID,
      expect.objectContaining({ sortBy: 'birthDate', sortOrder: 'asc' }),
    );
  });

  it('should return 400 for NaN numeric params', async () => {
    authAs(ADMIN_PAYLOAD);

    const res = await request(app)
      .get(`/api/org/farms/${FARM_ID}/animals?minWeightKg=abc`)
      .set('Authorization', 'Bearer valid');

    expect(res.status).toBe(400);
    expect(res.body.error).toContain('minWeightKg');
  });
});

// ─── GET /org/farms/:farmId/animals/export ──────────────────────────

describe('GET /org/farms/:farmId/animals/export', () => {
  it('should return CSV with correct headers', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.exportAnimalsCsv.mockResolvedValue('\uFEFFBrinco;Nome;Sexo\nBR001;Mimosa;Fêmea');

    const res = await request(app)
      .get(`/api/org/farms/${FARM_ID}/animals/export`)
      .set('Authorization', 'Bearer valid');

    expect(res.status).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toContain(`animais-${FARM_ID}.csv`);
    expect(res.text).toContain('Brinco;Nome;Sexo');
  });

  it('should pass filters to exportAnimalsCsv', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.exportAnimalsCsv.mockResolvedValue('\uFEFFBrinco\n');

    await request(app)
      .get(`/api/org/farms/${FARM_ID}/animals/export?sex=FEMALE&lotId=lot-1`)
      .set('Authorization', 'Bearer valid');

    expect(mockedService.exportAnimalsCsv).toHaveBeenCalledWith(
      expect.any(Object),
      FARM_ID,
      expect.objectContaining({ sex: 'FEMALE', lotId: 'lot-1' }),
    );
  });

  it('should pass locationId to exportAnimalsCsv', async () => {
    authAs(ADMIN_PAYLOAD);
    mockedService.exportAnimalsCsv.mockResolvedValue('\uFEFFBrinco\n');

    await request(app)
      .get(`/api/org/farms/${FARM_ID}/animals/export?locationId=loc-1`)
      .set('Authorization', 'Bearer valid');

    expect(mockedService.exportAnimalsCsv).toHaveBeenCalledWith(
      expect.any(Object),
      FARM_ID,
      expect.objectContaining({ locationId: 'loc-1' }),
    );
  });

  it('should return 401 without auth', async () => {
    const res = await request(app).get(`/api/org/farms/${FARM_ID}/animals/export`);

    expect(res.status).toBe(401);
  });
});

// ─── resolveEnumValue (unit) ────────────────────────────────────────

describe('resolveEnumValue', () => {
  const { resolveEnumValue: realResolve } = jest.requireActual('./animals.service');
  const sexAliases = { m: 'MALE', macho: 'MALE', f: 'FEMALE', fêmea: 'FEMALE' };
  const validSexes = ['MALE', 'FEMALE'] as const;

  it('should resolve direct uppercase match', () => {
    expect(realResolve('MALE', sexAliases, validSexes)).toBe('MALE');
  });

  it('should resolve alias', () => {
    expect(realResolve('macho', sexAliases, validSexes)).toBe('MALE');
    expect(realResolve('f', sexAliases, validSexes)).toBe('FEMALE');
  });

  it('should return null for empty/null', () => {
    expect(realResolve(null, sexAliases, validSexes)).toBeNull();
    expect(realResolve('', sexAliases, validSexes)).toBeNull();
  });

  it('should return null for unrecognized value', () => {
    expect(realResolve('unknown', sexAliases, validSexes)).toBeNull();
  });
});

// ─── parseDate (unit) ───────────────────────────────────────────────

describe('parseDate', () => {
  const { parseDate: realParse } = jest.requireActual('./animals.service');

  it('should parse DD/MM/YYYY format', () => {
    expect(realParse('15/03/2024')).toBe('2024-03-15');
  });

  it('should parse YYYY-MM-DD format', () => {
    expect(realParse('2024-03-15')).toBe('2024-03-15');
  });

  it('should return null for null/empty', () => {
    expect(realParse(null)).toBeNull();
    expect(realParse('')).toBeNull();
  });

  it('should return null for invalid date', () => {
    expect(realParse('invalid')).toBeNull();
  });
});
