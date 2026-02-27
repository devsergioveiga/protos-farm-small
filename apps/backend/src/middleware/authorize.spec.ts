import { Request, Response, NextFunction } from 'express';
import { authorize } from './authorize';

function mockReq(user?: Record<string, unknown>): Request {
  return { user } as unknown as Request;
}

function mockRes(): Response {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('authorize middleware', () => {
  let next: NextFunction;

  beforeEach(() => {
    next = jest.fn();
  });

  it('should return 401 when req.user is undefined', () => {
    const req = mockReq();
    const res = mockRes();

    authorize('SUPER_ADMIN')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Não autenticado' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 403 when user role is not allowed', () => {
    const req = mockReq({
      userId: 'user-1',
      email: 'user@test.com',
      role: 'OPERATOR',
      organizationId: 'org-1',
    });
    const res = mockRes();

    authorize('SUPER_ADMIN')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Acesso negado' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should call next() when user role is allowed', () => {
    const req = mockReq({
      userId: 'user-1',
      email: 'admin@test.com',
      role: 'SUPER_ADMIN',
      organizationId: 'org-1',
    });
    const res = mockRes();

    authorize('SUPER_ADMIN')(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });

  it('should accept multiple roles', () => {
    const req = mockReq({
      userId: 'user-1',
      email: 'admin@test.com',
      role: 'ADMIN',
      organizationId: 'org-1',
    });
    const res = mockRes();

    authorize('SUPER_ADMIN', 'ADMIN')(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});
