import { Request, Response, NextFunction } from 'express';
import { createLogger } from './logger.js';

const log = createLogger('HTTP');

const SENSITIVE_PATHS = ['/api/auth/login', '/api/auth/logout'];

export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = Date.now();
  const { method, path, ip } = req;

  res.on('finish', () => {
    const duration = Date.now() - start;
    const status = res.statusCode;
    const level = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info';
    const body = SENSITIVE_PATHS.includes(path) ? '[redacted]' : req.body;

    const entry = `${method} ${path} → ${status} (${duration}ms) from ${ip}`;
    if (level === 'error') {
      log.error(entry);
    } else if (level === 'warn') {
      log.warn(entry);
    } else {
      log.debug(entry, Object.keys(body).length > 0 ? { body } : undefined);
    }
  });

  next();
}
