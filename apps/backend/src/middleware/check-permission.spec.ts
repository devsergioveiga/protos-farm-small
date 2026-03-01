import { Request, Response, NextFunction } from 'express';
import { checkPermission } from './check-permission';
import { DEFAULT_ROLE_PERMISSIONS, ROLE_HIERARCHY, Permission } from '../shared/rbac/permissions';

// Mock rbac.service
jest.mock('../shared/rbac/rbac.service', () => ({
  getUserPermissions: jest.fn(),
}));

import { getUserPermissions } from '../shared/rbac/rbac.service';

const mockGetUserPermissions = getUserPermissions as jest.MockedFunction<typeof getUserPermissions>;

function mockReq(user?: Record<string, unknown>): Request {
  return { user } as unknown as Request;
}

function mockRes(): Response {
  const res = {} as Response;
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
}

describe('checkPermission middleware', () => {
  let next: NextFunction;

  beforeEach(() => {
    next = jest.fn();
    jest.clearAllMocks();
  });

  it('should return 401 when req.user is undefined', async () => {
    const req = mockReq();
    const res = mockRes();

    await checkPermission('farms:read')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(401);
    expect(res.json).toHaveBeenCalledWith({ error: 'Não autenticado' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should bypass permission check for SUPER_ADMIN', async () => {
    const req = mockReq({
      userId: 'user-1',
      email: 'super@test.com',
      role: 'SUPER_ADMIN',
      organizationId: 'org-1',
    });
    const res = mockRes();

    await checkPermission('organizations:delete')(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(mockGetUserPermissions).not.toHaveBeenCalled();
  });

  it('should allow when user has all required permissions', async () => {
    mockGetUserPermissions.mockResolvedValue(['farms:read', 'farms:create', 'farms:update']);

    const req = mockReq({
      userId: 'user-1',
      email: 'manager@test.com',
      role: 'MANAGER',
      organizationId: 'org-1',
    });
    const res = mockRes();

    await checkPermission('farms:read', 'farms:create')(req, res, next);

    expect(next).toHaveBeenCalled();
    expect(mockGetUserPermissions).toHaveBeenCalledWith('user-1');
  });

  it('should return 403 when user lacks a required permission', async () => {
    mockGetUserPermissions.mockResolvedValue(['farms:read']);

    const req = mockReq({
      userId: 'user-1',
      email: 'consultant@test.com',
      role: 'CONSULTANT',
      organizationId: 'org-1',
    });
    const res = mockRes();

    await checkPermission('farms:read', 'farms:create')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(res.json).toHaveBeenCalledWith({ error: 'Permissão insuficiente' });
    expect(next).not.toHaveBeenCalled();
  });

  it('should allow ADMIN for non-org-create/delete permissions', async () => {
    mockGetUserPermissions.mockResolvedValue(DEFAULT_ROLE_PERMISSIONS.ADMIN);

    const req = mockReq({
      userId: 'user-1',
      email: 'admin@test.com',
      role: 'ADMIN',
      organizationId: 'org-1',
    });
    const res = mockRes();

    await checkPermission('users:create', 'users:read')(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('should deny ADMIN for organizations:create', async () => {
    mockGetUserPermissions.mockResolvedValue(DEFAULT_ROLE_PERMISSIONS.ADMIN);

    const req = mockReq({
      userId: 'user-1',
      email: 'admin@test.com',
      role: 'ADMIN',
      organizationId: 'org-1',
    });
    const res = mockRes();

    await checkPermission('organizations:create')(req, res, next);

    expect(res.status).toHaveBeenCalledWith(403);
    expect(next).not.toHaveBeenCalled();
  });
});

describe('ROLE_HIERARCHY', () => {
  it('should have SUPER_ADMIN as highest', () => {
    expect(ROLE_HIERARCHY.SUPER_ADMIN).toBe(100);
  });

  it('should have ADMIN below SUPER_ADMIN', () => {
    expect(ROLE_HIERARCHY.ADMIN).toBeLessThan(ROLE_HIERARCHY.SUPER_ADMIN);
    expect(ROLE_HIERARCHY.ADMIN).toBe(90);
  });

  it('should have CONSULTANT as lowest', () => {
    const values = Object.values(ROLE_HIERARCHY);
    expect(ROLE_HIERARCHY.CONSULTANT).toBe(Math.min(...values));
  });
});

describe('DEFAULT_ROLE_PERMISSIONS', () => {
  it('SUPER_ADMIN should have all permissions', () => {
    const totalPerms = 7 * 4; // 7 modules × 4 actions
    expect(DEFAULT_ROLE_PERMISSIONS.SUPER_ADMIN).toHaveLength(totalPerms);
  });

  it('ADMIN should not have organizations:create or organizations:delete', () => {
    expect(DEFAULT_ROLE_PERMISSIONS.ADMIN).not.toContain('organizations:create');
    expect(DEFAULT_ROLE_PERMISSIONS.ADMIN).not.toContain('organizations:delete');
  });

  it('CONSULTANT should only have read permissions', () => {
    const perms = DEFAULT_ROLE_PERMISSIONS.CONSULTANT;
    expect(perms.every((p: Permission) => p.endsWith(':read'))).toBe(true);
  });

  it('MANAGER should have all farm permissions', () => {
    expect(DEFAULT_ROLE_PERMISSIONS.MANAGER).toContain('farms:create');
    expect(DEFAULT_ROLE_PERMISSIONS.MANAGER).toContain('farms:read');
    expect(DEFAULT_ROLE_PERMISSIONS.MANAGER).toContain('farms:update');
    expect(DEFAULT_ROLE_PERMISSIONS.MANAGER).toContain('farms:delete');
  });

  it('FINANCIAL should have all financial permissions', () => {
    expect(DEFAULT_ROLE_PERMISSIONS.FINANCIAL).toContain('financial:create');
    expect(DEFAULT_ROLE_PERMISSIONS.FINANCIAL).toContain('financial:read');
    expect(DEFAULT_ROLE_PERMISSIONS.FINANCIAL).toContain('financial:update');
    expect(DEFAULT_ROLE_PERMISSIONS.FINANCIAL).toContain('financial:delete');
  });
});
