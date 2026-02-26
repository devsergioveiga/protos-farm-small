import net from 'node:net';
import { loadEnv } from '../../config/env';

export interface CheckResult {
  status: 'healthy' | 'unhealthy';
  responseTime: number;
  error?: string;
}

export interface HealthStatus {
  status: 'healthy' | 'unhealthy';
  version: string;
  uptime: number;
  timestamp: string;
  checks: {
    postgres: CheckResult;
    redis: CheckResult;
  };
}

function checkTcp(host: string, port: number, timeout = 3000): Promise<CheckResult> {
  return new Promise((resolve) => {
    const start = Date.now();
    const socket = net.createConnection({ host, port });

    const timer = setTimeout(() => {
      socket.destroy();
      resolve({
        status: 'unhealthy',
        responseTime: Date.now() - start,
        error: `Connection timeout after ${timeout}ms`,
      });
    }, timeout);

    socket.on('connect', () => {
      clearTimeout(timer);
      socket.destroy();
      resolve({
        status: 'healthy',
        responseTime: Date.now() - start,
      });
    });

    socket.on('error', (err) => {
      clearTimeout(timer);
      socket.destroy();
      resolve({
        status: 'unhealthy',
        responseTime: Date.now() - start,
        error: err.message,
      });
    });
  });
}

export async function checkPostgres(): Promise<CheckResult> {
  const env = loadEnv();
  return checkTcp(env.POSTGRES_HOST, env.POSTGRES_PORT);
}

export async function checkRedis(): Promise<CheckResult> {
  const env = loadEnv();
  return checkTcp(env.REDIS_HOST, env.REDIS_PORT);
}

export async function getHealthStatus(): Promise<HealthStatus> {
  const [postgres, redis] = await Promise.all([checkPostgres(), checkRedis()]);

  const allHealthy = postgres.status === 'healthy' && redis.status === 'healthy';

  return {
    status: allHealthy ? 'healthy' : 'unhealthy',
    version: '0.1.0',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
    checks: { postgres, redis },
  };
}
