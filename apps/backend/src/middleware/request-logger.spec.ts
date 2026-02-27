import { Request, Response, NextFunction } from 'express';
import { EventEmitter } from 'events';

const mockLogger = {
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
};

jest.mock('../shared/utils/logger', () => ({
  logger: mockLogger,
}));

import { requestLoggerMiddleware } from './request-logger';

function createMockReqRes(path: string, method = 'GET') {
  const req = { path, originalUrl: path, method } as Request;
  const res = new EventEmitter() as Response & EventEmitter;
  res.statusCode = 200;
  const next: NextFunction = jest.fn();
  return { req, res, next };
}

beforeEach(() => {
  jest.clearAllMocks();
});

describe('Request logger middleware', () => {
  it('should log info for 2xx responses', () => {
    const { req, res, next } = createMockReqRes('/api/health');
    res.statusCode = 200;

    requestLoggerMiddleware(req, res, next);
    res.emit('finish');

    expect(next).toHaveBeenCalled();
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        url: '/api/health',
        status_code: 200,
        response_time_ms: expect.any(Number),
      }),
      'request completed',
    );
  });

  it('should log warn for 4xx responses', () => {
    const { req, res, next } = createMockReqRes('/api/nonexistent');
    res.statusCode = 404;

    requestLoggerMiddleware(req, res, next);
    res.emit('finish');

    expect(mockLogger.warn).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        url: '/api/nonexistent',
        status_code: 404,
      }),
      'request completed',
    );
  });

  it('should log error for 5xx responses', () => {
    const { req, res, next } = createMockReqRes('/api/fail');
    res.statusCode = 500;

    requestLoggerMiddleware(req, res, next);
    res.emit('finish');

    expect(mockLogger.error).toHaveBeenCalledWith(
      expect.objectContaining({
        method: 'GET',
        url: '/api/fail',
        status_code: 500,
      }),
      'request completed',
    );
  });

  it('should skip /metrics endpoint', () => {
    const { req, res, next } = createMockReqRes('/metrics');

    requestLoggerMiddleware(req, res, next);
    res.emit('finish');

    expect(next).toHaveBeenCalled();
    expect(mockLogger.info).not.toHaveBeenCalled();
  });

  it('should skip /api/health/live endpoint', () => {
    const { req, res, next } = createMockReqRes('/api/health/live');

    requestLoggerMiddleware(req, res, next);
    res.emit('finish');

    expect(next).toHaveBeenCalled();
    expect(mockLogger.info).not.toHaveBeenCalled();
  });
});
