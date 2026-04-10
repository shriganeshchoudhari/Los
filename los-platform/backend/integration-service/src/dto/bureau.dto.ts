import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsNumber,
  IsBoolean,
  IsUUID,
  IsArray,
  ValidateNested,
  Min,
  Max,
  IsDateString,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { BureauProvider } from '../entities/bureau.entity';

export class BureauConsentDto {
  @ApiProperty({ description: 'Application ID' })
  @IsUUID()
  @IsNotEmpty()
  applicationId: string;

  @ApiProperty({ description: 'Applicant ID' })
  @IsUUID()
  @IsNotEmpty()
  applicantId: string;

  @ApiProperty({ description: 'SHA-256 hash of PAN number' })
  @IsString()
  @IsNotEmpty()
  panHash: string;

  @ApiProperty({ description: 'OTP entered by customer for consent', minLength: 6, maxLength: 6 })
  @IsString()
  @IsNotEmpty()
  @Min(100000)
  @Max(999999)
  consentOtp: string;

  @ApiPropertyOptional({ description: 'Providers to pull from', enum: BureauProvider, isArray: true })
  @IsOptional()
  @IsArray()
  @IsEnum(BureauProvider, { each: true })
  providers?: BureauProvider[];
}

export class BureauPullRequestDto {
  @ApiProperty({ enum: BureauProvider })
  @IsEnum(BureauProvider)
  provider: BureauProvider;

  @ApiProperty({ description: 'SHA-256 hash of PAN' })
  @IsString()
  @IsNotEmpty()
  panHash: string;

  @ApiProperty({ description: 'Full name as on PAN card' })
  @IsString()
  @IsNotEmpty()
  consumerName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  gender?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mobileNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  passportNumber?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  voterId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  drivingLicense?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(1900)
  @Max(2099)
  year?: number;
}

export class BureauPullResponseDto {
  @ApiProperty()
  jobId: string;

  @ApiProperty({ enum: BureauProvider })
  provider: BureauProvider;

  @ApiProperty()
  status: string;

  @ApiPropertyOptional()
  score?: number;

  @ApiPropertyOptional()
  reportId?: string;

  @ApiPropertyOptional()
  errorCode?: string;

  @ApiPropertyOptional()
  errorMessage?: string;

  @ApiPropertyOptional()
  latencyMs?: number;
}

export class BureauBulkPullRequestDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  applicationId: string;

  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  applicantId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  panHash: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  consumerName: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dateOfBirth?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  mobileNumber?: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  consentOtp: string;
}

export class BureauBulkPullResponseDto {
  @ApiProperty()
  applicationId: string;

  @ApiProperty()
  totalRequested: number;

  @ApiProperty()
  totalSucceeded: number;

  @ApiProperty()
  totalFailed: number;

  @ApiProperty({ type: [BureauPullResponseDto] })
  results: BureauPullResponseDto[];

  @ApiPropertyOptional()
  aggregated?: {
    primaryProvider: BureauProvider;
    primaryScore: number;
    totalExposure: number;
    totalEmi: number;
    maxDpd: number;
    activeAccounts: number;
    enquiries30d: number;
  };
}

export class BureauReportQueryDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  applicationId: string;

  @ApiPropertyOptional({ enum: BureauProvider })
  @IsOptional()
  @IsEnum(BureauProvider)
  provider?: BureauProvider;
}

export class BureauConsentVerifyDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  applicationId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  panHash: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @Min(100000)
  @Max(999999)
  consentOtp: string;
}
