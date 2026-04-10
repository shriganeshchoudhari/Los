import { FeatureEngineeringService } from './feature-engineering.service';
import { BureauContextData, RuleEvaluationContext } from '../rules/rule.types';

describe('FeatureEngineeringService', () => {
  let service: FeatureEngineeringService;

  beforeEach(() => {
    service = new FeatureEngineeringService();
  });

  describe('extractFeatures', () => {
    it('should extract all 26 features from bureau context', () => {
      const ctx: RuleEvaluationContext = {
        applicationId: 'app-001',
        loanType: 'PERSONAL_LOAN',
        channelCode: 'BRANCH',
        requestedAmount: 100000000,
        requestedTenureMonths: 36,
        applicantAge: 34,
        employmentType: 'SALARIED_PRIVATE',
        grossMonthlyIncome: 15000000,
        netMonthlyIncome: 12000000,
        totalAnnualIncome: 180000000,
        bureauData: {
          creditScore: 751,
          scoreModel: 'CIBIL Score 3.0',
          activeAccounts: 2,
          closedAccounts: 1,
          overdueAccounts: 0,
          totalExposure: 50000000,
          securedExposure: 10000000,
          unsecuredExposure: 40000000,
          totalEmi: 1500000,
          dpd30: 0,
          dpd60: 0,
          dpd90: 0,
          dpd180: 0,
          maxDpd: 0,
          enquiries30d: 2,
          enquiries90d: 3,
          writeoffs: 0,
          suitFiled: false,
          wilfulDefaulter: false,
          disputed: false,
          fraudFlag: false,
          enquiries: [],
          accounts: [
            {
              accountNumber: 'ACCT001',
              accountType: 'PL',
              bureauAccountType: 'Personal Loan',
              status: 'Active',
              ownershipType: 'Individual',
              currentBalance: 8000000,
              sanctionAmount: 100000000,
              overdueAmount: 0,
              dpd: 0,
              openedDate: '2021-06-15',
              lender: 'HDFC Bank',
            },
          ],
        },
        existingApplications: [],
        previousLoans: [],
      };

      const features = service.extractFeatures(ctx);

      expect(features.bureauScore).toBe(751);
      expect(features.scoreNormalized).toBeCloseTo((751 - 300) / 600, 2);
      expect(features.dpd90Flag).toBe(0);
      expect(features.dpd60Flag).toBe(0);
      expect(features.dpd30Flag).toBe(0);
      expect(features.maxDpd).toBe(0);
      expect(features.totalExposure).toBe(50000000);
      expect(features.unsecuredExposure).toBe(40000000);
      expect(features.securedExposure).toBe(10000000);
      expect(features.exposureToIncome).toBeCloseTo(50000000 / 180000000, 4);
      expect(features.emiToIncome).toBeCloseTo(1500000 / 15000000, 4);
      expect(features.activeAccounts).toBe(2);
      expect(features.closedAccounts).toBe(1);
      expect(features.totalAccounts).toBe(3);
      expect(features.enquiryVelocity30d).toBe(2);
      expect(features.enquiryVelocity90d).toBe(3);
      expect(features.writeoffFlag).toBe(0);
      expect(features.suitFiledFlag).toBe(0);
      expect(features.wilfulDefaulterFlag).toBe(0);
      expect(features.disputedFlag).toBe(0);
    });

    it('should handle missing bureau data', () => {
      const ctx: RuleEvaluationContext = {
        applicationId: 'app-002',
        loanType: 'PERSONAL_LOAN',
        channelCode: 'BRANCH',
        requestedAmount: 50000000,
        requestedTenureMonths: 24,
        applicantAge: 28,
        employmentType: 'SALARIED_PRIVATE',
        grossMonthlyIncome: 5000000,
        netMonthlyIncome: 4000000,
        totalAnnualIncome: 60000000,
        bureauData: undefined,
        existingApplications: [],
        previousLoans: [],
      };

      const features = service.extractFeatures(ctx);

      expect(features.bureauScore).toBe(0);
      expect(features.scoreNormalized).toBe(0);
      expect(features.dpd90Flag).toBe(0);
      expect(features.maxDpd).toBe(0);
      expect(features.totalExposure).toBe(0);
      expect(features.activeAccounts).toBe(0);
      expect(features.writeoffFlag).toBe(0);
    });

    it('should set DPD flags correctly', () => {
      const ctx: RuleEvaluationContext = {
        applicationId: 'app-003',
        loanType: 'PERSONAL_LOAN',
        channelCode: 'BRANCH',
        requestedAmount: 50000000,
        requestedTenureMonths: 24,
        applicantAge: 28,
        employmentType: 'SALARIED_PRIVATE',
        grossMonthlyIncome: 5000000,
        netMonthlyIncome: 4000000,
        totalAnnualIncome: 60000000,
        bureauData: {
          creditScore: 600,
          scoreModel: 'CIBIL',
          activeAccounts: 1,
          closedAccounts: 0,
          overdueAccounts: 1,
          totalExposure: 10000000,
          securedExposure: 0,
          unsecuredExposure: 10000000,
          totalEmi: 500000,
          dpd30: 3,
          dpd60: 0,
          dpd90: 0,
          dpd180: 0,
          maxDpd: 3,
          enquiries30d: 0,
          enquiries90d: 0,
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

      const features = service.extractFeatures(ctx);

      expect(features.dpd90Flag).toBe(0);
      expect(features.dpd60Flag).toBe(0);
      expect(features.dpd30Flag).toBe(1);
      expect(features.maxDpd).toBe(3);
    });

    it('should flag wilful defaulter', () => {
      const ctx: RuleEvaluationContext = {
        applicationId: 'app-004',
        loanType: 'PERSONAL_LOAN',
        channelCode: 'BRANCH',
        requestedAmount: 50000000,
        requestedTenureMonths: 24,
        applicantAge: 28,
        employmentType: 'SALARIED_PRIVATE',
        grossMonthlyIncome: 5000000,
        netMonthlyIncome: 4000000,
        totalAnnualIncome: 60000000,
        bureauData: {
          creditScore: 550,
          scoreModel: 'CIBIL',
          activeAccounts: 1,
          closedAccounts: 0,
          overdueAccounts: 0,
          totalExposure: 0,
          securedExposure: 0,
          unsecuredExposure: 0,
          totalEmi: 0,
          dpd30: 0,
          dpd60: 0,
          dpd90: 90,
          dpd180: 0,
          maxDpd: 90,
          enquiries30d: 8,
          enquiries90d: 12,
          writeoffs: 0,
          suitFiled: false,
          wilfulDefaulter: true,
          disputed: false,
          fraudFlag: false,
          enquiries: [],
          accounts: [],
        },
        existingApplications: [],
        previousLoans: [],
      };

      const features = service.extractFeatures(ctx);

      expect(features.dpd90Flag).toBe(1);
      expect(features.wilfulDefaulterFlag).toBe(1);
      expect(features.maxDpd).toBe(90);
      expect(features.enquiryVelocity30d).toBe(8);
    });
  });

  describe('featuresToArray', () => {
    it('should convert features to array in correct order', () => {
      const ctx: RuleEvaluationContext = {
        applicationId: 'app-005',
        loanType: 'PERSONAL_LOAN',
        channelCode: 'BRANCH',
        requestedAmount: 100000000,
        requestedTenureMonths: 36,
        applicantAge: 34,
        employmentType: 'SALARIED_PRIVATE',
        grossMonthlyIncome: 15000000,
        netMonthlyIncome: 12000000,
        totalAnnualIncome: 180000000,
        bureauData: {
          creditScore: 750,
          scoreModel: 'CIBIL',
          activeAccounts: 2,
          closedAccounts: 1,
          overdueAccounts: 0,
          totalExposure: 50000000,
          securedExposure: 0,
          unsecuredExposure: 50000000,
          totalEmi: 1000000,
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

      const features = service.extractFeatures(ctx);
      const arr = service.featuresToArray(features);

      expect(arr.length).toBe(26);
      expect(arr[0]).toBe(750); // bureauScore
      expect(arr[1]).toBeCloseTo((750 - 300) / 600, 2); // scoreNormalized
    });
  });

  describe('standardize', () => {
    it('should normalize features using provided mean and std', () => {
      const features = [100, 200, 300];
      const mean = [50, 100, 200];
      const std = [25, 50, 100];

      const result = service.standardize(features, mean, std);

      expect(result[0]).toBeCloseTo((100 - 50) / 25, 4); // 2
      expect(result[1]).toBeCloseTo((200 - 100) / 50, 4); // 2
      expect(result[2]).toBeCloseTo((300 - 200) / 100, 4); // 1
    });

    it('should handle zero std by returning 0', () => {
      const features = [100, 200];
      const mean = [50, 100];
      const std = [0, 50];

      const result = service.standardize(features, mean, std);

      expect(result[0]).toBe(0);
      expect(result[1]).toBeCloseTo((200 - 100) / 50, 4);
    });
  });

  describe('getFeatureCount', () => {
    it('should return 26 features', () => {
      expect(service.getFeatureCount()).toBe(26);
    });
  });
});
