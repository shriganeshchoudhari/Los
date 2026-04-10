import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
  Req,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { TrancheService } from '../services/tranche.service';
import {
  TranchePlanDto,
  CreateTrancheDto,
  BatchCreateTrancheDto,
  UpdateTrancheDto,
  ApproveTrancheDto,
  RejectTrancheDto,
  ScheduleDisbursementDto,
  DisbursementInspectionDto,
  TranchePlanResponseDto,
} from '../dto/tranche.dto';

@ApiTags('Multi-Tranche Disbursement')
@ApiBearerAuth()
@Controller('tranches')
export class TrancheController {
  constructor(private readonly trancheService: TrancheService) {}

  @Post('plan')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a disbursement plan for an application (home loans, LAP, etc.)' })
  @ApiResponse({ status: 201, description: 'Plan created' })
  async createPlan(@Body() dto: TranchePlanDto): Promise<{ planId: string }> {
    return this.trancheService.createPlan(dto);
  }

  @Post('batch')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create multiple tranches in a single batch (max 10 per loan)' })
  @ApiResponse({ status: 201, description: 'Tranches created' })
  async batchCreateTranches(@Body() dto: BatchCreateTrancheDto) {
    return this.trancheService.batchCreateTranches(dto);
  }

  @Get('plan/:applicationId')
  @ApiOperation({ summary: 'Get complete disbursement plan with all tranches for an application' })
  @ApiResponse({ status: 200, type: TranchePlanResponseDto })
  async getPlan(@Param('applicationId') applicationId: string): Promise<TranchePlanResponseDto> {
    return this.trancheService.getPlanByApplication(applicationId) as Promise<TranchePlanResponseDto>;
  }

  @Patch(':trancheId')
  @ApiOperation({ summary: 'Update tranche details (amount, dates, milestone, documents)' })
  @ApiResponse({ status: 200, description: 'Tranche updated' })
  async updateTranche(
    @Param('trancheId') trancheId: string,
    @Body() dto: UpdateTrancheDto,
    @Req() req: any,
  ) {
    return this.trancheService.updateTranche(trancheId, dto, req.user?.id || 'system');
  }

  @Post(':trancheId/submit')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Submit tranche for approval (after documents are ready)' })
  @ApiResponse({ status: 200, description: 'Tranche submitted for approval' })
  async submitTranche(@Param('trancheId') trancheId: string) {
    return this.trancheService.submitTranche(trancheId);
  }

  @Post(':trancheId/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve a submitted tranche (credit officer/manager)' })
  @ApiResponse({ status: 200, description: 'Tranche approved' })
  async approveTranche(
    @Param('trancheId') trancheId: string,
    @Body() dto: ApproveTrancheDto,
    @Req() req: any,
  ) {
    return this.trancheService.approveTranche(trancheId, dto, req.user?.id || 'system');
  }

  @Post(':trancheId/reject')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Reject a tranche with reason' })
  @ApiResponse({ status: 200, description: 'Tranche rejected' })
  async rejectTranche(
    @Param('trancheId') trancheId: string,
    @Body() dto: RejectTrancheDto,
    @Req() req: any,
  ) {
    return this.trancheService.rejectTranche(trancheId, dto, req.user?.id || 'system');
  }

  @Post(':trancheId/schedule')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Schedule disbursement for an approved tranche' })
  @ApiResponse({ status: 200, description: 'Disbursement scheduled' })
  async scheduleDisbursement(@Body() dto: ScheduleDisbursementDto) {
    return this.trancheService.scheduleDisbursement(dto);
  }

  @Post('inspections')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a field inspection report for a tranche' })
  @ApiResponse({ status: 201, description: 'Inspection created' })
  async createInspection(@Body() dto: DisbursementInspectionDto, @Req() req: any) {
    return this.trancheService.createInspection(dto, req.user?.id || 'inspector');
  }

  @Post('inspections/:inspectionId/approve')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve an inspection report (enables tranche approval)' })
  @ApiResponse({ status: 200, description: 'Inspection approved' })
  async approveInspection(
    @Param('inspectionId') inspectionId: string,
    @Body() body: { remarks?: string },
    @Req() req: any,
  ) {
    return this.trancheService.approveInspection(inspectionId, req.user?.id || 'system', body.remarks);
  }

  @Get('inspections/:trancheId')
  @ApiOperation({ summary: 'Get all inspection reports for a tranche' })
  @ApiResponse({ status: 200, description: 'Inspection reports' })
  async getInspections(@Param('trancheId') trancheId: string) {
    return this.trancheService.getInspectionsByTranche(trancheId);
  }

  @Get(':trancheId')
  @ApiOperation({ summary: 'Get tranche details' })
  @ApiResponse({ status: 200, description: 'Tranche details' })
  async getTranche(@Param('trancheId') trancheId: string) {
    return this.trancheService.getTrancheById(trancheId);
  }

  @Patch('plan/:applicationId/sanction')
  @ApiOperation({ summary: 'Set sanctioned amount on plan (after credit decision)' })
  @HttpCode(HttpStatus.OK)
  @ApiResponse({ status: 200, description: 'Sanctioned amount updated' })
  async setPlanSanction(
    @Param('applicationId') applicationId: string,
    @Body() body: { sanctionedAmount: number },
    @Req() req: any,
  ) {
    await this.trancheService.setPlanSanctionedAmount(applicationId, body.sanctionedAmount, req.user?.id || 'system');
    return { message: 'Sanctioned amount updated' };
  }
}
