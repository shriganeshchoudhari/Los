import { Injectable, NestMiddleware, Logger } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { Redis } from 'ioredis';

export interface IdempotencyOptions {
  redisClient: Redis;
  ttlSeconds?: number;
  headerName?: string;
}

@Injectable()
export class IdempotencyMiddleware implements NestMiddleware {
  private readonly logger = new Logger(IdempotencyMiddleware.name);
  private readonly redis: Redis;
  private readonly ttlSeconds: number;
  private readonly headerName: string;

  constructor(options: IdempotencyOptions) {
    this.redis = options.redisClient;
    this.ttlSeconds = options.ttlSeconds ?? 86400;
    this.headerName = options.headerName ?? 'X-Idempotency-Key';
  }

  async use(req: Request, res: Response, next: NextFunction): Promise<void> {
    if (req.method === 'GET' || req.method === 'DELETE' || req.method === 'HEAD') {
      return next();
    }

    const idempotencyKey = (req.headers[this.headerName.toLowerCase()] as string) || req.headers['x-idempotency-key'] as string;

    if (!idempotencyKey) {
      return next();
    }

    if (!/^[a-zA-Z0-9_-]{8,64}$/.test(idempotencyKey)) {
      res.status(400).json({ code: 'IDEMP_001', message: 'Invalid idempotency key format' });
      return;
    }

    const cacheKey = `idempotency:${idempotencyKey}`;

    const existing = await this.redis.get(cacheKey);

    if (existing) {
      const cached = JSON.parse(existing);

      if (cached.responseStatus && cached.responseBody) {
        res.set('X-Idempotency-Replay', 'true');
        res.set('X-Idempotency-Key', idempotencyKey);

        for (const [header, value] of Object.entries(cached.responseHeaders || {})) {
          if (header !== 'content-length' && header !== 'transfer-encoding') {
            res.setHeader(header, value as string);
          }
        }

        res.status(cached.responseStatus).json(cached.responseBody);
        this.logger.debug(`Idempotency replay: ${idempotencyKey}`);
        return;
      }
    }

    const startTime = Date.now();

    const originalJson = res.json.bind(res);
    const responseHeaders: Record<string, string> = {};

    res.json = ((body: any) => {
      const elapsed = Date.now() - startTime;

      if (elapsed > 1000) {
        this.logger.warn(`Slow response (${elapsed}ms) for idempotency key: ${idempotencyKey}`);
      }

      const headersToCache: Record<string, string> = {};
      res.getHeaderNames().forEach((name) => {
        const value = res.getHeader(name);
        if (value) {
          const key = name.toLowerCase();
          headersToCache[key] = String(value);
        }
      });

      const cacheData = {
        responseStatus: res.statusCode,
        responseBody: body,
        responseHeaders: headersToCache,
        timestamp: new Date().toISOString(),
      };

      this.redis.setex(cacheKey, this.ttlSeconds, JSON.stringify(cacheData)).catch((err) => {
        this.logger.error(`Failed to cache idempotency response: ${err.message}`);
      });

      return originalJson(body);
    });

    next();
  }
}
