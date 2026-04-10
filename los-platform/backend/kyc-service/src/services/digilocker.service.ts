import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createError } from '@los/common';

export enum DigiLockerDocumentType {
  PAN = 'PAN',
  DRIVING_LICENSE = 'DRIVING_LICENSE',
  VEHICLE_RC = 'VEHICLE_RC',
  AADHAAR = 'AADHAAR',
  PASSPORT = 'PASSPORT',
  ITR = 'ITR',
}

export interface DigiLockerDocument {
  type: DigiLockerDocumentType;
  issuer: string;
  uri: string;
  fileName: string;
  mimeType: string;
  issuedOn?: string;
  expiryDate?: string;
  extractedData?: Record<string, unknown>;
}

export interface DigiLockerFetchResult {
  success: boolean;
  documents: DigiLockerDocument[];
  accessToken?: string;
  error?: string;
}

@Injectable()
export class DigiLockerService {
  private readonly logger = new Logger(DigiLockerService.name);
  private readonly clientId: string;
  private readonly clientSecret: string;
  private readonly redirectUri: string;
  private readonly baseUrl = 'https://api.digitallocker.gov.in/public/1';
  private readonly oauthUrl = 'https://api.digitallocker.gov.in/public/oauth2/1';

  constructor(private readonly configService: ConfigService) {
    this.clientId = this.configService.get<string>('DIGILOCKER_CLIENT_ID', '');
    this.clientSecret = this.configService.get<string>('DIGILOCKER_CLIENT_SECRET', '');
    this.redirectUri = this.configService.get<string>('DIGILOCKER_REDIRECT_URI', 'https://los.losbank.in/auth/digilocker/callback');
  }

  async getAuthorizationUrl(state: string): Promise<string> {
    const params = new URLSearchParams({
      response_type: 'code',
      client_id: this.clientId,
      redirect_uri: this.redirectUri,
      state,
      purpose: 'LOS_KYC_DOCUMENT_FETCH',
    });

    return `${this.oauthUrl}/authorize?${params.toString()}`;
  }

  async exchangeCodeForToken(code: string): Promise<{ accessToken: string; refreshToken: string }> {
    if (!this.clientId) {
      throw createError('KYC_009', 'DigiLocker integration not configured');
    }

    const response = await fetch(`${this.oauthUrl}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        redirect_uri: this.redirectUri,
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }),
      signal: AbortSignal.timeout(15000),
    });

    if (!response.ok) {
      throw createError('KYC_010', `DigiLocker token exchange failed: ${response.status}`);
    }

    const data = await response.json() as any;
    return {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
    };
  }

  async fetchDocuments(accessToken: string): Promise<DigiLockerFetchResult> {
    try {
      const response = await fetch(`${this.baseUrl}/documents`, {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Accept': 'application/json',
        },
        signal: AbortSignal.timeout(15000),
      });

      if (!response.ok) {
        if (response.status === 401) {
          throw createError('KYC_011', 'DigiLocker access token expired');
        }
        throw createError('KYC_012', `DigiLocker document fetch failed: ${response.status}`);
      }

      const data = await response.json() as any;
      const documents: DigiLockerDocument[] = (data.documents || []).map((doc: any) => ({
        type: this.mapDocType(doc.doctype || doc.type),
        issuer: doc.issuer || 'DigiLocker',
        uri: doc.uri || doc.url,
        fileName: doc.name || doc.filename || `document_${Date.now()}`,
        mimeType: doc.mimeType || 'application/pdf',
        issuedOn: doc.issuedOn,
        expiryDate: doc.expiryDate,
        extractedData: doc.extractedData,
      }));

      return { success: true, documents, accessToken };
    } catch (error) {
      this.logger.error(`DigiLocker fetch failed: ${error.message}`);
      return { success: false, documents: [], error: error.message };
    }
  }

  async downloadDocument(accessToken: string, documentUri: string): Promise<Buffer> {
    const response = await fetch(documentUri, {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
      signal: AbortSignal.timeout(30000),
    });

    if (!response.ok) {
      throw createError('KYC_013', `DigiLocker document download failed: ${response.status}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    return Buffer.from(arrayBuffer);
  }

  async refreshAccessToken(refreshToken: string): Promise<string> {
    const response = await fetch(`${this.oauthUrl}/token`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
        client_id: this.clientId,
        client_secret: this.clientSecret,
      }),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw createError('KYC_014', 'DigiLocker token refresh failed');
    }

    const data = await response.json() as any;
    return data.access_token;
  }

  async fetchPan(accessToken: string): Promise<DigiLockerDocument | null> {
    const result = await this.fetchDocuments(accessToken);
    if (!result.success) return null;

    const panDoc = result.documents.find((d) => d.type === DigiLockerDocumentType.PAN);
    return panDoc || null;
  }

  async fetchDrivingLicense(accessToken: string): Promise<DigiLockerDocument | null> {
    const result = await this.fetchDocuments(accessToken);
    if (!result.success) return null;

    const dlDoc = result.documents.find((d) => d.type === DigiLockerDocumentType.DRIVING_LICENSE);
    return dlDoc || null;
  }

  private mapDocType(docType: string): DigiLockerDocumentType {
    const typeMap: Record<string, DigiLockerDocumentType> = {
      'PAN': DigiLockerDocumentType.PAN,
      'Driving License': DigiLockerDocumentType.DRIVING_LICENSE,
      'DL': DigiLockerDocumentType.DRIVING_LICENSE,
      'Vehicle RC': DigiLockerDocumentType.VEHICLE_RC,
      'RC': DigiLockerDocumentType.VEHICLE_RC,
      'Aadhaar': DigiLockerDocumentType.AADHAAR,
      'Passport': DigiLockerDocumentType.PASSPORT,
      'ITR': DigiLockerDocumentType.ITR,
    };

    return typeMap[docType?.toUpperCase()] || DigiLockerDocumentType.PAN;
  }
}
