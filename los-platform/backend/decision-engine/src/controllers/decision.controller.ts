import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiProperty } from '@nestjs/swagger';
import { DecisionEngineService } from '../services/decision-engine.service';
import {
  TriggerDecisionDto,
  ManualDecisionDto,
  DecisionResponseDto,
  OverrideRequestDto,
  OverrideApproveDto,
  OverrideRequestResponseDto,
} from '../dto';
import { RolesGuard, Roles, AuthenticatedRequest, SkipAuth } from '@los/common';

@ApiTags('Decision Engine')
@ApiBearerAuth()
@Controller('decisions')
@UseGuards(RolesGuard)
export class DecisionController {
  constructor(private readonly decisionService: DecisionEngineService) {}

  @Post('trigger')
  @Roles('CREDIT_ANALYST', 'BRANCH_MANAGER', 'ZONAL_CREDIT_HEAD', 'SYSTEM')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Trigger credit decision for application' })
  @ApiResponse({ status: 200, description: 'Decision result', type: DecisionResponseDto })
  async triggerDecision(
    @Body() dto: TriggerDecisionDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<DecisionResponseDto> {
    return this.decisionService.triggerDecision(dto);
  }

  @Get(':applicationId')
  @Roles('CREDIT_ANALYST', 'BRANCH_MANAGER', 'ZONAL_CREDIT_HEAD', 'LOAN_OFFICER', 'COMPLIANCE_OFFICER')
  @ApiOperation({ summary: 'Get decision for application' })
  @ApiResponse({ status: 200, description: 'Decision result', type: DecisionResponseDto })
  async getDecision(
    @Param('applicationId') applicationId: string,
    @Req() req: AuthenticatedRequest,
  ): Promise<DecisionResponseDto> {
    return this.decisionService.getDecision(applicationId);
  }

  @Post('override')
  @Roles('BRANCH_MANAGER', 'ZONAL_CREDIT_HEAD')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Manual override of decision (direct — use maker-checker flow for production)' })
  @ApiResponse({ status: 200, description: 'Updated decision', type: DecisionResponseDto })
  async manualOverride(
    @Body() dto: ManualDecisionDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<DecisionResponseDto> {
    return this.decisionService.manualOverride(dto, req.user.id);
  }

  @Post('override/request')
  @Roles('BRANCH_MANAGER', 'ZONAL_CREDIT_HEAD', 'CREDIT_ANALYST')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Request manual override (maker — creates OVERRIDE_PENDING status)' })
  @ApiResponse({ status: 201, description: 'Override request created', type: OverrideRequestResponseDto })
  async requestOverride(
    @Body() dto: OverrideRequestDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<OverrideRequestResponseDto> {
    return this.decisionService.requestOverride(dto, req.user.id);
  }

  @Post('override/approve')
  @Roles('ZONAL_CREDIT_HEAD')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve or reject override request (checker — completes override)' })
  @ApiResponse({ status: 200, description: 'Override request processed', type: OverrideRequestResponseDto })
  async approveOverride(
    @Body() dto: OverrideApproveDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<OverrideRequestResponseDto> {
    return this.decisionService.approveOverride(dto, req.user.id);
  }

  @Get('override/:requestId')
  @Roles('BRANCH_MANAGER', 'ZONAL_CREDIT_HEAD', 'CREDIT_ANALYST', 'COMPLIANCE_OFFICER')
  @ApiOperation({ summary: 'Get override request details' })
  @ApiResponse({ status: 200, description: 'Override request details', type: OverrideRequestResponseDto })
  async getOverrideRequest(@Param('requestId') requestId: string): Promise<OverrideRequestResponseDto> {
    return this.decisionService.getOverrideRequest(requestId);
  }

  @Get('override/pending')
  @Roles('ZONAL_CREDIT_HEAD')
  @ApiOperation({ summary: 'List all pending override requests for the approver' })
  @ApiResponse({ status: 200, description: 'List of pending override requests', type: [OverrideRequestResponseDto] })
  async listPendingOverrides(): Promise<OverrideRequestResponseDto[]> {
    return this.decisionService.listPendingOverrides();
  }
}

@ApiTags('Health')
@Controller('health')
export class HealthController {
  @SkipAuth()
  @Get()
  @ApiOperation({ summary: 'Health check' })
  @ApiResponse({ status: 200, description: 'Service is healthy' })
  check() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
      service: 'decision-engine',
    };
  }
}
