import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, LessThanOrEqual, MoreThan, IsNull } from 'typeorm';
import { v4 as uuidv4 } from 'uuid';
import {
  RuleDefinitionEntity,
  RuleCategory,
  RuleSeverity,
} from '../rules/rule-definition.entity';
import { RuleDefinition } from '../rules/rule.types';

interface PolicySnapshot {
  version: string;
  effectiveFrom: Date;
  effectiveTo?: Date;
  rules: PolicyRuleSnapshot[];
  createdBy: string;
  createdAt: Date;
}

interface PolicyRuleSnapshot {
  ruleId: string;
  name: string;
  category: string;
  severity: string;
  priority: number;
  conditions: Record<string, any>;
  thenClause: Record<string, any>;
  productOverrides: Record<string, any>;
  isActive: boolean;
}

@Injectable()
export class PolicyVersioningService {
  private readonly logger = new Logger(PolicyVersioningService.name);

  constructor(
    @InjectRepository(RuleDefinitionEntity)
    private readonly ruleRepo: Repository<RuleDefinitionEntity>,
    private readonly dataSource: DataSource,
  ) {}

  async createPolicyVersion(
    versionName: string,
    effectiveFrom: Date,
    effectiveTo: Date | undefined,
    createdBy: string,
    ruleOverrides: { ruleId: string; changes: Partial<RuleDefinitionEntity> }[] = [],
  ): Promise<PolicySnapshot> {
    const existingActive = await this.ruleRepo.find({
      where: { isActive: true },
    });

    if (effectiveTo && effectiveFrom >= effectiveTo) {
      throw new ConflictException('Effective from must be before effective to');
    }

    const versionStr = versionName || `v${Date.now()}`;

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      await queryRunner.manager.update(
        RuleDefinitionEntity,
        { isActive: true },
        { isActive: false },
      );

      const newRules: PolicyRuleSnapshot[] = [];

      for (const rule of existingActive) {
        const override = ruleOverrides.find((o) => o.ruleId === rule.ruleId);
        const updatedRule = override
          ? { ...rule, ...override.changes }
          : rule;

        const newRule = queryRunner.manager.create(RuleDefinitionEntity, {
          ...updatedRule,
          id: uuidv4(),
          version: versionStr,
          effectiveFrom,
          effectiveTo: effectiveTo || null,
          isActive: true,
          createdAt: new Date(),
        });

        const saved = await queryRunner.manager.save(RuleDefinitionEntity, newRule);

        newRules.push({
          ruleId: saved.ruleId,
          name: saved.name,
          category: saved.category,
          severity: saved.severity,
          priority: saved.priority,
          conditions: saved.conditions as Record<string, any>,
          thenClause: saved.thenClause as Record<string, any>,
          productOverrides: saved.productOverrides as Record<string, any>,
          isActive: saved.isActive,
        });
      }

      for (const override of ruleOverrides) {
        const existing = existingActive.find((r) => r.ruleId === override.ruleId);
        if (!existing) {
          const newRule = queryRunner.manager.create(RuleDefinitionEntity, {
            ...override.changes,
            id: uuidv4(),
            ruleId: override.ruleId,
            version: versionStr,
            effectiveFrom,
            effectiveTo: effectiveTo || null,
            isActive: true,
            createdAt: new Date(),
          });
          const saved = await queryRunner.manager.save(RuleDefinitionEntity, newRule);

          newRules.push({
            ruleId: saved.ruleId,
            name: saved.name,
            category: saved.category,
            severity: saved.severity,
            priority: saved.priority,
            conditions: saved.conditions as Record<string, any>,
            thenClause: saved.thenClause as Record<string, any>,
            productOverrides: saved.productOverrides as Record<string, any>,
            isActive: saved.isActive,
          });
        }
      }

      await queryRunner.commitTransaction();

      this.logger.log(`Policy version ${versionStr} created with ${newRules.length} rules, effective from ${effectiveFrom.toISOString()}`);

      return {
        version: versionStr,
        effectiveFrom,
        effectiveTo,
        rules: newRules,
        createdBy,
        createdAt: new Date(),
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async getActiveRules(): Promise<RuleDefinitionEntity[]> {
    return this.ruleRepo.find({
      where: { isActive: true },
      order: { category: 'ASC', priority: 'ASC' },
    });
  }

  async getRulesForDate(date: Date): Promise<RuleDefinitionEntity[]> {
    return this.ruleRepo
      .createQueryBuilder('r')
      .where('r.is_active = :active', { active: true })
      .andWhere('r.effective_from <= :date', { date })
      .andWhere('(r.effective_to IS NULL OR r.effective_to >= :date)', { date })
      .orderBy('r.category', 'ASC')
      .addOrderBy('r.priority', 'ASC')
      .getMany();
  }

  async getPolicyHistory(): Promise<{
    version: string;
    effectiveFrom: Date;
    effectiveTo: Date | null;
    ruleCount: number;
    createdAt: Date;
  }[]> {
    const rules = await this.ruleRepo.find({
      select: ['version', 'effectiveFrom', 'effectiveTo', 'createdAt'],
      order: { createdAt: 'DESC' },
    });

    const versionMap = new Map<string, { effectiveFrom: Date; effectiveTo: Date | null; createdAt: Date; count: number }>();

    for (const rule of rules) {
      if (!versionMap.has(rule.version)) {
        versionMap.set(rule.version, {
          effectiveFrom: rule.effectiveFrom,
          effectiveTo: rule.effectiveTo || null,
          createdAt: rule.createdAt,
          count: 0,
        });
      }
      versionMap.get(rule.version)!.count++;
    }

    return Array.from(versionMap.entries()).map(([version, data]) => ({
      version,
      effectiveFrom: data.effectiveFrom,
      effectiveTo: data.effectiveTo,
      ruleCount: data.count,
      createdAt: data.createdAt,
    }));
  }

  async getRuleHistory(ruleId: string): Promise<RuleDefinitionEntity[]> {
    return this.ruleRepo.find({
      where: { ruleId },
      order: { version: 'DESC' },
    });
  }

  async compareVersions(versionA: string, versionB: string): Promise<{
    added: RuleDefinitionEntity[];
    removed: RuleDefinitionEntity[];
    modified: { ruleId: string; field: string; oldValue: any; newValue: any }[];
  }> {
    const rulesA = await this.ruleRepo.find({
      where: { version: versionA, isActive: true },
    });
    const rulesB = await this.ruleRepo.find({
      where: { version: versionB, isActive: true },
    });

    const mapA = new Map(rulesA.map((r) => [r.ruleId, r]));
    const mapB = new Map(rulesB.map((r) => [r.ruleId, r]));

    const added = rulesB.filter((r) => !mapA.has(r.ruleId));
    const removed = rulesA.filter((r) => !mapB.has(r.ruleId));

    const modified: { ruleId: string; field: string; oldValue: any; newValue: any }[] = [];
    for (const ruleB of rulesB) {
      const ruleA = mapA.get(ruleB.ruleId);
      if (ruleA) {
        const fields = ['priority', 'severity', 'thenClause', 'conditions', 'productOverrides'];
        for (const field of fields) {
          const valA = (ruleA as any)[field];
          const valB = (ruleB as any)[field];
          if (JSON.stringify(valA) !== JSON.stringify(valB)) {
            modified.push({ ruleId: ruleB.ruleId, field, oldValue: valA, newValue: valB });
          }
        }
      }
    }

    return { added, removed, modified };
  }

  async cloneVersion(sourceVersion: string, newVersion: string, effectiveFrom: Date, createdBy: string): Promise<PolicySnapshot> {
    const sourceRules = await this.ruleRepo.find({
      where: { version: sourceVersion },
    });

    if (sourceRules.length === 0) {
      throw new NotFoundException(`Policy version ${sourceVersion} not found`);
    }

    await this.ruleRepo.update(
      { isActive: true },
      { isActive: false },
    );

    const newRules: PolicyRuleSnapshot[] = [];
    for (const rule of sourceRules) {
      const newRule = this.ruleRepo.create({
        ...rule,
        id: uuidv4(),
        version: newVersion,
        effectiveFrom,
        effectiveTo: null,
        isActive: true,
        createdAt: new Date(),
      });
      const saved = await this.ruleRepo.save(newRule);

      newRules.push({
        ruleId: saved.ruleId,
        name: saved.name,
        category: saved.category,
        severity: saved.severity,
        priority: saved.priority,
        conditions: saved.conditions as Record<string, any>,
        thenClause: saved.thenClause as Record<string, any>,
        productOverrides: saved.productOverrides as Record<string, any>,
        isActive: saved.isActive,
      });
    }

    this.logger.log(`Policy version ${newVersion} cloned from ${sourceVersion} with ${newRules.length} rules`);

    return {
      version: newVersion,
      effectiveFrom,
      effectiveTo: undefined,
      rules: newRules,
      createdBy,
      createdAt: new Date(),
    };
  }

  async activateVersion(version: string): Promise<void> {
    await this.ruleRepo.update({ isActive: true }, { isActive: false });
    await this.ruleRepo.update({ version, isActive: false }, { isActive: true });
    this.logger.log(`Policy version ${version} activated`);
  }
}
