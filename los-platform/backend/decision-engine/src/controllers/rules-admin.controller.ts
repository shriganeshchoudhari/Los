import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
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
import { RuleEngineConfigService, CreateRuleDto, UpdateRuleDto } from '../services/rule-engine-config.service';
import { PolicyVersioningService } from './policy-versioning.service';
import { RolesGuard, Roles, AuthenticatedRequest } from '@los/common';
import { RuleEvaluationContext } from './rule.types';

@ApiTags('Rules Admin')
@ApiBearerAuth()
@Controller('rules')
@UseGuards(RolesGuard)
export class RulesAdminController {
  constructor(
    private readonly ruleConfigService: RuleEngineConfigService,
    private readonly policyVersioning: PolicyVersioningService,
  ) {}

  @Get()
  @Roles('CREDIT_ANALYST', 'ZONAL_CREDIT_HEAD', 'COMPLIANCE_OFFICER', 'SYSTEM')
  @ApiOperation({ summary: 'List all rules with optional filters' })
  @ApiResponse({ status: 200, description: 'Paginated list of rules' })
  @ApiQuery({ name: 'category', required: false })
  @ApiQuery({ name: 'severity', required: false })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean })
  @ApiQuery({ name: 'loanType', required: false })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'size', required: false, type: Number })
  async listRules(@Query() query: any) {
    return this.ruleConfigService.listRules({
      category: query.category,
      severity: query.severity,
      isActive: query.isActive !== undefined ? query.isActive === 'true' : undefined,
      loanType: query.loanType,
      page: query.page ? parseInt(query.page) : 0,
      size: query.size ? parseInt(query.size) : 50,
    });
  }

  @Get(':ruleId')
  @Roles('CREDIT_ANALYST', 'ZONAL_CREDIT_HEAD', 'COMPLIANCE_OFFICER', 'SYSTEM')
  @ApiOperation({ summary: 'Get a specific rule by ID' })
  @ApiResponse({ status: 200, description: 'Rule details' })
  @ApiResponse({ status: 404, description: 'Rule not found' })
  async getRule(@Param('ruleId') ruleId: string) {
    return this.ruleConfigService.getRule(ruleId);
  }

  @Post()
  @Roles('ZONAL_CREDIT_HEAD', 'COMPLIANCE_OFFICER', 'SYSTEM')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new lending rule' })
  @ApiResponse({ status: 201, description: 'Rule created' })
  @ApiResponse({ status: 409, description: 'Rule ID already exists' })
  async createRule(@Body() dto: CreateRuleDto, @Req() req: AuthenticatedRequest) {
    return this.ruleConfigService.createRule(dto, req.user.id);
  }

  @Post('bulk')
  @Roles('ZONAL_CREDIT_HEAD', 'SYSTEM')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Bulk create multiple rules' })
  @ApiResponse({ status: 200, description: 'Bulk create result' })
  async bulkCreateRules(@Body() dtos: CreateRuleDto[], @Req() req: AuthenticatedRequest) {
    return this.ruleConfigService.bulkCreateRules(dtos, req.user.id);
  }

  @Put(':ruleId')
  @Roles('ZONAL_CREDIT_HEAD', 'COMPLIANCE_OFFICER', 'SYSTEM')
  @ApiOperation({ summary: 'Update an existing rule' })
  @ApiResponse({ status: 200, description: 'Rule updated' })
  @ApiResponse({ status: 404, description: 'Rule not found' })
  async updateRule(
    @Param('ruleId') ruleId: string,
    @Body() dto: UpdateRuleDto,
    @Req() req: AuthenticatedRequest,
  ) {
    return this.ruleConfigService.updateRule(ruleId, dto, req.user.id);
  }

  @Patch(':ruleId/toggle')
  @Roles('ZONAL_CREDIT_HEAD', 'SYSTEM')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Enable or disable a rule' })
  @ApiResponse({ status: 200, description: 'Rule toggled' })
  async toggleRule(
    @Param('ruleId') ruleId: string,
    @Body() body: { isActive: boolean },
    @Req() req: AuthenticatedRequest,
  ) {
    return this.ruleConfigService.updateRule(ruleId, { isActive: body.isActive }, req.user.id);
  }

  @Delete(':ruleId')
  @Roles('ZONAL_CREDIT_HEAD', 'SYSTEM')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Soft-delete a rule' })
  @ApiResponse({ status: 204, description: 'Rule deleted' })
  @ApiResponse({ status: 404, description: 'Rule not found' })
  async deleteRule(@Param('ruleId') ruleId: string) {
    await this.ruleConfigService.deleteRule(ruleId);
  }

  @Post(':ruleId/test')
  @Roles('CREDIT_ANALYST', 'ZONAL_CREDIT_HEAD', 'SYSTEM')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Test a rule against sample context data' })
  @ApiResponse({ status: 200, description: 'Rule evaluation result' })
  async testRule(
    @Param('ruleId') ruleId: string,
    @Body() context: RuleEvaluationContext,
  ) {
    return this.ruleConfigService.testRule(ruleId, context);
  }

  @Post('evaluate-context')
  @Roles('CREDIT_ANALYST', 'ZONAL_CREDIT_HEAD', 'SYSTEM')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Evaluate all active dynamic rules against context' })
  @ApiResponse({ status: 200, description: 'Rule evaluation results' })
  async evaluateAllRules(@Body() context: RuleEvaluationContext) {
    const rules = await this.ruleConfigService.getActiveDynamicRules();
    const results = await Promise.all(
      rules.map((r) => this.ruleConfigService.evaluateDynamicRule(r, context)),
    );
    return {
      rulesEvaluated: results.length,
      results,
      evaluatedAt: new Date().toISOString(),
    };
  }

  @Post('policy-versions')
  @Roles('ZONAL_CREDIT_HEAD', 'SYSTEM')
  @HttpCode(HttpStatus.CREATED)
  @ApiOperation({ summary: 'Create a new policy version snapshot' })
  @ApiResponse({ status: 201, description: 'Policy version created' })
  async createPolicyVersion(
    @Body()
    body: {
      versionName: string;
      effectiveFrom: string;
      effectiveTo?: string;
      ruleOverrides?: any[];
    },
    @Req() req: AuthenticatedRequest,
  ) {
    return this.policyVersioning.createPolicyVersion(
      body.versionName,
      new Date(body.effectiveFrom),
      body.effectiveTo ? new Date(body.effectiveTo) : undefined,
      req.user.id,
      body.ruleOverrides || [],
    );
  }

  @Get('policy-versions/history')
  @Roles('CREDIT_ANALYST', 'ZONAL_CREDIT_HEAD', 'COMPLIANCE_OFFICER', 'SYSTEM')
  @ApiOperation({ summary: 'Get policy version history' })
  @ApiResponse({ status: 200, description: 'Policy version history' })
  async getPolicyHistory() {
    return this.policyVersioning.getPolicyHistory();
  }

  @Get('policy-versions/:version')
  @Roles('CREDIT_ANALYST', 'ZONAL_CREDIT_HEAD', 'SYSTEM')
  @ApiOperation({ summary: 'Get rules for a specific policy version' })
  @ApiResponse({ status: 200, description: 'Policy version rules' })
  async getPolicyVersionRules(@Param('version') version: string) {
    const rules = await this.policyVersioning.getRulesForDate(new Date());
    const filtered = rules.filter((r: any) => r.version === version);
    return { version, ruleCount: filtered.length, rules: filtered };
  }

  @Post('policy-versions/:version/activate')
  @Roles('ZONAL_CREDIT_HEAD', 'SYSTEM')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Activate a specific policy version' })
  @ApiResponse({ status: 200, description: 'Policy version activated' })
  async activatePolicyVersion(@Param('version') version: string) {
    await this.policyVersioning.activateVersion(version);
    return { message: `Policy version ${version} activated` };
  }

  @Get('policy-versions/compare')
  @Roles('ZONAL_CREDIT_HEAD', 'SYSTEM')
  @ApiQuery({ name: 'versionA', required: true })
  @ApiQuery({ name: 'versionB', required: true })
  @ApiOperation({ summary: 'Compare two policy versions' })
  @ApiResponse({ status: 200, description: 'Policy version comparison' })
  async compareVersions(
    @Query('versionA') versionA: string,
    @Query('versionB') versionB: string,
  ) {
    return this.policyVersioning.compareVersions(versionA, versionB);
  }
}
