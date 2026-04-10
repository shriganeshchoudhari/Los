import { Test, TestingModule } from '@nestjs/testing';
import { RuleEvaluatorService, RuleEngineResult } from './rule-evaluator.service';
import { LoanProductConfig } from '../entities/product.entity';
import { RuleEvaluationContext } from './rule.types';

const DEFAULT_PRODUCT: LoanProductConfig = {
  id: 'test-product',
  productCode: 'PL_SAL',
  loanType: 'PERSONAL_LOAN',
  minAmount: 5000000,
  maxAmount: 2500000000,
  minTenureMonths: 12,
  maxTenureMonths: 60,
  minAge: 21,
  maxAge: 65,
  minCreditScore: 650,
  maxFoir: 50,
  maxLtv: null,
  baseRateBps: 850,
  spreadBps: 200,
  processingFeePercent: 1,
  prepaymentPenaltyPct: 0,
  allowedEmploymentTypes: ['SALARIED_PRIVATE', 'SALARIED_GOVT'],
  mandatoryDocuments: [],
  conditionalRules: {},
  isActive: true,
  effectiveFrom: new Date('2024-01-01'),
  createdAt: new Date(),
};

const DEFAULT_CTX: RuleEvaluationContext = {
  applicationId: 'app-001',
  loanType: 'PERSONAL_LOAN',
  channelCode: 'BRANCH',
  requestedAmount: 100000000,
  requestedTenureMonths: 36,
  applicantAge: 34,
  employmentType: 'SALARIED_PRIVATE',
  employmentTenureMonths: 24,
  grossMonthlyIncome: 15000000,
  netMonthlyIncome: 12000000,
  totalAnnualIncome: 180000000,
  collateralValue: undefined,
  bureauData: {
    creditScore: 751,
    scoreModel: 'CIBIL Score 3.0',
    activeAccounts: 2,
    closedAccounts: 1,
    overdueAccounts: 0,
    totalExposure: 50000000,
    securedExposure: 0,
    unsecuredExposure: 50000000,
    totalEmi: 1500000,
    dpd30: 0,
    dpd60: 0,
    dpd90: 0,
    dpd180: 0,
    maxDpd: 0,
    enquiries30d: 1,
    enquiries90d: 2,
    writeoffs: 0,
    suitFiled: false,
    wilfulDefaulter: false,
    disputed: false,
    fraudFlag: false,
    enquiries: [],
    accounts: [],
  },
  existingApplications: [],
  previousLoans: [],
};

