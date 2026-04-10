import {
  IsNotEmpty,
  IsString,
  IsNumber,
  IsOptional,
  IsArray,
  IsEnum,
  IsDateString,
  ValidateNested,
  Min,
  Max,
  IsBoolean,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { TrancheMilestone, TrancheStatus } from '../entities/tranche.entity';

export class TranchePlanDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  applicationId: string;

  @ApiProperty()
  @IsNumber()
  @Min(1)
  totalTranches: number;

  @ApiPropertyOptional({ description: 'Stage name e.g. "Under Construction", "Possession Stage"' })
  @IsOptional()
  @IsString()
  stageName?: string;

  @ApiPropertyOptional({ description: 'Project type: CONSTRUCTION, LAP_PURCHASE, EXTENSION' })
  @IsOptional()
  @IsString()
  projectType?: string;

  @ApiPropertyOptional({ description: 'Expected completion in months' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(120)
  expectedCompletionMonths?: number;

  @ApiPropertyOptional({ description: 'Minimum % of sanctioned for first tranche', default: 10 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  firstTrancheMinPercent?: number;

  @ApiPropertyOptional({ description: 'Minimum % of sanctioned for subsequent tranches', default: 5 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  subsequentTrancheMinPercent?: number;
}

export class CreateTrancheDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  applicationId: string;

  @ApiProperty()
  @IsNumber()
  @Min(1)
  @Max(10)
  trancheNumber: number;

  @ApiProperty({ example: 'First disbursement on agreement signing' })
  @IsNotEmpty()
  @IsString()
  @MaxLength(100)
  trancheName: string;

  @ApiProperty()
  @IsNumber()
  @Min(10000)
  amount: number;

  @ApiProperty({ enum: TrancheMilestone })
  @IsNotEmpty()
  @IsEnum(TrancheMilestone)
  milestone: TrancheMilestone;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  milestoneDescription?: string;

  @ApiProperty({ example: '2024-09-15' })
  @IsNotEmpty()
  @IsDateString()
  plannedDate: string;

  @ApiPropertyOptional({ example: '2024-09-30' })
  @IsOptional()
  @IsDateString()
  scheduledDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  benefitDescription?: string;

  @ApiPropertyOptional({ example: ['Sale Agreement', 'Photographs', 'Valuation Report'] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  requiredDocuments?: string[];

  @ApiPropertyOptional({ default: false })
  @IsOptional()
  @IsBoolean()
  inspectionRequired?: boolean;
}

export class BatchCreateTrancheDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  applicationId: string;

  @ApiProperty({ type: [CreateTrancheDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => CreateTrancheDto)
  tranches: CreateTrancheDto[];
}

export class UpdateTrancheDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(10000)
  amount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  scheduledDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEnum(TrancheMilestone)
  milestone?: TrancheMilestone;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  milestoneDescription?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  benefitDescription?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  submittedDocuments?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  documentsApproved?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  remarks?: string;
}

export class ApproveTrancheDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  remarks?: string;
}

export class RejectTrancheDto {
  @ApiProperty({ example: 'Property documents not matching application' })
  @IsNotEmpty()
  @IsString()
  rejectionReason: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  remarks?: string;
}

export class ScheduleDisbursementDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  trancheId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  scheduledDate?: string;

  @ApiPropertyOptional({ description: 'Override disbursement amount (within approved tranche amount)' })
  @IsOptional()
  @IsNumber()
  @Min(10000)
  overrideAmount?: number;
}

export class DisbursementInspectionDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  trancheId: string;

  @ApiProperty({ example: 'FIELD_INSPECTION' })
  @IsNotEmpty()
  @IsString()
  inspectionType: string;

  @ApiProperty({ example: '2024-09-01' })
  @IsNotEmpty()
  @IsDateString()
  inspectionDate: string;

  @ApiProperty({ example: 'Rajesh Kumar' })
  @IsNotEmpty()
  @IsString()
  inspectorName: string;

  @ApiPropertyOptional({ example: 'ABC Valuers Pvt Ltd' })
  @IsOptional()
  @IsString()
  inspectorAgency?: string;

  @ApiProperty({ example: 'Plot No. 123, Whitefield, Bangalore - 560066' })
  @IsNotEmpty()
  @IsString()
  siteAddress: string;

  @ApiProperty({ example: 'Foundation + Ground Floor Plinth' })
  @IsNotEmpty()
  @IsString()
  stageOfConstruction: string;

  @ApiProperty({ example: 35.5 })
  @IsNotEmpty()
  @IsNumber()
  @Min(0)
  @Max(100)
  completionPercent: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  previousCompletionPercent?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsArray()
  stageWiseProgress?: { stage: string; planned: number; actual: number; status: string }[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  qualityObservations?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  riskFlags?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  inspectionReportKey?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  photos?: string[];
}

export class TranchePlanResponseDto {
  @ApiProperty()
  planId: string;

  @ApiProperty()
  applicationId: string;

  @ApiProperty()
  totalSanctionedAmount: number;

  @ApiProperty()
  totalPlannedAmount: number;

  @ApiProperty()
  totalDisbursedAmount: number;

  @ApiProperty()
  totalTranches: number;

  @ApiProperty()
  disbursedTranches: number;

  @ApiProperty()
  planStatus: string;

  @ApiProperty({ type: Object })
  tranches: TrancheDetailDto[];
}

export class TrancheDetailDto {
  @ApiProperty()
  trancheId: string;

  @ApiProperty()
  trancheCode: string;

  @ApiProperty()
  trancheNumber: number;

  @ApiProperty()
  trancheName: string;

  @ApiProperty()
  amount: number;

  @ApiProperty()
  cumulativeAmount: number;

  @ApiProperty()
  percentageOfSanction: number;

  @ApiProperty({ enum: TrancheMilestone })
  milestone: TrancheMilestone;

  @ApiProperty({ enum: TrancheStatus })
  status: TrancheStatus;

  @ApiProperty()
  plannedDate: Date;

  @ApiProperty()
  scheduledDate: Date | null;

  @ApiProperty()
  actualDisbursementDate: Date | null;

  @ApiProperty()
  documentsApproved: boolean;

  @ApiProperty()
  inspectionRequired: boolean;

  @ApiProperty()
  latestAllowedDate: Date;

  @ApiPropertyOptional()
  inspectionReportKey?: string | null;
}
