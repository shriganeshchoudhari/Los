import {
  IsNotEmpty,
  IsString,
  IsEnum,
  IsOptional,
  IsObject,
  IsNumber,
  IsDateString,
  IsArray,
  ValidateNested,
  Min,
  Max,
  Matches,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { LoanType, ChannelCode, EmploymentType, CustomerSegment } from '../entities/loan-application.entity';

export class AddressDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  line1?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  line2?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  landmark?: string;

  @ApiProperty({ example: 'Pune' })
  @IsNotEmpty()
  @IsString()
  city: string;

  @ApiProperty({ example: 'Pune' })
  @IsNotEmpty()
  @IsString()
  district: string;

  @ApiProperty({ example: 'MH' })
  @IsNotEmpty()
  @IsString()
  @Matches(/^[A-Z]{2}$/)
  state: string;

  @ApiProperty({ example: '411057' })
  @IsNotEmpty()
  @IsString()
  @Matches(/^\d{6}$/)
  pincode: string;

  @ApiPropertyOptional({ example: 'IN' })
  @IsOptional()
  @IsString()
  country?: string;

  @ApiPropertyOptional({ enum: ['PERMANENT', 'CURRENT', 'OFFICE', 'OTHER'] })
  @IsOptional()
  @IsString()
  addressType?: string;
}

export class ApplicantProfileDto {
  @ApiProperty({ example: 'Ravi Sharma' })
  @IsNotEmpty()
  @IsString()
  @MinLength(2)
  fullName: string;

  @ApiProperty({ example: '1990-04-21' })
  @IsNotEmpty()
  @IsDateString()
  dob: string;

  @ApiPropertyOptional({ enum: ['MALE', 'FEMALE', 'TRANSGENDER'] })
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiPropertyOptional({ enum: ['SINGLE', 'MARRIED', 'DIVORCED', 'WIDOWED'] })
  @IsOptional()
  @IsString()
  maritalStatus?: string;

  @ApiProperty({ example: '9876543210' })
  @IsNotEmpty()
  @IsString()
  @Matches(/^[6-9]\d{9}$/)
  mobile: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  email?: string;

  @ApiProperty({ enum: ['RESIDENT_INDIAN', 'NRI', 'OCI', 'PIO'] })
  @IsNotEmpty()
  @IsString()
  residentialStatus: string;

