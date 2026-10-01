import { Request, Response, NextFunction } from 'express';

interface RateLimitStore {
  [key: string]: {
    count: number;
    resetAt: number;
  };
}

const store: RateLimitStore = {};

// Clean up stale entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const k in store) {
    if (store[k].resetAt < now) {
      delete store[k];
    }
  }
}, 5 * 60 * 1000);

export function rateLimiter(options: { maxRequests: number; windowMs: number; keyPrefix?: string }) {
  const { maxRequests, windowMs, keyPrefix = 'rl' } = options;

  return (req: Request, res: Response, next: NextFunction) => {
    // In test environment, allow bypassing unless specifically testing rate limiter
    if (process.env.NODE_ENV === 'test' && !req.headers['x-test-rate-limit']) {
      return next();
    }

    const ip = req.ip || req.socket.remoteAddress || '127.0.0.1';
    const key = `${keyPrefix}:${ip}`;
    const now = Date.now();

    if (!store[key] || store[key].resetAt < now) {
      store[key] = {
        count: 1,
        resetAt: now + windowMs,
      };
      return next();
    }

    store[key].count += 1;

    if (store[key].count > maxRequests) {
      const retryAfterSec = Math.ceil((store[key].resetAt - now) / 1000);
      res.setHeader('Retry-After', retryAfterSec);
      return res.status(429).json({
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: `Too many requests. Please try again in ${retryAfterSec} seconds.`,
        },
      });
    }

    next();
  };
}
