import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, MoreThan, LessThanOrEqual } from 'typeorm';
import {
  InterestRateConfig,
  RateHistory,
} from './rate.entity';
import {
  RateCalculationInput,
  RateCalculationResult,
  RateBenchmarkType,
  CreditGrade,
  EmploymentCategory,
  MCLOverage,
} from './rate.types';

const BPS = 10000;

const GRADE_SCORE_RANGES: Record<CreditGrade, { min: number; max: number }> = {
  [CreditGrade.A_PLUS]: { min: 850, max: 900 },
  [CreditGrade.A]: { min: 780, max: 849 },
  [CreditGrade.B_PLUS]: { min: 700, max: 779 },
  [CreditGrade.B]: { min: 620, max: 699 },
  [CreditGrade.C]: { min: 550, max: 619 },
  [CreditGrade.D]: { min: 450, max: 549 },
  [CreditGrade.F]: { min: 0, max: 449 },
};

const EMPLOYMENT_CATEGORY_MAP: Record<string, EmploymentCategory> = {
  SALARIED_PRIVATE: EmploymentCategory.SALARIED,
  SALARIED_GOVERNMENT: EmploymentCategory.SALARIED,
  SALARIED_PSU: EmploymentCategory.SALARIED,
  SELF_EMPLOYED_PROFESSIONAL: EmploymentCategory.SELF_EMPLOYED,
  SELF_EMPLOYED_BUSINESS: EmploymentCategory.SELF_EMPLOYED,
  AGRICULTURALIST: EmploymentCategory.AGRICULTURALIST,
  PENSIONER: EmploymentCategory.PENSIONER,
};

const RISK_EMPLOYER_PREFIXES = ['MULTI', 'CHIT', 'NBFC', 'MONEY', 'FINANCE', 'GAME', 'CRYPTO', 'P2P'];

@Injectable()
export class InterestRateService {
  private readonly logger = new Logger(InterestRateService.name);

  constructor(
    @InjectRepository(InterestRateConfig)
    private readonly rateConfigRepo: Repository<InterestRateConfig>,
    @InjectRepository(RateHistory)
    private readonly rateHistoryRepo: Repository<RateHistory>,
  ) {}