  @ApiPropertyOptional({ type: [AddressDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => AddressDto)
  addresses?: AddressDto[];

  @ApiPropertyOptional({ example: 3 })
  @IsOptional()
  @IsNumber()
  yearsAtCurrentAddress?: number;

  @ApiPropertyOptional({ enum: ['OWNED', 'RENTED', 'PARENTAL', 'COMPANY_PROVIDED'] })
  @IsOptional()
  @IsString()
  ownOrRentedResidence?: string;
}

export class EmploymentDetailsDto {
  @ApiProperty({ enum: EmploymentType })
  @IsNotEmpty()
  @IsEnum(EmploymentType)
  employmentType: EmploymentType;

  @ApiPropertyOptional({ example: 'Infosys Limited' })
  @IsOptional()
  @IsString()
  employerName?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  employerPAN?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  designation?: string;

  @ApiPropertyOptional({ example: 84 })
  @IsOptional()
  @IsNumber()
  totalWorkExperienceMonths?: number;

  @ApiPropertyOptional({ example: 50 })
  @IsOptional()
  @IsNumber()
  currentJobExperienceMonths?: number;

  @ApiProperty({ example: 12000000, description: 'Gross monthly income in Paisa' })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  grossMonthlyIncome: number;

  @ApiProperty({ example: 9500000, description: 'Net monthly income in Paisa' })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  netMonthlyIncome: number;

  @ApiProperty({ example: 144000000, description: 'Total annual income in Paisa' })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  totalAnnualIncome: number;
}

export class LoanRequirementDto {
  @ApiProperty({ enum: LoanType })
  @IsNotEmpty()
  @IsEnum(LoanType)
  loanType: LoanType;

  @ApiProperty({ example: 50000000, description: 'Requested amount in Paisa' })
  @IsNotEmpty()
  @IsNumber()
  @Min(100000)
  requestedAmount: number;

  @ApiProperty({ example: 36, description: 'Requested tenure in months' })
  @IsNotEmpty()
  @IsNumber()
  @Min(1)
  @Max(360)
  requestedTenureMonths: number;

  @ApiPropertyOptional({ example: 'Medical emergency' })
  @IsOptional()
  @IsString()
  purposeDescription?: string;

  @ApiPropertyOptional({ example: 15, description: 'Preferred EMI date (1-28)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(28)
  preferredEmiDate?: number;
}

export class CreateApplicationDto {
  @ApiProperty({ enum: LoanType })
  @IsNotEmpty()
  @IsEnum(LoanType)
  loanType: LoanType;

  @ApiProperty({ enum: ChannelCode })
  @IsNotEmpty()
  @IsEnum(ChannelCode)
  channelCode: ChannelCode;

  @ApiPropertyOptional({ example: 'MH001' })
  @IsOptional()
  @IsString()
  branchCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  dsaCode?: string;

  @ApiProperty({ type: ApplicantProfileDto })
  @IsNotEmpty()
  @IsObject()
  @ValidateNested()
  @Type(() => ApplicantProfileDto)
  applicant: ApplicantProfileDto;

  @ApiProperty({ type: EmploymentDetailsDto })
  @IsNotEmpty()
  @IsObject()
  @ValidateNested()
  @Type(() => EmploymentDetailsDto)
  employmentDetails: EmploymentDetailsDto;

  @ApiProperty({ type: LoanRequirementDto })
  @IsNotEmpty()
  @IsObject()
  @ValidateNested()
  @Type(() => LoanRequirementDto)
  loanRequirement: LoanRequirementDto;
}

export class UpdateApplicationDto {
  @ApiProperty({ enum: ['APPLICANT', 'EMPLOYMENT', 'LOAN_REQUIREMENT', 'COLLATERAL'] })
  @IsNotEmpty()
  @IsString()
  section: string;

  @ApiProperty()
  @IsNotEmpty()
  @IsObject()
  data: Record<string, any>;

  @ApiProperty({ example: 1 })
  @IsNotEmpty()
  @IsNumber()
  version: number;
}

export class ApplicationResponseDto {
  @ApiProperty()
  applicationId: string;

  @ApiProperty({ example: 'LOS-2024-MH-000001' })
  applicationNumber: string;

  @ApiProperty({ enum: ApplicationStatus })
  status: ApplicationStatus;

  @ApiPropertyOptional()
  nextStep?: string;

  @ApiProperty()
  createdAt: string;
}

export class ApplicationSummaryDto {
  @ApiProperty()
  applicationId: string;

  @ApiProperty()
  applicationNumber: string;

  @ApiProperty({ enum: ApplicationStatus })
  status: ApplicationStatus;

  @ApiProperty({ enum: LoanType })
  loanType: LoanType;

  @ApiProperty()
  applicantName: string;

  @ApiProperty()
  requestedAmount: number;

  @ApiPropertyOptional()
  sanctionedAmount?: number;

  @ApiPropertyOptional()
  nextStep?: string;

  @ApiPropertyOptional()
  pendingDocuments?: string[];

  @ApiPropertyOptional()
  submittedAt?: string;

  @ApiProperty()
  lastUpdatedAt: string;
}

export class CoApplicantDto {
  @ApiProperty()
  @IsString()
  name: string;

  @ApiProperty()
  @IsString()
  @Matches(/^[6-9]\d{9}$/)
  mobile: string;

  @ApiProperty()
  @IsString()
  @Matches(/^[A-Z]{5}[0-9]{4}[A-Z]$/)
  panNumber: string;

  @ApiPropertyOptional()
  @IsString()
  relationship?: string;

  @ApiPropertyOptional()
  @IsNumber()
  grossMonthlyIncome?: number;

  @ApiPropertyOptional()
  @IsNumber()
  netMonthlyIncome?: number;
}

export class CollateralDto {
  @ApiProperty()
  @IsString()
  collateralType: string;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  marketValue: number;

  @ApiPropertyOptional()
  @IsString()
  address?: string;

  @ApiPropertyOptional()
  @IsString()
  documentRef?: string;
}

export class AutoSaveDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  applicantProfile?: Partial<ApplicantProfileDto>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  employmentDetails?: Partial<employmentDetailsDto>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  loanRequirement?: Partial<LoanRequirementDto>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CoApplicantDto)
  coApplicants?: CoApplicantDto[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsObject()
  collateral?: CollateralDto;
}

export class AutoSaveResponseDto {
  @ApiProperty()
  savedAt: string;

  @ApiProperty({ type: [String] })
  dirtySections: string[];

  @ApiProperty()
  version: number;
}

export class FoirCalculationResultDto {
  @ApiProperty()
  netMonthlyIncome: number;

  @ApiProperty()
  existingEmi: number;

  @ApiProperty()
  newEmi: number;

  @ApiProperty()
  totalEmi: number;

  @ApiProperty()
  foir: number;

  @ApiProperty()
  foirPercent: number;

  @ApiProperty()
  maxEligibleAmount: number;

  @ApiProperty()
  maxEligibleTenure: number;

  @ApiProperty()
  monthlyRateBps: number;
}
