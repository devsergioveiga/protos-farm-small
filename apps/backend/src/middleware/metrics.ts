import { Request, Response, NextFunction } from 'express';
import client from 'prom-client';

const register = client.register;

client.collectDefaultMetrics({ register });

const httpRequestDuration = new client.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'] as const,
  buckets: [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
  registers: [register],
});

export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (req.path === '/metrics') {
    next();
    return;
  }

  const end = httpRequestDuration.startTimer();

  res.on('finish', () => {
    const route = req.route?.path ? req.baseUrl + req.route.path : req.originalUrl;

    end({
      method: req.method,
      route,
      status_code: res.statusCode,
    });
  });

  next();
}

export async function metricsHandler(_req: Request, res: Response): Promise<void> {
  res.set('Content-Type', register.contentType);
  res.end(await register.metrics());
}