  async calculateRate(input: RateCalculationInput): Promise<RateCalculationResult> {
    const config = await this.getActiveConfig(input.productCode);
    if (!config) {
      return this.getFallbackRate(input);
    }

    const benchmarkRate = await this.getBenchmarkRate(config.benchmarkType);
    const baseSpreadBps = config.defaultSpreadBps;

    const tenureAdjustmentBps = this.calculateTenureAdjustment(
      input.approvedTenureMonths,
      config.tenureSpreadBands || [],
    );

    const creditGradeAdjustmentBps = this.calculateCreditGradeAdjustment(
      input.creditGrade,
      config.creditGradeSpreads || [],
      input.bureauScore,
    );

    const employmentCategory = this.mapEmploymentCategory(input.employmentType);
    const employmentAdjustmentBps = this.calculateEmploymentAdjustment(
      employmentCategory,
      config.employmentAdjustmentsBps || {} as Record<EmploymentCategory, number>,
    );

    const amountRiskAdjustmentBps = this.calculateAmountRiskAdjustment(
      input.approvedAmount,
      config.amountRiskThresholds || [],
    );

    const employerRiskAdjustmentBps = this.calculateEmployerRiskAdjustment(
      input.employerCategory || '',
    );

    const totalSpreadBps =
      baseSpreadBps +
      tenureAdjustmentBps +
      creditGradeAdjustmentBps +
      employmentAdjustmentBps +
      amountRiskAdjustmentBps +
      employerRiskAdjustmentBps;

    let finalRateBps = Math.round(benchmarkRate * 100 + totalSpreadBps);
    let isRateCapped = false;
    let rateCappingReason: string | undefined;

    if (finalRateBps < config.minRateBps) {
      finalRateBps = config.minRateBps;
      isRateCapped = true;
      rateCappingReason = `Rate capped at minimum ${(config.minRateBps / 100).toFixed(2)}% (A+ grade / best employment category)`;
    } else if (finalRateBps > config.maxRateBps) {
      finalRateBps = config.maxRateBps;
      isRateCapped = true;
      rateCappingReason = `Rate capped at maximum ${(config.maxRateBps / 100).toFixed(2)}% (sub-prime grade / high-risk profile)`;
    }

    const finalRatePercent = Math.round((finalRateBps / 100) * 100) / 100;

    const tenureBandDesc = this.getTenureBandDescription(input.approvedTenureMonths, config.tenureSpreadBands || []);
    const gradeDesc = `${input.creditGrade}: ${(creditGradeAdjustmentBps >= 0 ? '+' : '')}${(creditGradeAdjustmentBps / 100).toFixed(2)}% vs base`;
    const empDesc = `${employmentCategory}: ${(employmentAdjustmentBps >= 0 ? '+' : '')}${(employmentAdjustmentBps / 100).toFixed(2)}%`;
    const amountDesc = amountRiskAdjustmentBps > 0 ? `+${(amountRiskAdjustmentBps / 100).toFixed(2)}% for ₹${(input.approvedAmount / 100000).toFixed(1)}L` : 'None';

    const result: RateCalculationResult = {
      benchmarkType: config.benchmarkType,
      benchmarkRate,
      baseSpreadBps,
      tenureAdjustmentBps,
      creditGradeAdjustmentBps,
      employmentAdjustmentBps,
      amountRiskAdjustmentBps,
      totalSpreadBps,
      finalRateBps,
      finalRatePercent,
      minRateBps: config.minRateBps,
      maxRateBps: config.maxRateBps,
      isRateCapped,
      rateCappingReason,
      calculationBreakdown: {
        mclrRate: benchmarkRate,
        baseSpread: baseSpreadBps / 100,
        tenureAdjustment: tenureBandDesc,
        gradeAdjustment: gradeDesc,
        employmentAdjustment: empDesc,
        amountRiskPremium: amountDesc,
        totalSpread: totalSpreadBps / 100,
        finalRate: finalRatePercent,
      },
    };

    this.logger.log(
      `Rate calculated for ${input.productCode}: ${finalRatePercent}% (benchmark: ${benchmarkRate}%, spread: ${totalSpreadBps / 100}%, grade: ${input.creditGrade})`,
    );

    return result;
  }

  async recordRate(
    applicationId: string,
    input: RateCalculationInput,
    result: RateCalculationResult,
  ): Promise<void> {
    const record = this.rateHistoryRepo.create({
      applicationId,
      productCode: input.productCode,
      creditGrade: input.creditGrade,
      approvedAmount: input.approvedAmount,
      tenureMonths: input.approvedTenureMonths,
      benchmarkType: result.benchmarkType,
      benchmarkRate: result.benchmarkRate,
      totalSpreadBps: result.totalSpreadBps,
      finalRateBps: result.finalRateBps,
      finalRatePercent: result.finalRatePercent,
      isRateCapped: result.isRateCapped,
      calculationBreakdown: result.calculationBreakdown,
    });
    await this.rateHistoryRepo.save(record);
  }

  async getRatePreview(
    productCode: string,
    amount: number,
    tenureMonths: number,
  ): Promise<{ grade: string; ratePercent: number }[]> {
    const config = await this.getActiveConfig(productCode);
    if (!config?.roiPreviewTable) {
      const grades = Object.values(CreditGrade);
      return grades.map((grade) => ({
        grade,
        ratePercent: this.estimateRateForGrade(productCode, grade, amount, tenureMonths),
      }));
    }

    return config.roiPreviewTable
      .filter((row) => tenureMonths >= row.tenure - 6 && tenureMonths <= row.tenure + 6)
      .map((row) => ({ grade: row.grade, ratePercent: row.ratePercent }));
  }

  async getActiveConfig(productCode: string): Promise<InterestRateConfig | null> {
    const today = new Date();
    return this.rateConfigRepo.findOne({
      where: {
        productCode,
        isActive: true,
        effectiveFrom: LessThanOrEqual(today),
      },
      order: { effectiveFrom: 'DESC' },
    });
  }

