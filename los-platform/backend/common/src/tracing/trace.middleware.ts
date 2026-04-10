import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { getTraceId, getSpanId } from './tracing';

@Injectable()
export class TracingMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const traceId = getTraceId();
    const spanId = getSpanId();

    if (traceId) {
      res.setHeader('X-Trace-Id', traceId);
    }
    if (spanId) {
      res.setHeader('X-Span-Id', spanId);
    }

    next();
  }
}
