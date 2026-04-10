import {
  Controller, Get, Post, Param, Body, UseGuards, Req, NotFoundException, Logger
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Request } from 'express';
import { LoanAgreementService } from '../services/loan-agreement.service';
import { eSignService } from '../services/esign.service';
import { MinIOService } from '../services/minio.service';
import { KafkaService, AuditService, AuditEventCategory, AuditEventType, KAFKA_TOPICS } from '@los/common';
import {
  GenerateAgreementDto,
  InitiateESignDto,
  VerifyESignDto,
  CancelESignDto,
} from '../dto/agreement.dto';
import { RolesGuard, Roles } from '@los/common';
import { LoanAgreementStatus, LoanAgreementSignature, SignatureStatus } from '../entities';

@ApiTags('Loan Agreement')
@ApiBearerAuth()
@Controller('loan-agreement')
@UseGuards(RolesGuard)
export class LoanAgreementController {
  private readonly logger = new Logger(LoanAgreementController.name);

  constructor(
    private readonly agreementService: LoanAgreementService,
    private readonly esignService: eSignService,
    private readonly minioService: MinIOService,
    private readonly kafka: KafkaService,
    private readonly auditService: AuditService,
    @InjectRepository(LoanAgreementSignature)
    private readonly signatureRepo: Repository<LoanAgreementSignature>,
  ) {}

  @Post('generate')
  @Roles('LOAN_OFFICER', 'BRANCH_MANAGER', 'CREDIT_ANALYST')
  @ApiOperation({ summary: 'Generate loan agreement PDF for an application' })
  @ApiResponse({ status: 201, description: 'Loan agreement generated and stored' })
  async generateAgreement(@Body() dto: GenerateAgreementDto, @Req() req: Request) {
    const userId = (req as any).user?.id || 'system';
    const agreement = await this.agreementService.generateAndStoreAgreement(dto.applicationId, userId);
    return {
      id: agreement.id,
      agreementNumber: agreement.agreementNumber,
      applicationId: agreement.applicationId,
      status: agreement.status,
      documentKey: agreement.documentKey,
      createdAt: agreement.createdAt,
    };
  }

  @Get('application/:applicationId')
  @Roles('LOAN_OFFICER', 'BRANCH_MANAGER', 'CREDIT_ANALYST', 'ZONAL_CREDIT_HEAD')
  @ApiOperation({ summary: 'Get loan agreement for an application' })
  async getAgreement(@Param('applicationId') applicationId: string) {
    const agreement = await this.agreementService.getAgreementByApplication(applicationId);
    if (!agreement) {
      throw new NotFoundException(`Agreement not found for application ${applicationId}`);
    }
    return agreement;
  }

  @Get('document/:applicationId/pdf')
  @Roles('LOAN_OFFICER', 'BRANCH_MANAGER', 'CREDIT_ANALYST', 'ZONAL_CREDIT_HEAD', 'APPLICANT')
  @ApiOperation({ summary: 'Download loan agreement PDF' })
  async downloadAgreement(@Param('applicationId') applicationId: string) {
    const pdfBuffer = await this.agreementService.getAgreementPdf(applicationId);
    return {
      buffer: pdfBuffer.toString('base64'),
      filename: `Loan_Agreement_${applicationId}.pdf`,
      contentType: 'application/pdf',
    };
  }

  @Post('esign/initiate')
  @Roles('LOAN_OFFICER', 'BRANCH_MANAGER', 'CREDIT_ANALYST')
  @ApiOperation({ summary: 'Initiate eSign process for loan agreement' })
  @ApiResponse({ status: 201, description: 'eSign initiated, OTP sent or signing URL returned' })
  async initiateESign(@Body() dto: InitiateESignDto, @Req() req: Request) {
    const userId = (req as any).user?.id || 'system';

    const agreement = await this.agreementService.getAgreementByApplication(dto.applicationId);
    if (!agreement) {
      throw new NotFoundException(`Agreement not found for application ${dto.applicationId}. Generate it first.`);
    }

    if (!agreement.documentKey) {
      throw new NotFoundException('Agreement document not yet generated');
    }

    const pdfBuffer = await this.minioService.getObject(agreement.documentKey);
    const documentHash = this.esignService.computeDocumentHash(pdfBuffer);

    const signature = await this.agreementService.createSignatureRecord(
      agreement.id,
      'BORROWER',
      dto.signerName,
      dto.signerMobile,
      dto.signerEmail,
      'Borrower',
    );

    let result;
    if (dto.preVerified && dto.signerAadhaar) {
      result = await this.esignService.initiateWithPreVerified(
        documentHash,
        agreement.id,
        dto.signerName,
        dto.signerAadhaar,
        dto.signerMobile,
        dto.signerEmail,
      );
    } else {
      result = await this.esignService.initiateSigning({
        documentHash,
        documentId: agreement.id,
        signerName: dto.signerName,
        signerMobile: dto.signerMobile,
        signerEmail: dto.signerEmail,
        consent: 'Y',
      });
    }

    signature.esignTransactionId = result.esignTransactionId;
    signature.esignProvider = result.esignProvider;
    signature.documentHashBeforeSign = documentHash;
    signature.consentTaken = true;
    signature.consentTimestamp = new Date();
    signature.consentIp = (req.ip || req.socket.remoteAddress || 'unknown') as string;
    signature.signatureStatus = SignatureStatus.INITIATED;
    await this.signatureRepo.save(signature);

    await this.agreementService.updateAgreementStatus(agreement.id, LoanAgreementStatus.AWAITING_ESIGN);

    await this.auditService.log({
      eventCategory: AuditEventCategory.APPLICATION,
      eventType: AuditEventType.SANCTION_LETTER_GENERATED,
      entityType: 'LoanAgreementSignature',
      entityId: signature.id,
      userId,
      metadata: {
        applicationId: dto.applicationId,
        agreementId: agreement.id,
        transactionId: result.esignTransactionId,
        signerName: dto.signerName,
        preVerified: dto.preVerified || false,
      },
    });

    return result;
  }

