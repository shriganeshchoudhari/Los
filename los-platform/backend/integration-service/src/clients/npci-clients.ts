import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PaymentMode, Disbursement, PaymentTransaction } from '../entities/payment.entity';
import { CircuitBreaker, DEFAULT_CIRCUIT_BREAKER_CONFIG } from '../utils/circuit-breaker';
import { withRetry } from '../utils/retry';

export interface PaymentInitRequest {
  senderAccount: string;
  senderIfsc: string;
  beneficiaryAccount: string;
  beneficiaryIfsc: string;
  beneficiaryName: string;
  beneficiaryMobile?: string;
  amount: number;
  reference?: string;
  remarks?: string;
}

export interface PaymentInitResponse {
  success: boolean;
  npciReferenceId?: string;
  utrNumber?: string;
  statusCode?: string;
  statusMessage?: string;
  errorCode?: string;
  errorMessage?: string;
  latencyMs: number;
}

export interface PaymentCallback {
  utrNumber: string;
  status: 'SUCCESS' | 'FAILED' | 'RETURNED';
  statusCode?: string;
  reasonCode?: string;
  reasonDescription?: string;
  settlementDate?: string;
  amount?: number;
  timestamp: string;
}

export interface PennyDropResult {
  verified: boolean;
  accountExists?: boolean;
  bankName?: string;
  accountHolderName?: string;
  accountType?: string;
  impsEnabled?: boolean;
  errorCode?: string;
  errorMessage?: string;
}

@Injectable()
export class IMPSClient {
  private readonly logger = new Logger(IMPSClient.name);
  private readonly circuitBreaker: CircuitBreaker;
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly bankCode: string;

  constructor(private readonly configService: ConfigService) {
    this.circuitBreaker = new CircuitBreaker({
      ...DEFAULT_CIRCUIT_BREAKER_CONFIG,
      failureThreshold: 3,
      timeout: 30_000,
      openDuration: 30_000,
    });
    this.baseUrl = this.configService.get<string>('NPCI_IMPS_URL', 'https://api.npci.org/imps');
    this.apiKey = this.configService.get<string>('NPCI_IMPS_API_KEY', '');
    this.bankCode = this.configService.get<string>('NPCI_BANK_CODE', 'SBIN');
  }

  async initiatePayment(req: PaymentInitRequest): Promise<PaymentInitResponse> {
    const startTime = Date.now();

    if (req.amount > 500_000) {
      return {
        success: false,
        errorCode: 'AMOUNT_LIMIT_EXCEEDED',
        errorMessage: 'IMPS limit is ₹5L per transaction',
        latencyMs: Date.now() - startTime,
      };
    }

    try {
      const result = await this.circuitBreaker.execute(async () => {
        return withRetry(async () => {
          const requestBody = {
            message: {
              paymntReq: {
                '@_xmlns': 'http://npci.org/imps/schema',
                bankId: this.bankCode,
                senderAccountNo: req.senderAccount,
                senderIFSCCode: req.senderIfsc,
                beneAccountNo: req.beneficiaryAccount,
                beneIFSCCode: req.beneficiaryIfsc,
                beneName: req.beneficiaryName,
                amount: req.amount.toFixed(2),
                custRefNo: req.reference || `REF${Date.now()}`,
                remarks: req.remarks || '',
                timestamp: new Date().toISOString(),
              },
            },
          };

          const response = await fetch(`${this.baseUrl}/v1/transfer`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-API-Key': this.apiKey,
              'X-Request-Id': `imps-${Date.now()}`,
              'X-Timestamp': new Date().toISOString(),
            },
            body: JSON.stringify(requestBody),
            signal: AbortSignal.timeout(30_000),
          });

          if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`IMPS API error: ${response.status} - ${errorBody}`);
          }

          return response.json() as Promise<IMPSApiResponse>;
        }, { maxAttempts: 3, timeoutMs: 30_000 });
      });

      const latencyMs = Date.now() - startTime;
      return this.mapResponse(result, latencyMs);
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      return this.mapError(error as Error, latencyMs);
    }
  }

  async initiatePennyDrop(req: {
    accountNumber: string;
    ifsc: string;
    beneficiaryName?: string;
  }): Promise<PennyDropResult> {
    const startTime = Date.now();
    try {
      const result = await this.circuitBreaker.execute(async () => {
        return withRetry(async () => {
          const response = await fetch(`${this.baseUrl}/v1/validation/account`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-API-Key': this.apiKey,
              'X-Request-Id': `pd-${Date.now()}`,
            },
            body: JSON.stringify({
              accountNo: req.accountNumber,
              ifscCode: req.ifsc,
              beneName: req.beneficiaryName || '',
            }),
            signal: AbortSignal.timeout(30_000),
          });

          if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`IMPS penny drop error: ${response.status} - ${errorBody}`);
          }

          return response.json() as Promise<IMPSPennyDropResponse>;
        }, { maxAttempts: 3, timeoutMs: 30_000 });
      });

      const latencyMs = Date.now() - startTime;
      return {
        verified: result.status === 'SUCCESS' && result.accountExists === true,
        accountExists: result.accountExists,
        bankName: result.bankName,
        accountHolderName: result.accountHolderName,
        accountType: result.accountType,
        impsEnabled: result.impsEnabled,
      };
    } catch (error) {
      return {
        verified: false,
        errorCode: 'IMPS_ERROR',
        errorMessage: (error as Error).message,
      };
    }
  }

  private mapResponse(data: IMPSApiResponse, latencyMs: number): PaymentInitResponse {
    if (data.status === 'ACCEPTED' || data.status === 'SUCCESS') {
      return {
        success: true,
        npciReferenceId: data.refId,
        utrNumber: data.utrNo,
        statusCode: data.status,
        statusMessage: 'Payment initiated',
        latencyMs,
      };
    }
    return {
      success: false,
      statusCode: data.status,
      statusMessage: data.message || 'IMPS payment failed',
      errorCode: data.errorCode || 'IMPS_ERROR',
      errorMessage: data.message || 'IMPS payment failed',
      latencyMs,
    };
  }

  private mapError(error: Error, latencyMs: number): PaymentInitResponse {
    this.logger.error(`IMPS payment failed: ${error.message}`);
    return {
      success: false,
      errorCode: 'IMPS_ERROR',
      errorMessage: error.message,
      latencyMs,
    };
  }

  getCircuitMetrics() {
    return this.circuitBreaker.getMetrics();
  }
}

