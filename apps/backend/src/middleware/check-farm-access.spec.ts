import { Request, Response, NextFunction } from 'express';
import { checkFarmAccess } from './check-farm-access';

// Mock RLS bypass — executes callback with a mock tx client
const mockFindUnique = jest.fn();

jest.mock('../database/rls', () => ({
  withRlsBypass: jest.fn(async (fn: (tx: unknown) => Promise<unknown>) => {
    const txClient = {
      userFarmAccess: {
        findUnique: mockFindUnique,
      },
    };
    return fn(txClient);
  }),
}));

function mockReq(
  user?: Record<string, unknown>,
  params: Record<string, string> = {},
  body: Record<string, unknown> = {},
  query: Record<string, unknown> = {},
): Request {
  return { user, params, body, query } as unknown as Request;
}

function mockRes(): Response {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('checkFarmAccess middleware', () => {
  let next: NextFunction;

  beforeEach(() => {
    next = jest.fn();
    jest.clearAllMocks();
  });

  it('should return 401 when req.user is undefined', async () => {
    const req = mockReq();
    const res = mockRes();

    await checkFarmAccess()(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(next).not.toHaveBeenCalled();
  });

  it('should bypass for SUPER_ADMIN', async () => {
    const req = mockReq(
      { userId: 'u1', email: 'sa@test.com', role: 'SUPER_ADMIN', organizationId: 'o1' },
      { farmId: 'f1' },
    );
    const res = mockRes();

    await checkFarmAccess()(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it('should bypass for ADMIN', async () => {
    const req = mockReq(
      { userId: 'u1', email: 'admin@test.com', role: 'ADMIN', organizationId: 'o1' },
      { farmId: 'f1' },
    );
    const res = mockRes();

    await checkFarmAccess()(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it('should skip check when no farmId is present', async () => {
    const req = mockReq({
      userId: 'u1',
      email: 'op@test.com',
      role: 'OPERATOR',
      organizationId: 'o1',
    });
    const res = mockRes();

    await checkFarmAccess()(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it('should allow OPERATOR with farm access', async () => {
    mockFindUnique.mockResolvedValue({ id: 'access-1', userId: 'u1', farmId: 'f1' });

    const req = mockReq(
      { userId: 'u1', email: 'op@test.com', role: 'OPERATOR', organizationId: 'o1' },
      { farmId: 'f1' },
    );
    const res = mockRes();

    await checkFarmAccess()(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(mockFindUnique).toHaveBeenCalledWith({
      where: { userId_farmId: { userId: 'u1', farmId: 'f1' } },
    });
  });

  it('should deny OPERATOR without farm access', async () => {
    mockFindUnique.mockResolvedValue(null);

    const req = mockReq(
      { userId: 'u1', email: 'op@test.com', role: 'OPERATOR', organizationId: 'o1' },
      { farmId: 'f1' },
    );
    const res = mockRes();

    await checkFarmAccess()(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Sem acesso a esta fazenda' });
    expect(next).not.toHaveBeenCalled();
  });
});
