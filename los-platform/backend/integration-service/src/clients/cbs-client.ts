import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as soap from 'soap';
import { XMLParser } from 'fast-xml-parser';
import { CircuitBreaker, CircuitOpenError, DEFAULT_CIRCUIT_BREAKER_CONFIG } from '../utils/circuit-breaker';
import { CBSCustomerCreateDto, CBSLoanAccountCreateDto } from '../dto/payment.dto';

export interface CBSCustomerResponse {
  customerId: string;
  cifNumber: string;
  relationshipId: string;
  status: string;
  openedAt: string;
  errorCode?: string;
  errorMessage?: string;
}

export interface CBSLoanAccountResponse {
  accountId: string;
  accountNumber: string;
  status: string;
  interestRate: number;
  tenureMonths: number;
  emiAmount: number;
  firstEMIDate: string;
  lastEMIDate: string;
  errorCode?: string;
  errorMessage?: string;
}

export interface CBSError {
  code: string;
  message: string;
  field?: string;
}

@Injectable()
export class CBSClient {
  private readonly logger = new Logger(CBSClient.name);
  private readonly circuitBreaker: CircuitBreaker;
  private soapClient: soap.Client | null = null;
  private wsdlCacheTime = 0;
  private readonly wsdlCacheTtlMs = 24 * 60 * 60 * 1000;

  constructor(
    private readonly configService: ConfigService,
  ) {
    this.circuitBreaker = new CircuitBreaker({
      ...DEFAULT_CIRCUIT_BREAKER_CONFIG,
      failureThreshold: 5,
      timeout: 30_000,
      openDuration: 60_000,
    });
  }

  private async getSoapClient(): Promise<soap.Client> {
    const now = Date.now();
    if (this.soapClient && (now - this.wsdlCacheTime) < this.wsdlCacheTtlMs) {
      return this.soapClient;
    }

    const wsdlUrl = this.configService.get<string>('CBS_WSDL_URL', 'http://localhost:8080/finacle/wsdl');
    const username = this.configService.get<string>('CBS_USERNAME');
    const password = this.configService.get<string>('CBS_PASSWORD');

    this.logger.log(`Initializing CBS SOAP client with WSDL: ${wsdlUrl}`);

    return new Promise((resolve, reject) => {
      soap.createClient(wsdlUrl, {
        wsdl_options: {
          timeout: 30_000,
        },
        soap_options: {
          envelope_attributes: {
            'xmlns:cus': 'http://www.finacle.com/customer',
            'xmlns:loan': 'http://www.finacle.com/loan',
          },
        },
      }, (err, client) => {
        if (err) {
          this.logger.error(`CBS SOAP client creation failed: ${err.message}`);
          reject(err);
          return;
        }

        if (!client) {
          reject(new Error('SOAP client is undefined'));
          return;
        }

        if (username && password) {
          client.setSecurity(new soap.BasicAuthSecurity(username, password));
        }

        this.soapClient = client;
        this.wsdlCacheTime = now;
        this.logger.log('CBS SOAP client initialized successfully');
        resolve(client);
      });
    });
  }

  async createCustomer(dto: CBSCustomerCreateDto): Promise<CBSCustomerResponse> {
    return this.circuitBreaker.execute(async () => {
      const client = await this.getSoapClient();
      const startTime = Date.now();

      const cbsRequest = {
        CustomerAddRequest: {
          'cus:CustomerAddReq': {
            'cus:custId': {
              'cus:coreCustomerId': '',
            },
            'cus:custName': {
              'cus:firstName': dto.firstName,
              'cus:lastName': dto.lastName,
            },
            'cus:custDtls': {
              'cus:dateOfBirth': dto.dateOfBirth,
              'cus:gender': dto.gender,
            },
            'cus:custPersonType': dto.customerType,
            'cus:AddressDtls': {
              'cus:AddressRec': {
                'cus:addressLine1': dto.addressLine1,
                'cus:city': dto.city,
                'cus:state': dto.state,
                'cus:pinCode': dto.pincode,
                'cus:addressType': 'PERMANENT',
              },
            },
            'cus:IdentityDtls': {
              'cus:IdentityRec': {
                'cus:identityType': 'PAN',
                'cus:identityNum': this.maskPan(dto.panNumber),
              },
            },
            'cus:ContactDtls': {
              'cus:ContactRec': {
                'cus:phoneType': 'MOBILE',
                'cus:phoneNum': dto.mobileNumber,
                'cus:emailId': dto.emailId,
              },
            },
          },
        },
      };

      const result = await this.invokeWithTimeout(
        client.CustomerService,
        'addCustomer',
        [cbsRequest],
      );

      const latencyMs = Date.now() - startTime;
      this.logger.log(`CBS createCustomer completed in ${latencyMs}ms`);

      return this.mapCustomerResponse(result, dto.panNumber);
    });
  }

