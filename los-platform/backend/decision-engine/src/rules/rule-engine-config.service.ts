import { Injectable, Logger, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, IsNull, Not, In } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import { RuleDefinitionEntity } from './rule-definition.entity';
import {
  RuleDefinition,
  RuleEvaluationContext,
  RuleOutcome,
  RuleEvaluationResult,
  RuleSeverity,
  RuleCondition,
  RuleThenClause,
  ProductOverride,
} from './rule.types';
import { RuleConditionEvaluator } from './rule-condition-evaluator';
import { PolicyVersioningService } from './policy-versioning.service';

interface DynamicRuleDefinition {
  ruleId: string;
  name: string;
  description: string;
  category: string;
  severity: RuleSeverity;
  version: string;
  priority: number;
  isActive: boolean;
  effectiveFrom: Date;
  effectiveTo?: Date;
  loanTypes?: string[];
  channels?: string[];
  conditions: RuleCondition[];
  thenClause: RuleThenClause;
  productOverrides?: ProductOverride[];
  skipConditions?: RuleCondition[];
}

@Injectable()
export class RuleEngineConfigService {
  private readonly logger = new Logger(RuleEngineConfigService.name);

  constructor(
    @InjectRepository(RuleDefinitionEntity)
    private readonly ruleRepo: Repository<RuleDefinitionEntity>,
    private readonly policyVersioning: PolicyVersioningService,
    private readonly conditionEvaluator: RuleConditionEvaluator,
  ) {}

  async createRule(dto: CreateRuleDto, createdBy: string): Promise<DynamicRuleDefinition> {
    const existing = await this.ruleRepo.findOne({ where: { ruleId: dto.ruleId } });
    if (existing) {
      throw new ConflictException(`Rule with ID ${dto.ruleId} already exists`);
    }

    const entity = this.ruleRepo.create({
      id: uuidv4(),
      ruleId: dto.ruleId,
      name: dto.name,
      description: dto.description,
      category: dto.category,
      severity: dto.severity,
      version: dto.version || '1.0',
      priority: dto.priority || 50,
      isActive: dto.isActive ?? true,
      effectiveFrom: dto.effectiveFrom ? new Date(dto.effectiveFrom) : new Date(),
      effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : null,
      loanTypes: dto.loanTypes || [],
      channels: dto.channels || [],
      conditions: dto.conditions || [],
      thenClause: dto.thenClause || { outcome: RuleOutcome.PASS, outcomeMessage: '' },
      productOverrides: dto.productOverrides || [],
      skipConditions: dto.skipConditions || [],
      createdBy,
      createdAt: new Date(),
    });

    const saved = await this.ruleRepo.save(entity);
    this.logger.log(`Rule ${saved.ruleId} created by ${createdBy}`);
    return this.toRuleDefinition(saved);
  }

  async updateRule(ruleId: string, dto: UpdateRuleDto, updatedBy: string): Promise<DynamicRuleDefinition> {
    const existing = await this.ruleRepo.findOne({ where: { ruleId } });
    if (!existing) {
      throw new NotFoundException(`Rule ${ruleId} not found`);
    }

    const updates: Partial<RuleDefinitionEntity> = {
      name: dto.name ?? existing.name,
      description: dto.description ?? existing.description,
      category: dto.category ?? existing.category,
      severity: dto.severity ?? existing.severity,
      priority: dto.priority ?? existing.priority,
      isActive: dto.isActive ?? existing.isActive,
      effectiveFrom: dto.effectiveFrom ? new Date(dto.effectiveFrom) : existing.effectiveFrom,
      effectiveTo: dto.effectiveTo ? new Date(dto.effectiveTo) : existing.effectiveTo,
      loanTypes: dto.loanTypes ?? existing.loanTypes,
      channels: dto.channels ?? existing.channels,
      conditions: dto.conditions ?? existing.conditions,
      thenClause: dto.thenClause ?? existing.thenClause,
      productOverrides: dto.productOverrides ?? existing.productOverrides,
      skipConditions: dto.skipConditions ?? existing.skipConditions,
      updatedAt: new Date(),
      updatedBy,
    };

    await this.ruleRepo.update({ ruleId }, updates);
    const updated = await this.ruleRepo.findOne({ where: { ruleId } });
    this.logger.log(`Rule ${ruleId} updated by ${updatedBy}`);
    return this.toRuleDefinition(updated!);
  }