interface IMPSApiResponse {
  status: string;
  refId: string;
  utrNo: string;
  message?: string;
  errorCode?: string;
}

interface IMPSPennyDropResponse {
  status: 'SUCCESS' | 'FAILED';
  accountExists: boolean;
  bankName?: string;
  accountHolderName?: string;
  accountType?: string;
  impsEnabled?: boolean;
  errorCode?: string;
  errorMessage?: string;
}

@Injectable()
export class NEFTClient {
  private readonly logger = new Logger(NEFTClient.name);
  private readonly circuitBreaker: CircuitBreaker;
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(private readonly configService: ConfigService) {
    this.circuitBreaker = new CircuitBreaker({
      ...DEFAULT_CIRCUIT_BREAKER_CONFIG,
      failureThreshold: 3,
      timeout: 30_000,
      openDuration: 30_000,
    });
    this.baseUrl = this.configService.get<string>('NPCI_NEFT_URL', 'https://api.npci.org/neft');
    this.apiKey = this.configService.get<string>('NPCI_NEFT_API_KEY', '');
  }

  async initiatePayment(req: PaymentInitRequest): Promise<PaymentInitResponse> {
    const startTime = Date.now();
    const now = new Date();
    const cutoffHour = 19;

    if (now.getHours() >= cutoffHour) {
      const nextBatch = new Date(now);
      nextBatch.setDate(nextBatch.getDate() + (now.getDay() === 5 ? 3 : 1));
      nextBatch.setHours(8, 0, 0, 0);

      return {
        success: true,
        statusCode: 'BATCH_QUEUED',
        statusMessage: `NEFT batch queued for ${nextBatch.toISOString()}`,
        latencyMs: Date.now() - startTime,
      };
    }

    try {
      const result = await this.circuitBreaker.execute(async () => {
        return withRetry(async () => {
          const response = await fetch(`${this.baseUrl}/v1/transfer`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-API-Key': this.apiKey,
              'X-Request-Id': `neft-${Date.now()}`,
            },
            body: JSON.stringify({
              senderAccount: req.senderAccount,
              senderIFSC: req.senderIfsc,
              beneficiaryAccount: req.beneficiaryAccount,
              beneficiaryIFSC: req.beneficiaryIfsc,
              beneficiaryName: req.beneficiaryName,
              amount: req.amount.toFixed(2),
              reference: req.reference || `REF${Date.now()}`,
              remarks: req.remarks || '',
              timestamp: new Date().toISOString(),
            }),
            signal: AbortSignal.timeout(30_000),
          });

          if (!response.ok) {
            throw new Error(`NEFT API error: ${response.status}`);
          }

          return response.json() as Promise<NEFTApiResponse>;
        }, { maxAttempts: 3, timeoutMs: 30_000 });
      });