  async createLoanAccount(dto: CBSLoanAccountCreateDto): Promise<CBSLoanAccountResponse> {
    return this.circuitBreaker.execute(async () => {
      const client = await this.getSoapClient();
      const startTime = Date.now();

      const loanRequest = {
        LoanAccountRequest: {
          'loan:LoanAccountAddReq': {
            'loan:customerId': dto.cbsCustomerId,
            'loan:productCode': dto.productCode,
            'loan:sanctionAmount': dto.sanctionedAmount,
            'loan:tenureMonths': dto.tenureMonths,
            'loan:interestRate': dto.interestRate,
            'loan:disbursementAccount': {
              'loan:accountNumber': dto.disbursementAccountNumber,
              'loan:ifscCode': dto.disbursementIfsc,
            },
            'loan:disbursementDate': dto.disbursementDate,
            'loan:loanPurpose': dto.purposeOfLoan || 'LOAN',
            'loan:branchCode': dto.branchCode || 'HO',
            'loan:applicationId': dto.applicationId,
          },
        },
      };

      const result = await this.invokeWithTimeout(
        client.LoanService,
        'createLoanAccount',
        [loanRequest],
      );

      const latencyMs = Date.now() - startTime;
      this.logger.log(`CBS createLoanAccount completed in ${latencyMs}ms`);

      return this.mapLoanAccountResponse(result, dto.applicationId);
    });
  }

  private async invokeWithTimeout(
    service: unknown,
    method: string,
    args: unknown[],
    timeoutMs = 30_000,
  ): Promise<unknown> {
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => {
        reject(new Error(`CBS SOAP call timed out after ${timeoutMs}ms`));
      }, timeoutMs);

      (service as Record<string, Function>)[method](...args, (err: Error | null, result: unknown) => {
        clearTimeout(timer);
        if (err) {
          reject(err);
        } else {
          resolve(result);
        }
      });
    });
  }

  private mapCustomerResponse(result: unknown, panForValidation: string): CBSCustomerResponse {
    try {
      const xmlResult = result as Record<string, unknown>;
      const responseBody = xmlResult?.CustomerAddResponse?.CustomerAddResponse;

      if (!responseBody) {
        return {
          customerId: '',
          cifNumber: '',
          relationshipId: '',
          status: 'FAILED',
          openedAt: '',
          errorCode: 'PARSE_ERROR',
          errorMessage: 'Unexpected CBS response format',
        };
      }

      const statusCode = responseBody?.statusCode as string;
      if (statusCode !== 'SUCCESS') {
        return {
          customerId: '',
          cifNumber: '',
          relationshipId: '',
          status: 'FAILED',
          openedAt: '',
          errorCode: responseBody?.errorCode as string || 'CBS_ERROR',
          errorMessage: responseBody?.errorMessage as string || 'Customer creation failed',
        };
      }

      return {
        customerId: responseBody?.customerId as string || '',
        cifNumber: responseBody?.cifNumber as string || '',
        relationshipId: responseBody?.relationshipId as string || '',
        status: statusCode,
        openedAt: responseBody?.openedAt as string || new Date().toISOString(),
      };
    } catch (err) {
      return {
        customerId: '',
        cifNumber: '',
        relationshipId: '',
        status: 'FAILED',
        openedAt: '',
        errorCode: 'MAPPING_ERROR',
        errorMessage: (err as Error).message,
      };
    }
  }

  private mapLoanAccountResponse(result: unknown, applicationId: string): CBSLoanAccountResponse {
    try {
      const xmlResult = result as Record<string, unknown>;
      const responseBody = xmlResult?.LoanAccountResponse?.LoanAccountResponse;

      if (!responseBody) {
        return {
          accountId: '',
          accountNumber: '',
          status: 'FAILED',
          interestRate: 0,
          tenureMonths: 0,
          emiAmount: 0,
          firstEMIDate: '',
          lastEMIDate: '',
          errorCode: 'PARSE_ERROR',
          errorMessage: 'Unexpected CBS loan response format',
        };
      }

      const statusCode = responseBody?.statusCode as string;
      if (statusCode !== 'SUCCESS') {
        return {
          accountId: '',
          accountNumber: '',
          status: 'FAILED',
          interestRate: 0,
          tenureMonths: 0,
          emiAmount: 0,
          firstEMIDate: '',
          lastEMIDate: '',
          errorCode: responseBody?.errorCode as string || 'CBS_ERROR',
          errorMessage: responseBody?.errorMessage as string || 'Loan account creation failed',
        };
      }

      return {
        accountId: responseBody?.accountId as string || '',
        accountNumber: responseBody?.accountNumber as string || '',
        status: statusCode,
        interestRate: parseFloat(responseBody?.interestRate as string || '0'),
        tenureMonths: parseInt(responseBody?.tenureMonths as string || '0', 10),
        emiAmount: parseFloat(responseBody?.emiAmount as string || '0'),
        firstEMIDate: responseBody?.firstEMIDate as string || '',
        lastEMIDate: responseBody?.lastEMIDate as string || '',
      };
    } catch (err) {
      return {
        accountId: '',
        accountNumber: '',
        status: 'FAILED',
        interestRate: 0,
        tenureMonths: 0,
        emiAmount: 0,
        firstEMIDate: '',
        lastEMIDate: '',
        errorCode: 'MAPPING_ERROR',
        errorMessage: (err as Error).message,
      };
    }
  }

  private maskPan(pan: string): string {
    if (!pan || pan.length < 5) return 'XXXXX';
    return pan.substring(0, 5).toUpperCase() + 'XXXX';
  }

  getCircuitState() {
    return this.circuitBreaker.getState();
  }

  getCircuitMetrics() {
    return this.circuitBreaker.getMetrics();
  }
}
