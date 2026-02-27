import { Request, Response, NextFunction } from 'express';
import { logger } from '../shared/utils/logger';

const EXCLUDED_PATHS = ['/metrics', '/api/health/live'];

export function requestLoggerMiddleware(req: Request, res: Response, next: NextFunction): void {
  if (EXCLUDED_PATHS.includes(req.path)) {
    next();
    return;
  }

  const start = Date.now();

  res.on('finish', () => {
    const responseTime = Date.now() - start;
    const statusCode = res.statusCode;

    const logData = {
      method: req.method,
      url: req.originalUrl,
      status_code: statusCode,
      response_time_ms: responseTime,
    };

    if (statusCode >= 500) {
      logger.error(logData, 'request completed');
    } else if (statusCode >= 400) {
      logger.warn(logData, 'request completed');
    } else {
      logger.info(logData, 'request completed');
    }
  });

  next();
}
