import { Injectable } from '@nestjs/common';
import {
  BureauContextData,
  BureauDerivedFeatures,
  RuleEvaluationContext,
} from '../rules/rule.types';

@Injectable()
export class FeatureEngineeringService {
  private readonly FEATURE_NAMES = [
    'bureauScore',
    'scoreNormalized',
    'dpd90Flag',
    'dpd60Flag',
    'dpd30Flag',
    'maxDpd',
    'totalExposure',
    'unsecuredExposure',
    'securedExposure',
    'exposureToIncome',
    'emiToIncome',
    'activeAccounts',
    'closedAccounts',
    'totalAccounts',
    'accountsPerYear',
    'enquiryVelocity30d',
    'enquiryVelocity90d',
    'writeoffFlag',
    'suitFiledFlag',
    'wilfulDefaulterFlag',
    'disputedFlag',
    'creditAgeMonths',
    'avgTenureClosed',
    'utilizationCredit',
    'newAccounts6m',
    'droppedAccounts3m',
  ] as const;

  extractFeatures(ctx: RuleEvaluationContext): BureauDerivedFeatures {
    const bureau = ctx.bureauData;
    const now = new Date();

    const bureauScore = bureau?.creditScore ?? 0;
    const activeAccounts = bureau?.activeAccounts ?? 0;
    const closedAccounts = bureau?.closedAccounts ?? 0;
    const totalAccounts = activeAccounts + closedAccounts;
    const totalExposure = bureau?.totalExposure ?? 0;
    const unsecuredExposure = bureau?.unsecuredExposure ?? totalExposure;
    const securedExposure = bureau?.securedExposure ?? 0;
    const totalEmi = bureau?.totalEmi ?? 0;

    const grossMonthlyIncome = ctx.grossMonthlyIncome || 1;
    const annualIncome = grossMonthlyIncome * 12;

    const accounts = bureau?.accounts ?? [];
    const creditAgeMonths = this.calculateCreditAge(accounts);
    const avgTenureClosed = this.calculateAvgTenureClosed(accounts);
    const newAccounts6m = this.countNewAccounts(accounts, 6);
    const droppedAccounts3m = this.countDroppedAccounts(accounts, 3);

    const utilizationCredit = annualIncome > 0 ? totalExposure / annualIncome : 0;

    return {
      bureauScore,
      scoreNormalized: Math.max(0, Math.min(1, (bureauScore - 300) / 600)),
      dpd90Flag: (bureau?.dpd90 ?? 0) > 0 ? 1 : 0,
      dpd60Flag: (bureau?.dpd60 ?? 0) > 0 ? 1 : 0,
      dpd30Flag: (bureau?.dpd30 ?? 0) > 0 ? 1 : 0,
      maxDpd: Math.max(
        bureau?.dpd30 ?? 0,
        bureau?.dpd60 ?? 0,
        bureau?.dpd90 ?? 0,
        bureau?.dpd180 ?? 0,
      ),
      totalExposure,
      unsecuredExposure,
      securedExposure,
      exposureToIncome: annualIncome > 0 ? totalExposure / annualIncome : 0,
      emiToIncome: grossMonthlyIncome > 0 ? totalEmi / grossMonthlyIncome : 0,
      activeAccounts,
      closedAccounts,
      totalAccounts,
      accountsPerYear: creditAgeMonths > 0 ? (totalAccounts / (creditAgeMonths / 12)) : 0,
      enquiryVelocity30d: bureau?.enquiries30d ?? 0,
      enquiryVelocity90d: bureau?.enquiries90d ?? 0,
      writeoffFlag: (bureau?.writeoffs ?? 0) > 0 ? 1 : 0,
      suitFiledFlag: bureau?.suitFiled ? 1 : 0,
      wilfulDefaulterFlag: bureau?.wilfulDefaulter ? 1 : 0,
      disputedFlag: bureau?.disputed ? 1 : 0,
      creditAgeMonths,
      avgTenureClosed,
      utilizationCredit,
      newAccounts6m,
      droppedAccounts3m,
    };
  }

  featuresToArray(features: BureauDerivedFeatures): number[] {
    return [
      features.bureauScore,
      features.scoreNormalized,
      features.dpd90Flag,
      features.dpd60Flag,
      features.dpd30Flag,
      features.maxDpd,
      features.totalExposure,
      features.unsecuredExposure,
      features.securedExposure,
      features.exposureToIncome,
      features.emiToIncome,
      features.activeAccounts,
      features.closedAccounts,
      features.totalAccounts,
      features.accountsPerYear,
      features.enquiryVelocity30d,
      features.enquiryVelocity90d,
      features.writeoffFlag,
      features.suitFiledFlag,
      features.wilfulDefaulterFlag,
      features.disputedFlag,
      features.creditAgeMonths,
      features.avgTenureClosed,
      features.utilizationCredit,
      features.newAccounts6m,
      features.droppedAccounts3m,
    ];
  }

  featuresToRecord(features: BureauDerivedFeatures): Record<string, number> {
    const arr = this.featuresToArray(features);
    const result: Record<string, number> = {};
    this.FEATURE_NAMES.forEach((name, i) => {
      result[name] = arr[i];
    });
    return result;
  }

  getFeatureNames(): readonly string[] {
    return this.FEATURE_NAMES;
  }

  getFeatureCount(): number {
    return this.FEATURE_NAMES.length;
  }

  private calculateCreditAge(accounts: BureauContextData['accounts']): number {
    if (!accounts || accounts.length === 0) return 0;
    const now = new Date();
    let earliestDate = now;
    for (const acc of accounts) {
      const opened = new Date(acc.openedDate);
      if (opened < earliestDate) earliestDate = opened;
    }
    const monthsDiff = (now.getTime() - earliestDate.getTime()) / (1000 * 60 * 60 * 24 * 30);
    return Math.round(monthsDiff);
  }

  private calculateAvgTenureClosed(accounts: BureauContextData['accounts']): number {
    if (!accounts || accounts.length === 0) return 0;
    const closed = accounts.filter(a => a.closedDate && a.openedDate);
    if (closed.length === 0) return 0;
    let totalMonths = 0;
    for (const acc of closed) {
      const opened = new Date(acc.openedDate);
      const closed_1 = new Date(acc.closedDate!);
      const months = (closed_1.getTime() - opened.getTime()) / (1000 * 60 * 60 * 24 * 30);
      totalMonths += months;
    }
    return Math.round(totalMonths / closed.length);
  }

  private countNewAccounts(accounts: BureauContextData['accounts'], months: number): number {
    if (!accounts || accounts.length === 0) return 0;
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);
    return accounts.filter(a => new Date(a.openedDate) > cutoff).length;
  }

  private countDroppedAccounts(accounts: BureauContextData['accounts'], months: number): number {
    if (!accounts || accounts.length === 0) return 0;
    const cutoff = new Date();
    cutoff.setMonth(cutoff.getMonth() - months);
    return accounts.filter(a => a.closedDate && new Date(a.closedDate) > cutoff).length;
  }

  standardize(
    features: number[],
    mean: number[],
    std: number[],
  ): number[] {
    return features.map((v, i) => {
      const s = std[i] || 1;
      return s === 0 ? 0 : (v - (mean[i] || 0)) / s;
    });
  }
}
