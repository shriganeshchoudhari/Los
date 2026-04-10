import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { v4 as uuidv4 } from 'uuid';
import * as crypto from 'crypto';
import { AuditLog, AuditEventCategory, AuditEventType } from './audit-log.entity';

export interface AuditContext {
  actorId?: string | null;
  actorRole?: string | null;
  actorIp?: string | null;
  userAgent?: string | null;
  requestId?: string;
  correlationId?: string | null;
}

export interface AuditLogInput {
  eventCategory: AuditEventCategory;
  eventType: AuditEventType;
  entityType: string;
  entityId: string;
  beforeState?: string | null;
  afterState?: string | null;
  context?: AuditContext;
  metadata?: Record<string, any>;
  serviceOrigin?: string;
}

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);
  private readonly serviceName: string;
  private lastChainHash: string | null = null;

  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
    private readonly configService: ConfigService,
  ) {
    this.serviceName = configService.get<string>('SERVICE_NAME', 'unknown');
  }

  async log(input: AuditLogInput): Promise<string> {
    const {
      eventCategory,
      eventType,
      entityType,
      entityId,
      beforeState,
      afterState,
      context = {},
      metadata = {},
      serviceOrigin,
    } = input;

    const requestId = context.requestId || uuidv4();
    const correlationId = context.correlationId || null;
    const chainHash = this.computeChainHash(
      entityId,
      eventType,
      afterState || beforeState || '',
    );

    const log = this.auditLogRepo.create({
      id: uuidv4(),
      eventCategory,
      eventType,
      actorId: context.actorId || null,
      actorRole: context.actorRole || null,
      actorIp: context.actorIp || null,
      userAgent: context.userAgent || null,
      entityType,
      entityId,
      beforeState: beforeState || null,
      afterState: afterState || null,
      metadata,
      requestId,
      correlationId,
      serviceOrigin: serviceOrigin || this.serviceName,
      timestamp: new Date(),
      chainHash,
    });

    this.lastChainHash = chainHash;

    try {
      await this.auditLogRepo.save(log);
      this.logger.debug(
        `Audit: ${eventCategory}/${eventType} on ${entityType}:${entityId} by ${context.actorId || 'system'}`,
      );
    } catch (err) {
      this.logger.error(
        `Failed to write audit log: ${err.message}`,
        { entityId, eventType, entityType },
      );
      throw err;
    }

    return log.id!;
  }

  async logAsync(input: AuditLogInput): Promise<void> {
    setImmediate(() => this.log(input).catch((err) => {
      this.logger.error(`Async audit log failed: ${err.message}`);
    }));
  }

  async logStatusChange(
    entityType: string,
    entityId: string,
    beforeStatus: string,
    afterStatus: string,
    context: AuditContext,
    metadata?: Record<string, any>,
  ): Promise<string> {
    return this.log({
      eventCategory: AuditEventCategory.APPLICATION,
      eventType: AuditEventType.STATUS_CHANGE,
      entityType,
      entityId,
      beforeState: JSON.stringify({ status: beforeStatus }),
      afterState: JSON.stringify({ status: afterStatus }),
      context,
      metadata: { reason: metadata?.reason, triggeredBy: 'system' },
    });
  }

  async logStateChange(
    entityType: string,
    entityId: string,
    before: Record<string, any>,
    after: Record<string, any>,
    eventType: AuditEventType,
    context: AuditContext,
    category?: AuditEventCategory,
  ): Promise<string> {
    return this.log({
      eventCategory: category || AuditEventCategory.APPLICATION,
      eventType,
      entityType,
      entityId,
      beforeState: JSON.stringify(before),
      afterState: JSON.stringify(after),
      context,
    });
  }

  async queryLogs(filter: {
    entityType?: string;
    entityId?: string;
    actorId?: string;
    eventType?: string;
    eventCategory?: string;
    fromDate?: Date;
    toDate?: Date;
    page?: number;
    size?: number;
  }): Promise<{ items: AuditLog[]; total: number }> {
    const where: any = {};
    if (filter.entityType) where.entityType = filter.entityType;
    if (filter.entityId) where.entityId = filter.entityId;
    if (filter.actorId) where.actorId = filter.actorId;
    if (filter.eventType) where.eventType = filter.eventType;
    if (filter.eventCategory) where.eventCategory = filter.eventCategory;

    const page = filter.page ?? 0;
    const size = filter.size ?? 50;

    const qb = this.auditLogRepo.createQueryBuilder('audit')
      .where(where);

    if (filter.fromDate) {
      qb.andWhere('audit.timestamp >= :fromDate', { fromDate: filter.fromDate });
    }
    if (filter.toDate) {
      qb.andWhere('audit.timestamp <= :toDate', { toDate: filter.toDate });
    }

    qb.orderBy('audit.timestamp', 'DESC')
      .skip(page * size)
      .take(size);

    const [items, total] = await qb.getManyAndCount();
    return { items, total };
  }

  async getEntityHistory(entityType: string, entityId: string): Promise<AuditLog[]> {
    return this.auditLogRepo.find({
      where: { entityType, entityId },
      order: { timestamp: 'DESC' },
    });
  }

  async verifyChainIntegrity(
    entityType: string,
    entityId: string,
  ): Promise<{ isValid: boolean; brokenAt?: string; logs: AuditLog[] }> {
    const logs = await this.auditLogRepo.find({
      where: { entityType, entityId },
      order: { timestamp: 'ASC' },
    });

    let previousHash: string | null = null;
    for (const log of logs) {
      const expectedHash = this.computeChainHash(
        log.entityId,
        log.eventType,
        log.afterState || log.beforeState || '',
        previousHash,
      );
      if (log.chainHash !== expectedHash) {
        return { isValid: false, brokenAt: log.id, logs };
      }
      previousHash = log.chainHash;
    }
    return { isValid: true, logs };
  }

  private computeChainHash(
    entityId: string,
    eventType: string,
    state: string,
    previousHash?: string | null,
  ): string {
    const payload = `${entityId}|${eventType}|${state}|${previousHash || 'GENESIS'}|${this.serviceName}`;
    return crypto.createHash('sha256').update(payload).digest('hex');
  }
}
