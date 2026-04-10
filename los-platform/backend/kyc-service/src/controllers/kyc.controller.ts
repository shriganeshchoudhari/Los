import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Request } from 'express';
import { v4 as uuidv4 } from 'uuid';
import {
  KYCService,
  OfflineXmlKycService,
  DigiLockerService,
  KycReuseService,
} from '../services';
import {
  InitiateAadhaarKycDto,
  VerifyAadhaarOtpDto,
  VerifyPANDto,
  FaceMatchDto,
  KYCStatusResponseDto,
  ConsentDto,
  OfflineXmlKycDto,
  OfflineXmlKycResponseDto,
  DigiLockerCallbackDto,
  DigiLockerDocumentsDto,
  DigiLockerDocumentResponseDto,
  KycReuseCheckDto,
  KycReuseCheckResponseDto,
  KycReuseDto,
  KycReuseResponseDto,
} from '../dto';
import { RolesGuard, Roles, AuthenticatedRequest, SkipAuth } from '@los/common';

@ApiTags('KYC')
@ApiBearerAuth()
@Controller('kyc')
@UseGuards(RolesGuard)
export class KYCController {
  constructor(
    private readonly kycService: KYCService,
    private readonly offlineXmlKycService: OfflineXmlKycService,
    private readonly digiLockerService: DigiLockerService,
    private readonly kycReuseService: KycReuseService,
  ) {}