  async deleteRule(ruleId: string): Promise<void> {
    const existing = await this.ruleRepo.findOne({ where: { ruleId } });
    if (!existing) {
      throw new NotFoundException(`Rule ${ruleId} not found`);
    }
    await this.ruleRepo.softDelete({ ruleId });
    this.logger.log(`Rule ${ruleId} soft-deleted`);
  }

  async getRule(ruleId: string): Promise<DynamicRuleDefinition> {
    const entity = await this.ruleRepo.findOne({ where: { ruleId } });
    if (!entity) {
      throw new NotFoundException(`Rule ${ruleId} not found`);
    }
    return this.toRuleDefinition(entity);
  }

  async listRules(filter?: {
    category?: string;
    severity?: string;
    isActive?: boolean;
    loanType?: string;
    page?: number;
    size?: number;
  }): Promise<{ items: DynamicRuleDefinition[]; total: number; page: number; size: number }> {
    const where: any = {};
    if (filter?.category) where.category = filter.category;
    if (filter?.severity) where.severity = filter.severity;
    if (filter?.isActive !== undefined) where.isActive = filter.isActive;

    const page = filter?.page ?? 0;
    const size = filter?.size ?? 50;

    const [entities, total] = await this.ruleRepo.findAndCount({
      where,
      order: { category: 'ASC', priority: 'ASC' },
      skip: page * size,
      take: size,
    });

    let items = entities.map((e) => this.toRuleDefinition(e));

    if (filter?.loanType) {
      items = items.filter(
        (r) => !r.loanTypes || r.loanTypes.length === 0 || r.loanTypes.includes(filter.loanType!),
      );
    }

    return { items, total, page, size };
  }

  async evaluateDynamicRule(
    def: DynamicRuleDefinition,
    ctx: RuleEvaluationContext,
  ): Promise<RuleEvaluationResult> {
    if (def.loanTypes && def.loanTypes.length > 0 && !def.loanTypes.includes(ctx.loanType)) {
      return this.buildResult(def, RuleOutcome.SKIP, 'Loan type not applicable', true);
    }

    if (def.channels && def.channels.length > 0 && !def.channels.includes(ctx.channelCode)) {
      return this.buildResult(def, RuleOutcome.SKIP, 'Channel not applicable', false);
    }

    if (this.conditionEvaluator.evaluateSkipConditions(def.skipConditions, ctx)) {
      return this.buildResult(def, RuleOutcome.SKIP, 'Skip conditions met', false);
    }

    const allConditionsMet = def.conditions.every((c) =>
      this.conditionEvaluator.evaluateCondition(c, ctx),
    );

    const outcome = allConditionsMet ? def.thenClause.outcome : RuleOutcome.PASS;
    const message = allConditionsMet
      ? def.thenClause.outcomeMessage
      : 'Conditions not met — rule passed by default';

    return {
      ruleId: def.ruleId,
      ruleName: def.name,
      category: def.category as any,
      severity: def.severity,
      outcome,
      threshold: this.formatThreshold(def),
      actualValue: this.formatActualValue(def, ctx),
      message,
      isHardStop: def.thenClause.outcome === RuleOutcome.FAIL && def.severity === RuleSeverity.HARD_STOP,
      rejectionCode: def.thenClause.rejectionCode,
      conditionCode: def.thenClause.conditionCode,
      isMandatory: def.thenClause.isMandatory,
      evaluatedAt: new Date(),
    };
  }

  async getActiveDynamicRules(): Promise<DynamicRuleDefinition[]> {
    const today = new Date();
    const entities = await this.ruleRepo.find({
      where: {
        isActive: true,
        effectiveFrom: Not(IsNull()),
      },
      order: { category: 'ASC', priority: 'ASC' },
    });

    return entities
      .filter((e) => {
        const from = new Date(e.effectiveFrom);
        const to = e.effectiveTo ? new Date(e.effectiveTo) : null;
        return from <= today && (!to || to >= today);
      })
      .map((e) => this.toRuleDefinition(e));
  }

