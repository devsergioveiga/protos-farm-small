import { logAudit } from './audit.service';

const mockCreate = jest.fn();

jest.mock('../../database/rls', () => ({
  withRlsBypass: (fn: (tx: unknown) => Promise<unknown>) => {
    const txClient = {
      auditLog: {
        create: (...args: unknown[]) => mockCreate(...args),
      },
    };
    return fn(txClient);
  },
}));

const mockLoggerError = jest.fn();

jest.mock('../utils/logger', () => ({
  logger: {
    error: (...args: unknown[]) => mockLoggerError(...args),
  },
}));

const SAMPLE_ENTRY = {
  actorId: 'user-1',
  actorEmail: 'admin@test.com',
  actorRole: 'SUPER_ADMIN' as const,
  action: 'CREATE_ORGANIZATION',
  targetType: 'organization',
  targetId: 'org-1',
  metadata: { name: 'Test Org' },
  ipAddress: '127.0.0.1',
};

describe('logAudit', () => {
  beforeEach(() => {
    mockCreate.mockReset();
    mockLoggerError.mockReset();
  });

  it('should create an audit log entry', async () => {
    mockCreate.mockResolvedValue({ id: 'log-1', ...SAMPLE_ENTRY });

    await logAudit(SAMPLE_ENTRY);

    expect(mockCreate).toHaveBeenCalledWith({ data: SAMPLE_ENTRY });
  });

  it('should not throw when prisma create fails', async () => {
    mockCreate.mockRejectedValue(new Error('DB connection lost'));

    await expect(logAudit(SAMPLE_ENTRY)).resolves.toBeUndefined();

    expect(mockLoggerError).toHaveBeenCalledWith(
      expect.objectContaining({ err: expect.any(Error), entry: SAMPLE_ENTRY }),
      'Failed to write audit log',
    );
  });

  it('should work without optional fields', async () => {
    const minimalEntry = {
      actorId: 'user-1',
      actorEmail: 'admin@test.com',
      actorRole: 'SUPER_ADMIN' as const,
      action: 'CREATE_ORGANIZATION',
    };

    mockCreate.mockResolvedValue({ id: 'log-2', ...minimalEntry });

    await logAudit(minimalEntry);

    expect(mockCreate).toHaveBeenCalledWith({ data: minimalEntry });
  });
});
