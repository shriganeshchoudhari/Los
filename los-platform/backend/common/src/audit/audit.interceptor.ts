import {
  Injectable,
  Logger,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, defer } from 'rxjs';
import { tap } from 'rxjs/operators';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
import { AuditService, AuditContext } from './audit.service';

export interface AuditOptions {
  entityType: string;
  entityIdPath?: string;
  category?: string;
  eventType?: string;
  actionExtractor?: (args: any[]) => string;
  idExtractor?: (args: any[], result: any) => string;
}

export function Audit(options: AuditOptions) {
  return function (
    target: any,
    propertyKey: string,
    descriptor: PropertyDescriptor,
  ) {
    const originalMethod = descriptor.value;
    descriptor.value = async function (...args: any[]) {
      const ctx = require('@nestjs/common').ExecutionContext;
      const executionCtx = ctx.createExecutionContext(args[0]);
      const auditService: AuditService = args[0]?.app?.get?.('AuditService')
        || require('@los/common').auditService;

      const before = JSON.stringify(args[1] || {});
      const result = await originalMethod.apply(this, args);
      const after = JSON.stringify(result || {});

      const request = args[0];
      const actorId = request?.user?.id || request?.user?.sub || null;
      const actorRole = request?.user?.role || null;
      const requestId = request?.headers?.['x-request-id'] || uuidv4();
      const correlationId = request?.headers?.['x-correlation-id'] || null;
      const actorIp = request?.ip || request?.connection?.remoteAddress || null;
      const userAgent = request?.headers?.['user-agent'] || null;

      const auditContext: AuditContext = {
        actorId,
        actorRole,
        actorIp,
        userAgent,
        requestId,
        correlationId,
      };

      const entityId = options.idExtractor
        ? options.idExtractor(args, result)
        : result?.id || args[0]?.params?.applicationId || uuidv4();

      const eventType = options.actionExtractor
        ? options.actionExtractor(args)
        : (options.eventType || 'UPDATE');

      const serviceName = process.env.SERVICE_NAME || 'unknown';

      try {
        await auditService.log({
          eventCategory: options.category as any || 'APPLICATION',
          eventType: eventType as any,
          entityType: options.entityType,
          entityId,
          beforeState: before,
          afterState: after,
          context: auditContext,
          metadata: { method: propertyKey, args: sanitizeArgs(args) },
          serviceOrigin: serviceName,
        });
      } catch (err) {
        // Audit failures must not break the main flow
        console.error('Audit log failed:', err.message);
      }

      return result;
    };
    return descriptor;
  };
}

function sanitizeArgs(args: any[]): Record<string, any> {
  if (!args || args.length === 0) return {};
  const first = args[1] || args[0];
  if (typeof first !== 'object') return {};
  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(first)) {
    if (['password', 'token', 'secret', 'otp', 'pin'].includes(key.toLowerCase())) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object') {
      sanitized[key] = '[OBJECT]';
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

@Injectable()
export class AuditInterceptor implements NestInterceptor {
  private readonly logger = new Logger(AuditInterceptor.name);

  constructor(private readonly auditService: AuditService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();

    const requestId = request?.headers?.['x-request-id'] || uuidv4();
    const correlationId = request?.headers?.['x-correlation-id'] || uuidv4();

    const auditContext: AuditContext = {
      actorId: request?.user?.id || request?.user?.sub || null,
      actorRole: request?.user?.role || null,
      actorIp: request?.ip || request?.connection?.remoteAddress || null,
      userAgent: request?.headers?.['user-agent'] || null,
      requestId,
      correlationId,
    };

    response.setHeader('X-Request-Id', requestId);
    response.setHeader('X-Correlation-Id', correlationId);

    return defer(() => next.handle()).pipe(
      tap(async (result: any) => {
        try {
          const auditMeta = request?.auditMeta;
          if (!auditMeta) return;

          const entityId = result?.id || auditMeta.entityId || uuidv4();
          await this.auditService.log({
            eventCategory: auditMeta.category || 'APPLICATION',
            eventType: auditMeta.eventType || 'UPDATE',
            entityType: auditMeta.entityType || 'Unknown',
            entityId,
            beforeState: auditMeta.beforeState || null,
            afterState: JSON.stringify(result),
            context: auditContext,
            metadata: auditMeta.metadata || {},
            serviceOrigin: process.env.SERVICE_NAME || 'unknown',
          });
        } catch (err) {
          this.logger.error(`Audit intercept failed: ${err.message}`);
        }
      }),
    );
  }
}
