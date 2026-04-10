import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { Kafka, Producer, logLevel } from 'kafkajs';
import { v4 as uuidv4 } from 'uuid';
import { injectTraceContext, getTraceId, getSpanId } from '../tracing';

@Injectable()
export class KafkaService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(KafkaService.name);
  private kafka: Kafka;
  private producer: Producer;
  private isConnected = false;

  constructor() {
    const brokers = (process.env.KAFKA_BROKERS || 'localhost:9092').split(',');
    this.kafka = new Kafka({
      clientId: process.env.KAFKA_CLIENT_ID || 'los-common',
      brokers,
      logLevel: logLevel.ERROR,
      retry: {
        initialRetryTime: 100,
        retries: 3,
      },
    });
    this.producer = this.kafka.producer();
  }

  async onModuleInit() {
    try {
      await this.producer.connect();
      this.isConnected = true;
      this.logger.log('Kafka producer connected');
    } catch (error) {
      this.logger.warn(`Kafka producer connection failed: ${error.message}. Events will be published on demand.`);
    }
  }

  async onModuleDestroy() {
    if (this.isConnected) {
      await this.producer.disconnect();
      this.logger.log('Kafka producer disconnected');
    }
  }

  async emit(topic: string, payload: Record<string, any>): Promise<void> {
    const traceId = getTraceId();
    const spanId = getSpanId();

    const message = {
      messageId: uuidv4(),
      payload,
      timestamp: new Date().toISOString(),
      version: '1.0',
    };

    if (!this.isConnected) {
      this.logger.warn(`Kafka not connected. Skipping event: ${topic}`);
      return;
    }

    const traceHeaders = injectTraceContext({});
    const headers: Record<string, string> = {};
    for (const [key, value] of Object.entries(traceHeaders)) {
      if (value !== undefined) {
        headers[key] = value as string;
      }
    }
    if (traceId) headers['X-Trace-Id'] = traceId;
    if (spanId) headers['X-Span-Id'] = spanId;

    try {
      await this.producer.send({
        topic,
        messages: [
          {
            key: payload.applicationId || payload.loanId || uuidv4(),
            value: JSON.stringify(message),
            headers,
          },
        ],
      });
      this.logger.debug(`Event published to ${topic} [traceId=${traceId || 'n/a'}]`);
    } catch (error) {
      this.logger.error(`Failed to publish event to ${topic}: ${error.message}`);
      throw error;
    }
  }
}
