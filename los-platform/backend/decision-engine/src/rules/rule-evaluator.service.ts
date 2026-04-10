import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { LoanProductConfig, BenchmarkRate } from '../entities/product.entity';
import {
  RuleEvaluationContext,
  DecisionContext,
  RuleEvaluationResult,
  RuleOutcome,
} from './rule.types';
import {
  getAllRuleDefinitions,
  getActiveRules,
  getRulesByCategory,
  getRuleEvaluator,
} from './rule-registry';
import { RuleEngineConfigService } from './rule-engine-config.service';
import { PolicyVersioningService } from './policy-versioning.service';

export interface RuleEngineResult {
  applicationId: string;
  totalRules: number;
  passed: number;
  failed: number;
  warnings: number;
  skipped: number;
  hardStopFailures: RuleEvaluationResult[];
  warningResults: RuleEvaluationResult[];
  passResults: RuleEvaluationResult[];
  skippedResults: RuleEvaluationResult[];
  canAutoApprove: boolean;
  shouldRefer: boolean;
  shouldReject: boolean;
  evaluationTimeMs: number;
  evaluatedAt: Date;
}

export interface ScorecardInput {
  creditScore: number;
  netMonthlyIncome: number;
  grossMonthlyIncome: number;
  bureauData: RuleEvaluationContext['bureauData'];
  employmentType: string;
  requestedAmount: number;
  tenure: number;
  foir: number;
  ltv?: number;
}

@Injectable()
export class RuleEvaluatorService {
  private readonly logger = new Logger(RuleEvaluatorService.name);

  constructor(
    private readonly policyVersioning: PolicyVersioningService,
    private readonly ruleConfig: RuleEngineConfigService,
  ) {}

  async evaluateAllRulesAsync(
    ctx: RuleEvaluationContext,
    product: LoanProductConfig,
    benchmarkRates: BenchmarkRate[] = [],
  ): Promise<RuleEngineResult> {
    const start = Date.now();

    const [codeRules, dbRules] = await Promise.all([
      Promise.resolve(getActiveRules()),
      this.ruleConfig.getActiveDynamicRules(),
    ]);

    const allRules = [...codeRules, ...dbRules];
    const results: RuleEvaluationResult[] = [];
    const benchmarkMap = new Map<string, BenchmarkRate>();
    for (const br of benchmarkRates) {
      benchmarkMap.set(br.type, br);
    }

    const decisionCtx: DecisionContext = { ctx, product, benchmarkRates: benchmarkMap };

    for (const def of allRules) {
      if (def.loanTypes && def.loanTypes.length > 0 && !def.loanTypes.includes(ctx.loanType)) {
        continue;
      }
      if (def.channels && def.channels.length > 0 && !def.channels.includes(ctx.channelCode)) {
        continue;
      }

      const isDbRule = 'conditions' in def && Array.isArray(def.conditions);
      let result: RuleEvaluationResult;

      if (isDbRule) {
        result = await this.ruleConfig.evaluateDynamicRule(def as any, ctx);
      } else {
        const evaluator = getRuleEvaluator(def.ruleId);
        if (!evaluator) {
          this.logger.warn(`No evaluator found for rule ${def.ruleId}`);
          continue;
        }
        result = evaluator(decisionCtx);
      }
      results.push(result);
    }

    const hardStopFailures = results.filter(r => r.isHardStop && r.outcome === RuleOutcome.FAIL);
    const warnings = results.filter(r => r.outcome === RuleOutcome.WARN);
    const passed = results.filter(r => r.outcome === RuleOutcome.PASS);
    const skipped = results.filter(r => r.outcome === RuleOutcome.SKIP);

    const shouldReject = hardStopFailures.length > 0;
    const shouldRefer = !shouldReject && warnings.length >= 5;
    const canAutoApprove = !shouldReject && !shouldRefer;

    return {
      applicationId: ctx.applicationId,
      totalRules: activeRules.length,
      passed: passed.length,
      failed: hardStopFailures.length,
      warnings: warnings.length,
      skipped: skipped.length,
      hardStopFailures,
      warningResults: warnings,
      passResults: passed,
      skippedResults: skipped,
      canAutoApprove,
      shouldRefer,
      shouldReject,
      evaluationTimeMs: Date.now() - start,
      evaluatedAt: new Date(),
    };
  }

  evaluateRulesByCategory(
    ctx: RuleEvaluationContext,
    product: LoanProductConfig,
    category: string,
  ): RuleEvaluationResult[] {
    const defs = getRulesByCategory(category as any);
    const results: RuleEvaluationResult[] = [];
    const benchmarkMap = new Map<string, BenchmarkRate>();
    const decisionCtx: DecisionContext = { ctx, product, benchmarkRates: benchmarkMap };

    for (const def of defs) {
      const evaluator = getRuleEvaluator(def.ruleId);
      if (evaluator) {
        results.push(evaluator(decisionCtx));
      }
    }
    return results;
  }

  getRuleSummary(): {
    total: number;
    byCategory: Record<string, number>;
    hardStopCount: number;
    warningCount: number;
  } {
    const all = getAllRuleDefinitions();
    const byCategory: Record<string, number> = {};
    let hardStopCount = 0;
    let warningCount = 0;

    for (const r of all) {
      byCategory[r.category] = (byCategory[r.category] || 0) + 1;
      if (r.severity === 'HARD_STOP') hardStopCount++;
      if (r.severity === 'WARNING') warningCount++;
    }

    return { total: all.length, byCategory, hardStopCount, warningCount };
  }

