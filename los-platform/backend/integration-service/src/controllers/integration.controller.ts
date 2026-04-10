import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  ValidationPipe,
  UsePipes,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '@los/common';
import { IntegrationService } from '../services/integration.service';
import {
  BureauBulkPullRequestDto,
  BureauBulkPullResponseDto,
  BureauReportQueryDto,
  BureauConsentDto,
} from '../dto/bureau.dto';
import {
  DisbursementInitDto,
  DisbursementResponseDto,
  NACHMandateInitDto,
  PaymentCallbackDto,
  PennyDropVerifyDto,
  CBSCustomerCreateDto,
  CBSLoanAccountCreateDto,
  DisbursementQueryDto,
} from '../dto/payment.dto';

@ApiTags('Integration')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('integration')
export class IntegrationController {
  constructor(private readonly integrationService: IntegrationService) {}

  @Post('bureau/consent')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Record bureau pull consent (OTP-confirmed)' })
  @ApiResponse({ status: 200, description: 'Consent recorded successfully' })
  async recordBureauConsent(@Body() dto: BureauConsentDto) {
    const result = await this.integrationService.processBureauConsent(
      dto.applicationId,
      dto.applicantId,
      dto.panHash,
      dto.consentOtp,
    );
    return {
      success: true,
      consentId: result.consentId,
      expiresAt: result.expiresAt,
      message: 'Bureau pull consent recorded. Proceed with pull within 30 minutes.',
    };
  }

  @Post('bureau/pull')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Pull bureau reports from all bureaus in parallel' })
  @ApiResponse({ status: 200, description: 'Bureau pull results', type: BureauBulkPullResponseDto })
  async pullBureauBulk(@Body(ValidationPipe) dto: BureauBulkPullRequestDto): Promise<BureauBulkPullResponseDto> {
    return this.integrationService.pullBureauBulk(dto);
  }

  @Get('bureau/reports')
  @ApiOperation({ summary: 'Get bureau reports for an application' })
  @ApiResponse({ status: 200, description: 'List of bureau reports' })
  async getBureauReports(@Query(ValidationPipe) query: BureauReportQueryDto) {
    const reports = await this.integrationService.getBureauReports(query);
    return {
      applicationId: query.applicationId,
      reports: reports.map(r => ({
        id: r.id,
        provider: r.provider,
        score: r.parsedScore,
        grade: r.parsedGrade,
        totalAccounts: r.parsedTotalAccounts,
        activeAccounts: r.parsedActiveAccounts,
        totalExposure: r.parsedTotalExposure,
        maxDpd: r.parsedDpdOver90,
        writeoffs: r.parsedWriteoffs,
        suitFiled: r.parsedSuitFiled,
        createdAt: r.createdAt,
      })),
    };
  }

  @Post('cbs/customer')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create customer in CBS (Finacle/BaNCS)' })
  @ApiResponse({ status: 201, description: 'Customer created in CBS' })
  async createCBSCustomer(@Body(ValidationPipe) dto: CBSCustomerCreateDto) {
    return this.integrationService.createCBSCustomer(dto);
  }

  @Post('cbs/loan-account')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create loan account in CBS' })
  @ApiResponse({ status: 201, description: 'Loan account created in CBS' })
  async createCBSLoanAccount(@Body(ValidationPipe) dto: CBSLoanAccountCreateDto) {
    return this.integrationService.createCBSLoanAccount(dto);
  }

  @Post('disbursement')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Initiate loan disbursement' })
  @ApiResponse({ status: 201, description: 'Disbursement initiated', type: DisbursementResponseDto })
  async initiateDisbursement(@Body(ValidationPipe) dto: DisbursementInitDto) {
    const disbursement = await this.integrationService.initiateDisbursement(dto);
    return {
      id: disbursement.id,
      disbursementNumber: disbursement.disbursementNumber,
      applicationId: disbursement.applicationId,
      amount: disbursement.amount,
      paymentMode: disbursement.paymentMode,
      status: disbursement.status,
      beneficiaryAccountNumber: `****${disbursement.beneficiaryAccountNumber.slice(-4)}`,
      beneficiaryIfsc: disbursement.beneficiaryIfsc,
      initiatedAt: disbursement.initiatedAt,
      message: `Disbursement initiated. Mode: ${disbursement.paymentMode}. You will receive UTR confirmation via webhook.`,
    };
  }

  @Get('disbursement')
  @ApiOperation({ summary: 'Get disbursement history' })
  @ApiResponse({ status: 200, description: 'Disbursement history' })
  async getDisbursements(@Query(ValidationPipe) query: DisbursementQueryDto) {
    const disbursements = await this.integrationService.getDisbursements(query.applicationId, query.status);
    return {
      count: disbursements.length,
      disbursements: disbursements.map(d => ({
        id: d.id,
        disbursementNumber: d.disbursementNumber,
        applicationId: d.applicationId,
        amount: d.amount,
        paymentMode: d.paymentMode,
        status: d.status,
        utrNumber: d.utrNumber,
        initiatedAt: d.initiatedAt,
        settlementAt: d.settlementAt,
        failureReason: d.failureReason,
      })),
    };
  }

  @Post('disbursement/callback')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Handle payment gateway/NPCI webhook callback' })
  async handlePaymentCallback(@Body() dto: PaymentCallbackDto) {
    const result = await this.integrationService.handlePaymentCallback(dto);
    if (!result.processed) {
      return { received: true, processed: false, message: 'Callback received but no matching disbursement found' };
    }
    return { received: true, processed: true, disbursementId: result.disbursementId };
  }

  @Post('nach/mandate')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register NACH/eMandate for loan repayment' })
  @ApiResponse({ status: 201, description: 'Mandate registration submitted' })
  async registerNACHMandate(@Body(ValidationPipe) dto: NACHMandateInitDto) {
    const mandate = await this.integrationService.initiateNACHMandate(dto);
    return {
      id: mandate.id,
      emandateId: mandate.emandateId,
      umrn: mandate.umrn,
      registrationStatus: mandate.registrationStatus,
      confirmationStatus: mandate.confirmationStatus,
      message: 'Mandate registration submitted. Confirmation typically takes 3-5 business days.',
    };
  }

  @Post('penny-drop/verify')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify bank account via penny drop' })
  async verifyPennyDrop(@Body(ValidationPipe) dto: PennyDropVerifyDto) {
    return this.integrationService.verifyPennyDrop(dto);
  }

  @Get('health/metrics')
  @ApiOperation({ summary: 'Get circuit breaker health metrics for all integrations' })
  async getHealthMetrics() {
    return this.integrationService.getHealthMetrics();
  }
}
