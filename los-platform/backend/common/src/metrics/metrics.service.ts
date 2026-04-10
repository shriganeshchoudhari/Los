import { Injectable, OnModuleInit } from '@nestjs/common';
import {
  Registry,
  Counter,
  Histogram,
  Gauge,
  collectDefaultMetrics,
  register,
} from 'prom-client';

@Injectable()
export class MetricsService implements OnModuleInit {
  private readonly registry: Registry;

  constructor() {
    this.registry = register;
  }

  onModuleInit() {
    collectDefaultMetrics({ register: this.registry });
  }

  getRegistry(): Registry {
    return this.registry;
  }

  async getMetrics(): Promise<string> {
    return this.registry.metrics();
  }

  getContentType(): string {
    return this.registry.contentType;
  }

  counter(opts: { name: string; help: string; labelNames?: string[] }): Counter<string> {
    return new Counter({
      name: opts.name,
      help: opts.help,
      labelNames: opts.labelNames || [],
      registers: [this.registry],
    });
  }

  histogram(opts: { name: string; help: string; labelNames?: string[]; buckets?: number[] }): Histogram<string> {
    return new Histogram({
      name: opts.name,
      help: opts.help,
      labelNames: opts.labelNames || [],
      buckets: opts.buckets || [0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1, 2.5, 5, 10],
      registers: [this.registry],
    });
  }

  gauge(opts: { name: string; help: string; labelNames?: string[] }): Gauge<string> {
    return new Gauge({
      name: opts.name,
      help: opts.help,
      labelNames: opts.labelNames || [],
      registers: [this.registry],
    });
  }
}

export const HTTP_REQUEST_DURATION = 'los_http_request_duration_seconds';
export const HTTP_REQUEST_TOTAL = 'los_http_requests_total';
export const ACTIVE_HTTP_REQUESTS = 'los_active_http_requests';

export const APPLICATION_COUNTER = 'los_application_total';
export const APPLICATION_STATUS_GAUGE = 'los_application_by_status';
export const APPLICATION_PROCESSING_DURATION = 'los_application_processing_duration_seconds';

export const KYC_VERIFICATION_TOTAL = 'los_kyc_verifications_total';
export const KYC_VERIFICATION_DURATION = 'los_kyc_verification_duration_seconds';

export const DECISION_TOTAL = 'los_decisions_total';
export const DECISION_DURATION = 'los_decision_duration_seconds';
export const DECISION_SCORE_GAUGE = 'los_decision_score';

export const PDD_CHECKLIST_GAUGE = 'los_pdd_checklists';
export const PDD_OVERDUE_GAUGE = 'los_pdd_overdue';
export const PDD_BREACH_COUNTER = 'los_pdd_breaches_total';

export const ESIGN_TOTAL = 'los_esign_transactions_total';
export const ESIGN_DURATION = 'los_esign_duration_seconds';

export const DOCUMENT_UPLOAD_TOTAL = 'los_document_uploads_total';
export const DOCUMENT_UPLOAD_SIZE = 'los_document_upload_size_bytes';

export const NOTIFICATION_TOTAL = 'los_notifications_total';
export const NOTIFICATION_DURATION = 'los_notification_duration_seconds';

export const KAFKA_MESSAGES_PRODUCED = 'los_kafka_messages_produced_total';
export const KAFKA_MESSAGES_CONSUMED = 'los_kafka_messages_consumed_total';
export const KAFKA_PRODUCE_ERRORS = 'los_kafka_produce_errors_total';

export const DB_QUERY_DURATION = 'los_db_query_duration_seconds';
export const DB_CONNECTION_POOL_SIZE = 'los_db_connection_pool_size';

export const REDIS_OPERATION_DURATION = 'los_redis_operation_duration_seconds';
export const REDIS_OPERATION_TOTAL = 'los_redis_operations_total';

export const CIRCUIT_BREAKER_STATE = 'los_circuit_breaker_state';
