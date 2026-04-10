import {
  IsNotEmpty,
  IsString,
  IsEnum,
  IsOptional,
  IsNumber,
  Min,
  Max,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { KYCStatus } from '../entities/kyc.entity';

export class InitiateAadhaarKycDto {
  @ApiProperty({ description: 'Application ID' })
  @IsNotEmpty()
  @IsString()
  applicationId: string;

  @ApiProperty({ description: 'OTP session ID for consent confirmation' })
  @IsNotEmpty()
  @IsString()
  consentOtpSessionId: string;
}

export class VerifyAadhaarOtpDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  applicationId: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  txnId: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  uidaiRefId: string;

  @ApiProperty({ description: '6-digit OTP from UIDAI' })
  @IsNotEmpty()
  @IsString()
  @Matches(/^\d{6}$/)
  otp: string;
}

export class VerifyPANDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  applicationId: string;

  @ApiProperty({ description: '10-character PAN number' })
  @IsNotEmpty()
  @IsString()
  @Matches(/^[A-Z]{5}[0-9]{4}[A-Z]$/, { message: 'Invalid PAN format' })
  panNumber: string;

  @ApiProperty({ description: 'Full name as on PAN card' })
  @IsNotEmpty()
  @IsString()
  fullName: string;

  @ApiProperty({ description: 'Date of birth in YYYY-MM-DD format' })
  @IsNotEmpty()
  @IsString()
  dob: string;
}

export class FaceMatchDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  applicationId: string;

  @ApiProperty({ description: 'Base64 encoded selfie image' })
  @IsNotEmpty()
  @IsString()
  selfieImageBase64: string;
}

export class AadhaarInitResponseDto {
  @ApiProperty()
  txnId: string;

  @ApiProperty()
  uidaiRefId: string;

  @ApiProperty()
  expiresIn: number;
}

export class KYCStatusResponseDto {
  @ApiProperty()
  kycId: string;

  @ApiProperty({ enum: KYCStatus })
  status: KYCStatus;

  @ApiPropertyOptional()
  overallRiskScore?: number;

  @ApiPropertyOptional()
  aadhaarVerified?: boolean;

  @ApiPropertyOptional()
  panVerified?: boolean;

  @ApiPropertyOptional()
  faceMatched?: boolean;
}

export class OfflineXmlKycDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  applicationId: string;

  @ApiProperty({ description: 'Base64 encoded Aadhaar XML' })
  @IsNotEmpty()
  @IsString()
  xmlContentBase64: string;

  @ApiPropertyOptional({ description: '6-digit share code from Aadhaar letter' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{6}$/)
  shareCode?: string;

  @ApiPropertyOptional({ description: 'Registered mobile for verification' })
  @IsOptional()
  @IsString()
  @Matches(/^[6-9]\d{9}$/)
  mobile?: string;
}

export class OfflineXmlKycResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiPropertyOptional()
  kycId?: string;

  @ApiPropertyOptional()
  error?: string;
}

export class DigiLockerAuthUrlDto {
  @ApiProperty()
  authUrl: string;
}

export class DigiLockerCallbackDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  code: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  state?: string;
}

export class DigiLockerDocumentsDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty()
  documents: DigiLockerDocumentResponseDto[];
}

export class DigiLockerDocumentResponseDto {
  @ApiProperty()
  type: string;

  @ApiProperty()
  issuer: string;

  @ApiProperty()
  fileName: string;

  @ApiPropertyOptional()
  issuedOn?: string;

  @ApiPropertyOptional()
  expiryDate?: string;

  @ApiPropertyOptional()
  extractedData?: Record<string, unknown>;
}

export class KycReuseCheckDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  applicationId: string;

  @ApiProperty({ description: 'SHA-256 hash of Aadhaar number' })
  @IsNotEmpty()
  @IsString()
  aadhaarHash: string;

  @ApiPropertyOptional({ description: 'Masked PAN (e.g., XXXXX1234X)' })
  @IsOptional()
  @IsString()
  panMasked?: string;
}

export class KycReuseCheckResponseDto {
  @ApiProperty()
  canReuse: boolean;

  @ApiPropertyOptional()
  existingKycId?: string;

  @ApiPropertyOptional()
  reuseEligible?: boolean;

  @ApiPropertyOptional()
  validityExpiresAt?: string;

  @ApiPropertyOptional()
  daysRemaining?: number;

  @ApiPropertyOptional()
  reason?: string;
}

export class KycReuseDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  applicationId: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  existingKycId: string;
}

export class KycReuseResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiPropertyOptional()
  reusedKycId?: string;

  @ApiPropertyOptional()
  error?: string;
}

export class ConsentDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  applicationId: string;

  @ApiProperty({ enum: ['KYC_AADHAAR_EKYC', 'CREDIT_BUREAU_PULL', 'DATA_PROCESSING'] })
  @IsNotEmpty()
  @IsString()
  consentType: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  consentText: string;
}
