import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { MinIOService } from './minio.service';
import { OcrProvider, DocumentType } from '../entities/document.entity';
import { OcrParseResultDto } from '../dto/document.dto';

export interface OcrResult {
  provider: string;
  documentType: string;
  extractedData: Record<string, unknown>;
  confidence: number;
  errors: string[];
  rawResponse: Record<string, unknown>;
}

@Injectable()
export class OcrService {
  private readonly logger = new Logger(OcrService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly minIOService: MinIOService,
  ) {}

  async parseDocument(
    objectKey: string,
    documentType: DocumentType,
    mimeType: string,
    providerOverride?: string,
  ): Promise<OcrResult> {
    const provider = this.resolveProvider(providerOverride);
    const documentBuffer = await this.minIOService.getObject(objectKey);

    this.logger.log(`Starting OCR for ${documentType} using ${provider}`);

    try {
      switch (provider) {
        case OcrProvider.KARZA:
          return await this.callKarza(documentBuffer, documentType, mimeType);
        case OcrProvider.SIGNZY:
          return await this.callSignzy(documentBuffer, documentType, mimeType);
        default:
          return this.emptyResult(provider, documentType);
      }
    } catch (error) {
      this.logger.error(`OCR failed for ${documentType}: ${error.message}`);
      return {
        provider,
        documentType,
        extractedData: {},
        confidence: 0,
        errors: [error.message],
        rawResponse: {},
      };
    }
  }

  private resolveProvider(override?: string): OcrProvider {
    if (override) {
      const upper = override.toUpperCase();
      if (upper === 'KARZA') return OcrProvider.KARZA;
      if (upper === 'SIGNZY') return OcrProvider.SIGNZY;
    }
    return OcrProvider.KARZA;
  }

  private async callKarza(
    buffer: Buffer,
    documentType: DocumentType,
    mimeType: string,
  ): Promise<OcrResult> {
    const apiKey = this.configService.get<string>('KARZA_API_KEY');
    if (!apiKey) {
      return this.mockOcrResult(OcrProvider.KARZA, documentType);
    }

    const formData = this.buildKarzaFormData(buffer, documentType, mimeType);
    const response = await this.httpPost(
      this.configService.get<string>('KARZA_API_URL', 'https://api.karza.in/v3'),
      formData,
      apiKey,
    );

    return this.normalizeKarzaResponse(response, documentType);
  }

  private buildKarzaFormData(buffer: Buffer, documentType: DocumentType, mimeType: string): FormData {
    const formData = new FormData();
    formData.append('file', new Blob([buffer], { type: mimeType }), 'document');

    switch (documentType) {
      case DocumentType.PAN:
        formData.append('consent', 'Y');
        formData.append('consent_text', 'I authorize LOS to access my PAN details');
        break;
      case DocumentType.SALARY_SLIP_1:
      case DocumentType.SALARY_SLIP_2:
      case DocumentType.SALARY_SLIP_3:
        formData.append('doc_type', 'salary_slip');
        break;
      case DocumentType.BANK_STATEMENT:
        formData.append('doc_type', 'bank_statement');
        break;
    }

    return formData;
  }

  private normalizeKarzaResponse(response: Record<string, unknown>, documentType: DocumentType): OcrResult {
    const statusCode = response['statusCode'] as number;
    if (statusCode !== 101) {
      return {
        provider: OcrProvider.KARZA,
        documentType,
        extractedData: {},
        confidence: 0,
        errors: [`Karza returned status ${statusCode}: ${response['error'] || 'Unknown error'}`],
        rawResponse: response,
      };
    }

    const result = (response['result'] as Record<string, unknown>) || {};
    const data = (result['data'] as Record<string, unknown>) || {};

    switch (documentType) {
      case DocumentType.PAN:
        return {
          provider: OcrProvider.KARZA,
          documentType,
          extractedData: {
            panNumber: data['pan_number'],
            name: data['name'],
            fathersName: data['fathers_name'],
            dob: data['dob'],
            shareCode: data['share_code'],
          },
          confidence: (result['ocrConfidence'] as number) || 85,
          errors: [],
          rawResponse: response,
        };

      case DocumentType.SALARY_SLIP_1:
      case DocumentType.SALARY_SLIP_2:
      case DocumentType.SALARY_SLIP_3:
        return {
          provider: OcrProvider.KARZA,
          documentType,
          extractedData: {
            grossSalary: data['gross_salary'],
            netSalary: data['net_salary'],
            employerName: data['employer_name'],
            employeeName: data['employee_name'],
            panNumber: data['pan_number'],
            monthYear: data['month_year'],
            deductions: data['deductions'],
          },
          confidence: (result['ocrConfidence'] as number) || 80,
          errors: [],
          rawResponse: response,
        };

      case DocumentType.BANK_STATEMENT:
        return {
          provider: OcrProvider.KARZA,
          documentType,
          extractedData: {
            accountHolderName: data['account_holder_name'],
            accountNumber: data['account_number'],
            ifscCode: data['ifsc_code'],
            averageMonthlyBalance: data['average_monthly_balance'],
            totalCredits: data['total_credits'],
            totalDebits: data['total_debits'],
            salaryCredits: data['salary_credits'],
            emiPayments: data['emi_payments'],
            overdraftLimit: data['overdraft_limit'],
          },
          confidence: (result['ocrConfidence'] as number) || 75,
          errors: [],
          rawResponse: response,
        };

      default:
        return {
          provider: OcrProvider.KARZA,
          documentType,
          extractedData: data,
          confidence: (result['ocrConfidence'] as number) || 60,
          errors: [],
          rawResponse: response,
        };
    }
  }

