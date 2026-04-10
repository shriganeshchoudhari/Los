import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery, ApiHeader } from '@nestjs/swagger';
import * as jwt from 'jsonwebtoken';
import { DSAService } from '../services/dsa.service';
import {
  RegisterPartnerDto,
  PartnerRegistrationResponseDto,
  PartnerApprovalDto,
  DSALoginDto,
  DSALoginResponseDto,
  CreateOfficerDto,
  CreateDSAApplicationDto,
  DSADashboardDto,
  CommissionSummaryDto,
  CommissionDetailDto,
  PartnerListQueryDto,
  PartnerDetailDto,
  RefreshTokenDto,
} from '../dto';
import { DSAPartnerStatus } from '../entities/dsa.entity';

interface DSARequest {
  user?: {
    id: string;
    partnerId: string;
    partnerCode: string;
    employeeCode?: string;
    role: string;
    type: 'partner' | 'officer';
  };
}

@Controller()
@ApiTags('DSA Portal')
export class DSAController {
  constructor(private readonly dsaService: DSAService) {}

  @Post('auth/register')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Register a new DSA partner (public)' })
  @ApiResponse({ status: 201, description: 'Partner registered successfully' })
  @ApiResponse({ status: 409, description: 'Partner with this PAN/email/mobile already exists' })
  async registerPartner(@Body() dto: RegisterPartnerDto): Promise<PartnerRegistrationResponseDto> {
    return this.dsaService.registerPartner(dto);
  }

  @Post('auth/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Partner login (DSA partner code + password)' })
  @ApiResponse({ status: 200, description: 'Login successful', type: DSALoginResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async partnerLogin(@Body() dto: DSALoginDto): Promise<DSALoginResponseDto> {
    return this.dsaService.partnerLogin(dto);
  }

  @Post('auth/refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Refresh access token' })
  async refreshToken(@Body() dto: RefreshTokenDto): Promise<{ accessToken: string; refreshToken: string; expiresIn: number }> {
    return this.dsaService.refreshToken(dto.refreshToken);
  }

  @Post('officers/login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'DSA Officer login (employee code + mobile OTP/password)' })
  @ApiResponse({ status: 200, description: 'Login successful', type: DSALoginResponseDto })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async officerLogin(
    @Body() body: { employeeCode: string; password: string },
  ): Promise<DSALoginResponseDto> {
    return this.dsaService.officerLogin(body.employeeCode, body.password);
  }

  @Get('dashboard')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get partner dashboard with stats, trend, officer breakdown' })
  @ApiResponse({ status: 200, description: 'Dashboard data', type: DSADashboardDto })
  async getDashboard(@Req() req: DSARequest): Promise<DSADashboardDto> {
    const partnerId = this.extractPartnerId(req);
    return this.dsaService.getPartnerDashboard(partnerId);
  }

  @Post('applications')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a loan application on behalf of a customer (DSA officer)' })
  @ApiResponse({ status: 201, description: 'Application created', type: Object })
  @ApiResponse({ status: 409, description: 'Duplicate application for this customer' })
  async createApplication(@Body() dto: CreateDSAApplicationDto, @Req() req: DSARequest) {
    const partnerId = this.extractPartnerId(req);
    const officerId = req.user?.id;
    const app = await this.dsaService.createApplication(partnerId, officerId, dto);
    return {
      id: app.id,
      applicationNumber: app.applicationNumber,
      status: app.status,
      message: `Application ${app.applicationNumber} created successfully. Customer will receive an SMS with login details.`,
    };
  }

  @Get('applications')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List DSA applications for the partner' })
  @ApiQuery({ name: 'status', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'size', required: false, type: Number })
  async listApplications(
    @Req() req: DSARequest,
    @Query('status') status?: string,
    @Query('page') page?: number,
    @Query('size') size?: number,
  ) {
    const partnerId = this.extractPartnerId(req);
    return this.dsaService.listApplications(partnerId, status, page || 0, size || 20);
  }

  @Get('officers')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List officers for the partner' })
  async listOfficers(@Req() req: DSARequest) {
    const partnerId = this.extractPartnerId(req);
    return this.dsaService.getOfficers(partnerId);
  }

  @Post('officers')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new DSA officer (partner admin only)' })
  async createOfficer(@Body() dto: CreateOfficerDto, @Req() req: DSARequest) {
    const partnerId = this.extractPartnerId(req);
    const officer = await this.dsaService.createOfficer(partnerId, dto, req.user?.id || '');
    return {
      id: officer.id,
      employeeCode: officer.employeeCode,
      fullName: officer.fullName,
      designation: officer.designation,
      status: officer.status,
      message: `Officer ${officer.employeeCode} created. Default credentials sent via SMS.`,
    };
  }

  @Get('commissions')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get commission summary for the partner' })
  async getCommissionSummary(@Req() req: DSARequest): Promise<CommissionSummaryDto> {
    const partnerId = this.extractPartnerId(req);
    return this.dsaService.getCommissionSummary(partnerId);
  }

  @Get('commissions/history')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get commission payout history' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'size', required: false, type: Number })
  async getCommissionHistory(
    @Req() req: DSARequest,
    @Query('page') page?: number,
    @Query('size') size?: number,
  ): Promise<{ data: CommissionDetailDto[]; total: number }> {
    const partnerId = this.extractPartnerId(req);
    return this.dsaService.getCommissionHistory(partnerId, page || 0, size || 20);
  }

  @Get('profile')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get partner profile' })
  async getProfile(@Req() req: DSARequest): Promise<PartnerDetailDto> {
    const partnerId = this.extractPartnerId(req);
    return this.dsaService.getPartnerById(partnerId);
  }

  @Get('admin/partners')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List all DSA partners (bank staff only)' })
  async listPartners(@Query() query: PartnerListQueryDto) {
    return this.dsaService.listPartners(query);
  }

  @Get('admin/partners/:partnerId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get partner details (bank staff only)' })
  async getPartner(@Param('partnerId') partnerId: string): Promise<PartnerDetailDto> {
    return this.dsaService.getPartnerById(partnerId);
  }

  @Patch('admin/partners/:partnerId/approve')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Approve or reject a DSA partner (bank staff only)' })
  @ApiResponse({ status: 200, description: 'Partner status updated' })
  async approvePartner(
    @Param('partnerId') partnerId: string,
    @Body() dto: PartnerApprovalDto,
    @Req() req: DSARequest,
  ) {
    const approverId = req.user?.id || 'system';
    return this.dsaService.approvePartner(partnerId, dto, approverId);
  }

  @Post('admin/commissions/payout')
  @ApiBearerAuth()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Process monthly commission payout for a partner' })
  async processPayout(
    @Body() body: { partnerId: string; payoutMonth: string },
    @Req() req: DSARequest,
  ) {
    const processedBy = req.user?.id || 'system';
    return this.dsaService.processCommissionPayout(body.partnerId, body.payoutMonth, processedBy);
  }

  private extractPartnerId(req: DSARequest): string {
    if (!req.user?.partnerId) {
      throw new UnauthorizedException('Invalid token: partner ID not found');
    }
    return req.user.partnerId;
  }
}