  async getBenchmarkRate(type: RateBenchmarkType): Promise<number> {
    const BENCHMARK_DEFAULTS: Record<RateBenchmarkType, number> = {
      [RateBenchmarkType.MCLR_1Y]: 890,
      [RateBenchmarkType.MCLR_3M]: 865,
      [RateBenchmarkType.REPO_RATE]: 650,
      [RateBenchmarkType.T_BILL_91D]: 675,
      [RateBenchmarkType.BASE_RATE]: 925,
    };
    return BENCHMARK_DEFAULTS[type];
  }

  private calculateTenureAdjustment(
    tenureMonths: number,
    bands: { minTenureMonths: number; maxTenureMonths: number; additionalSpreadBps: number }[],
  ): number {
    if (!bands.length) {
      if (tenureMonths <= 12) return 25;
      if (tenureMonths <= 24) return 15;
      if (tenureMonths <= 36) return 0;
      if (tenureMonths <= 60) return -10;
      return -20;
    }

    const band = bands.find(
      (b) => tenureMonths >= b.minTenureMonths && tenureMonths <= b.maxTenureMonths,
    );
    return band?.additionalSpreadBps ?? 0;
  }

  private calculateCreditGradeAdjustment(
    grade: CreditGrade,
    spreads: { grade: string; minSpreadBps: number; maxSpreadBps: number }[],
    bureauScore: number,
  ): number {
    if (!spreads.length) {
      switch (grade) {
        case CreditGrade.A_PLUS: return -100;
        case CreditGrade.A: return -50;
        case CreditGrade.B_PLUS: return 0;
        case CreditGrade.B: return 50;
        case CreditGrade.C: return 125;
        case CreditGrade.D: return 200;
        case CreditGrade.F: return 300;
      }
    }

    const config = spreads.find((s) => s.grade === grade);
    if (!config) return 0;
    const midSpread = (config.minSpreadBps + config.maxSpreadBps) / 2;
    const scoreFactor = (bureauScore - 750) / 50;
    return Math.round(midSpread + scoreFactor * 5);
  }

  private calculateEmploymentAdjustment(
    category: EmploymentCategory,
    adjustments: Record<EmploymentCategory, number>,
  ): number {
    const defaults: Record<EmploymentCategory, number> = {
      [EmploymentCategory.SALARIED]: -25,
      [EmploymentCategory.SELF_EMPLOYED]: 25,
      [EmploymentCategory.AGRICULTURALIST]: 0,
      [EmploymentCategory.PENSIONER]: 10,
    };

    return adjustments[category] ?? defaults[category] ?? 0;
  }

  private calculateAmountRiskAdjustment(
    amount: number,
    thresholds: { minAmount: number; maxAmount: number; additionalBps: number }[],
  ): number {
    if (!thresholds.length) {
      if (amount > 20000000) return 25;
      if (amount > 10000000) return 15;
      if (amount > 5000000) return 5;
      return 0;
    }

    const threshold = thresholds.find(
      (t) => amount >= t.minAmount && amount <= t.maxAmount,
    );
    return threshold?.additionalBps ?? 0;
  }

  private calculateEmployerRiskAdjustment(employerCategory: string): number {
    const upper = employerCategory.toUpperCase();
    const isHighRisk = RISK_EMPLOYER_PREFIXES.some((prefix) => upper.startsWith(prefix));
    return isHighRisk ? 50 : 0;
  }

  private mapEmploymentCategory(employmentType: string): EmploymentCategory {
    return EMPLOYMENT_CATEGORY_MAP[employmentType] ?? EmploymentCategory.SELF_EMPLOYED;
  }

