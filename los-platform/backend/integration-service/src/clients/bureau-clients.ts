import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { BureauProvider, BureauReport } from '../entities/bureau.entity';
import { BureauPullRequestDto } from '../dto/bureau.dto';
import { CircuitBreaker, DEFAULT_CIRCUIT_BREAKER_CONFIG } from '../utils/circuit-breaker';
import { withRetry } from '../utils/retry';
import { XMLParser } from 'fast-xml-parser';

export interface BureauPullResult {
  success: boolean;
  provider: BureauProvider;
  score?: number;
  rawResponse?: Record<string, unknown>;
  errorCode?: string;
  errorMessage?: string;
  latencyMs: number;
}

@Injectable()
export class CibilClient {
  private readonly logger = new Logger(CibilClient.name);
  private readonly circuitBreaker: CircuitBreaker;
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(private readonly configService: ConfigService) {
    this.circuitBreaker = new CircuitBreaker({
      ...DEFAULT_CIRCUIT_BREAKER_CONFIG,
      failureThreshold: 5,
      timeout: 30_000,
    });
    this.baseUrl = this.configService.get<string>('CIBIL_API_URL', 'https://api.cibil.com');
    this.apiKey = this.configService.get<string>('CIBIL_API_KEY', '');
  }

  async pullReport(dto: BureauPullRequestDto): Promise<BureauPullResult> {
    const startTime = Date.now();
    try {
      const result = await this.circuitBreaker.execute(async () => {
        return withRetry(async () => {
          const requestBody = {
            memberId: this.apiKey,
            consumerName: dto.consumerName,
            panHash: dto.panHash,
            dob: dto.dateOfBirth,
            gender: dto.gender,
            mobilePhone: dto.mobileNumber,
            passportNum: dto.passportNumber,
            voterId: dto.voterId,
            drivingLicense: dto.drivingLicense,
            transactionId: `CIB-${Date.now()}`,
          };

          const response = await fetch(`${this.baseUrl}/consumerconsent/individual`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.apiKey}`,
              'X-Request-Id': `req-${Date.now()}`,
            },
            body: JSON.stringify(requestBody),
            signal: AbortSignal.timeout(30_000),
          });

          if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`CIBIL API error: ${response.status} - ${errorBody}`);
          }

          return response.json() as Promise<CibilApiResponse>;
        }, { maxAttempts: 3, timeoutMs: 30_000 });
      });

      const latencyMs = Date.now() - startTime;
      return this.mapResponse(result, latencyMs);
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      return this.mapError(error as Error, latencyMs);
    }
  }

  private mapResponse(data: CibilApiResponse, latencyMs: number): BureauPullResult {
    if (data.status === 'SUCCESS' && data.consumerReport) {
      return {
        success: true,
        provider: BureauProvider.CIBIL,
        score: data.consumerReport.cibilScore || null,
        rawResponse: data as unknown as Record<string, unknown>,
        latencyMs,
      };
    }
    return {
      success: false,
      provider: BureauProvider.CIBIL,
      errorCode: data.errorCode || 'UNKNOWN',
      errorMessage: data.errorMessage || 'CIBIL pull failed',
      latencyMs,
    };
  }

  private mapError(error: Error, latencyMs: number): BureauPullResult {
    this.logger.error(`CIBIL pull failed: ${error.message}`);
    return {
      success: false,
      provider: BureauProvider.CIBIL,
      errorCode: 'CIBIL_ERROR',
      errorMessage: error.message,
      latencyMs,
    };
  }

  getCircuitMetrics() {
    return this.circuitBreaker.getMetrics();
  }
}

interface CibilApiResponse {
  status: 'SUCCESS' | 'FAILED';
  transactionId: string;
  errorCode?: string;
  errorMessage?: string;
  consumerReport?: {
    cibilScore: number;
    reportDate: string;
    nameMatchScore: number;
    totalAccounts: number;
    activeAccounts: number;
    closedAccounts: number;
    totalOutstanding: number;
    totalEMI: number;
    dpd0to30: number;
    dpd31to60: number;
    dpd61to90: number;
    dpdOver90: number;
    enquiriesLast30Days: number;
    enquiriesLast90Days: number;
    writeoffs: number;
    suitFiled: boolean;
    accounts: CibilAccountRecord[];
    enquiries: CibilEnquiryRecord[];
  };
}

interface CibilAccountRecord {
  accountNumber: string;
  accountType: string;
  ownershipType: string;
  currentBalance: number;
  amountOverdue: number;
  dpd: number;
  openedDate: string;
  closedDate: string | null;
  lastPaymentDate: string | null;
  lender: string;
}

interface CibilEnquiryRecord {
  enquiryDate: string;
  enquiryAmount: number;
  enquiryPurpose: string;
  lender: string;
}

@Injectable()
export class ExperianClient {
  private readonly logger = new Logger(ExperianClient.name);
  private readonly circuitBreaker: CircuitBreaker;
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(private readonly configService: ConfigService) {
    this.circuitBreaker = new CircuitBreaker({
      ...DEFAULT_CIRCUIT_BREAKER_CONFIG,
      failureThreshold: 5,
      timeout: 30_000,
    });
    this.baseUrl = this.configService.get<string>('EXPERIAN_API_URL', 'https://api.experian.com');
    this.apiKey = this.configService.get<string>('EXPERIAN_API_KEY', '');
  }

  async pullReport(dto: BureauPullRequestDto): Promise<BureauPullResult> {
    const startTime = Date.now();
    try {
      const result = await this.circuitBreaker.execute(async () => {
        return withRetry(async () => {
          const requestBody = {
            applicant: {
              consumerName: dto.consumerName,
              panHash: dto.panHash,
              dob: dto.dateOfBirth,
              gender: dto.gender,
              mobilePhone: dto.mobileNumber,
              voterId: dto.voterId,
              drivingLicense: dto.drivingLicense,
              passport: dto.passportNumber,
            },
            consent: {
              type: 'BUREAU_PULL',
              timestamp: new Date().toISOString(),
            },
          };

          const response = await fetch(`${this.baseUrl}/v1/consumerconsent`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.apiKey}`,
              'X-Request-Id': `req-${Date.now()}`,
            },
            body: JSON.stringify(requestBody),
            signal: AbortSignal.timeout(30_000),
          });

          if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Experian API error: ${response.status} - ${errorBody}`);
          }

          return response.json() as Promise<ExperianApiResponse>;
        }, { maxAttempts: 3, timeoutMs: 30_000 });
      });

      const latencyMs = Date.now() - startTime;
      return this.mapResponse(result, latencyMs);
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      return this.mapError(error as Error, latencyMs);
    }
  }

  private mapResponse(data: ExperianApiResponse, latencyMs: number): BureauPullResult {
    if (data.status === 'SUCCESS' && data.creditReport) {
      return {
        success: true,
        provider: BureauProvider.EXPERIAN,
        score: data.creditReport.experianScore || null,
        rawResponse: data as unknown as Record<string, unknown>,
        latencyMs,
      };
    }
    return {
      success: false,
      provider: BureauProvider.EXPERIAN,
      errorCode: data.errorCode || 'UNKNOWN',
      errorMessage: data.errorMessage || 'Experian pull failed',
      latencyMs,
    };
  }

  private mapError(error: Error, latencyMs: number): BureauPullResult {
    this.logger.error(`Experian pull failed: ${error.message}`);
    return {
      success: false,
      provider: BureauProvider.EXPERIAN,
      errorCode: 'EXPERIAN_ERROR',
      errorMessage: error.message,
      latencyMs,
    };
  }

  getCircuitMetrics() {
    return this.circuitBreaker.getMetrics();
  }
}

interface ExperianApiResponse {
  status: 'SUCCESS' | 'FAILED';
  transactionId: string;
  errorCode?: string;
  errorMessage?: string;
  creditReport?: {
    experianScore: number;
    reportDate: string;
    totalAccounts: number;
    activeAccounts: number;
    closedAccounts: number;
    totalExposure: number;
    totalEMI: number;
    dpd0to30: number;
    dpd31to60: number;
    dpd61to90: number;
    dpdOver90: number;
    enquiries30d: number;
    enquiries90d: number;
    writeoffs: number;
    suitFiled: boolean;
  };
}

@Injectable()
export class EquifaxClient {
  private readonly logger = new Logger(EquifaxClient.name);
  private readonly circuitBreaker: CircuitBreaker;
  private readonly baseUrl: string;
  private readonly apiKey: string;
  private readonly parser: XMLParser;

  constructor(private readonly configService: ConfigService) {
    this.circuitBreaker = new CircuitBreaker({
      ...DEFAULT_CIRCUIT_BREAKER_CONFIG,
      failureThreshold: 5,
      timeout: 30_000,
    });
    this.baseUrl = this.configService.get<string>('EQUIFAX_API_URL', 'https://soap.equifax.com');
    this.apiKey = this.configService.get<string>('EQUIFAX_API_KEY', '');
    this.parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '@_',
    });
  }

  async pullReport(dto: BureauPullRequestDto): Promise<BureauPullResult> {
    const startTime = Date.now();
    try {
      const result = await this.circuitBreaker.execute(async () => {
        return withRetry(async () => {
          const soapEnvelope = this.buildSoapEnvelope(dto);
          const response = await fetch(this.baseUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'text/xml;charset=UTF-8',
              'SOAPAction': 'urn:getConsumerCreditReport',
              'Authorization': `Bearer ${this.apiKey}`,
            },
            body: soapEnvelope,
            signal: AbortSignal.timeout(30_000),
          });

          if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`Equifax API error: ${response.status} - ${errorBody}`);
          }

          const xmlResponse = await response.text();
          return this.parser.parse(xmlResponse) as EquifaxSoapResponse;
        }, { maxAttempts: 3, timeoutMs: 30_000 });
      });

      const latencyMs = Date.now() - startTime;
      return this.mapResponse(result, latencyMs);
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      return this.mapError(error as Error, latencyMs);
    }
  }

  private buildSoapEnvelope(dto: BureauPullRequestDto): string {
    return `<?xml version="1.0" encoding="UTF-8"?>
<soapenv:Envelope xmlns:soapenv="http://schemas.xmlsoap.org/soap/envelope/"
                   xmlns:eqx="http://www.equifax.com/consumer">
  <soapenv:Header>
    <eqx:Authentication>
      <eqx:apiKey>${this.apiKey}</eqx:apiKey>
    </eqx:Authentication>
  </soapenv:Header>
  <soapenv:Body>
    <eqx:GetConsumerCreditReportRequest>
      <eqx:Consumer>
        <eqx:ConsumerName>${this.escapeXml(dto.consumerName)}</eqx:ConsumerName>
        <eqx:PANHash>${this.escapeXml(dto.panHash)}</eqx:PANHash>
        <eqx:DateOfBirth>${dto.dateOfBirth || ''}</eqx:DateOfBirth>
        <eqx:Gender>${dto.gender || ''}</eqx:Gender>
        <eqx:MobilePhone>${dto.mobileNumber || ''}</eqx:MobilePhone>
      </eqx:Consumer>
      <eqx:Consent>
        <eqx:ConsentType>BUREAU_PULL</eqx:ConsentType>
        <eqx:ConsentTimestamp>${new Date().toISOString()}</eqx:ConsentTimestamp>
      </eqx:Consent>
    </eqx:GetConsumerCreditReportRequest>
  </soapenv:Body>
</soapenv:Envelope>`;
  }

  private escapeXml(str: string): string {
    return str
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }

  private mapResponse(data: EquifaxSoapResponse, latencyMs: number): BureauPullResult {
    const body = data['soapenv:Envelope']?.['soapenv:Body'];
    const response = body?.['eqx:GetConsumerCreditReportResponse'];

    if (!response) {
      return {
        success: false,
        provider: BureauProvider.EQUIFAX,
        errorCode: 'PARSE_ERROR',
        errorMessage: 'Invalid Equifax SOAP response',
        latencyMs,
      };
    }

    const status = response['@_status'] || response.status;
    if (status === 'SUCCESS' || status === '0') {
      const report = response['ConsumerCreditReport'];
      return {
        success: true,
        provider: BureauProvider.EQUIFAX,
        score: report?.score ? parseInt(report.score, 10) : null,
        rawResponse: response as unknown as Record<string, unknown>,
        latencyMs,
      };
    }

    return {
      success: false,
      provider: BureauProvider.EQUIFAX,
      errorCode: response.errorCode || 'EQUIFAX_ERROR',
      errorMessage: response.errorMessage || 'Equifax pull failed',
      latencyMs,
    };
  }

  private mapError(error: Error, latencyMs: number): BureauPullResult {
    this.logger.error(`Equifax pull failed: ${error.message}`);
    return {
      success: false,
      provider: BureauProvider.EQUIFAX,
      errorCode: 'EQUIFAX_ERROR',
      errorMessage: error.message,
      latencyMs,
    };
  }

  getCircuitMetrics() {
    return this.circuitBreaker.getMetrics();
  }
}

interface EquifaxSoapResponse {
  'soapenv:Envelope': {
    'soapenv:Body': {
      'eqx:GetConsumerCreditReportResponse': {
        '@_status': string;
        status?: string;
        errorCode?: string;
        errorMessage?: string;
        ConsumerCreditReport?: {
          score: string;
          reportDate: string;
          totalAccounts: string;
          activeAccounts: string;
          totalExposure: string;
          totalEMI: string;
          dpd0to30: string;
          dpd31to60: string;
          dpd61to90: string;
          dpdOver90: string;
          enquiries30d: string;
          writeoffs: string;
        };
      };
    };
  };
}

@Injectable()
export class CrifClient {
  private readonly logger = new Logger(CrifClient.name);
  private readonly circuitBreaker: CircuitBreaker;
  private readonly baseUrl: string;
  private readonly apiKey: string;

  constructor(private readonly configService: ConfigService) {
    this.circuitBreaker = new CircuitBreaker({
      ...DEFAULT_CIRCUIT_BREAKER_CONFIG,
      failureThreshold: 5,
      timeout: 30_000,
    });
    this.baseUrl = this.configService.get<string>('CRIF_API_URL', 'https://api.crifhighmark.com');
    this.apiKey = this.configService.get<string>('CRIF_API_KEY', '');
  }

  async pullReport(dto: BureauPullRequestDto): Promise<BureauPullResult> {
    const startTime = Date.now();
    try {
      const result = await this.circuitBreaker.execute(async () => {
        return withRetry(async () => {
          const requestBody = {
            memberId: this.apiKey,
            consumerName: dto.consumerName,
            panHash: dto.panHash,
            dob: dto.dateOfBirth,
            mobilePhone: dto.mobileNumber,
            consentTimestamp: new Date().toISOString(),
          };

          const response = await fetch(`${this.baseUrl}/consumer/consent`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${this.apiKey}`,
              'X-Request-Id': `req-${Date.now()}`,
            },
            body: JSON.stringify(requestBody),
            signal: AbortSignal.timeout(30_000),
          });

