import { Request, Response } from 'express';

const mockRedis = {
  incr: jest.fn(),
  expire: jest.fn(),
  exists: jest.fn(),
  ttl: jest.fn(),
  set: jest.fn(),
  del: jest.fn(),
};

jest.mock('../database/redis', () => ({
  redis: mockRedis,
}));

import { loginRateLimit, incrementLoginFailures, clearLoginFailures } from './rate-limit';

function createMockReq(overrides: Partial<Request> = {}): Request {
  return {
    ip: '127.0.0.1',
    socket: { remoteAddress: '127.0.0.1' },
    body: { email: 'user@test.com' },
    ...overrides,
  } as unknown as Request;
}

function createMockRes(): Response & { statusCode: number; body: unknown } {
  const res = {
    statusCode: 200,
    body: null as unknown,
    status(code: number) {
      res.statusCode = code;
      return res;
    },
    json(data: unknown) {
      res.body = data;
      return res;
    },
  };
  return res as unknown as Response & { statusCode: number; body: unknown };
}

describe('loginRateLimit middleware', () => {
  const middleware = loginRateLimit();

  beforeEach(() => {
    jest.resetAllMocks();
    mockRedis.exists.mockResolvedValue(0);
  });

  it('should allow request when under IP limit', async () => {
    mockRedis.incr.mockResolvedValue(1);
    const next = jest.fn();

    await middleware(createMockReq(), createMockRes(), next);

    expect(next).toHaveBeenCalled();
  });

  it('should block request when IP limit exceeded (>5/min)', async () => {
    mockRedis.incr.mockResolvedValue(6);
    const res = createMockRes();
    const next = jest.fn();

    await middleware(createMockReq(), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(429);
  });

  it('should block request when email is blocked', async () => {
    mockRedis.incr.mockResolvedValue(1);
    mockRedis.exists.mockResolvedValue(1);
    mockRedis.ttl.mockResolvedValue(600);
    const res = createMockRes();
    const next = jest.fn();

    await middleware(createMockReq(), res, next);

    expect(next).not.toHaveBeenCalled();
    expect(res.statusCode).toBe(429);
    expect((res.body as { error: string }).error).toContain('bloqueada');
  });

  it('should set TTL on first IP attempt', async () => {
    mockRedis.incr.mockResolvedValue(1);
    const next = jest.fn();

    await middleware(createMockReq(), createMockRes(), next);

    expect(mockRedis.expire).toHaveBeenCalledWith(expect.stringContaining('login_rate:ip:'), 60);
  });

  it('should allow request when redis fails (fail-open)', async () => {
    mockRedis.incr.mockRejectedValue(new Error('Redis down'));
    const next = jest.fn();

    await middleware(createMockReq(), createMockRes(), next);

    expect(next).toHaveBeenCalled();
  });
});

describe('incrementLoginFailures', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should increment failure counter', async () => {
    mockRedis.incr.mockResolvedValue(1);

    await incrementLoginFailures('user@test.com');

    expect(mockRedis.incr).toHaveBeenCalledWith('login_failures:user@test.com');
  });

  it('should set TTL on first failure', async () => {
    mockRedis.incr.mockResolvedValue(1);

    await incrementLoginFailures('user@test.com');

    expect(mockRedis.expire).toHaveBeenCalledWith('login_failures:user@test.com', 900);
  });

  it('should block email after 10 failures', async () => {
    mockRedis.incr.mockResolvedValue(10);

    await incrementLoginFailures('user@test.com');

    expect(mockRedis.set).toHaveBeenCalledWith('login_block:user@test.com', '1', 'EX', 900);
    expect(mockRedis.del).toHaveBeenCalledWith('login_failures:user@test.com');
  });

  it('should not block email before 10 failures', async () => {
    mockRedis.incr.mockResolvedValue(9);

    await incrementLoginFailures('user@test.com');

    expect(mockRedis.set).not.toHaveBeenCalled();
  });

  it('should normalize email to lowercase', async () => {
    mockRedis.incr.mockResolvedValue(1);

    await incrementLoginFailures('User@Test.COM');

    expect(mockRedis.incr).toHaveBeenCalledWith('login_failures:user@test.com');
  });
});

describe('clearLoginFailures', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should delete the failure counter', async () => {
    await clearLoginFailures('user@test.com');

    expect(mockRedis.del).toHaveBeenCalledWith('login_failures:user@test.com');
  });
});
