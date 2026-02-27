import { Request, Response, NextFunction } from 'express';
import { authenticate } from './auth';
import * as authService from '../modules/auth/auth.service';

jest.mock('../modules/auth/auth.service');

const mockedService = jest.mocked(authService);

function mockReq(headers: Record<string, string> = {}): Request {
  return { headers } as unknown as Request;
}

function mockRes(): Response {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('authenticate middleware', () => {
  let next: NextFunction;

  beforeEach(() => {
    jest.resetAllMocks();
    next = jest.fn();
  });

  it('should return 401 when Authorization header is missing', () => {
    const req = mockReq();
    const res = mockRes();

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Token de autenticação não fornecido' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 when Authorization header does not start with Bearer', () => {
    const req = mockReq({ authorization: 'Basic abc123' });
    const res = mockRes();

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Formato de token inválido' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should return 401 when token is invalid', () => {
    const req = mockReq({ authorization: 'Bearer invalid-token' });
    const res = mockRes();

    mockedService.verifyAccessToken.mockImplementation(() => {
      throw new Error('jwt malformed');
    });

    authenticate(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Token inválido ou expirado' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should call next() and set req.user when token is valid', () => {
    const req = mockReq({ authorization: 'Bearer valid-token' });
    const res = mockRes();

    const payload = {
      userId: 'user-1',
      email: 'user@test.com',
      role: 'ADMIN' as const,
      organizationId: 'org-1',
    };

    mockedService.verifyAccessToken.mockReturnValue(payload);

    authenticate(req, res, next);

    expect(req.user).toEqual(payload);
    expect(next).toHaveBeenCalled();
    expect(res.status).not.toHaveBeenCalled();
  });
});
