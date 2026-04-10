import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, Between, MoreThan } from 'typeorm';
import { AuditLog, AuditEventCategory } from '@los/common';
import { RolesGuard, Roles, SkipAuth } from '@los/common';

@ApiTags('Audit Logs')
@Controller('audit-logs')
export class AuditLogController {
  constructor(
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
  ) {}

  @Get()
  @SkipAuth()
  @ApiOperation({ summary: 'Query audit logs for compliance portal' })
  @ApiQuery({ name: 'category', required: false, enum: AuditEventCategory })
  @ApiQuery({ name: 'applicationId', required: false })
  @ApiQuery({ name: 'actorId', required: false })
  @ApiQuery({ name: 'dateRange', required: false, description: '24h, 7d, or 30d' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'size', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'Paginated audit logs' })
  async getAuditLogs(
    @Query('category') category?: AuditEventCategory,
    @Query('applicationId') applicationId?: string,
    @Query('actorId') actorId?: string,
    @Query('dateRange') dateRange?: string,
    @Query('page') page?: number,
    @Query('size') size?: number,
  ) {
    const since = this.parseDateRange(dateRange || '7d');
    const pageNum = Math.max(1, page || 1);
    const pageSize = Math.min(100, size || 50);
    const skip = (pageNum - 1) * pageSize;

    const where: Record<string, any> = {
      timestamp: MoreThan(since),
    };
    if (category) where.eventCategory = category;
    if (applicationId) where.applicationId = applicationId;
    if (actorId) where.actorId = actorId;

    const [logs, total] = await this.auditLogRepo.findAndCount({
      where,
      order: { timestamp: 'DESC' },
      skip,
      take: pageSize,
    });

    return {
      data: logs,
      pagination: {
        total,
        page: pageNum,
        size: pageSize,
        totalPages: Math.ceil(total / pageSize),
      },
    };
  }

  @Get('export')
  @SkipAuth()
  @ApiOperation({ summary: 'Export audit logs as CSV' })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'dateRange', required: false })
  async exportAuditLogs(
    @Query('category') category?: AuditEventCategory,
    @Query('dateRange') dateRange?: string,
  ) {
    const since = this.parseDateRange(dateRange || '30d');
    const where: Record<string, any> = { timestamp: MoreThan(since) };
    if (category) where.eventCategory = category;

    const logs = await this.auditLogRepo.find({
      where,
      order: { timestamp: 'DESC' },
      take: 10000,
    });

    const headers = [
      'ID', 'Timestamp', 'Event Category', 'Event Type', 'Actor ID', 'Actor Role',
      'Application ID', 'Entity Type', 'Entity ID', 'IP Address', 'Service Origin',
    ];
    const rows = logs.map(log => [
      log.id,
      log.timestamp?.toISOString(),
      log.eventCategory,
      log.eventType,
      log.actorId,
      log.actorRole,
      log.applicationId,
      log.entityType,
      log.entityId,
      log.actorIp,
      log.serviceOrigin,
    ]);

    return {
      csv: [headers, ...rows].map(row => row.join(',')).join('\n'),
      count: logs.length,
    };
  }

  private parseDateRange(range: string): Date {
    const now = new Date();
    switch (range) {
      case '24h': return new Date(now.getTime() - 24 * 60 * 60 * 1000);
      case '7d': return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      case '30d': return new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      default: return new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    }
  }
}
