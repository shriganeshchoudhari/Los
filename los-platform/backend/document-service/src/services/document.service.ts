import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In, Not } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import { Kafka } from 'kafkajs';
import { v4 as uuidv4 } from 'uuid';
import {
  Document,
  DocumentChecklist,
  DocumentReview,
  DocumentType,
  DocumentStatus,
  ChecklistStatus,
  OcrProvider,
} from '../entities/document.entity';
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
} from '../dto/document.dto';
import { MinIOService } from './minio.service';
import { OcrService } from './ocr.service';
import { createError, AuditService, AuditEventCategory, AuditEventType } from '@los/common';

const ALLOWED_MIME_TYPES: Record<DocumentType, string[]> = {
  [DocumentType.PAN]: ['image/jpeg', 'image/png', 'application/pdf'],
  [DocumentType.AADHAAR_FRONT]: ['image/jpeg', 'image/png', 'application/pdf'],
  [DocumentType.AADHAAR_BACK]: ['image/jpeg', 'image/png', 'application/pdf'],
  [DocumentType.PASSPORT]: ['image/jpeg', 'image/png', 'application/pdf'],
  [DocumentType.VOTER_ID]: ['image/jpeg', 'image/png', 'application/pdf'],
  [DocumentType.DRIVING_LICENSE]: ['image/jpeg', 'image/png', 'application/pdf'],
  [DocumentType.BANK_STATEMENT]: ['application/pdf'],
  [DocumentType.SALARY_SLIP_1]: ['application/pdf', 'image/jpeg', 'image/png'],
  [DocumentType.SALARY_SLIP_2]: ['application/pdf', 'image/jpeg', 'image/png'],
  [DocumentType.SALARY_SLIP_3]: ['application/pdf', 'image/jpeg', 'image/png'],
  [DocumentType.ITR]: ['application/pdf'],
  [DocumentType.FORM_16]: ['application/pdf'],
  [DocumentType.VEHICLE_RC]: ['image/jpeg', 'image/png', 'application/pdf'],
  [DocumentType.PROPERTY_DOCUMENT]: ['application/pdf'],
  [DocumentType.NOC]: ['application/pdf'],
  [DocumentType.AGREEMENT_TO_SALE]: ['application/pdf'],
  [DocumentType.APPROVAL_LETTER]: ['application/pdf'],
  [DocumentType.VALUATION_REPORT]: ['application/pdf'],
  [DocumentType.PHOTO]: ['image/jpeg', 'image/png'],
  [DocumentType.SIGNATURE]: ['image/png', 'image/jpeg'],
  [DocumentType.ADDRESS_PROOF]: ['application/pdf', 'image/jpeg', 'image/png'],
  [DocumentType.INCOME_PROOF]: ['application/pdf', 'image/jpeg', 'image/png'],
  [DocumentType.IDENTITY_PROOF]: ['application/pdf', 'image/jpeg', 'image/png'],
  [DocumentType.OTHER]: ['application/pdf', 'image/jpeg', 'image/png'],
};

@Injectable()
export class DocumentService {
  private readonly logger = new Logger(DocumentService.name);
  private readonly kafka: Kafka;

  constructor(
    @InjectRepository(Document)
    private readonly documentRepository: Repository<Document>,
    @InjectRepository(DocumentChecklist)
    private readonly checklistRepository: Repository<DocumentChecklist>,
    @InjectRepository(DocumentReview)
    private readonly reviewRepository: Repository<DocumentReview>,
    private readonly minIOService: MinIOService,
    private readonly ocrService: OcrService,
    private readonly configService: ConfigService,
    private readonly auditService: AuditService,
  ) {
    this.kafka = new Kafka({
      clientId: 'document-service',
      brokers: configService.get<string[]>('KAFKA_BROKERS', ['localhost:9092']),
    });
  }

