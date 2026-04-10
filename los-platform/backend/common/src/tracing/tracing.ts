import { NodeSDK } from '@opentelemetry/sdk-node';
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http';
import { Resource } from '@opentelemetry/resources';
import { SEMRESATTRS_SERVICE_NAME, SEMRESATTRS_SERVICE_VERSION, SEMRESATTRS_DEPLOYMENT_ENVIRONMENT } from '@opentelemetry/semantic-conventions';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { B3Propagator } from '@opentelemetry/propagator-b3';
import { trace, context, SpanKind, SpanStatusCode, propagation, Span } from '@opentelemetry/api';

let sdk: NodeSDK | null = null;

export function initTracing(serviceName: string, serviceVersion = '1.0.0'): NodeSDK {
  const collectorUrl = process.env.OTEL_EXPORTER_OTLP_ENDPOINT || 'http://localhost:4318/v1/traces';

  const resource = new Resource({
    [SEMRESATTRS_SERVICE_NAME]: serviceName,
    [SEMRESATTRS_SERVICE_VERSION]: serviceVersion,
    [SEMRESATTRS_DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV || 'development',
  });

  const traceExporter = new OTLPTraceExporter({
    url: collectorUrl,
    headers: {
      'x-honeycomb-team': process.env.HONEYCOMB_API_KEY || '',
    },
  });

  sdk = new NodeSDK({
    resource,
    spanProcessor: new BatchSpanProcessor(traceExporter, {
      maxQueueSize: 2048,
      maxExportBatchSize: 512,
      scheduledDelayMillis: 5000,
      exportTimeoutMillis: 30000,
    }),
    textMapPropagator: new B3Propagator(),
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false },
        '@opentelemetry/instrumentation-http': {
          enabled: true,
          ignoreIncomingRequestHook: (req) => {
            const url = (req as any).url;
            return url === '/metrics' || url === '/health' || url === '/health/liveness';
          },
        },
        '@opentelemetry/instrumentation-express': { enabled: true },
        '@opentelemetry/instrumentation-pg': { enabled: true },
        '@opentelemetry/instrumentation-redis-4': { enabled: true },
        '@opentelemetry/instrumentation-kafkajs': { enabled: true },
      }),
    ],
  });

  sdk.start();
  return sdk;
}

export async function shutdownTracing(): Promise<void> {
  if (sdk) {
    await sdk.shutdown();
    sdk = null;
  }
}

export function getTracer(name = 'los-platform'): ReturnType<typeof trace.getTracer> {
  return trace.getTracer(name);
}

export function getCurrentSpan(): Span | undefined {
  return trace.getActiveSpan();
}

export function getTraceId(): string | undefined {
  const span = getCurrentSpan();
  return span?.spanContext().traceId;
}

export function getSpanId(): string | undefined {
  const span = getCurrentSpan();
  return span?.spanContext().spanId;
}

export function injectTraceContext(): Record<string, string> {
  const carrier: Record<string, string> = {};
  propagation.inject(context.active(), carrier);
  return carrier;
}

export function extractTraceContext(carrier: Record<string, string>) {
  return propagation.extract(context.active(), carrier);
}

export function createSpan(
  name: string,
  fn: (span: Span) => Promise<any>,
  options: {
    kind?: SpanKind;
    attributes?: Record<string, string | number | boolean>;
  } = {},
): Promise<any> {
  const tracer = getTracer();
  return tracer.startActiveSpan(name, { kind: options.kind || SpanKind.INTERNAL }, async (span) => {
    try {
      if (options.attributes) {
        for (const [key, value] of Object.entries(options.attributes)) {
          span.setAttribute(key, value);
        }
      }
      const result = await fn(span);
      span.setStatus({ code: SpanStatusCode.OK });
      return result;
    } catch (error) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message });
      span.recordException(error);
      throw error;
    } finally {
      span.end();
    }
  });
}

export enum SpanKind {
  CLIENT = 'CLIENT',
  SERVER = 'SERVER',
  PRODUCER = 'PRODUCER',
  CONSUMER = 'CONSUMER',
}
