import {
  Controller,
  Get,
  Post,
  Patch,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiProperty, ApiQuery, ApiPropertyOptional } from '@nestjs/swagger';
import { PddService } from '../services/pdd.service';
import { RolesGuard, Roles, AuthenticatedRequest } from '@los/common';

@ApiTags('PDD (Post Disbursement Documentation)')
@ApiBearerAuth()
@Controller('pdd')
@UseGuards(RolesGuard)
export class PddController {
  constructor(private readonly pddService: PddService) {}

  @Post(':applicationId/initiate')
  @Roles('LOAN_OFFICER', 'BRANCH_MANAGER', 'SYSTEM')
  @ApiOperation({ summary: 'Initiate PDD checklist on loan disbursement' })
  @ApiResponse({ status: 201, description: 'PDD initiated' })
  async initiatePdd(
    @Param('applicationId') applicationId: string,
    @Body() body: { loanType: string; disbursementDate: string; customItems?: any[] },
    @Query() query: any,
  ) {
    return this.pddService.initiatePdd(
      applicationId,
      body.loanType,
      new Date(body.disbursementDate),
      query.userId || 'system',
    );
  }

  @Get(':applicationId')
  @Roles('LOAN_OFFICER', 'BRANCH_MANAGER', 'CREDIT_ANALYST', 'ZONAL_CREDIT_HEAD')
  @ApiOperation({ summary: 'Get PDD checklist with all items for an application' })
  @ApiResponse({ status: 200, description: 'PDD checklist' })
  async getChecklist(@Param('applicationId') applicationId: string) {
    return this.pddService.getChecklist(applicationId);
  }

  @Post('items/:itemId/submit')
  @Roles('LOAN_OFFICER', 'APPLICANT')
  @ApiOperation({ summary: 'Submit a PDD checklist item with document reference' })
  @ApiResponse({ status: 200, description: 'Item submitted' })
  async submitItem(
    @Param('itemId') itemId: string,
    @Body() body: { documentRefId?: string; remarks?: string },
  ) {
    return this.pddService.submitItem(
      itemId,
      body.documentRefId || null,
      body.remarks || null,
      'applicant',
    );
  }

  @Patch('items/:itemId/verify')
  @Roles('LOAN_OFFICER', 'BRANCH_MANAGER')
  @ApiOperation({ summary: 'Verify or reject a submitted PDD item' })
  @ApiResponse({ status: 200, description: 'Item verified/rejected' })
  async verifyItem(
    @Param('itemId') itemId: string,
    @Body() body: { decision: 'APPROVED' | 'REJECTED'; rejectionReason?: string; verifiedBy: string },
  ) {
    return this.pddService.verifyItem(
      itemId,
      body.decision,
      body.rejectionReason || null,
      body.verifiedBy,
    );
  }

  @Patch('items/:itemId/waive')
  @Roles('BRANCH_MANAGER', 'ZONAL_CREDIT_HEAD')
  @ApiOperation({ summary: 'Waive a PDD requirement (with reason)' })
  @ApiResponse({ status: 200, description: 'Item waived' })
  async waiveItem(
    @Param('itemId') itemId: string,
    @Body() body: { reason: string; waivedBy: string },
  ) {
    return this.pddService.waiveItem(itemId, body.reason, body.waivedBy);
  }

  @Patch(':checklistId/extend')
  @Roles('BRANCH_MANAGER')
  @ApiOperation({ summary: 'Extend PDD due date' })
  @ApiResponse({ status: 200, description: 'Due date extended' })
  async extendDueDate(
    @Param('checklistId') checklistId: string,
    @Body() body: { newDueDate: string; reason: string },
  ) {
    return this.pddService.extendDueDate(checklistId, new Date(body.newDueDate), body.reason);
  }

  @Get('dashboard/overdue')
  @Roles('LOAN_OFFICER', 'BRANCH_MANAGER', 'ZONAL_CREDIT_HEAD')
  @ApiOperation({ summary: 'Get all overdue PDD checklists' })
  @ApiResponse({ status: 200, description: 'Overdue checklists' })
  @ApiQuery({ name: 'daysThreshold', required: false, type: Number, description: 'Days past due date threshold' })
  async getOverdueChecklists(@Query('daysThreshold') daysThreshold = 1) {
    return this.pddService.getOverdueChecklists(+daysThreshold);
  }

  @Get('dashboard/summary')
  @Roles('LOAN_OFFICER', 'BRANCH_MANAGER', 'ZONAL_CREDIT_HEAD')
  @ApiOperation({ summary: 'PDD dashboard summary for branch' })
  @ApiResponse({ status: 200, description: 'Dashboard stats' })
  @ApiQuery({ name: 'branchCode', required: false, description: 'Branch code filter' })
  async getDashboard(@Query('branchCode') branchCode?: string) {
    return this.pddService.getPddDashboard(branchCode);
  }
}