  async getUploadUrl(dto: GetUploadUrlDto, userId: string): Promise<GetUploadUrlResponseDto> {
    this.validateMimeType(dto.documentType, dto.mimeType);

    const objectKey = this.minIOService.generateObjectKey(
      dto.applicationId,
      dto.documentType,
      dto.fileName,
    );

    const { url, expiresAt } = await this.minIOService.getPresignedUploadUrl(
      objectKey,
      dto.mimeType,
      900,
    );

    const existing = await this.documentRepository.findOne({
      where: { applicationId: dto.applicationId, documentType: dto.documentType },
    });

    if (existing) {
      await this.minIOService.deleteObject(existing.objectKey);
      existing.objectKey = objectKey;
      existing.fileName = dto.fileName;
      existing.originalName = dto.fileName;
      existing.mimeType = dto.mimeType;
      existing.fileSize = dto.fileSize || 0;
      existing.checksum = dto.checksum || '';
      existing.status = DocumentStatus.PENDING;
      existing.presignedUrl = url;
      existing.presignedUrlExpiresAt = expiresAt;
      await this.documentRepository.save(existing);
      return {
        documentId: existing.id,
        uploadUrl: url,
        objectKey,
        expiresAt: expiresAt.toISOString(),
        mimeType: dto.mimeType,
      };
    }

    const document = this.documentRepository.create({
      id: uuidv4(),
      applicationId: dto.applicationId,
      documentType: dto.documentType,
      status: DocumentStatus.PENDING,
      fileName: dto.fileName,
      originalName: dto.fileName,
      mimeType: dto.mimeType,
      fileSize: dto.fileSize || 0,
      checksum: dto.checksum || '',
      bucketName: this.configService.get<string>('MINIO_BUCKET', 'los-documents'),
      objectKey,
      presignedUrl: url,
      presignedUrlExpiresAt: expiresAt,
    });

    const saved = await this.documentRepository.save(document);

    await this.auditService.log({
      eventCategory: AuditEventCategory.DOCUMENT,
      eventType: AuditEventType.DOCUMENT_UPLOAD,
      entityType: 'Document',
      entityId: saved.id,
      actorId: userId,
      afterState: JSON.stringify({ documentType: saved.documentType, mimeType: saved.mimeType, fileSize: saved.fileSize }),
      metadata: { applicationId: dto.applicationId, documentType: saved.documentType },
    });

    return {
      documentId: saved.id,
      uploadUrl: url,
      objectKey,
      expiresAt: expiresAt.toISOString(),
      mimeType: dto.mimeType,
    };
  }

  async confirmUpload(dto: ConfirmUploadDto, userId: string): Promise<DocumentResponseDto> {
    const document = await this.documentRepository.findOne({ where: { id: dto.documentId } });

    if (!document) {
      throw createError('DOC_001', 'Document not found');
    }

    if (dto.checksum) {
      document.checksum = dto.checksum;
    }
    if (dto.fileSize) {
      document.fileSize = dto.fileSize;
    }

    document.status = DocumentStatus.UPLOADED;
    const saved = await this.documentRepository.save(document);

    await this.auditService.log({
      eventCategory: AuditEventCategory.DOCUMENT,
      eventType: AuditEventType.DOCUMENT_UPLOAD,
      entityType: 'Document',
      entityId: saved.id,
      actorId: userId,
      afterState: JSON.stringify({ status: saved.status, documentType: saved.documentType }),
      metadata: { applicationId: saved.applicationId, documentType: saved.documentType, confirmed: true },
    });

    await this.triggerOcrInternal(saved.id);

    return this.formatDocumentResponse(saved);
  }

  async getDocument(documentId: string, userId: string): Promise<DocumentResponseDto> {
    const document = await this.documentRepository.findOne({ where: { id: documentId } });
    if (!document) {
      throw createError('DOC_001', 'Document not found');
    }
    return this.formatDocumentResponse(document);
  }

