import { Controller, Get, Post, Body, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { PolicyVersioningService } from '../rules/policy-versioning.service';
import { RuleDefinitionEntity } from '../rules/rule-definition.entity';
import {
  CreatePolicyVersionDto,
  CloneVersionDto,
  ActivateVersionDto,
  CompareVersionsDto,
} from '../dto/decision.dto';
import { RolesGuard, Roles } from '@los/common';

@ApiTags('Policy Versioning')
@ApiBearerAuth()
@Controller('policy')
@UseGuards(RolesGuard)
export class PolicyVersioningController {
  constructor(private readonly policyVersioningService: PolicyVersioningService) {}

  @Get('versions')
  @Roles('ADMIN', 'ZONAL_CREDIT_HEAD', 'CREDIT_ANALYST')
  @ApiOperation({ summary: 'Get all policy versions with rule counts' })
  async getPolicyHistory() {
    return this.policyVersioningService.getPolicyHistory();
  }

  @Get('rules/active')
  @ApiOperation({ summary: 'Get all active rules for current version' })
  @ApiResponse({ status: 200, description: 'List of active rules' })
  async getActiveRules(): Promise<RuleDefinitionEntity[]> {
    return this.policyVersioningService.getActiveRules();
  }

  @Get('rules/:ruleId/history')
  @ApiOperation({ summary: 'Get version history for a specific rule' })
  async getRuleHistory(@Param('ruleId') ruleId: string): Promise<RuleDefinitionEntity[]> {
    return this.policyVersioningService.getRuleHistory(ruleId);
  }

  @Get('rules/for-date')
  @ApiOperation({ summary: 'Get rules effective on a specific date' })
  async getRulesForDate(@Query('date') dateStr: string): Promise<RuleDefinitionEntity[]> {
    const date = new Date(dateStr);
    return this.policyVersioningService.getRulesForDate(date);
  }

  @Post('versions')
  @Roles('ADMIN', 'ZONAL_CREDIT_HEAD')
  @ApiOperation({ summary: 'Create a new policy version (atomically deactivates old, creates new)' })
  async createPolicyVersion(@Body() dto: CreatePolicyVersionDto) {
    return this.policyVersioningService.createPolicyVersion(
      dto.versionName,
      new Date(dto.effectiveFrom),
      dto.effectiveTo ? new Date(dto.effectiveTo) : undefined,
      dto.createdBy,
      dto.ruleOverrides,
    );
  }

  @Post('versions/clone')
  @Roles('ADMIN', 'ZONAL_CREDIT_HEAD')
  @ApiOperation({ summary: 'Clone an existing policy version with a new version name' })
  async cloneVersion(@Body() dto: CloneVersionDto) {
    return this.policyVersioningService.cloneVersion(
      dto.sourceVersion,
      dto.newVersion,
      new Date(dto.effectiveFrom),
      dto.createdBy,
    );
  }

  @Post('versions/:version/activate')
  @Roles('ADMIN', 'ZONAL_CREDIT_HEAD')
  @ApiOperation({ summary: 'Activate a specific policy version (deactivates all others)' })
  async activateVersion(@Param('version') version: string) {
    await this.policyVersioningService.activateVersion(version);
    return { success: true, message: `Policy version ${version} activated` };
  }

  @Post('versions/compare')
  @Roles('ADMIN', 'ZONAL_CREDIT_HEAD', 'CREDIT_ANALYST')
  @ApiOperation({ summary: 'Compare two policy versions — shows added/removed/modified rules' })
  async compareVersions(@Body() dto: CompareVersionsDto) {
    return this.policyVersioningService.compareVersions(dto.versionA, dto.versionB);
  }
}