      const latencyMs = Date.now() - startTime;
      return this.mapResponse(result, latencyMs);
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      return this.mapError(error as Error, latencyMs);
    }
  }

  private mapResponse(data: NEFTApiResponse, latencyMs: number): PaymentInitResponse {
    if (data.status === 'ACCEPTED') {
      return {
        success: true,
        npciReferenceId: data.batchId,
        statusCode: data.status,
        statusMessage: 'NEFT batch accepted for next settlement cycle',
        latencyMs,
      };
    }
    return {
      success: false,
      statusCode: data.status,
      errorCode: data.errorCode || 'NEFT_ERROR',
      errorMessage: data.message || 'NEFT payment failed',
      latencyMs,
    };
  }

  private mapError(error: Error, latencyMs: number): PaymentInitResponse {
    this.logger.error(`NEFT payment failed: ${error.message}`);
    return {
      success: false,
      errorCode: 'NEFT_ERROR',
      errorMessage: error.message,
      latencyMs,
    };
  }

  getCircuitMetrics() {
    return this.circuitBreaker.getMetrics();
  }
}

interface NEFTApiResponse {
  status: string;
  batchId: string;
  message?: string;
  errorCode?: string;
}

@Injectable()
export class RTGSClient {
  private readonly logger = new Logger(RTGSClient.name);
  private readonly circuitBreaker: CircuitBreaker;
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(private readonly configService: ConfigService) {
    this.circuitBreaker = new CircuitBreaker({
      ...DEFAULT_CIRCUIT_BREAKER_CONFIG,
      failureThreshold: 3,
      timeout: 30_000,
      openDuration: 30_000,
    });
    this.baseUrl = this.configService.get<string>('NPCI_RTGS_URL', 'https://api.npci.org/rtgs');
    this.apiKey = this.configService.get<string>('NPCI_RTGS_API_KEY', '');
  }

  async initiatePayment(req: PaymentInitRequest): Promise<PaymentInitResponse> {
    const startTime = Date.now();

    if (req.amount < 200_000) {
      return {
        success: false,
        errorCode: 'AMOUNT_LIMIT_BELOW_MIN',
        errorMessage: 'RTGS minimum amount is ₹2L',
        latencyMs: Date.now() - startTime,
      };
    }

    const now = new Date();
    const isBusinessHours = this.isBusinessHours(now);
    if (!isBusinessHours) {
      return {
        success: false,
        errorCode: 'RTGS_CUTOFF_HOURS',
        errorMessage: 'RTGS available 8:00 AM - 4:30 PM on business days only',
        latencyMs: Date.now() - startTime,
      };
    }

    try {
      const result = await this.circuitBreaker.execute(async () => {
        return withRetry(async () => {
          const response = await fetch(`${this.baseUrl}/v1/transfer`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-API-Key': this.apiKey,
              'X-Request-Id': `rtgs-${Date.now()}`,
            },
            body: JSON.stringify({
              senderAccount: req.senderAccount,
              senderIFSC: req.senderIfsc,
              beneficiaryAccount: req.beneficiaryAccount,
              beneficiaryIFSC: req.beneficiaryIfsc,
              beneficiaryName: req.beneficiaryName,
              amount: req.amount.toFixed(2),
              reference: req.reference || `REF${Date.now()}`,
              remarks: req.remarks || '',
              timestamp: new Date().toISOString(),
            }),
            signal: AbortSignal.timeout(30_000),
          });

          if (!response.ok) {
            throw new Error(`RTGS API error: ${response.status}`);
          }

          return response.json() as Promise<RTGSApiResponse>;
        }, { maxAttempts: 3, timeoutMs: 30_000 });
      });