          if (!response.ok) {
            const errorBody = await response.text();
            throw new Error(`CRIF API error: ${response.status} - ${errorBody}`);
          }

          return response.json() as Promise<CrifApiResponse>;
        }, { maxAttempts: 3, timeoutMs: 30_000 });
      });

      const latencyMs = Date.now() - startTime;
      return this.mapResponse(result, latencyMs);
    } catch (error) {
      const latencyMs = Date.now() - startTime;
      return this.mapError(error as Error, latencyMs);
    }
  }

  private mapResponse(data: CrifApiResponse, latencyMs: number): BureauPullResult {
    if (data.status === 'SUCCESS' && data.consumerReport) {
      return {
        success: true,
        provider: BureauProvider.CRIF,
        score: data.consumerReport.crifScore || null,
        rawResponse: data as unknown as Record<string, unknown>,
        latencyMs,
      };
    }
    return {
      success: false,
      provider: BureauProvider.CRIF,
      errorCode: data.errorCode || 'UNKNOWN',
      errorMessage: data.errorMessage || 'CRIF pull failed',
      latencyMs,
    };
  }

  private mapError(error: Error, latencyMs: number): BureauPullResult {
    this.logger.error(`CRIF pull failed: ${error.message}`);
    return {
      success: false,
      provider: BureauProvider.CRIF,
      errorCode: 'CRIF_ERROR',
      errorMessage: error.message,
      latencyMs,
    };
  }

  getCircuitMetrics() {
    return this.circuitBreaker.getMetrics();
  }
}

interface CrifApiResponse {
  status: 'SUCCESS' | 'FAILED';
  transactionId: string;
  errorCode?: string;
  errorMessage?: string;
  consumerReport?: {
    crifScore: number;
    reportDate: string;
    totalAccounts: number;
    activeAccounts: number;
    totalExposure: number;
    totalEMI: number;
    dpd0to30: number;
    dpd31to60: number;
    dpd61to90: number;
    dpdOver90: number;
  };
}
