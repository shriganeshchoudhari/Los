// ─────────────────────────────────────────────────────────────
// 1. SHARED / PRIMITIVES
// ─────────────────────────────────────────────────────────────

export type ISODateTimeString = string;
export type ISODateString = string;
export type MobileNumber = string;
export type AadhaarNumber = string;
export type PANNumber = string;
export type PaisaAmount = number;
export type UUID = string;
export type IFSCCode = string;
export type UPIAddress = string;
export type Currency = 'INR';
export type CountryCode = 'IN';

export interface Money {
  amount: PaisaAmount;
  currency: Currency;
}

export interface Address {
  line1: string;
  line2?: string;
  landmark?: string;
  city: string;
  district: string;
  state: IndianState;
  pincode: string;
  country: CountryCode;
  addressType: AddressType;
}

export type AddressType = 'PERMANENT' | 'CURRENT' | 'OFFICE' | 'OTHER';

export type IndianState =
  | 'AN' | 'AP' | 'AR' | 'AS' | 'BR' | 'CH' | 'CT' | 'DN' | 'DD' | 'DL'
  | 'GA' | 'GJ' | 'HR' | 'HP' | 'JK' | 'JH' | 'KA' | 'KL' | 'LA' | 'LD'
  | 'MP' | 'MH' | 'MN' | 'ML' | 'MZ' | 'NL' | 'OD' | 'PY' | 'PB' | 'RJ'
  | 'SK' | 'TN' | 'TG' | 'TR' | 'UP' | 'UK' | 'WB';

export interface PagedRequest {
  page: number;
  size: number;
  sortBy?: string;
  sortOrder?: 'ASC' | 'DESC';
}

export interface PagedResponse<T> {
  content: T[];
  totalElements: number;
  totalPages: number;
  page: number;
  size: number;
}

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: ApiError;
  meta: ResponseMeta;
}

export interface ResponseMeta {
  requestId: UUID;
  timestamp: ISODateTimeString;
  version: string;
  processingTimeMs: number;
}

export interface ApiError {
  code: LOSErrorCode;
  message: string;
  details?: string;
  field?: string;
  retryable: boolean;
  retryAfterSeconds?: number;
}

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

export interface CircuitBreakerState {
  service: string;
  state: 'CLOSED' | 'OPEN' | 'HALF_OPEN';
  failureCount: number;
  failureThreshold: number;
  lastFailureAt?: ISODateTimeString;
  openedAt?: ISODateTimeString;
  nextAttemptAt?: ISODateTimeString;
}

export interface IdempotencyRecord {
  idempotencyKey: string;
  endpoint: string;
  responseStatus: number;
  responseBody: string;
  createdAt: ISODateTimeString;
  expiresAt: ISODateTimeString;
}