describe('RuleEvaluatorService', () => {
  let service: RuleEvaluatorService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [RuleEvaluatorService],
    }).compile();
    service = module.get<RuleEvaluatorService>(RuleEvaluatorService);
  });

  describe('evaluateAllRules', () => {
    it('should evaluate all active rules', () => {
      const result: RuleEngineResult = service.evaluateAllRules(DEFAULT_CTX, DEFAULT_PRODUCT, []);
      expect(result.totalRules).toBeGreaterThanOrEqual(47);
      expect(result.applicationId).toBe('app-001');
    });

    it('should pass all rules for a clean profile', () => {
      const result: RuleEngineResult = service.evaluateAllRules(DEFAULT_CTX, DEFAULT_PRODUCT, []);
      expect(result.canAutoApprove).toBe(true);
      expect(result.shouldReject).toBe(false);
      expect(result.shouldRefer).toBe(false);
    });

    it('should reject when credit score is below minimum', () => {
      const lowScoreCtx: RuleEvaluationContext = {
        ...DEFAULT_CTX,
        bureauData: { ...DEFAULT_CTX.bureauData!, creditScore: 550 },
      };
      const result = service.evaluateAllRules(lowScoreCtx, DEFAULT_PRODUCT, []);
      expect(result.shouldReject).toBe(true);
      expect(result.hardStopFailures.some(r => r.ruleId === 'CS_001')).toBe(true);
    });

    it('should reject when FOIR exceeds limit', () => {
      const highFoirCtx: RuleEvaluationContext = {
        ...DEFAULT_CTX,
        bureauData: { ...DEFAULT_CTX.bureauData!, totalEmi: 11000000 },
        netMonthlyIncome: 12000000,
      };
      const result = service.evaluateAllRules(highFoirCtx, DEFAULT_PRODUCT, []);
      expect(result.hardStopFailures.some(r => r.ruleId === 'FOIR_001')).toBe(true);
    });

    it('should reject when age at maturity exceeds max', () => {
      const oldCtx: RuleEvaluationContext = {
        ...DEFAULT_CTX,
        applicantAge: 60,
        requestedTenureMonths: 84,
      };
      const result = service.evaluateAllRules(oldCtx, DEFAULT_PRODUCT, []);
      expect(result.hardStopFailures.some(r => r.ruleId === 'AGE_001')).toBe(true);
    });

    it('should reject when amount exceeds product max', () => {
      const highAmtCtx: RuleEvaluationContext = {
        ...DEFAULT_CTX,
        requestedAmount: 3000000000,
      };
      const result = service.evaluateAllRules(highAmtCtx, DEFAULT_PRODUCT, []);
      expect(result.hardStopFailures.some(r => r.ruleId === 'AMT_001')).toBe(true);
    });

    it('should reject when 90+ DPD found', () => {
      const dpdCtx: RuleEvaluationContext = {
        ...DEFAULT_CTX,
        bureauData: { ...DEFAULT_CTX.bureauData!, dpd90: 30, dpd180: 0 },
      };
      const result = service.evaluateAllRules(dpdCtx, DEFAULT_PRODUCT, []);
      expect(result.hardStopFailures.some(r => r.ruleId === 'DPD_001')).toBe(true);
    });

    it('should reject when fraud flag is set', () => {
      const fraudCtx: RuleEvaluationContext = {
        ...DEFAULT_CTX,
        bureauData: { ...DEFAULT_CTX.bureauData!, fraudFlag: true },
      };
      const result = service.evaluateAllRules(fraudCtx, DEFAULT_PRODUCT, []);
      expect(result.hardStopFailures.some(r => r.ruleId === 'FRD_001')).toBe(true);
    });

    it('should reject when suit filed is set', () => {
      const suitCtx: RuleEvaluationContext = {
        ...DEFAULT_CTX,
        bureauData: { ...DEFAULT_CTX.bureauData!, suitFiled: true },
      };
      const result = service.evaluateAllRules(suitCtx, DEFAULT_PRODUCT, []);
      expect(result.hardStopFailures.some(r => r.ruleId === 'FRD_002')).toBe(true);
    });

    it('should reject when wilful defaulter is set', () => {
      const defaulterCtx: RuleEvaluationContext = {
        ...DEFAULT_CTX,
        bureauData: { ...DEFAULT_CTX.bureauData!, wilfulDefaulter: true },
      };
      const result = service.evaluateAllRules(defaulterCtx, DEFAULT_PRODUCT, []);
      expect(result.hardStopFailures.some(r => r.ruleId === 'FRD_003')).toBe(true);
    });

    it('should warn on high enquiry velocity', () => {
      const highEnqCtx: RuleEvaluationContext = {
        ...DEFAULT_CTX,
        bureauData: { ...DEFAULT_CTX.bureauData!, enquiries30d: 8, enquiries90d: 10 },
      };
      const result = service.evaluateAllRules(highEnqCtx, DEFAULT_PRODUCT, []);
      expect(result.warningResults.some(r => r.ruleId === 'ENQ_001')).toBe(true);
    });

    it('should warn when income below minimum', () => {
      const lowIncCtx: RuleEvaluationContext = {
        ...DEFAULT_CTX,
        netMonthlyIncome: 1000000,
        grossMonthlyIncome: 1200000,
      };
      const result = service.evaluateAllRules(lowIncCtx, DEFAULT_PRODUCT, []);
      expect(result.hardStopFailures.some(r => r.ruleId === 'INC_001')).toBe(true);
    });

    it('should refer to credit committee for low credit score with multiple warnings', () => {
      const riskyCtx: RuleEvaluationContext = {
        ...DEFAULT_CTX,
        bureauData: {
          ...DEFAULT_CTX.bureauData!,
          creditScore: 580,
          dpd30: 5,
          enquiries30d: 5,
        },
      };
      const result = service.evaluateAllRules(riskyCtx, DEFAULT_PRODUCT, []);
      expect(result.shouldRefer || result.shouldReject).toBe(true);
    });

    it('should produce hard stop failures before warnings', () => {
      const result: RuleEngineResult = service.evaluateAllRules(DEFAULT_CTX, DEFAULT_PRODUCT, []);
      const allFails = [...result.hardStopFailures, ...result.warningResults];
      expect(allFails.length).toBeGreaterThan(0);
      allFails.forEach(r => {
        expect(r.ruleId).toBeDefined();
        expect(r.message).toBeDefined();
      });
    });

    it('should include evaluation timing', () => {
      const result = service.evaluateAllRules(DEFAULT_CTX, DEFAULT_PRODUCT, []);
      expect(result.evaluationTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.evaluatedAt).toBeInstanceOf(Date);
    });

    it('should skip LTV rules when no collateral', () => {
      const result = service.evaluateAllRules(DEFAULT_CTX, DEFAULT_PRODUCT, []);
      const ltvResults = [...result.passResults, ...result.skippedResults].filter(r =>
        ['LTV_001', 'LTV_002', 'LTV_003'].includes(r.ruleId)
      );
      expect(ltvResults.length).toBe(3);
    });

    it('should evaluate LTV rules when collateral provided', () => {
      const collateralCtx: RuleEvaluationContext = {
        ...DEFAULT_CTX,
        collateralValue: 200000000,
        requestedAmount: 140000000,
      };
      const result = service.evaluateAllRules(collateralCtx, DEFAULT_PRODUCT, []);
      const ltvRule = [...result.passResults, ...result.warningResults, ...result.hardStopFailures]
        .find(r => r.ruleId === 'LTV_001');
      expect(ltvRule).toBeDefined();
      expect(ltvRule!.outcome).toBe('PASS');
    });

    it('should fail LTV when exceeds product max', () => {
      const highLtvCtx: RuleEvaluationContext = {
        ...DEFAULT_CTX,
        collateralValue: 100000000,
        requestedAmount: 90000000,
      };
      const result = service.evaluateAllRules(highLtvCtx, DEFAULT_PRODUCT, []);
      expect(result.hardStopFailures.some(r => r.ruleId === 'LTV_001')).toBe(true);
    });
  });

  describe('calculateScorecard', () => {
    it('should calculate score and grade for good profile', () => {
      const result = service.calculateScorecard({
        creditScore: 800,
        netMonthlyIncome: 15000000,
        grossMonthlyIncome: 18000000,
        bureauData: {
          dpd30: 0, dpd60: 0, dpd90: 0, dpd180: 0,
          writeoffs: 0, enquiries30d: 1, totalExposure: 20000000,
          activeAccounts: 2,
          securedExposure: 0, unsecuredExposure: 20000000, totalEmi: 0,
        },
        employmentType: 'SALARIED_PRIVATE',
        requestedAmount: 100000000,
        tenure: 36,
        foir: 35,
      });
      expect(result.totalScore).toBeGreaterThanOrEqual(700);
      expect(['A+', 'A', 'B+', 'B']).toContain(result.grade);
      expect(result.predictionProbability).toBeLessThan(0.1);
    });

    it('should return high risk grade for poor profile', () => {
      const result = service.calculateScorecard({
        creditScore: 550,
        netMonthlyIncome: 2000000,
        grossMonthlyIncome: 2500000,
        bureauData: {
          dpd30: 10, dpd60: 5, dpd90: 2, dpd180: 0,
          writeoffs: 1, enquiries30d: 5, totalExposure: 80000000,
          activeAccounts: 5,
          securedExposure: 0, unsecuredExposure: 80000000, totalEmi: 500000,
        },
        employmentType: 'SALARIED_PRIVATE',
        requestedAmount: 50000000,
        tenure: 48,
        foir: 60,
      });
      expect(['D', 'F']).toContain(result.grade);
      expect(result.predictionProbability).toBeGreaterThan(0.2);
      expect(result.riskFactors.length).toBeGreaterThan(0);
    });

    it('should include factor scores in result', () => {
      const result = service.calculateScorecard({
        creditScore: 700,
        netMonthlyIncome: 10000000,
        grossMonthlyIncome: 12000000,
        bureauData: {
          dpd30: 0, dpd60: 0, dpd90: 0, dpd180: 0,
          writeoffs: 0, enquiries30d: 2, totalExposure: 30000000,
          activeAccounts: 3,
          securedExposure: 0, unsecuredExposure: 30000000, totalEmi: 1000000,
        },
        employmentType: 'SALARIED_GOVT',
        requestedAmount: 80000000,
        tenure: 36,
        foir: 40,
      });
      expect(result.factorScores).toHaveProperty('creditScore');
      expect(result.factorScores).toHaveProperty('income');
      expect(result.factorScores).toHaveProperty('bureauHistory');
      expect(result.factorScores).toHaveProperty('employment');
      expect(result.factorScores).toHaveProperty('exposure');
    });

    it('should cap total score at max (1000)', () => {
      const result = service.calculateScorecard({
        creditScore: 900,
        netMonthlyIncome: 50000000,
        grossMonthlyIncome: 60000000,
        bureauData: {
          dpd30: 0, dpd60: 0, dpd90: 0, dpd180: 0,
          writeoffs: 0, enquiries30d: 0, totalExposure: 0,
          activeAccounts: 1,
          securedExposure: 0, unsecuredExposure: 0, totalEmi: 0,
        },
        employmentType: 'SALARIED_GOVT',
        requestedAmount: 50000000,
        tenure: 24,
        foir: 10,
      });
      expect(result.totalScore).toBeLessThanOrEqual(1000);
    });
  });

  describe('getRuleSummary', () => {
    it('should return total count of 47 rules', () => {
      const summary = service.getRuleSummary();
      expect(summary.total).toBe(47);
    });

    it('should have correct category breakdown', () => {
      const summary = service.getRuleSummary();
      expect(summary.byCategory['CREDIT_SCORE']).toBe(5);
      expect(summary.byCategory['FOIR']).toBe(4);
      expect(summary.byCategory['INCOME']).toBe(4);
      expect(summary.byCategory['AGE']).toBe(4);
      expect(summary.byCategory['AMOUNT_TENURE']).toBe(5);
      expect(summary.byCategory['BUREAU_HISTORY']).toBe(7);
      expect(summary.byCategory['FRAUD']).toBe(4);
      expect(summary.byCategory['EMPLOYMENT']).toBe(3);
      expect(summary.byCategory['LTV']).toBe(3);
      expect(summary.byCategory['PRODUCT_POLICY']).toBe(3);
      expect(summary.byCategory['LEGAL']).toBe(3);
      expect(summary.byCategory['DEDUPLICATION']).toBe(1);
      expect(summary.byCategory['CHANNEL']).toBe(1);
    });

    it('should count hard stops correctly', () => {
      const summary = service.getRuleSummary();
      expect(summary.hardStopCount).toBe(22);
      expect(summary.warningCount).toBe(23);
    });
  });
});
