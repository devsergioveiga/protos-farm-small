import request from 'supertest';
import { app } from '../../app';
import * as healthService from './health.service';

jest.mock('./health.service');

const mockedService = jest.mocked(healthService);

const healthyCheck: healthService.CheckResult = {
  status: 'healthy',
  responseTime: 5,
  postgisVersion: '3.4.0',
};
const unhealthyCheck: healthService.CheckResult = {
  status: 'unhealthy',
  responseTime: 3000,
  error: 'Connection timeout after 3000ms',
};

describe('Health endpoints', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('GET /api/health', () => {
    it('should return 200 when all checks are healthy', async () => {
      mockedService.getHealthStatus.mockResolvedValue({
        status: 'healthy',
        version: '0.1.0',
        uptime: 100,
        timestamp: '2026-02-26T00:00:00.000Z',
        checks: { postgres: healthyCheck, redis: healthyCheck },
      });

      const response = await request(app).get('/api/health');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('healthy');
      expect(response.body.version).toBe('0.1.0');
      expect(response.body).toHaveProperty('uptime');
      expect(response.body).toHaveProperty('timestamp');
      expect(response.body.checks.postgres.status).toBe('healthy');
      expect(response.body.checks.redis.status).toBe('healthy');
    });

    it('should return 503 when a check is unhealthy', async () => {
      mockedService.getHealthStatus.mockResolvedValue({
        status: 'unhealthy',
        version: '0.1.0',
        uptime: 100,
        timestamp: '2026-02-26T00:00:00.000Z',
        checks: { postgres: unhealthyCheck, redis: healthyCheck },
      });

      const response = await request(app).get('/api/health');

      expect(response.status).toBe(503);
      expect(response.body.status).toBe('unhealthy');
      expect(response.body.checks.postgres.status).toBe('unhealthy');
      expect(response.body.checks.postgres.error).toBeDefined();
    });
  });

  describe('GET /api/health/live', () => {
    it('should always return 200 with healthy status', async () => {
      const response = await request(app).get('/api/health/live');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('healthy');
    });
  });

  describe('GET /api/health/ready', () => {
    it('should return 200 when all dependencies are reachable', async () => {
      mockedService.checkPostgres.mockResolvedValue(healthyCheck);
      mockedService.checkRedis.mockResolvedValue(healthyCheck);

      const response = await request(app).get('/api/health/ready');

      expect(response.status).toBe(200);
      expect(response.body.status).toBe('healthy');
      expect(response.body.checks.postgres.status).toBe('healthy');
      expect(response.body.checks.redis.status).toBe('healthy');
    });

    it('should return 503 when a dependency is unreachable', async () => {
      mockedService.checkPostgres.mockResolvedValue(healthyCheck);
      mockedService.checkRedis.mockResolvedValue(unhealthyCheck);

      const response = await request(app).get('/api/health/ready');

      expect(response.status).toBe(503);
      expect(response.body.status).toBe('unhealthy');
      expect(response.body.checks.redis.status).toBe('unhealthy');
    });
  });
});