  async getDocumentsForApplication(
    applicationId: string,
    query: GetDocumentsQueryDto,
  ): Promise<{ content: DocumentResponseDto[]; totalElements: number; totalPages: number }> {
    const page = query.page ?? 0;
    const size = query.size ?? 20;

    const where: Record<string, unknown> = { applicationId };
    if (query.documentType) where.documentType = query.documentType;
    if (query.status) where.status = query.status;

    const [documents, totalElements] = await this.documentRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip: page * size,
      take: size,
    });

    return {
      content: documents.map((d) => this.formatDocumentResponse(d)),
      totalElements,
      totalPages: Math.ceil(totalElements / size),
    };
  }

  async updateDocumentMetadata(
    documentId: string,
    dto: UpdateDocumentMetadataDto,
  ): Promise<DocumentResponseDto> {
    const document = await this.documentRepository.findOne({ where: { id: documentId } });
    if (!document) {
      throw createError('DOC_001', 'Document not found');
    }

    if (dto.expiryDate) document.expiryDate = dto.expiryDate;
    if (dto.ocrProvider) {
      document.ocrProvider = dto.ocrProvider.toUpperCase() as OcrProvider;
    }

    const saved = await this.documentRepository.save(document);
    return this.formatDocumentResponse(saved);
  }

  async deleteDocument(documentId: string, userId: string): Promise<void> {
    const document = await this.documentRepository.findOne({ where: { id: documentId } });
    if (!document) {
      throw createError('DOC_001', 'Document not found');
    }

    await this.minIOService.deleteObject(document.objectKey);
    if (document.watermarkedObjectKey) {
      await this.minIOService.deleteObject(document.watermarkedObjectKey);
    }

    await this.auditService.log({
      eventCategory: AuditEventCategory.DOCUMENT,
      eventType: AuditEventType.DELETE,
      entityType: 'Document',
      entityId: documentId,
      actorId: userId,
      beforeState: JSON.stringify({ documentType: document.documentType, applicationId: document.applicationId, status: document.status }),
    });

    await this.documentRepository.remove(document);
    this.logger.log(`Document ${documentId} deleted by ${userId}`);
  }

  async reviewDocument(
    documentId: string,
    dto: ReviewDocumentDto,
    reviewerId: string,
    reviewerRole: string,
  ): Promise<DocumentResponseDto> {
    const document = await this.documentRepository.findOne({ where: { id: documentId } });
    if (!document) {
      throw createError('DOC_001', 'Document not found');
    }

    if (![DocumentStatus.APPROVED, DocumentStatus.REJECTED, DocumentStatus.UNDER_REVIEW].includes(dto.action)) {
      throw createError('DOC_002', 'Invalid review action. Must be APPROVED, REJECTED, or UNDER_REVIEW');
    }

    const previousStatus = document.status;
    document.status = dto.action;
    document.reviewerId = reviewerId;
    document.reviewedAt = new Date();
    document.reviewRemarks = dto.remarks || null;

    const review = this.reviewRepository.create({
      id: uuidv4(),
      documentId: document.id,
      applicationId: document.applicationId,
      reviewerId,
      reviewerRole,
      action: dto.action,
      previousStatus,
      newStatus: dto.action,
      remarks: dto.remarks,
      rejectionReasonCode: dto.rejectionReasonCode,
    });

    await this.reviewRepository.save(review);
    const saved = await this.documentRepository.save(document);

    await this.auditService.log({
      eventCategory: AuditEventCategory.DOCUMENT,
      eventType: AuditEventType.DOCUMENT_REVIEW,
      entityType: 'Document',
      entityId: saved.id,
      actorId: reviewerId,
      actorRole: reviewerRole,
      beforeState: JSON.stringify({ status: previousStatus }),
      afterState: JSON.stringify({ status: dto.action }),
      metadata: {
        applicationId: document.applicationId,
        documentType: document.documentType,
        action: dto.action,
        rejectionReasonCode: dto.rejectionReasonCode,
        remarks: dto.remarks,
      },
    });

    if (dto.action === DocumentStatus.REJECTED) {
      await this.publishEvent('los.document.rejected', {
        documentId,
        applicationId: document.applicationId,
        reviewerId,
        reasonCode: dto.rejectionReasonCode,
      });
    }

    return this.formatDocumentResponse(saved);
  }

  async triggerOcr(documentId: string, providerOverride?: string): Promise<DocumentResponseDto> {
    const document = await this.documentRepository.findOne({ where: { id: documentId } });
    if (!document) {
      throw createError('DOC_001', 'Document not found');
    }
    return this.formatDocumentResponse(await this.triggerOcrInternal(documentId, providerOverride));
  }

  private async triggerOcrInternal(
    documentId: string,
    providerOverride?: string,
  ): Promise<Document> {
    const document = await this.documentRepository.findOne({ where: { id: documentId } });
    if (!document) return document!;

    document.status = DocumentStatus.OCR_IN_PROGRESS;
    document.ocrAttempts += 1;
    if (providerOverride) {
      document.ocrProvider = providerOverride.toUpperCase() as OcrProvider;
    }
    await this.documentRepository.save(document);

    try {
      const result = await this.ocrService.parseDocument(
        document.objectKey,
        document.documentType,
        document.mimeType,
        providerOverride,
      );

      document.ocrResult = result.extractedData;
      document.ocrConfidence = result.confidence;
      document.ocrError = result.errors.length > 0 ? result.errors.join('; ') : null;
      document.status = result.confidence > 50 ? DocumentStatus.OCR_COMPLETED : DocumentStatus.OCR_FAILED;

      if (result.errors.length > 0) {
        document.status = DocumentStatus.OCR_FAILED;
      }
    } catch (error) {
      document.ocrError = error.message;
      document.status = DocumentStatus.OCR_FAILED;
    }

    return this.documentRepository.save(document);
  }

  async createChecklist(dto: CreateChecklistDto, userId: string): Promise<ChecklistResponseDto[]> {
    const existing = await this.checklistRepository.find({
      where: { applicationId: dto.applicationId },
    });

    const existingTypes = new Set(existing.map((c) => c.documentType));
    const toCreate = dto.documentTypes.filter((t) => !existingTypes.has(t));

    const newItems = toCreate.map((docType) =>
      this.checklistRepository.create({
        id: uuidv4(),
        applicationId: dto.applicationId,
        documentType: docType,
        status: ChecklistStatus.REQUIRED,
        isRequired: true,
      }),
    );

    if (newItems.length > 0) {
      await this.checklistRepository.save(newItems);
    }

    await this.publishEvent('los.document.checklist.created', {
      applicationId: dto.applicationId,
      documentTypes: dto.documentTypes,
      createdBy: userId,
    });

    const all = await this.checklistRepository.find({
      where: { applicationId: dto.applicationId },
    });
    return all.map((c) => this.formatChecklistResponse(c));
  }

  async getChecklist(applicationId: string): Promise<ChecklistResponseDto[]> {
    const items = await this.checklistRepository.find({
      where: { applicationId },
      order: { createdAt: 'ASC' },
    });
    return items.map((c) => this.formatChecklistResponse(c));
  }

  async updateChecklistItem(
    checklistId: string,
    dto: UpdateChecklistItemDto,
    userId: string,
  ): Promise<ChecklistResponseDto> {
    const item = await this.checklistRepository.findOne({ where: { id: checklistId } });
    if (!item) {
      throw createError('DOC_003', 'Checklist item not found');
    }

    item.status = dto.status;
    item.reason = dto.reason || null;
    item.documentId = dto.documentId || null;

    const saved = await this.checklistRepository.save(item);

    await this.publishEvent('los.document.checklist.updated', {
      checklistId,
      applicationId: item.applicationId,
      documentType: item.documentType,
      newStatus: dto.status,
      updatedBy: userId,
    });

    return this.formatChecklistResponse(saved);
  }

  async getDocumentReviewHistory(documentId: string): Promise<DocumentReview[]> {
    return this.reviewRepository.find({
      where: { documentId },
      order: { createdAt: 'DESC' },
    });
  }

  async getStats(applicationId?: string): Promise<DocumentStatsDto> {
    const where = applicationId ? { applicationId } : {};

    const [total, pending, approved, rejected, ocrResults] = await Promise.all([
      this.documentRepository.count({ where }),
      this.documentRepository.count({ where, where: { status: DocumentStatus.UNDER_REVIEW } as any }),
      this.documentRepository.count({ where, where: { status: DocumentStatus.APPROVED } as any }),
      this.documentRepository.count({ where, where: { status: DocumentStatus.REJECTED } as any }),
      this.documentRepository.find({ where, select: ['ocrConfidence', 'ocrError'] }),
    ]);

    const successfulOcr = ocrResults.filter((d) => d.ocrConfidence && d.ocrConfidence > 50).length;
    const ocrSuccessRate = total > 0 ? (successfulOcr / total) * 100 : 0;

    return {
      totalDocuments: total,
      pendingReview: pending,
      approved,
      rejected,
      ocrSuccessRate: Math.round(ocrSuccessRate * 10) / 10,
    };
  }

  async watermarkDocument(
    documentId: string,
    applicationNo: string,
    customText?: string,
  ): Promise<string> {
    const document = await this.documentRepository.findOne({ where: { id: documentId } });
    if (!document) {
      throw createError('DOC_001', 'Document not found');
    }

    const watermarkedKey = this.minIOService.getWatermarkedObjectKey(document.objectKey);

    await this.minIOService.watermarkAndUpload(
      document.objectKey,
      watermarkedKey,
      applicationNo,
      document.mimeType,
    );

    document.watermarkedObjectKey = watermarkedKey;
    await this.documentRepository.save(document);

    return watermarkedKey;
  }

  private validateMimeType(documentType: DocumentType, mimeType: string): void {
    const allowed = ALLOWED_MIME_TYPES[documentType];
    if (!allowed || !allowed.includes(mimeType)) {
      throw createError(
        'DOC_004',
        `Invalid file type for ${documentType}. Allowed: ${allowed?.join(', ') || 'none'}`,
      );
    }
  }

  private formatDocumentResponse(doc: Document): DocumentResponseDto {
    return {
      id: doc.id,
      applicationId: doc.applicationId,
      documentType: doc.documentType,
      status: doc.status,
      fileName: doc.fileName,
      mimeType: doc.mimeType,
      fileSize: Number(doc.fileSize),
      ocrResult: doc.ocrResult || undefined,
      ocrConfidence: doc.ocrConfidence ? Number(doc.ocrConfidence) : undefined,
      ocrError: doc.ocrError || undefined,
      isExpired: doc.isExpired,
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
    };
  }

  private formatChecklistResponse(item: DocumentChecklist): ChecklistResponseDto {
    return {
      id: item.id,
      applicationId: item.applicationId,
      documentType: item.documentType,
      status: item.status,
      isRequired: item.isRequired,
      documentId: item.documentId || undefined,
      createdAt: item.createdAt.toISOString(),
    };
  }

  private async publishEvent(topic: string, payload: Record<string, unknown>): Promise<void> {
    try {
      const producer = this.kafka.producer();
      await producer.connect();
      await producer.send({ topic, messages: [{ value: JSON.stringify(payload) }] });
      await producer.disconnect();
    } catch (error) {
      this.logger.error(`Failed to publish event ${topic}: ${error.message}`);
    }
  }
}
