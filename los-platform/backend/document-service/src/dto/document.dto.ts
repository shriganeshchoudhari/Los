import {
  IsNotEmpty,
  IsString,
  IsEnum,
  IsOptional,
  IsNumber,
  IsArray,
  ValidateNested,
  Min,
  Max,
  MinLength,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { DocumentType, DocumentStatus, ChecklistStatus } from '../entities/document.entity';

export class GetUploadUrlDto {
  @ApiProperty({ example: '550e8400-e29b-41d4-a716-446655440000' })
  @IsNotEmpty()
  @IsString()
  applicationId: string;

  @ApiProperty({ enum: DocumentType })
  @IsNotEmpty()
  @IsEnum(DocumentType)
  documentType: DocumentType;

  @ApiProperty({ example: 'my_document.pdf' })
  @IsNotEmpty()
  @IsString()
  @MinLength(1)
  fileName: string;

  @ApiProperty({ example: 'application/pdf' })
  @IsNotEmpty()
  @IsString()
  mimeType: string;

  @ApiPropertyOptional({ example: 1024000 })
  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(10 * 1024 * 1024)
  fileSize?: number;

  @ApiPropertyOptional({ example: 'ABC123' })
  @IsOptional()
  @IsString()
  checksum?: string;
}

export class GetUploadUrlResponseDto {
  @ApiProperty()
  documentId: string;

  @ApiProperty()
  uploadUrl: string;

  @ApiProperty()
  objectKey: string;

  @ApiProperty()
  expiresAt: string;

  @ApiProperty()
  mimeType: string;
}

export class ConfirmUploadDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  documentId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  checksum?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  fileSize?: number;
}

export class UpdateDocumentMetadataDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  expiryDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  ocrProvider?: string;
}

export class ReviewDocumentDto {
  @ApiProperty({ enum: DocumentStatus })
  @IsNotEmpty()
  @IsEnum(DocumentStatus)
  action: DocumentStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  remarks?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  rejectionReasonCode?: string;
}

export class CreateChecklistDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  applicationId: string;

  @ApiProperty({ enum: DocumentType, isArray: true })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => String)
  documentTypes: DocumentType[];
}

export class UpdateChecklistItemDto {
  @ApiProperty({ enum: ChecklistStatus })
  @IsNotEmpty()
  @IsEnum(ChecklistStatus)
  status: ChecklistStatus;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reason?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  documentId?: string;
}

export class GetDocumentsQueryDto {
  @ApiPropertyOptional({ enum: DocumentType })
  @IsOptional()
  @IsEnum(DocumentType)
  documentType?: DocumentType;

  @ApiPropertyOptional({ enum: DocumentStatus })
  @IsOptional()
  @IsEnum(DocumentStatus)
  status?: DocumentStatus;

  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  @Type(() => Number)
  page?: number;

  @ApiPropertyOptional({ type: Number })
  @IsOptional()
  @Type(() => Number)
  size?: number;
}

export class DocumentResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  applicationId: string;

  @ApiProperty({ enum: DocumentType })
  documentType: DocumentType;

  @ApiProperty({ enum: DocumentStatus })
  status: DocumentStatus;

  @ApiProperty()
  fileName: string;

  @ApiProperty()
  mimeType: string;

  @ApiProperty()
  fileSize: number;

  @ApiPropertyOptional()
  ocrResult?: Record<string, unknown>;

  @ApiPropertyOptional()
  ocrConfidence?: number;

  @ApiPropertyOptional()
  ocrError?: string;

  @ApiProperty()
  isExpired: boolean;

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  updatedAt: string;
}

export class ChecklistResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  applicationId: string;

  @ApiProperty({ enum: DocumentType })
  documentType: DocumentType;

  @ApiProperty({ enum: ChecklistStatus })
  status: ChecklistStatus;

  @ApiProperty()
  isRequired: boolean;

  @ApiPropertyOptional()
  documentId?: string;

  @ApiProperty()
  createdAt: string;
}

export class OcrParseResultDto {
  @ApiProperty()
  provider: string;

  @ApiProperty()
  documentType: string;

  @ApiProperty()
  extractedData: Record<string, unknown>;

  @ApiProperty()
  confidence: number;

  @ApiPropertyOptional()
  errors?: string[];

  @ApiProperty()
  rawResponse: Record<string, unknown>;
}

export class TriggerOcrDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  documentId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  provider?: string;
}

export class WatermarkDocumentDto {
  @ApiProperty()
  @IsNotEmpty()
  @IsString()
  documentId: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  customText?: string;
}

export class DocumentStatsDto {
  @ApiProperty()
  totalDocuments: number;

  @ApiProperty()
  pendingReview: number;

  @ApiProperty()
  approved: number;

  @ApiProperty()
  rejected: number;

  @ApiProperty()
  ocrSuccessRate: number;
}
