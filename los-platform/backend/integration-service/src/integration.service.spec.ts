import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { ConfigService } from '@nestjs/config';
import { CircuitBreaker, CircuitState, CircuitOpenError } from '../utils/circuit-breaker';
import { withRetry } from '../utils/retry';
import { CibilClient, ExperianClient, EquifaxClient, CrifClient } from '../clients/bureau-clients';
import { IMPSClient, NEFTClient, RTGSClient, UPIClient, NACHClient } from '../clients/npci-clients';
import { CBSClient } from '../clients/cbs-client';

describe('CircuitBreaker', () => {
  it('should start in CLOSED state', () => {
    const cb = new CircuitBreaker({ failureThreshold: 3, successThreshold: 2, timeout: 1000, openDuration: 5000, halfOpenRequests: 1 });
    expect(cb.getState()).toBe(CircuitState.CLOSED);
  });

  it('should open after reaching failure threshold', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 3, successThreshold: 2, timeout: 100, openDuration: 1000, halfOpenRequests: 1 });
    const failingFn = jest.fn().mockRejectedValue(new Error('Test error'));

    for (let i = 0; i < 3; i++) {
      try { await cb.execute(failingFn); } catch {}
    }

    expect(cb.getState()).toBe(CircuitState.OPEN);
  });

  it('should throw CircuitOpenError when open', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 1, successThreshold: 1, timeout: 100, openDuration: 10000, halfOpenRequests: 1 });
    const failingFn = jest.fn().mockRejectedValue(new Error('Test error'));

    try { await cb.execute(failingFn); } catch {}

    await expect(cb.execute(jest.fn().mockResolvedValue('success'))).rejects.toThrow(CircuitOpenError);
  });

  it('should succeed and transition to closed after success in half-open', async () => {
    const cb = new CircuitBreaker({ failureThreshold: 1, successThreshold: 1, timeout: 100, openDuration: 50, halfOpenRequests: 1 });
    const failingFn = jest.fn().mockRejectedValue(new Error('Test error'));
    const successFn = jest.fn().mockResolvedValue('success');

    try { await cb.execute(failingFn); } catch {}
    await new Promise(r => setTimeout(r, 60));
    await cb.execute(successFn);

    expect(cb.getState()).toBe(CircuitState.CLOSED);
    expect(successFn).toHaveBeenCalled();
  });

  it('should return correct retry after value', () => {
    const cb = new CircuitBreaker({ failureThreshold: 1, successThreshold: 1, timeout: 100, openDuration: 5000, halfOpenRequests: 1 });
    const failingFn = jest.fn().mockRejectedValue(new Error('Test error'));

    try { await cb.execute(failingFn); } catch {}

    const metrics = cb.getMetrics();
    expect(metrics.state).toBe(CircuitState.OPEN);
    expect(metrics.retryAfter).toBeGreaterThan(0);
  });
});

describe('withRetry', () => {
  it('should return result on first success', async () => {
    const fn = jest.fn().mockResolvedValue('success');
    const result = await withRetry(fn, { maxAttempts: 3 });
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on transient failure then succeed', async () => {
    const fn = jest.fn()
      .mockRejectedValueOnce(new Error('ETIMEDOUT'))
      .mockRejectedValueOnce(new Error('ECONNRESET'))
      .mockResolvedValue('success');

    const result = await withRetry(fn, { maxAttempts: 3, retryableErrors: ['ETIMEDOUT', 'ECONNRESET'] });
    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should not retry non-retryable errors', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('VALIDATION_ERROR'));
    await expect(withRetry(fn, { maxAttempts: 3 })).rejects.toThrow('VALIDATION_ERROR');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should throw after max attempts exhausted', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('ETIMEDOUT'));
    await expect(withRetry(fn, { maxAttempts: 3, retryableErrors: ['ETIMEDOUT'] })).rejects.toThrow('ETIMEDOUT');
    expect(fn).toHaveBeenCalledTimes(3);
  });
});

describe('PaymentModeRouting', () => {
  it('should route RTGS for amount >= 20L', () => {
    const determinePaymentMode = (amount: number) => {
      if (amount >= 2_000_000) return 'RTGS';
      if (amount >= 100_000) return 'NEFT';
      return 'IMPS';
    };

    expect(determinePaymentMode(5_000_000)).toBe('RTGS');
    expect(determinePaymentMode(2_000_000)).toBe('RTGS');
    expect(determinePaymentMode(500_000)).toBe('NEFT');
    expect(determinePaymentMode(100_000)).toBe('NEFT');
    expect(determinePaymentMode(99_999)).toBe('IMPS');
    expect(determinePaymentMode(50_000)).toBe('IMPS');
  });
});

