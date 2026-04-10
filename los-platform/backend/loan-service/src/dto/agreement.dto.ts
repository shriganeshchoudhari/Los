import { IsString, IsNumber, IsArray, IsBoolean, IsOptional, IsDateString, Min, Max } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';

export class LoanAgreementDto {
  @ApiProperty()
  @IsString()
  applicationNumber: string;

  @ApiProperty()
  @IsString()
  loanAccountNumber: string;

  @ApiProperty()
  @IsString()
  customerName: string;

  @ApiProperty()
  @IsString()
  customerAddress: string;

  @ApiProperty()
  @IsString()
  customerPAN: string;

  @ApiProperty()
  @IsString()
  customerMobile: string;

  @ApiProperty()
  @IsString()
  customerEmail: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  coBorrowerName?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  coBorrowerAddress?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  coBorrowerPAN?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  guarantorName?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  guarantorAddress?: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  guarantorPAN?: string;

  @ApiProperty()
  @IsNumber()
  @Min(10000)
  sanctionedAmount: number;

  @ApiProperty()
  @IsString()
  sanctionedAmountInWords: string;

  @ApiProperty()
  @IsNumber()
  @Min(4)
  @Max(28)
  rateOfInterestPercent: number;

  @ApiProperty()
  @IsNumber()
  rateOfInterestBps: number;

  @ApiProperty()
  @IsNumber()
  @Min(6)
  @Max(360)
  tenureMonths: number;

  @ApiProperty()
  @IsNumber()
  @Min(100)
  emiAmount: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  moratoriumPeriodMonths?: number;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  moratoriumEMI?: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  processingFee: number;

  @ApiProperty()
  @IsDateString()
  agreementDate: string;

  @ApiProperty()
  @IsString()
  agreementNumber: string;

  @ApiProperty()
  @IsString()
  productName: string;

  @ApiProperty()
  @IsString()
  productCode: string;

  @ApiProperty()
  @IsString()
  disbursementAccountNumber: string;

  @ApiProperty()
  @IsString()
  disbursementIFSC: string;

  @ApiProperty()
  @IsString()
  disbursementBankName: string;

  @ApiProperty()
  @IsString()
  branchName: string;

  @ApiProperty()
  @IsString()
  branchAddress: string;

  @ApiProperty()
  @IsString()
  securityDescription: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  insurancePolicyNumber?: string;

  @ApiPropertyOptional()
  @IsNumber()
  @IsOptional()
  insurancePremium?: number;

  @ApiProperty()
  @IsDateString()
  firstEMIDate: string;

  @ApiProperty()
  @IsDateString()
  lastEMIDate: string;

  @ApiProperty()
  @IsString()
  prepaymentPenaltyClause: string;

  @ApiProperty()
  @IsNumber()
  defaultInterestRatePercent: number;

  @ApiProperty()
  @IsNumber()
  bounceCharge: number;

  @ApiProperty()
  @IsBoolean()
  partPaymentAllowed: boolean;

  @ApiProperty()
  @IsNumber()
  @Min(1000)
  partPaymentMinAmount: number;

  @ApiProperty()
  @IsBoolean()
  partPaymentTenureReduction: boolean;

  @ApiProperty()
  @IsBoolean()
  foreclosureAllowed: boolean;

  @ApiProperty()
  @IsNumber()
  foreclosureNoticePeriodDays: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  @Max(5)
  foreclosurePenaltyPercent: number;

  @ApiProperty({ type: [String] })
  @IsArray()
  @IsString({ each: true })
  specialConditions: string[];

  @ApiProperty()
  @IsString()
  jurisdiction: string;

  @ApiProperty()
  @IsString()
  witnessingOfficerName: string;

  @ApiProperty()
  @IsString()
  witnessingOfficerDesignation: string;
}

export class GenerateAgreementDto {
  @ApiProperty()
  @IsString()
  applicationId: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  agreementNumber?: string;
}

export class InitiateESignDto {
  @ApiProperty()
  @IsString()
  applicationId: string;

  @ApiProperty()
  @IsString()
  signerName: string;

  @ApiProperty()
  @IsString()
  signerMobile: string;

  @ApiProperty()
  @IsString()
  signerEmail: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  signerAadhaar?: string;

  @ApiPropertyOptional()
  @IsBoolean()
  @IsOptional()
  preVerified?: boolean;
}

export class VerifyESignDto {
  @ApiProperty()
  @IsString()
  transactionId: string;

  @ApiProperty()
  @IsString()
  otp: string;

  @ApiProperty()
  @IsString()
  aadhaarLast4: string;
}

export class CancelESignDto {
  @ApiProperty()
  @IsString()
  transactionId: string;

  @ApiProperty()
  @IsString()
  reason: string;
}

export class AgreementSigningResultDto {
  @ApiProperty()
  documentId: string;

  @ApiProperty()
  esignTransactionId: string;

  @ApiProperty()
  esignProvider: string;

  @ApiProperty()
  otpSentTo: string;

  @ApiPropertyOptional()
  @IsString()
  @IsOptional()
  signingUrl?: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  expiresAt: Date;
}

export class CreatePolicyVersionDto {
  @ApiProperty()
  @IsString()
  versionName: string;

  @ApiProperty()
  @IsDateString()
  effectiveFrom: string;

  @ApiPropertyOptional()
  @IsDateString()
  @IsOptional()
  effectiveTo?: string;

  @ApiProperty()
  @IsString()
  createdBy: string;

  @ApiPropertyOptional({ type: Object })
  @IsArray()
  @IsOptional()
  ruleOverrides?: { ruleId: string; changes: Record<string, any> }[];
}

export class CloneVersionDto {
  @ApiProperty()
  @IsString()
  sourceVersion: string;

  @ApiProperty()
  @IsString()
  newVersion: string;

  @ApiProperty()
  @IsDateString()
  effectiveFrom: string;

  @ApiProperty()
  @IsString()
  createdBy: string;
}

export class ActivateVersionDto {
  @ApiProperty()
  @IsString()
  version: string;
}

export class CompareVersionsDto {
  @ApiProperty()
  @IsString()
  versionA: string;

  @ApiProperty()
  @IsString()
  versionB: string;
}