      const latencyMs = Date.now() - startTime;
      return this.mapResponse(result, latencyMs);
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      return this.mapError(error as Error, latencyMs);
    }
  }

  private isBusinessHours(date: Date): boolean {
    const day = date.getDay();
    if (day === 0 || day === 6) return false;
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const timeInMinutes = hours * 60 + minutes;
    return timeInMinutes >= 480 && timeInMinutes < 990;
  }

  private mapResponse(data: RTGSApiResponse, latencyMs: number): PaymentInitResponse {
    if (data.status === 'ACCEPTED') {
      return {
        success: true,
        npciReferenceId: data.referenceId,
        utrNumber: data.utrNo,
        statusCode: data.status,
        statusMessage: 'RTGS payment initiated',
        latencyMs,
      };
    }
    return {
      success: false,
      statusCode: data.status,
      errorCode: data.errorCode || 'RTGS_ERROR',
      errorMessage: data.message || 'RTGS payment failed',
      latencyMs,
    };
  }

  private mapError(error: Error, latencyMs: number): PaymentInitResponse {
    this.logger.error(`RTGS payment failed: ${error.message}`);
    return {
      success: false,
      errorCode: 'RTGS_ERROR',
      errorMessage: error.message,
      latencyMs,
    };
  }

  getCircuitMetrics() {
    return this.circuitBreaker.getMetrics();
  }
}

interface RTGSApiResponse {
  status: string;
  referenceId: string;
  utrNo: string;
  message?: string;
  errorCode?: string;
}

@Injectable()
export class UPIClient {
  private readonly logger = new Logger(UPIClient.name);
  private readonly circuitBreaker: CircuitBreaker;
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly vpa: string;

  constructor(private readonly configService: ConfigService) {
    this.circuitBreaker = new CircuitBreaker({
      ...DEFAULT_CIRCUIT_BREAKER_CONFIG,
      failureThreshold: 3,
      timeout: 30_000,
      openDuration: 30_000,
    });
    this.baseUrl = this.configService.get<string>('NPCI_UPI_URL', 'https://api.npci.org/upi');
    this.apiKey = this.configService.get<string>('NPCI_UPI_API_KEY', '');
    this.vpa = this.configService.get<string>('NPCI_UPI_VPA', 'losbank@npci');
  }

  async initiatePayment(req: PaymentInitRequest): Promise<PaymentInitResponse> {
    const startTime = Date.now();

    if (req.amount > 100_000) {
      return {
        success: false,
        errorCode: 'AMOUNT_LIMIT_EXCEEDED',
        errorMessage: 'UPI limit is ₹1L per transaction',
        latencyMs: Date.now() - startTime,
      };
    }

    try {
      const result = await this.circuitBreaker.execute(async () => {
        return withRetry(async () => {
          const response = await fetch(`${this.baseUrl}/v1/collect`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-API-Key': this.apiKey,
              'X-Request-Id': `upi-${Date.now()}`,
            },
            body: JSON.stringify({
              payerVpa: this.vpa,
              payeeVpa: `${req.beneficiaryAccount}@${req.beneficiaryIfsc.substring(0, 4)}`,
              amount: req.amount.toFixed(2),
              remark: req.remarks || 'LOS Disbursement',
              mcc: '5411',
            }),
            signal: AbortSignal.timeout(30_000),
          });

          if (!response.ok) {
            throw new Error(`UPI API error: ${response.status}`);
          }

          return response.json() as Promise<UPIApiResponse>;
        }, { maxAttempts: 3, timeoutMs: 30_000 });
      });

      const latencyMs = Date.now() - startTime;
      return this.mapResponse(result, latencyMs);
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      return this.mapError(error as Error, latencyMs);
    }
  }

  private mapResponse(data: UPIApiResponse, latencyMs: number): PaymentInitResponse {
    if (data.status === 'ACCEPTED') {
      return {
        success: true,
        npciReferenceId: data.referenceId,
        statusCode: data.status,
        statusMessage: 'UPI collect request sent to beneficiary',
        latencyMs,
      };
    }
    return {
      success: false,
      statusCode: data.status,
      errorCode: data.errorCode || 'UPI_ERROR',
      errorMessage: data.message || 'UPI payment failed',
      latencyMs,
    };
  }

  private mapError(error: Error, latencyMs: number): PaymentInitResponse {
    this.logger.error(`UPI payment failed: ${error.message}`);
    return {
      success: false,
      errorCode: 'UPI_ERROR',
      errorMessage: error.message,
      latencyMs,
    };
  }

  getCircuitMetrics() {
    return this.circuitBreaker.getMetrics();
  }
}

interface UPIApiResponse {
  status: string;
  referenceId: string;
  message?: string;
  errorCode?: string;
}

