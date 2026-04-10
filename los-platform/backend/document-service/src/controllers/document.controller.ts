import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { DocumentService } from '../services/document.service';
import {
  GetUploadUrlDto,
  GetUploadUrlResponseDto,
  ConfirmUploadDto,
  UpdateDocumentMetadataDto,
  ReviewDocumentDto,
  CreateChecklistDto,
  UpdateChecklistItemDto,
  GetDocumentsQueryDto,
  DocumentResponseDto,
  ChecklistResponseDto,
  DocumentStatsDto,
  TriggerOcrDto,
  WatermarkDocumentDto,
} from '../dto/document.dto';
import { RolesGuard, Roles, AuthenticatedRequest } from '@los/common';

@ApiTags('Documents')
@ApiBearerAuth()
@UseGuards(RolesGuard)
@Controller()
export class DocumentController {
  constructor(private readonly documentService: DocumentService) {}

  @Post('documents/presigned-url')
  @Roles('APPLICANT', 'LOAN_OFFICER', 'DSA')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Get presigned URL for document upload to MinIO' })
  @ApiResponse({ status: 201, type: GetUploadUrlResponseDto })
  async getUploadUrl(
    @Body() dto: GetUploadUrlDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<GetUploadUrlResponseDto> {
    return this.documentService.getUploadUrl(dto, req.user.id);
  }

  @Post('documents/confirm-upload')
  @Roles('APPLICANT', 'LOAN_OFFICER', 'DSA')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Confirm upload completion and trigger OCR' })
  @ApiResponse({ status: 200, type: DocumentResponseDto })
  async confirmUpload(
    @Body() dto: ConfirmUploadDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<DocumentResponseDto> {
    return this.documentService.confirmUpload(dto, req.user.id);
  }

  @Get('applications/:applicationId/documents')
  @Roles('APPLICANT', 'LOAN_OFFICER', 'CREDIT_ANALYST', 'BRANCH_MANAGER', 'COMPLIANCE_OFFICER')
  @ApiOperation({ summary: 'List documents for an application' })
  @ApiResponse({ status: 200 })
  async getDocuments(
    @Param('applicationId') applicationId: string,
    @Query() query: GetDocumentsQueryDto,
  ) {
    return this.documentService.getDocumentsForApplication(applicationId, query);
  }

  @Get('documents/:documentId')
  @Roles('APPLICANT', 'LOAN_OFFICER', 'CREDIT_ANALYST', 'BRANCH_MANAGER', 'COMPLIANCE_OFFICER')
  @ApiOperation({ summary: 'Get document details' })
  @ApiResponse({ status: 200, type: DocumentResponseDto })
  async getDocument(
    @Param('documentId') documentId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<DocumentResponseDto> {
    return this.documentService.getDocument(documentId, req.user.id);
  }

  @Patch('documents/:documentId')
  @Roles('LOAN_OFFICER', 'CREDIT_ANALYST')
  @ApiOperation({ summary: 'Update document metadata (expiry, OCR provider)' })
  @ApiResponse({ status: 200, type: DocumentResponseDto })
  async updateDocument(
    @Param('documentId') documentId: string,
    @Body() dto: UpdateDocumentMetadataDto,
  ): Promise<DocumentResponseDto> {
    return this.documentService.updateDocumentMetadata(documentId, dto);
  }

  @Delete('documents/:documentId')
  @Roles('APPLICANT', 'LOAN_OFFICER')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete a document' })
  @ApiResponse({ status: 204 })
  async deleteDocument(
    @Param('documentId') documentId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<void> {
    return this.documentService.deleteDocument(documentId, req.user.id);
  }

  @Post('documents/:documentId/review')
  @Roles('LOAN_OFFICER', 'CREDIT_ANALYST', 'BRANCH_MANAGER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Review a document (approve/reject/under_review)' })
  @ApiResponse({ status: 200, type: DocumentResponseDto })
  async reviewDocument(
    @Param('documentId') documentId: string,
    @Body() dto: ReviewDocumentDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<DocumentResponseDto> {
    return this.documentService.reviewDocument(
      documentId,
      dto,
      req.user.id,
      req.user.role,
    );
  }

  @Get('documents/:documentId/reviews')
  @Roles('LOAN_OFFICER', 'CREDIT_ANALYST', 'BRANCH_MANAGER', 'COMPLIANCE_OFFICER')
  @ApiOperation({ summary: 'Get document review history' })
  @ApiResponse({ status: 200 })
  async getReviewHistory(@Param('documentId') documentId: string) {
    return this.documentService.getDocumentReviewHistory(documentId);
  }

  @Post('documents/:documentId/ocr')
  @Roles('LOAN_OFFICER', 'SYSTEM')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Trigger OCR on a document (retry)' })
  @ApiResponse({ status: 200, type: DocumentResponseDto })
  async triggerOcr(
    @Param('documentId') documentId: string,
    @Body() dto: TriggerOcrDto,
  ): Promise<DocumentResponseDto> {
    return this.documentService.triggerOcr(documentId, dto.provider);
  }

  @Post('documents/:documentId/watermark')
  @Roles('LOAN_OFFICER', 'CREDIT_ANALYST')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Generate watermarked copy of document' })
  @ApiResponse({ status: 200 })
  async watermarkDocument(
    @Param('documentId') documentId: string,
    @Body() dto: WatermarkDocumentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const applicationNo = dto.customText || documentId;
    const watermarkedKey = await this.documentService.watermarkDocument(
      documentId,
      applicationNo,
      dto.customText,
    );
    return { watermarkedObjectKey: watermarkedKey };
  }

  @Post('documents/checklist')
  @Roles('LOAN_OFFICER', 'SYSTEM')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create document checklist for an application' })
  @ApiResponse({ status: 201, type: [ChecklistResponseDto] })
  async createChecklist(
    @Body() dto: CreateChecklistDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<ChecklistResponseDto[]> {
    return this.documentService.createChecklist(dto, req.user.id);
  }

  @Get('applications/:applicationId/checklist')
  @Roles('APPLICANT', 'LOAN_OFFICER', 'CREDIT_ANALYST', 'BRANCH_MANAGER')
  @ApiOperation({ summary: 'Get document checklist for an application' })
  @ApiResponse({ status: 200, type: [ChecklistResponseDto] })
  async getChecklist(
    @Param('applicationId') applicationId: string,
  ): Promise<ChecklistResponseDto[]> {
    return this.documentService.getChecklist(applicationId);
  }

  @Patch('documents/checklist/:checklistId')
  @Roles('LOAN_OFFICER', 'CREDIT_ANALYST')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Update checklist item status' })
  @ApiResponse({ status: 200, type: ChecklistResponseDto })
  async updateChecklistItem(
    @Param('checklistId') checklistId: string,
    @Body() dto: UpdateChecklistItemDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<ChecklistResponseDto> {
    return this.documentService.updateChecklistItem(checklistId, dto, req.user.id);
  }

  @Get('documents/stats')
  @Roles('LOAN_OFFICER', 'CREDIT_ANALYST', 'BRANCH_MANAGER')
  @ApiOperation({ summary: 'Get document statistics' })
  @ApiResponse({ status: 200, type: DocumentStatsDto })
  async getStats(@Query('applicationId') applicationId?: string): Promise<DocumentStatsDto> {
    return this.documentService.getStats(applicationId);
  }
}
