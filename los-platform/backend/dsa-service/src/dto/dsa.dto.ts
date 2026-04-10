import {
  IsNotEmpty,
  IsString,
  IsEnum,
  IsOptional,
  IsArray,
  IsNumber,
  Min,
  Max,
  Matches,
  MinLength,
  MaxLength,
  IsEmail,
  IsPhoneNumber,
  IsUrl,
  ValidateNested,
  IsBoolean,
  IsDateString,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { DSAPartnerType, DSAPartnerStatus, CommissionType } from '../entities/dsa.entity';

export class RegisterPartnerDto {
  @ApiProperty({ example: 'Financial Advisors Pvt Ltd', description: 'Registered business name' })
  @IsNotEmpty()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  partnerName: string;

  @ApiProperty({ enum: DSAPartnerType, example: DSAPartnerType.PRIVATE_LIMITED })
  @IsNotEmpty()
  @IsEnum(DSAPartnerType)
  partnerType: DSAPartnerType;

  @ApiProperty({ example: 'AABCF1234F' })
  @IsNotEmpty()
  @IsString()
  @Matches(/^[A-Z]{5}[0-9]{4}[A-Z]$/, { message: 'Invalid PAN format' })
  pan: string;

  @ApiPropertyOptional({ example: '27AABCF1234F1ZB' })
  @IsOptional()
  @IsString()
  @Matches(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, { message: 'Invalid GSTIN format' })
  gstin?: string;

  @ApiProperty({ example: '123 Main Road, Andheri West, Mumbai - 400053' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(500)
  registeredAddress: string;

  @ApiProperty({ example: 'Mumbai' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(50)
  city: string;

  @ApiProperty({ example: 'MH' })
  @IsNotEmpty()
  @IsString()
  @Matches(/^[A-Z]{2}$/)
  state: string;

  @ApiProperty({ example: '400053' })
  @IsNotEmpty()
  @IsString()
  @Matches(/^\d{6}$/)
  pincode: string;

  @ApiProperty({ example: 'Rajesh Kumar', description: 'Primary contact person name' })
  @IsNotEmpty()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  contactName: string;

  @ApiProperty({ example: '9876543210' })
  @IsNotEmpty()
  @IsString()
  @Matches(/^[6-9]\d{9}$/, { message: 'Invalid mobile number' })
  contactMobile: string;

  @ApiProperty({ example: 'rajesh@finadvisors.com' })
  @IsNotEmpty()
  @IsEmail()
  contactEmail: string;

  @ApiProperty({ example: 'SBIN0001234' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(30)
  primaryBankAccount: string;

  @ApiProperty({ example: 'SBIN0001234' })
  @IsNotEmpty()
  @IsString()
  @Matches(/^[A-Z]{4}0[A-Z0-9]{6}$/, { message: 'Invalid IFSC code' })
  primaryIfsc: string;

  @ApiProperty({ example: 'Rajesh Kumar', description: 'Bank account holder name' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(200)
  bankAccountHolder: string;

  @ApiPropertyOptional({ enum: CommissionType, default: CommissionType.HYBRID })
  @IsOptional()
  @IsEnum(CommissionType)
  commissionType?: CommissionType;

  @ApiPropertyOptional({ description: 'Territory codes (state codes)', example: ['MH', 'GJ', 'RJ'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  territoryCodes?: string[];

  @ApiPropertyOptional({ description: 'Allowed loan product codes', example: ['PL', 'BL', 'HL'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedProducts?: string[];

  @ApiPropertyOptional({ description: 'Min loan amount for commission', default: 50000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  minLoanAmount?: number;

  @ApiPropertyOptional({ description: 'Max loan amount for commission', default: 50000000 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxLoanAmount?: number;
}

export class PartnerRegistrationResponseDto {
  @ApiProperty()
  partnerId: string;

  @ApiProperty()
  partnerCode: string;

  @ApiProperty({ example: DSAPartnerStatus.PENDING_APPROVAL })
  status: DSAPartnerStatus;

  @ApiProperty()
  message: string;
}

export class PartnerApprovalDto {
  @ApiProperty({ example: 'APPROVED', enum: [DSAPartnerStatus.APPROVED, DSAPartnerStatus.REJECTED] })
  @IsNotEmpty()
  @IsEnum([DSAPartnerStatus.APPROVED, DSAPartnerStatus.REJECTED])
  status: DSAPartnerStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  rejectionReason?: string;

  @ApiPropertyOptional({ description: 'Upfront commission in basis points (e.g., 150 = 1.5%)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(500)
  upfrontCommissionBps?: number;

  @ApiPropertyOptional({ description: 'Trail commission in basis points per annum' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(200)
  trailCommissionBps?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  remarks?: string;
}

export class DSALoginDto {
  @ApiProperty({ example: 'DSA001' })
  @IsNotEmpty()
  @IsString()
  partnerCode: string;

  @ApiProperty({ example: 'SecurePass@123' })
  @IsNotEmpty()
  @IsString()
  password: string;

  @ApiPropertyOptional({ example: '192.168.1.1' })
  @IsOptional()
  @IsString()
  ipAddress?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  userAgent?: string;
}

export class DSALoginResponseDto {
  @ApiProperty()
  accessToken: string;

  @ApiProperty()
  refreshToken: string;

  @ApiProperty()
  expiresIn: number;

  @ApiProperty()
  partnerId: string;

  @ApiProperty()
  partnerCode: string;

  @ApiProperty()
  partnerName: string;

  @ApiProperty()
  role: string;
}

export class CreateOfficerDto {
  @ApiProperty({ example: 'John DSoula' })
  @IsNotEmpty()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  fullName: string;

  @ApiProperty({ example: '9876543210' })
  @IsNotEmpty()
  @IsString()
  @Matches(/^[6-9]\d{9}$/)
  mobile: string;

  @ApiProperty({ example: 'john.dsouza@finadvisors.com' })
  @IsNotEmpty()
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Relationship Manager' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  designation: string;

  @ApiPropertyOptional({ example: 'Sales' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  department?: string;

  @ApiPropertyOptional({ example: ['MH', 'GJ'], description: 'Territory codes' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  territoryCodes?: string[];

  @ApiPropertyOptional({ example: ['PL', 'BL'], description: 'Allowed products' })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  allowedProducts?: string[];

  @ApiPropertyOptional({ description: 'Max loan amount officer can sanction', default: 0 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  maxSanctionAuthority?: number;
}

export class OfficerResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  employeeCode: string;

  @ApiProperty()
  fullName: string;

  @ApiProperty()
  designation: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  maxSanctionAuthority: number;

  @ApiProperty()
  totalApplications: number;

  @ApiProperty()
  totalDisbursements: number;
}

export class CreateDSAApplicationDto {
  @ApiProperty({ example: 'Priya Patel' })
  @IsNotEmpty()
  @IsString()
  @MinLength(2)
  @MaxLength(200)
  customerName: string;

  @ApiProperty({ example: '9876543210' })
  @IsNotEmpty()
  @IsString()
  @Matches(/^[6-9]\d{9}$/)
  customerMobile: string;

  @ApiPropertyOptional({ example: 'ABCDE1234F' })
  @IsOptional()
  @IsString()
  @Matches(/^[A-Z]{5}[0-9]{4}[A-Z]$/, { message: 'Invalid PAN format' })
  customerPan?: string;

  @ApiProperty({ example: 'PL', description: 'Loan product code: PL, BL, HL, LAP, AL, EL, SL, TL' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(30)
  loanType: string;

  @ApiProperty({ example: 500000 })
  @IsNotEmpty()
  @IsNumber()
  @Min(10000)
  requestedAmount: number;

  @ApiProperty({ example: 36, description: 'Requested tenure in months' })
  @IsNotEmpty()
  @IsNumber()
  @Min(6)
  @Max(360)
  requestedTenureMonths: number;

  @ApiPropertyOptional({ example: 'debt_consolidation' })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  purpose?: string;

  @ApiPropertyOptional({ example: 'fbclid=abc123' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  utmSource?: string;

  @ApiPropertyOptional({ example: 'social' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  utmMedium?: string;

  @ApiPropertyOptional({ example: 'campaign_summer_2024' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  utmCampaign?: string;

  @ApiPropertyOptional({ example: 'existing_customer_5678' })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  sourceLeadId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  remarks?: string;
}

export class DSAApplicationResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  applicationNumber: string;

  @ApiProperty()
  customerName: string;

  @ApiProperty()
  loanType: string;

  @ApiProperty()
  requestedAmount: number;

  @ApiProperty()
  requestedTenureMonths: number;

  @ApiProperty()
  status: string;

  @ApiProperty()
  officerId: string;

  @ApiProperty()
  createdAt: Date;
}

export class DSADashboardDto {
  @ApiProperty()
  partnerId: string;

  @ApiProperty()
  partnerName: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  totalApplications: number;

  @ApiProperty()
  submittedApplications: number;

  @ApiProperty()
  approvedApplications: number;

  @ApiProperty()
  disbursedApplications: number;

  @ApiProperty()
  rejectedApplications: number;

  @ApiProperty()
  totalDisbursedAmount: number;

  @ApiProperty()
  totalCommissionEarned: number;

  @ApiProperty()
  totalCommissionPaid: number;

  @ApiProperty()
  pendingCommission: number;

  @ApiProperty()
  conversionRate: number;

  @ApiProperty()
  disbursementRate: number;

  @ApiPropertyOptional()
  monthlyTrend?: {
    month: string;
    applications: number;
    disbursed: number;
    commission: number;
  }[];

  @ApiPropertyOptional()
  officerStats?: {
    officerId: string;
    officerName: string;
    applications: number;
    disbursements: number;
  }[];
}

export class CommissionSummaryDto {
  @ApiProperty()
  partnerId: string;

  @ApiProperty()
  totalEarned: number;

  @ApiProperty()
  totalTDS: number;

  @ApiProperty()
  totalGST: number;

  @ApiProperty()
  totalPaid: number;

  @ApiProperty()
  pendingPayout: number;

  @ApiProperty()
  lastPayoutDate: Date | null;

  @ApiProperty()
  lastPayoutAmount: number;
}

export class CommissionDetailDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  applicationId: string;

  @ApiProperty()
  loanApplicationId: string;

  @ApiProperty()
  loanType: string;

  @ApiProperty()
  disbursedAmount: number;

  @ApiProperty()
  commissionType: CommissionType;

  @ApiProperty()
  commissionRateBps: number;

  @ApiProperty()
  commissionAmount: number;

  @ApiProperty()
  gstAmount: number;

  @ApiProperty()
  tdsAmount: number;

  @ApiProperty()
  netPayable: number;

  @ApiProperty()
  disbursementDate: Date;

  @ApiProperty()
  payoutMonth: string;

  @ApiProperty()
  status: string;

  @ApiProperty()
  processedAt: Date | null;
}

export class PartnerListQueryDto {
  @ApiPropertyOptional({ enum: DSAPartnerStatus })
  @IsOptional()
  @IsEnum(DSAPartnerStatus)
  status?: DSAPartnerStatus;

  @ApiPropertyOptional({ enum: DSAPartnerType })
  @IsOptional()
  @IsEnum(DSAPartnerType)
  partnerType?: DSAPartnerType;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  page?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  size?: number;
}

export class PartnerDetailDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  partnerCode: string;

  @ApiProperty()
  partnerName: string;

  @ApiProperty()
  partnerType: DSAPartnerType;

  @ApiProperty()
  status: DSAPartnerStatus;

  @ApiProperty()
  contactName: string;

  @ApiProperty()
  contactMobile: string;

  @ApiProperty()
  contactEmail: string;

  @ApiProperty()
  city: string;

  @ApiProperty()
  state: string;

  @ApiProperty()
  commissionType: CommissionType;

  @ApiProperty()
  upfrontCommissionBps: number;

  @ApiProperty()
  trailCommissionBps: number;

  @ApiProperty()
  territoryCodes: string[];

  @ApiProperty()
  allowedProducts: string[];

  @ApiProperty()
  totalApplications: number;

  @ApiProperty()
  totalDisbursements: number;

  @ApiProperty()
  totalDisbursedAmount: number;

  @ApiProperty()
  totalCommissionPaid: number;

  @ApiProperty()
  agreementValidFrom: Date | null;

  @ApiProperty()
  agreementValidTo: Date | null;

  @ApiProperty()
  createdAt: Date;

  @ApiProperty()
  updatedAt: Date;
}

export class DSASetPasswordDto {
  @ApiProperty({ example: 'SecurePass@123' })
  @IsNotEmpty()
  @IsString()
  @MinLength(8)
  @MaxLength(50)
  password: string;

  @ApiProperty({ example: 'SecurePass@123' })
  @IsNotEmpty()
  @IsString()
  confirmPassword: string;
}

export class RefreshTokenDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  refreshToken: string;
}