  @Post('aadhaar/init')
  @Roles('APPLICANT', 'LOAN_OFFICER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Initiate Aadhaar eKYC' })
  @ApiResponse({ status: 200, description: 'OTP sent to registered mobile' })
  async initiateAadhaarKYC(
    @Body() dto: InitiateAadhaarKycDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.kycService.initiateAadhaarKYC(dto);
  }

  @Post('aadhaar/verify')
  @Roles('APPLICANT', 'LOAN_OFFICER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify Aadhaar OTP' })
  @ApiResponse({ status: 200, description: 'Aadhaar verified successfully' })
  async verifyAadhaarOtp(
    @Body() dto: VerifyAadhaarOtpDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<KYCStatusResponseDto> {
    return this.kycService.verifyAadhaarOtp(dto);
  }

  @Post('aadhaar/offline')
  @Roles('APPLICANT', 'LOAN_OFFICER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Aadhaar offline XML KYC fallback' })
  @ApiResponse({ status: 200, description: 'Offline KYC result' })
  async offlineXmlKyc(
    @Body() dto: OfflineXmlKycDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<OfflineXmlKycResponseDto> {
    const xmlContent = Buffer.from(dto.xmlContentBase64, 'base64').toString('utf8');
    return this.offlineXmlKycService.processOfflineXml(
      dto.applicationId,
      xmlContent,
      dto.shareCode || '000000',
      dto.mobile || '',
      req.user.id,
    );
  }

  @Post('pan/verify')
  @Roles('APPLICANT', 'LOAN_OFFICER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Verify PAN card' })
  @ApiResponse({ status: 200, description: 'PAN verified successfully' })
  async verifyPAN(
    @Body() dto: VerifyPANDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<KYCStatusResponseDto> {
    return this.kycService.verifyPAN(dto);
  }

  @Post('face/match')
  @Roles('APPLICANT', 'LOAN_OFFICER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Perform face match' })
  @ApiResponse({ status: 200, description: 'Face match result' })
  async performFaceMatch(
    @Body() dto: FaceMatchDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<KYCStatusResponseDto> {
    return this.kycService.performFaceMatch(dto);
  }

  @Get(':applicationId')
  @Roles('APPLICANT', 'LOAN_OFFICER', 'CREDIT_ANALYST', 'COMPLIANCE_OFFICER')
  @ApiOperation({ summary: 'Get KYC status' })
  @ApiResponse({ status: 200, description: 'KYC status', type: KYCStatusResponseDto })
  async getKycStatus(
    @Param('applicationId') applicationId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<KYCStatusResponseDto> {
    return this.kycService.getKycStatus(applicationId);
  }

  @Post('check-completion')
  @Roles('LOAN_OFFICER', 'SYSTEM')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Check and update KYC completion status' })
  async checkCompletion(
    @Body() body: { applicationId: string },
    @Req() req: AuthenticatedRequest,
  ): Promise<KYCStatusResponseDto> {
    return this.kycService.checkKycCompletion(body.applicationId);
  }

  @Post('consent')
  @Roles('APPLICANT')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Capture consent' })
  async captureConsent(
    @Body() dto: ConsentDto,
    @Req() req: AuthenticatedRequest,
  ) {
    const user = req.user;
    const ipAddress = this.getClientIp(req);

    await this.kycService.captureConsent(
      dto.applicationId,
      user.id,
      dto.consentType,
      dto.consentText,
      ipAddress,
      req.headers['user-agent'] || '',
    );

    return { success: true };
  }

  @Get('consent/:applicationId')
  @Roles('APPLICANT', 'LOAN_OFFICER', 'CREDIT_ANALYST', 'COMPLIANCE_OFFICER')
  @ApiOperation({ summary: 'Get consent records for an application' })
  async getConsent(
    @Param('applicationId') applicationId: string,
  ) {
    return this.kycService.getConsent(applicationId);
  }

  @Get('reuse/check')
  @Roles('APPLICANT', 'LOAN_OFFICER')
  @ApiOperation({ summary: 'Check KYC reuse eligibility (10-year validity)' })
  @ApiResponse({ status: 200, type: KycReuseCheckResponseDto })
  async checkReuseEligibility(
    @Body() dto: KycReuseCheckDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<KycReuseCheckResponseDto> {
    return this.kycReuseService.checkReuseEligibility(
      dto.applicationId,
      req.user.id,
      dto.aadhaarHash,
      dto.panMasked,
    );
  }

  @Post('reuse')
  @Roles('APPLICANT', 'LOAN_OFFICER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reuse existing KYC for new application' })
  @ApiResponse({ status: 200, type: KycReuseResponseDto })
  async reuseKyc(
    @Body() dto: KycReuseDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<KycReuseResponseDto> {
    return this.kycReuseService.reuseKyc(
      dto.applicationId,
      req.user.id,
      dto.existingKycId,
    );
  }

  private getClientIp(req: Request): string {
    return (
      (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
      (req.headers['x-real-ip'] as string) ||
      req.socket.remoteAddress ||
      'unknown'
    );
  }
}

@ApiTags('DigiLocker')
@ApiBearerAuth()
@Controller('digilocker')
@UseGuards(RolesGuard)
export class DigiLockerController {
  constructor(private readonly digiLockerService: DigiLockerService) {}

  @Get('auth-url')
  @Roles('APPLICANT', 'LOAN_OFFICER')
  @ApiOperation({ summary: 'Get DigiLocker authorization URL' })
  async getAuthUrl(@Req() req: AuthenticatedRequest) {
    const state = uuidv4();
    const authUrl = await this.digiLockerService.getAuthorizationUrl(state);
    return { authUrl, state };
  }

  @Post('callback')
  @SkipAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'DigiLocker OAuth callback' })
  async callback(@Body() dto: DigiLockerCallbackDto) {
    const tokens = await this.digiLockerService.exchangeCodeForToken(dto.code);
    return { success: true, accessToken: tokens.accessToken };
  }

  @Get('documents')
  @Roles('APPLICANT', 'LOAN_OFFICER')
  @ApiOperation({ summary: 'Fetch available documents from DigiLocker' })
  @ApiResponse({ status: 200, type: DigiLockerDocumentsDto })
  async fetchDocuments(@Req() req: AuthenticatedRequest) {
    const accessToken = req.headers['x-digilocker-token'] as string;
    if (!accessToken) {
      return { success: false, documents: [], error: 'Access token required' };
    }
    return this.digiLockerService.fetchDocuments(accessToken);
  }
}

@ApiTags('Health')
@Controller('health')
export class HealthController {
  @SkipAuth()
  @Get()
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'kyc-service',
    };
  }
}