  private getTenureBandDescription(
    tenureMonths: number,
    bands: { minTenureMonths: number; maxTenureMonths: number; additionalSpreadBps: number; description?: string }[],
  ): string {
    if (!bands.length) {
      if (tenureMonths <= 12) return '≤12 months: +0.25% (short tenure premium)';
      if (tenureMonths <= 36) return '13-36 months: base spread';
      if (tenureMonths <= 60) return '37-60 months: -0.10% (long tenure discount)';
      return '61+ months: -0.20% (long tenure discount)';
    }

    const band = bands.find(
      (b) => tenureMonths >= b.minTenureMonths && tenureMonths <= b.maxTenureMonths,
    );
    if (!band) return 'Within default band';
    const sign = band.additionalSpreadBps >= 0 ? '+' : '';
    return `${band.description || `${band.minTenureMonths}-${band.maxTenureMonths}mo`}: ${sign}${(band.additionalSpreadBps / 100).toFixed(2)}%`;
  }

  private getFallbackRate(input: RateCalculationInput): RateCalculationResult {
    const mclrRate = 8.90;
    let spreadBps = 400;

    if (input.creditGrade === CreditGrade.A_PLUS) spreadBps = 250;
    else if (input.creditGrade === CreditGrade.A) spreadBps = 325;
    else if (input.creditGrade === CreditGrade.B_PLUS) spreadBps = 425;
    else if (input.creditGrade === CreditGrade.B) spreadBps = 500;
    else if (input.creditGrade === CreditGrade.C) spreadBps = 600;
    else if (input.creditGrade === CreditGrade.D) spreadBps = 750;
    else if (input.creditGrade === CreditGrade.F) spreadBps = 950;

    if (input.approvedTenureMonths <= 12) spreadBps += 25;
    else if (input.approvedTenureMonths > 60) spreadBps -= 20;

    if (!input.isSalaried) spreadBps += 25;
    if (input.approvedAmount > 10000000) spreadBps += 15;

    const finalRateBps = Math.round(mclrRate * 100 + spreadBps);
    const finalRatePercent = Math.round((finalRateBps / 100) * 100) / 100;
    const minRate = 8.50;
    const maxRate = 22.00;

    let isCapped = false;
    let capReason: string | undefined;
    if (finalRateBps < minRate * 100) {
      isCapped = true;
      capReason = `Capped at minimum ${minRate}%`;
    } else if (finalRateBps > maxRate * 100) {
      isCapped = true;
      capReason = `Capped at maximum ${maxRate}%`;
    }

    return {
      benchmarkType: RateBenchmarkType.MCLR_1Y,
      benchmarkRate: mclrRate,
      baseSpreadBps: 400,
      tenureAdjustmentBps: spreadBps - 400,
      creditGradeAdjustmentBps: 0,
      employmentAdjustmentBps: 0,
      amountRiskAdjustmentBps: 0,
      totalSpreadBps: spreadBps,
      finalRateBps: Math.min(Math.max(finalRateBps, minRate * 100), maxRate * 100),
      finalRatePercent: Math.min(Math.max(finalRatePercent, minRate), maxRate),
      minRateBps: minRate * 100,
      maxRateBps: maxRate * 100,
      isRateCapped: isCapped,
      rateCappingReason: capReason,
      calculationBreakdown: {
        mclrRate,
        baseSpread: 4.0,
        tenureAdjustment: `${input.approvedTenureMonths} months: fallback`,
        gradeAdjustment: `Grade ${input.creditGrade}`,
        employmentAdjustment: input.isSalaried ? 'Salaried: -0.25%' : 'Non-salaried: +0.25%',
        amountRiskPremium: 'None',
        totalSpread: spreadBps / 100,
        finalRate: finalRatePercent,
      },
    };
  }

  private estimateRateForGrade(
    productCode: string,
    grade: CreditGrade,
    amount: number,
    tenureMonths: number,
  ): number {
    const mclrRate = 8.90;
    const gradeSpreadBps: Record<CreditGrade, number> = {
      [CreditGrade.A_PLUS]: 250,
      [CreditGrade.A]: 325,
      [CreditGrade.B_PLUS]: 425,
      [CreditGrade.B]: 500,
      [CreditGrade.C]: 600,
      [CreditGrade.D]: 750,
      [CreditGrade.F]: 950,
    };
    const spreadBps = gradeSpreadBps[grade];
    return Math.round((mclrRate + spreadBps / 100) * 100) / 100;
  }
}