  async testRule(
    ruleId: string,
    ctx: RuleEvaluationContext,
  ): Promise<{ rule: DynamicRuleDefinition; result: RuleEvaluationResult }> {
    const rule = await this.getRule(ruleId);
    const result = await this.evaluateDynamicRule(rule, ctx);
    return { rule, result };
  }

  async bulkCreateRules(
    dtos: CreateRuleDto[],
    createdBy: string,
  ): Promise<{ created: number; failed: { ruleId: string; reason: string }[] }> {
    const failed: { ruleId: string; reason: string }[] = [];
    let created = 0;

    for (const dto of dtos) {
      try {
        await this.createRule(dto, createdBy);
        created++;
      } catch (err: any) {
        failed.push({ ruleId: dto.ruleId, reason: err.message });
      }
    }

    return { created, failed };
  }

  private buildResult(
    def: DynamicRuleDefinition,
    outcome: RuleOutcome,
    message: string,
    isHardStop: boolean,
  ): RuleEvaluationResult {
    return {
      ruleId: def.ruleId,
      ruleName: def.name,
      category: def.category as any,
      severity: def.severity,
      outcome,
      threshold: this.formatThreshold(def),
      actualValue: 'N/A',
      message,
      isHardStop,
      evaluatedAt: new Date(),
    };
  }

  private formatThreshold(def: DynamicRuleDefinition): string {
    if (def.conditions.length === 0) return 'None';
    return def.conditions
      .map((c) => `${c.field} ${c.operator} ${JSON.stringify(c.value)}`)
      .join(' AND ');
  }

  private formatActualValue(def: DynamicRuleDefinition, ctx: RuleEvaluationContext): string {
    return def.conditions
      .map((c) => {
        const value = this.getCtxValue(c.field, ctx);
        return `${c.field}=${JSON.stringify(value)}`;
      })
      .join(', ');
  }

  private getCtxValue(field: string, ctx: RuleEvaluationContext): any {
    const parts = field.split('.');
    let val: any = ctx;
    for (const p of parts) {
      if (val == null) return undefined;
      val = val[p];
    }
    return val;
  }

  private toRuleDefinition(entity: RuleDefinitionEntity): DynamicRuleDefinition {
    return {
      ruleId: entity.ruleId,
      name: entity.name,
      description: entity.description,
      category: entity.category,
      severity: entity.severity as RuleSeverity,
      version: entity.version,
      priority: entity.priority,
      isActive: entity.isActive,
      effectiveFrom: new Date(entity.effectiveFrom),
      effectiveTo: entity.effectiveTo ? new Date(entity.effectiveTo) : undefined,
      loanTypes: Array.isArray(entity.loanTypes) ? entity.loanTypes : [],
      channels: Array.isArray(entity.channels) ? entity.channels : [],
      conditions: Array.isArray(entity.conditions) ? entity.conditions : [],
      thenClause: entity.thenClause as RuleThenClause || { outcome: RuleOutcome.PASS, outcomeMessage: '' },
      productOverrides: Array.isArray(entity.productOverrides) ? entity.productOverrides : [],
      skipConditions: Array.isArray(entity.skipConditions) ? entity.skipConditions : [],
    };
  }
}

export interface CreateRuleDto {
  ruleId: string;
  name: string;
  description: string;
  category: string;
  severity: RuleSeverity;
  version?: string;
  priority?: number;
  isActive?: boolean;
  effectiveFrom?: string;
  effectiveTo?: string;
  loanTypes?: string[];
  channels?: string[];
  conditions?: RuleCondition[];
  thenClause?: RuleThenClause;
  productOverrides?: ProductOverride[];
  skipConditions?: RuleCondition[];
}

export interface UpdateRuleDto {
  name?: string;
  description?: string;
  category?: string;
  severity?: RuleSeverity;
  priority?: number;
  isActive?: boolean;
  effectiveFrom?: string;
  effectiveTo?: string;
  loanTypes?: string[];
  channels?: string[];
  conditions?: RuleCondition[];
  thenClause?: RuleThenClause;
  productOverrides?: ProductOverride[];
  skipConditions?: RuleCondition[];
}