  calculateScorecard(input: ScorecardInput): {
    totalScore: number;
    maxScore: number;
    grade: string;
    bandLabel: string;
    predictionProbability: number;
    riskFactors: string[];
    factorScores: Record<string, number>;
  } {
    const maxScore = 1000;
    let totalScore = 500;
    const factorScores: Record<string, number> = {};
    const riskFactors: string[] = [];

    const creditWeight = 0.30;
    const incomeWeight = 0.20;
    const bureauWeight = 0.25;
    const employmentWeight = 0.10;
    const exposureWeight = 0.15;

    // Credit score factor (300-900 range → 0-300 contribution)
    const creditContribution = input.creditScore > 0
      ? Math.max(0, ((input.creditScore - 300) / 600) * 300 * creditWeight)
      : 0;
    totalScore += creditContribution;
    factorScores['creditScore'] = Math.round(creditContribution);
    if (input.creditScore < 650) riskFactors.push(`Low credit score: ${input.creditScore}`);

    // Income factor
    const incomeRatio = Math.min(input.netMonthlyIncome / 5000000, 1);
    const incomeContribution = incomeRatio * 200 * incomeWeight;
    totalScore += incomeContribution;
    factorScores['income'] = Math.round(incomeContribution);
    if (input.netMonthlyIncome < 2500000) riskFactors.push(`Low income: ₹${(input.netMonthlyIncome / 100000).toFixed(1)}L`);

    // Bureau history factor
    let bureauScore = 250;
    if (input.bureauData) {
      const dpd30Penalty = (input.bureauData.dpd30 || 0) * 5;
      const dpd60Penalty = (input.bureauData.dpd60 || 0) * 10;
      const dpd90Penalty = (input.bureauData.dpd90 || 0) * 20;
      const dpd180Penalty = (input.bureauData.dpd180 || 0) * 30;
      const writeoffPenalty = (input.bureauData.writeoffs || 0) * 20;
      const enquiryPenalty = Math.min((input.bureauData.enquiries30d || 0) * 5, 25);
      bureauScore -= (dpd30Penalty + dpd60Penalty + dpd90Penalty + dpd180Penalty + writeoffPenalty + enquiryPenalty);
      bureauScore = Math.max(0, bureauScore);
      if (input.bureauData.dpd90 > 0) riskFactors.push(`DPD 90+: ${input.bureauData.dpd90} days`);
      if (input.bureauData.writeoffs > 0) riskFactors.push(`Write-offs: ${input.bureauData.writeoffs}`);
    }
    const bureauContribution = bureauScore * bureauWeight;
    totalScore += bureauContribution;
    factorScores['bureauHistory'] = Math.round(bureauContribution);

    // Employment factor
    let employmentScore = 100;
    if (input.employmentType === 'SALARIED_GOVT') employmentScore = 100;
    else if (input.employmentType === 'SALARIED_PRIVATE') employmentScore = 80;
    else if (input.employmentType === 'SELF_EMPLOYED_PROFESSIONAL') employmentScore = 70;
    else if (input.employmentType === 'SELF_EMPLOYED_NON_PROFESSIONAL') employmentScore = 60;
    else employmentScore = 50;
    const empContribution = employmentScore * employmentWeight;
    totalScore += empContribution;
    factorScores['employment'] = Math.round(empContribution);

    // Exposure factor
    const exposureRatio = input.bureauData
      ? Math.min((input.bureauData.totalExposure || 0) / (input.grossMonthlyIncome * 12), 1)
      : 0;
    const exposureScore = (1 - exposureRatio) * 150 * exposureWeight;
    totalScore += exposureScore;
    factorScores['exposure'] = Math.round(exposureScore);
    if (exposureRatio > 0.5) riskFactors.push(`High exposure: ${(exposureRatio * 100).toFixed(0)}% of annual income`);

    totalScore = Math.min(maxScore, Math.max(300, totalScore));

    let grade: string;
    let bandLabel: string;
    let predictionProbability: number;

    if (totalScore >= 850) { grade = 'A+'; bandLabel = 'PRIME'; predictionProbability = 0.01; }
    else if (totalScore >= 780) { grade = 'A'; bandLabel = 'PRIME'; predictionProbability = 0.02; }
    else if (totalScore >= 700) { grade = 'B+'; bandLabel = 'NEAR_PRIME'; predictionProbability = 0.05; }
    else if (totalScore >= 620) { grade = 'B'; bandLabel = 'NEAR_PRIME'; predictionProbability = 0.10; }
    else if (totalScore >= 550) { grade = 'C'; bandLabel = 'SUB_PRIME'; predictionProbability = 0.20; }
    else if (totalScore >= 450) { grade = 'D'; bandLabel = 'HIGH_RISK'; predictionProbability = 0.35; }
    else { grade = 'F'; bandLabel = 'VERY_HIGH_RISK'; predictionProbability = 0.55; }

    return {
      totalScore: Math.round(totalScore),
      maxScore,
      grade,
      bandLabel,
      predictionProbability,
      riskFactors,
      factorScores,
    };
  }
}