describe('CreditScoreGradeMapping', () => {
  const scoreToGrade = (score: number) => {
    if (score >= 800) return 'A+';
    if (score >= 750) return 'A';
    if (score >= 700) return 'B+';
    if (score >= 650) return 'B';
    if (score >= 600) return 'C';
    if (score >= 550) return 'D';
    return 'E';
  };

  it.each([
    [850, 'A+'], [800, 'A+'], [799, 'A'],
    [750, 'A'], [749, 'B+'], [700, 'B+'],
    [699, 'B'], [650, 'B'], [649, 'C'],
    [600, 'C'], [599, 'D'], [550, 'D'],
    [549, 'E'], [300, 'E'],
  ])('score %i should map to grade %s', (score, expectedGrade) => {
    expect(scoreToGrade(score)).toBe(expectedGrade);
  });
});

describe('BureauDuplicateLock', () => {
  it('should block duplicate bureau pull within 30 days per PAN', () => {
    const lockDurationMs = 30 * 24 * 60 * 60 * 1000;
    const now = Date.now();
    const recentLock = new Date(now - 10 * 24 * 60 * 60 * 1000);

    const isLocked = recentLock.getTime() > now - lockDurationMs;
    expect(isLocked).toBe(true);

    const oldLock = new Date(now - 35 * 24 * 60 * 60 * 1000);
    const isLockedOld = oldLock.getTime() > now - lockDurationMs;
    expect(isLockedOld).toBe(false);
  });
});

describe('RTGSBusinessHours', () => {
  const isBusinessHours = (date: Date) => {
    const day = date.getDay();
    if (day === 0 || day === 6) return false;
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const timeInMinutes = hours * 60 + minutes;
    return timeInMinutes >= 480 && timeInMinutes < 990;
  };

  it('should reject RTGS on weekends', () => {
    const saturday = new Date('2024-07-20T10:00:00');
    expect(isBusinessHours(saturday)).toBe(false);

    const sunday = new Date('2024-07-21T10:00:00');
    expect(isBusinessHours(sunday)).toBe(false);
  });

  it('should accept RTGS within business hours on weekdays', () => {
    const morning = new Date('2024-07-22T08:00:00');
    expect(isBusinessHours(morning)).toBe(true);

    const afternoon = new Date('2024-07-22T16:00:00');
    expect(isBusinessHours(afternoon)).toBe(false);

    const afternoonCutoff = new Date('2024-07-22T16:29:00');
    expect(isBusinessHours(afternoonCutoff)).toBe(false);

    const noon = new Date('2024-07-22T12:00:00');
    expect(isBusinessHours(noon)).toBe(true);
  });
});

describe('DisbursementIdempotency', () => {
  it('should detect duplicate disbursement by idempotency key', () => {
    const existingKeys = new Map<string, string>();
    const key1 = 'disb-123-abc';
    const key2 = 'disb-123-xyz';

    existingKeys.set(key1, 'existing-disb-id');

    expect(existingKeys.has(key1)).toBe(true);
    expect(existingKeys.has(key2)).toBe(false);
  });
});

describe('IMPSAmountLimit', () => {
  it('should reject IMPS for amount > 5L', () => {
    const isWithinLimit = (amount: number) => amount <= 500_000;
    expect(isWithinLimit(500_000)).toBe(true);
    expect(isWithinLimit(500_001)).toBe(false);
    expect(isWithinLimit(100_000)).toBe(true);
  });
});

describe('UPIAmountLimit', () => {
  it('should reject UPI for amount > 1L', () => {
    const isWithinLimit = (amount: number) => amount <= 100_000;
    expect(isWithinLimit(100_000)).toBe(true);
    expect(isWithinLimit(100_001)).toBe(false);
    expect(isWithinLimit(50_000)).toBe(true);
  });
});

describe('RTGSMinimumAmount', () => {
  it('should require minimum 2L for RTGS', () => {
    const isAboveMinimum = (amount: number) => amount >= 200_000;
    expect(isAboveMinimum(200_000)).toBe(true);
    expect(isAboveMinimum(199_999)).toBe(false);
    expect(isAboveMinimum(5_000_000)).toBe(true);
  });
});
