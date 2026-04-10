import { context, propagation } from '@opentelemetry/api';

export function injectTraceIntoKafkaHeaders(
  headers: Record<string, string | Buffer | undefined>,
): Record<string, string | Buffer | undefined> {
  const carrier: Record<string, string> = {};
  propagation.inject(context.active(), carrier);

  const result = { ...headers };
  for (const [key, value] of Object.entries(carrier)) {
    result[key] = value;
  }

  result['X-Trace-Id'] = carrier['traceparent']?.split('-')[1] || '';
  return result;
}

export function extractTraceFromKafkaHeaders(
  headers: Record<string, string | Buffer | undefined>,
) {
  const carrier: Record<string, string> = {};
  for (const [key, value] of Object.entries(headers)) {
    if (typeof value === 'string') {
      carrier[key] = value;
    } else if (Buffer.isBuffer(value)) {
      carrier[key] = value.toString('utf-8');
    }
  }
  return propagation.extract(context.active(), carrier);
}

export function getKafkaMessageTraceInfo(
  headers: Record<string, string | Buffer | undefined>,
): { traceId?: string; spanId?: string } {
  const traceparent = headers['traceparent'];
  if (typeof traceparent === 'string') {
    const parts = traceparent.split('-');
    return {
      traceId: parts[1],
      spanId: parts[2],
    };
  }

  const traceId = headers['X-Trace-Id'];
  return {
    traceId: typeof traceId === 'string' ? traceId : undefined,
    spanId: undefined,
  };
}