  @Post('esign/verify')
  @Roles('LOAN_OFFICER', 'BRANCH_MANAGER', 'CREDIT_ANALYST')
  @ApiOperation({ summary: 'Verify OTP and complete eSign' })
  @ApiResponse({ status: 200, description: 'Document signed successfully' })
  async verifyESign(@Body() dto: VerifyESignDto, @Req() req: Request) {
    const userId = (req as any).user?.id || 'system';
    const result = await this.esignService.verifyOTPAndSign(dto.transactionId, dto.otp, dto.aadhaarLast4);

    const signature = await this.signatureRepo.findOne({
      where: { esignTransactionId: dto.transactionId },
    });
    if (signature) {
      signature.signatureStatus = SignatureStatus.SIGNED;
      signature.signedAt = new Date();
      await this.signatureRepo.save(signature);
    }

    return result;
  }

  @Post('esign/callback')
  @ApiOperation({ summary: 'NSDL eSign callback webhook' })
  async esignCallback(@Body() payload: any) {
    this.logger.log(`eSign callback received: ${JSON.stringify(payload)}`);

    const { transactionId, status, signedDocumentHash, certificateSerialNumber, signerAadhaarHash } = payload;

    if (status === 'SIGNED') {
      const signature = await this.signatureRepo.findOne({
        where: { esignTransactionId: transactionId },
      });

      if (signature) {
        signature.signatureStatus = SignatureStatus.SIGNED;
        signature.documentHashAfterSign = signedDocumentHash || null;
        signature.certificateSerialNumber = certificateSerialNumber || null;
        signature.signerAadhaarHash = signerAadhaarHash || null;
        signature.signedAt = new Date();
        await this.signatureRepo.save(signature);

        const agreement = await this.agreementService.getAgreementByApplication(signature.agreementId);
        if (agreement) {
          const allSigs = await this.signatureRepo.find({ where: { agreementId: agreement.id } });
          const allSigned = allSigs.every((s) => s.signatureStatus === SignatureStatus.SIGNED);

          if (allSigned) {
            await this.agreementService.updateAgreementStatus(agreement.id, LoanAgreementStatus.FULLY_SIGNED);
            await this.kafka.emit(KAFKA_TOPICS.AGREEMENT_SIGNED, {
              agreementId: agreement.id,
              applicationId: agreement.applicationId,
              agreementNumber: agreement.agreementNumber,
              signedAt: new Date().toISOString(),
              allSignatures: allSigs.map((s) => ({
                signerType: s.signerType,
                signerName: s.signerName,
                certificateSerialNumber: s.certificateSerialNumber,
              })),
            });
          } else {
            await this.agreementService.updateAgreementStatus(agreement.id, LoanAgreementStatus.PARTIALLY_SIGNED);
          }
        }
      }
    } else if (status === 'FAILED') {
      const signature = await this.signatureRepo.findOne({
        where: { esignTransactionId: transactionId },
      });
      if (signature) {
        signature.signatureStatus = SignatureStatus.FAILED;
        signature.rejectionReason = payload.errorMessage || 'Signing failed';
        await this.signatureRepo.save(signature);
      }
    }

    return { acknowledged: true };
  }

  @Post('esign/cancel')
  @Roles('LOAN_OFFICER', 'BRANCH_MANAGER', 'CREDIT_ANALYST')
  @ApiOperation({ summary: 'Cancel eSign process' })
  async cancelESign(@Body() dto: CancelESignDto) {
    await this.esignService.cancelSigning(dto.transactionId, dto.reason);

    const signature = await this.signatureRepo.findOne({
      where: { esignTransactionId: dto.transactionId },
    });
    if (signature) {
      signature.signatureStatus = SignatureStatus.CANCELLED;
      signature.rejectionReason = dto.reason;
      await this.signatureRepo.save(signature);
    }

    return { success: true, message: 'eSign cancelled' };
  }

  @Get('esign/verify/:transactionId')
  @Roles('LOAN_OFFICER', 'BRANCH_MANAGER', 'CREDIT_ANALYST')
  @ApiOperation({ summary: 'Verify eSign signature validity' })
  async verifySignature(@Param('transactionId') transactionId: string) {
    return this.esignService.verifySignature(transactionId);
  }

  @Get('signatures/:agreementId')
  @Roles('LOAN_OFFICER', 'BRANCH_MANAGER', 'CREDIT_ANALYST')
  @ApiOperation({ summary: 'Get all signature records for an agreement' })
  async getSignatures(@Param('agreementId') agreementId: string) {
    return this.signatureRepo.find({ where: { agreementId }, order: { createdAt: 'ASC' } });
  }
}
