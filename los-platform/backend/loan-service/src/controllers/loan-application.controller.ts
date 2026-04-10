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
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { Request } from 'express';
import { LoanApplicationService } from '../services/loan-application.service';
import {
  CreateApplicationDto,
  UpdateApplicationDto,
  AutoSaveDto,
  ApplicationResponseDto,
} from '../dto';
import { ApplicationStatus } from '../entities/loan-application.entity';
import { RolesGuard, Roles, AuthenticatedRequest } from '@los/common';

@ApiTags('Loan Applications')
@ApiBearerAuth()
@Controller('applications')
@UseGuards(RolesGuard)
export class LoanApplicationController {
  constructor(private readonly applicationService: LoanApplicationService) {}

  @Post()
  @Roles('APPLICANT', 'LOAN_OFFICER', 'DSA')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new loan application' })
  @ApiResponse({ status: 201, description: 'Application created', type: ApplicationResponseDto })
  @ApiResponse({ status: 409, description: 'Duplicate application or validation error' })
  async createApplication(
    @Body() dto: CreateApplicationDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<ApplicationResponseDto> {
    const userId = req.user.id;
    return this.applicationService.createApplication(dto, userId);
  }

  @Get(':applicationId')
  @Roles('APPLICANT', 'LOAN_OFFICER', 'CREDIT_ANALYST', 'BRANCH_MANAGER', 'ZONAL_CREDIT_HEAD', 'COMPLIANCE_OFFICER')
  @ApiOperation({ summary: 'Get application details' })
  @ApiResponse({ status: 200, description: 'Application details' })
  @ApiResponse({ status: 404, description: 'Application not found' })
  async getApplication(
    @Param('applicationId') applicationId: string,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.applicationService.getApplication(applicationId, req.user.id, req.user.role);
  }

  @Patch(':applicationId')
  @Roles('APPLICANT', 'LOAN_OFFICER')
  @ApiOperation({ summary: 'Update application (draft only)' })
  @ApiResponse({ status: 200, description: 'Application updated', type: ApplicationResponseDto })
  @ApiResponse({ status: 400, description: 'Cannot update submitted application' })
  @ApiResponse({ status: 409, description: 'Version conflict' })
  async updateApplication(
    @Param('applicationId') applicationId: string,
    @Body() dto: UpdateApplicationDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<ApplicationResponseDto> {
    return this.applicationService.updateApplication(applicationId, dto, req.user.id);
  }

  @Post(':applicationId/submit')
  @Roles('APPLICANT', 'LOAN_OFFICER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit application for processing' })
  @ApiResponse({ status: 200, description: 'Application submitted', type: ApplicationResponseDto })
  @ApiResponse({ status: 400, description: 'Validation failed' })
  async submitApplication(
    @Param('applicationId') applicationId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<ApplicationResponseDto> {
    return this.applicationService.submitApplication(applicationId, req.user.id, req.user.role);
  }

  @Get()
  @Roles('LOAN_OFFICER', 'CREDIT_ANALYST', 'BRANCH_MANAGER', 'ZONAL_CREDIT_HEAD')
  @ApiOperation({ summary: 'List applications by status' })
  @ApiQuery({ name: 'status', required: false, enum: ApplicationStatus })
  @ApiQuery({ name: 'branchCode', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'size', required: false, type: Number })
  @ApiResponse({ status: 200, description: 'List of applications' })
  async getApplications(
    @Query('status') status?: ApplicationStatus,
    @Query('branchCode') branchCode?: string,
    @Query('page') page?: number,
    @Query('size') size?: number,
    @Req() req?: AuthenticatedRequest,
  ) {
    const effectiveBranchCode = branchCode || req?.user?.branchCode;
    return this.applicationService.getApplicationsByStatus(status, effectiveBranchCode, page || 0, size || 20);
  }

  @Patch(':applicationId/autosave')
  @Roles('APPLICANT', 'LOAN_OFFICER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Autosave application draft (partial update with 5-min Redis cache)' })
  @ApiResponse({ status: 200, description: 'Autosave result' })
  async autoSave(
    @Param('applicationId') applicationId: string,
    @Body() dto: AutoSaveDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.applicationService.autoSave(applicationId, dto, req.user.id);
  }

  @Get(':applicationId/foir')
  @Roles('APPLICANT', 'LOAN_OFFICER', 'CREDIT_ANALYST', 'BRANCH_MANAGER')
  @ApiOperation({ summary: 'Calculate FOIR and max eligible amount for application' })
  @ApiResponse({ status: 200, description: 'FOIR calculation result' })
  async calculateFoir(@Param('applicationId') applicationId: string) {
    return this.applicationService.calculateFOIR(applicationId);
  }

  @Post(':applicationId/assign-officer')
  @Roles('SYSTEM', 'BRANCH_MANAGER')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Assign loan officer via round-robin within branch' })
  @ApiResponse({ status: 200, description: 'Officer assigned' })
  async assignOfficer(@Param('applicationId') applicationId: string) {
    return this.applicationService.assignOfficerRoundRobin(applicationId);
  }
}
