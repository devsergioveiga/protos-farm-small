import { Router } from 'express';
import { getHealthStatus, checkPostgres, checkRedis } from './health.service';

export const healthRouter = Router();

healthRouter.get('/health', async (_req, res) => {
  const health = await getHealthStatus();
  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
});

healthRouter.get('/health/live', (_req, res) => {
  res.json({ status: 'healthy' });
});

healthRouter.get('/health/ready', async (_req, res) => {
  const [postgres, redis] = await Promise.all([checkPostgres(), checkRedis()]);
  const allHealthy = postgres.status === 'healthy' && redis.status === 'healthy';
  const statusCode = allHealthy ? 200 : 503;

  res.status(statusCode).json({
    status: allHealthy ? 'healthy' : 'unhealthy',
    checks: { postgres, redis },
  });
});