@Injectable()
export class NACHClient {
  private readonly logger = new Logger(NACHClient.name);
  private readonly circuitBreaker: CircuitBreaker;
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly sponsorCode: string;
  private readonly utilityCode: string;

  constructor(private readonly configService: ConfigService) {
    this.circuitBreaker = new CircuitBreaker({
      ...DEFAULT_CIRCUIT_BREAKER_CONFIG,
      failureThreshold: 3,
      timeout: 30_000,
      openDuration: 60_000,
    });
    this.baseUrl = this.configService.get<string>('NPCI_NACH_URL', 'https://api.npci.org/nach');
    this.apiKey = this.configService.get<string>('NPCI_NACH_API_KEY', '');
    this.sponsorCode = this.configService.get<string>('NACH_SPONSOR_CODE', '');
    this.utilityCode = this.configService.get<string>('NACH_UTILITY_CODE', '');
  }

  async registerMandate(req: {
    applicationId: string;
    loanId: string;
    loanAccountId: string;
    debtorAccountNumber: string;
    debtorIfsc: string;
    debtorName: string;
    maxAmount: number;
    startDate: string;
    endDate: string;
    frequency?: string;
  }): Promise<{ success: boolean; emandateId?: string; umrn?: string; errorCode?: string; errorMessage?: string }> {
    const startTime = Date.now();
    try {
      const result = await this.circuitBreaker.execute(async () => {
        return withRetry(async () => {
          const response = await fetch(`${this.baseUrl}/v1/mandate/register`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'X-API-Key': this.apiKey,
              'X-Request-Id': `nach-${Date.now()}`,
            },
            body: JSON.stringify({
              sponsorCode: this.sponsorCode,
              utilityCode: this.utilityCode,
              emandateId: `EMD-${req.applicationId.substring(0, 8)}-${Date.now()}`,
              applicationId: req.applicationId,
              loanAccountId: req.loanAccountId,
              debtorAccountNumber: req.debtorAccountNumber,
              debtorIfsc: req.debtorIfsc,
              debtorName: req.debtorName,
              maxAmount: req.maxAmount.toFixed(2),
              frequency: req.frequency || 'MONTHLY',
              startDate: req.startDate,
              endDate: req.endDate,
              timestamp: new Date().toISOString(),
            }),
            signal: AbortSignal.timeout(30_000),
          });

          if (!response.ok) {
            throw new Error(`NACH API error: ${response.status}`);
          }

          return response.json() as Promise<NACHApiResponse>;
        }, { maxAttempts: 3, timeoutMs: 30_000 });
      });

      const latencyMs = Date.now() - startTime;
      this.logger.log(`NACH mandate registration completed in ${latencyMs}ms`);

      if (result.status === 'ACCEPTED') {
        return {
          success: true,
          emandateId: result.emandateId,
          umrn: result.umrn,
        };
      }
      return {
        success: false,
        errorCode: result.errorCode || 'NACH_ERROR',
        errorMessage: result.message || 'NACH registration failed',
      };
    } catch (error) {
      this.logger.error(`NACH mandate registration failed: ${(error as Error).message}`);
      return {
        success: false,
        errorCode: 'NACH_ERROR',
        errorMessage: (error as Error).message,
      };
    }
  }

  async verifyMandate(emandateId: string): Promise<{ success: boolean; status?: string; rejectionReason?: string }> {
    try {
      const response = await fetch(`${this.baseUrl}/v1/mandate/status/${emandateId}`, {
        method: 'GET',
        headers: {
          'X-API-Key': this.apiKey,
          'X-Request-Id': `nach-status-${Date.now()}`,
        },
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) {
        throw new Error(`NACH status check error: ${response.status}`);
      }

      const data = await response.json() as NACHStatusResponse;
      return {
        success: data.status === 'CONFIRMED',
        status: data.status,
        rejectionReason: data.rejectionReason,
      };
    } catch (error) {
      return {
        success: false,
        status: 'ERROR',
        rejectionReason: (error as Error).message,
      };
    }
  }

  getCircuitMetrics() {
    return this.circuitBreaker.getMetrics();
  }
}

interface NACHApiResponse {
  status: 'ACCEPTED' | 'REJECTED' | 'PENDING';
  emandateId: string;
  umrn?: string;
  message?: string;
  errorCode?: string;
}

interface NACHStatusResponse {
  status: 'CONFIRMED' | 'REJECTED' | 'PENDING' | 'ERROR';
  emandateId: string;
  rejectionReason?: string;
}
