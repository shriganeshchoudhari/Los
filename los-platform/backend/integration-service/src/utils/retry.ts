export interface RetryOptions {
  maxAttempts: number;
  initialDelayMs: number;
  maxDelayMs: number;
  backoffMultiplier: number;
  timeoutMs: number;
  retryableErrors?: string[];
  nonRetryableErrors?: string[];
}

export const DEFAULT_RETRY_OPTIONS: Required<RetryOptions> = {
  maxAttempts: 3,
  initialDelayMs: 1000,
  maxDelayMs: 30_000,
  backoffMultiplier: 2,
  timeoutMs: 30_000,
  retryableErrors: [
    'ETIMEDOUT',
    'ECONNRESET',
    'ECONNREFUSED',
    'ENOTFOUND',
    'EAI_AGAIN',
    'SOCKET_HANGUP',
    'CircuitOpenError',
  ],
  nonRetryableErrors: [
    'VALIDATION_ERROR',
    'AUTH_ERROR',
    'CIRCUIT_OPEN',
  ],
};

export async function withRetry<T>(
  fn: () => Promise<T>,
  options: Partial<RetryOptions> = {},
): Promise<T> {
  const opts = { ...DEFAULT_RETRY_OPTIONS, ...options };
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= opts.maxAttempts; attempt++) {
    try {
      return await withTimeout(fn, opts.timeoutMs);
    } catch (error) {
      lastError = error as Error;

      if (attempt === opts.maxAttempts) break;
      if (!isRetryable(error as Error, opts)) break;

      const delay = calculateBackoff(attempt, opts);
      await sleep(delay);
    }
  }

  throw lastError;
}

async function withTimeout<T>(fn: () => Promise<T>, timeoutMs: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      reject(new Error(`Operation timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    fn()
      .then((result) => {
        clearTimeout(timer);
        resolve(result);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

function calculateBackoff(attempt: number, opts: Required<RetryOptions>): number {
  const delay = opts.initialDelayMs * Math.pow(opts.backoffMultiplier, attempt - 1);
  return Math.min(delay, opts.maxDelayMs);
}

function isRetryable(error: Error, opts: Required<RetryOptions>): boolean {
  if (opts.nonRetryableErrors.some((code) => error.message?.includes(code))) {
    return false;
  }
  return opts.retryableErrors.some(
    (code) => error.message?.includes(code) || error.name === code,
  );
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