  private async callSignzy(
    buffer: Buffer,
    documentType: DocumentType,
    mimeType: string,
  ): Promise<OcrResult> {
    const apiKey = this.configService.get<string>('SIGNZY_API_KEY');
    if (!apiKey) {
      return this.mockOcrResult(OcrProvider.SIGNZY, documentType);
    }

    const base64 = buffer.toString('base64');
    const response = await this.httpPostJson(
      this.configService.get<string>('SIGNZY_API_URL', 'https://www.signzy.app/api/v2'),
      {
        mimetype: mimeType,
        data: base64,
        filename: 'document',
      },
      apiKey,
    );

    return this.normalizeSignzyResponse(response, documentType);
  }

  private normalizeSignzyResponse(response: Record<string, unknown>, documentType: DocumentType): OcrResult {
    if (!response['success']) {
      return {
        provider: OcrProvider.SIGNZY,
        documentType,
        extractedData: {},
        confidence: 0,
        errors: [response['error'] as string || 'Signzy processing failed'],
        rawResponse: response,
      };
    }

    const result = (response['result'] as Record<string, unknown>) || {};

    return {
      provider: OcrProvider.SIGNZY,
      documentType,
      extractedData: result['data'] as Record<string, unknown> || {},
      confidence: (result['confidence'] as number) || 75,
      errors: [],
      rawResponse: response,
    };
  }

  private async httpPost(url: string, formData: FormData, apiKey: string): Promise<Record<string, unknown>> {
    const response = await fetch(`${url}/ocr`, {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` },
      body: formData as unknown as BodyInit,
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      throw new Error(`Karza API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  private async httpPostJson(url: string, body: Record<string, unknown>, apiKey: string): Promise<Record<string, unknown>> {
    const response = await fetch(`${url}/documents/ocr`, {
      method: 'POST',
      headers: {
        'Authorization': apiKey,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      throw new Error(`Signzy API error: ${response.status} ${response.statusText}`);
    }

    return response.json();
  }

  private mockOcrResult(provider: OcrProvider, documentType: DocumentType): OcrResult {
    const mockData: Record<DocumentType, Record<string, unknown>> = {
      [DocumentType.PAN]: {
        panNumber: 'XXXXXXXXXX',
        name: 'SAMPLE NAME',
        dob: 'XXXX-XX-XX',
        fathersName: 'FATHER NAME',
      },
      [DocumentType.SALARY_SLIP_1]: {
        grossSalary: 85000,
        netSalary: 72000,
        employerName: 'SAMPLE EMPLOYER PVT LTD',
        employeeName: 'SAMPLE NAME',
        monthYear: 'MAR 2024',
      },
      [DocumentType.SALARY_SLIP_2]: {
        grossSalary: 85000,
        netSalary: 72000,
        employerName: 'SAMPLE EMPLOYER PVT LTD',
        employeeName: 'SAMPLE NAME',
        monthYear: 'FEB 2024',
      },
      [DocumentType.SALARY_SLIP_3]: {
        grossSalary: 85000,
        netSalary: 72000,
        employerName: 'SAMPLE EMPLOYER PVT LTD',
        employeeName: 'SAMPLE NAME',
        monthYear: 'JAN 2024',
      },
      [DocumentType.BANK_STATEMENT]: {
        accountHolderName: 'SAMPLE NAME',
        averageMonthlyBalance: 45000,
        totalCredits: 255000,
        totalDebits: 210000,
        salaryCredits: 255000,
      },
      [DocumentType.AADHAAR_FRONT]: {
        aadhaarNumber: 'XXXX-XXXX-XXXX',
        name: 'SAMPLE NAME',
        dob: 'XX/XX/XXXX',
        address: 'SAMPLE ADDRESS',
      },
      [DocumentType.AADHAAR_BACK]: {
        address: 'SAMPLE ADDRESS',
      },
      [DocumentType.ITR]: {
        itrYear: '2023-24',
        grossIncome: 1020000,
        totalIncome: 980000,
        taxPaid: 12000,
      },
      [DocumentType.FORM_16]: {
        panNumber: 'XXXXXXXXXX',
        employerName: 'SAMPLE EMPLOYER PVT LTD',
        grossSalary: 1020000,
        taxableIncome: 980000,
        taxDeduted: 120000,
      },
      [DocumentType.PASSPORT]: {},
      [DocumentType.VOTER_ID]: {},
      [DocumentType.DRIVING_LICENSE]: {},
      [DocumentType.VEHICLE_RC]: {},
      [DocumentType.PROPERTY_DOCUMENT]: {},
      [DocumentType.NOC]: {},
      [DocumentType.AGREEMENT_TO_SALE]: {},
      [DocumentType.APPROVAL_LETTER]: {},
      [DocumentType.VALUATION_REPORT]: {},
      [DocumentType.PHOTO]: {},
      [DocumentType.SIGNATURE]: {},
      [DocumentType.ADDRESS_PROOF]: {},
      [DocumentType.INCOME_PROOF]: {},
      [DocumentType.IDENTITY_PROOF]: {},
      [DocumentType.OTHER]: {},
    };

    return {
      provider,
      documentType,
      extractedData: mockData[documentType] || {},
      confidence: 70,
      errors: [],
      rawResponse: { mock: true },
    };
  }

  private emptyResult(provider: string, documentType: DocumentType): OcrResult {
    return {
      provider,
      documentType,
      extractedData: {},
      confidence: 0,
      errors: ['No OCR provider configured'],
      rawResponse: {},
    };
  }
}
