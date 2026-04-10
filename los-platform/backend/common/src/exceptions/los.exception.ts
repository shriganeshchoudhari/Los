export type LOSErrorCode =
  | 'AUTH_001' | 'AUTH_002' | 'AUTH_003' | 'AUTH_004' | 'AUTH_005' | 'AUTH_006'
  | 'APP_001' | 'APP_002' | 'APP_003' | 'APP_004' | 'APP_005'
  | 'KYC_001' | 'KYC_002' | 'KYC_003' | 'KYC_004' | 'KYC_005' | 'KYC_006' | 'KYC_007'
  | 'BUR_001' | 'BUR_002' | 'BUR_003' | 'BUR_004'
  | 'DEC_001' | 'DEC_002' | 'DEC_003'
  | 'CBS_001' | 'CBS_002' | 'CBS_003' | 'CBS_004'
  | 'PAY_001' | 'PAY_002' | 'PAY_003' | 'PAY_004' | 'PAY_005'
  | 'DOC_001' | 'DOC_002' | 'DOC_003' | 'DOC_004'
  | 'GEN_001' | 'GEN_002' | 'GEN_003' | 'GEN_004' | 'GEN_005';

export interface LOSErrorDetails {
  code: LOSErrorCode;
  message: string;
  details?: string;
  field?: string;
  retryable: boolean;
  retryAfterSeconds?: number;
}

export class LOSException extends Error {
  public readonly code: LOSErrorCode;
  public readonly httpStatus: number;
  public readonly retryable: boolean;
  public readonly retryAfterSeconds?: number;

  constructor(details: LOSErrorDetails, httpStatus: number) {
    super(details.message);
    this.name = 'LOSException';
    this.code = details.code;
    this.httpStatus = httpStatus;
    this.retryable = details.retryable;
    this.retryAfterSeconds = details.retryAfterSeconds;
    Object.setPrototypeOf(this, LOSException.prototype);
  }

  toJSON(): LOSErrorDetails {
    return {
      code: this.code,
      message: this.message,
      details: this.details,
      field: this.field,
      retryable: this.retryable,
      retryAfterSeconds: this.retryAfterSeconds,
    };
  }
}

export const ErrorCodes: Record<LOSErrorCode, { httpStatus: number; retryable: boolean }> = {
  // Auth errors
  AUTH_001: { httpStatus: 401, retryable: false },
  AUTH_002: { httpStatus: 401, retryable: false },
  AUTH_003: { httpStatus: 429, retryable: false },
  AUTH_004: { httpStatus: 401, retryable: false },
  AUTH_005: { httpStatus: 401, retryable: false },
  AUTH_006: { httpStatus: 403, retryable: false },
  // Application errors
  APP_001: { httpStatus: 404, retryable: false },
  APP_002: { httpStatus: 409, retryable: false },
  APP_003: { httpStatus: 409, retryable: false },
  APP_004: { httpStatus: 400, retryable: false },
  APP_005: { httpStatus: 409, retryable: false },
  // KYC errors
  KYC_001: { httpStatus: 400, retryable: true, retryAfterSeconds: 60 },
  KYC_002: { httpStatus: 400, retryable: false },
  KYC_003: { httpStatus: 503, retryable: true, retryAfterSeconds: 30 },
  KYC_004: { httpStatus: 400, retryable: false },
  KYC_005: { httpStatus: 400, retryable: false },
  KYC_006: { httpStatus: 400, retryable: false },
  KYC_007: { httpStatus: 400, retryable: false },
  // Bureau errors
  BUR_001: { httpStatus: 504, retryable: true, retryAfterSeconds: 60 },
  BUR_002: { httpStatus: 404, retryable: false },
  BUR_003: { httpStatus: 400, retryable: false },
  BUR_004: { httpStatus: 409, retryable: false },
  // Decision errors
  DEC_001: { httpStatus: 400, retryable: false },
  DEC_002: { httpStatus: 409, retryable: false },
  DEC_003: { httpStatus: 400, retryable: false },
  // CBS errors
  CBS_001: { httpStatus: 504, retryable: true, retryAfterSeconds: 30 },
  CBS_002: { httpStatus: 409, retryable: false },
  CBS_003: { httpStatus: 400, retryable: false },
  CBS_004: { httpStatus: 500, retryable: true, retryAfterSeconds: 60 },
  // Payment errors
  PAY_001: { httpStatus: 400, retryable: false },
  PAY_002: { httpStatus: 403, retryable: false },
  PAY_003: { httpStatus: 409, retryable: false },
  PAY_004: { httpStatus: 502, retryable: true, retryAfterSeconds: 60 },
  PAY_005: { httpStatus: 400, retryable: true, retryAfterSeconds: 30 },
  // Document errors
  DOC_001: { httpStatus: 400, retryable: false },
  DOC_002: { httpStatus: 400, retryable: false },
  DOC_003: { httpStatus: 400, retryable: false },
  DOC_004: { httpStatus: 500, retryable: true, retryAfterSeconds: 30 },
  // General errors
  GEN_001: { httpStatus: 500, retryable: false },
  GEN_002: { httpStatus: 503, retryable: true, retryAfterSeconds: 30 },
  GEN_003: { httpStatus: 429, retryable: true, retryAfterSeconds: 60 },
  GEN_004: { httpStatus: 400, retryable: false },
  GEN_005: { httpStatus: 501, retryable: false },
};

export function createError(
  code: LOSErrorCode,
  message: string,
  details?: string,
  field?: string
): LOSException {
  const errorConfig = ErrorCodes[code];
  return new LOSException({
    code,
    message,
    details,
    field,
    retryable: errorConfig.retryable,
    retryAfterSeconds: errorConfig.retryAfterSeconds,
  }, errorConfig.httpStatus);
}
