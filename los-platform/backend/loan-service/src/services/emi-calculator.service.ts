import { Injectable, Logger } from '@nestjs/common';

export interface EmiCalculationInput {
  principal: number;
  annualRate: number;
  tenureMonths: number;
}

export interface EmiCalculationResult {
  emiAmount: number;
  totalInterest: number;
  totalPayment: number;
  monthlyRate: number;
  principal: number;
  tenureMonths: number;
  annualRate: number;
  calculatedAt: string;
}

export interface AmortizationEntry {
  month: number;
  emi: number;
  principalComponent: number;
  interestComponent: number;
  outstandingBalance: number;
  cumulativeInterest: number;
  cumulativePrincipal: number;
}

export interface AmortizationScheduleResult {
  schedule: AmortizationEntry[];
  totalInterest: number;
  totalPayment: number;
  emiAmount: number;
  principal: number;
  tenureMonths: number;
  annualRate: number;
  averageMonthlyInterest: number;
  interestToPrincipalRatio: number;
}

export interface PrepaymentScenario {
  prepaymentMonth: number;
  prepaymentAmount: number;
  balanceAfterPrepayment: number;
  remainingMonths: number;
  originalTotalInterest: number;
  newTotalInterest: number;
  interestSaved: number;
  originalTenureMonths: number;
  newTenureMonths: number;
  monthsSaved: number;
  newEmi?: number;
  prepaymentType: 'TENURE_REDUCTION' | 'EMI_REDUCTION';
  prepaymentPenalty: number;
  netSavings: number;
}

export interface ForeclosureResult {
  originalPrincipal: number;
  outstandingPrincipal: number;
  foreclosureProcessingFee: number;
  gstOnFee: number;
  totalAmountDue: number;
  foreclosureDate: string;
  tenureCompletedMonths: number;
  tenureRemainingMonths: number;
  originalTotalInterest: number;
  interestPaidTillDate: number;
  interestSavedVsOriginal: number;
}

export interface EmiBreakdown {
  emiAmount: number;
  principalComponent: number;
  interestComponent: number;
  interestPercentOfEmi: number;
}

@Injectable()
export class EmiCalculatorService {
  private readonly logger = new Logger(EmiCalculatorService.name);

  calculateEmi(input: EmiCalculationInput): EmiCalculationResult {
    const { principal, annualRate, tenureMonths } = input;
    const monthlyRate = annualRate / (12 * 100);

    let emi: number;
    if (monthlyRate === 0) {
      emi = Math.ceil(principal / tenureMonths);
    } else {
      emi =
        (principal * monthlyRate * Math.pow(1 + monthlyRate, tenureMonths)) /
        (Math.pow(1 + monthlyRate, tenureMonths) - 1);
      emi = Math.round(emi);
    }

    const totalPayment = emi * tenureMonths;
    const totalInterest = totalPayment - principal;

    return {
      emiAmount: emi,
      totalInterest: Math.round(totalInterest),
      totalPayment: Math.round(totalPayment),
      monthlyRate: Math.round(monthlyRate * 1e6) / 1e6,
      principal,
      tenureMonths,
      annualRate,
      calculatedAt: new Date().toISOString(),
    };
  }

  getEmiBreakdown(input: EmiCalculationInput): EmiBreakdown {
    const emiResult = this.calculateEmi(input);
    const monthlyRate = input.annualRate / (12 * 100);
    const firstInterest = monthlyRate === 0 ? 0 : Math.round(input.principal * monthlyRate);
    const firstPrincipal = emiResult.emiAmount - firstInterest;

    return {
      emiAmount: emiResult.emiAmount,
      principalComponent: Math.max(0, firstPrincipal),
      interestComponent: firstInterest,
      interestPercentOfEmi: Math.round((firstInterest / emiResult.emiAmount) * 10000) / 100,
    };
  }

  buildAmortizationSchedule(input: EmiCalculationInput): AmortizationScheduleResult {
    const { principal, annualRate, tenureMonths } = input;
    const monthlyRate = annualRate / (12 * 100);
    const emi = this.calculateEmi({ ...input, principal, annualRate, tenureMonths }).emiAmount;

    const schedule: AmortizationEntry[] = [];
    let outstandingBalance = principal;
    let cumulativeInterest = 0;
    let cumulativePrincipal = 0;

    for (let month = 1; month <= tenureMonths && outstandingBalance > 0; month++) {
      const interestComponent = Math.min(outstandingBalance * monthlyRate, outstandingBalance);
      const principalComponent = Math.min(emi - interestComponent, outstandingBalance);
      outstandingBalance = Math.max(0, outstandingBalance - principalComponent);
      cumulativeInterest += interestComponent;
      cumulativePrincipal += principalComponent;

      schedule.push({
        month,
        emi: principalComponent + interestComponent <= emi ? emi : principalComponent + interestComponent,
        principalComponent: Math.round(principalComponent),
        interestComponent: Math.round(interestComponent),
        outstandingBalance: Math.round(outstandingBalance),
        cumulativeInterest: Math.round(cumulativeInterest),
        cumulativePrincipal: Math.round(cumulativePrincipal),
      });
    }

    return {
      schedule,
      totalInterest: Math.round(cumulativeInterest),
      totalPayment: Math.round(cumulativeInterest + principal),
      emiAmount: emi,
      principal,
      tenureMonths: schedule.length,
      annualRate,
      averageMonthlyInterest: Math.round(cumulativeInterest / Math.max(1, schedule.length)),
      interestToPrincipalRatio:
        Math.round((cumulativeInterest / principal) * 10000) / 100,
    };
  }

  calculatePartialPrepayment(params: {
    originalPrincipal: number;
    annualRate: number;
    remainingMonths: number;
    prepaymentAmount: number;
    currentMonthEmi: number;
    prepaymentType: 'TENURE_REDUCTION' | 'EMI_REDUCTION';
    prepaymentPenaltyPercent: number;
    gstPercent?: number;
    firstEmiDate?: Date;
  }): PrepaymentScenario {
    const {
      originalPrincipal,
      annualRate,
      remainingMonths,
      prepaymentAmount,
      currentMonthEmi,
      prepaymentType,
      prepaymentPenaltyPercent,
      gstPercent = 18,
      firstEmiDate,
    } = params;

    const monthlyRate = annualRate / (12 * 100);
    const prepaymentPenalty = prepaymentAmount * (prepaymentPenaltyPercent / 100);
    const gstOnPenalty = prepaymentPenalty * (gstPercent / 100);
    const netPrepayment = prepaymentAmount + prepaymentPenalty + gstOnPenalty;
    const balanceAfterPrepayment = Math.max(0, originalPrincipal - prepaymentAmount);

    const originalSchedule = this.buildAmortizationSchedule({
      principal: originalPrincipal,
      annualRate,
      tenureMonths: remainingMonths,
    });

    let newSchedule: AmortizationScheduleResult;
    let newEmi: number | undefined;

    if (prepaymentType === 'TENURE_REDUCTION') {
      if (balanceAfterPrepayment <= 0) {
        return this.buildFullPrepaymentResult(
          originalPrincipal, originalSchedule, prepaymentAmount, prepaymentPenalty,
          gstOnPenalty, netPrepayment, remainingMonths, prepaymentType,
        );
      }
      const remainingForCalc = balanceAfterPrepayment;
      newSchedule = this.buildAmortizationSchedule({
        principal: remainingForCalc,
        annualRate,
        tenureMonths: remainingMonths,
      });
      newEmi = newSchedule.emiAmount;
    } else {
      if (balanceAfterPrepayment <= 0) {
        return this.buildFullPrepaymentResult(
          originalPrincipal, originalSchedule, prepaymentAmount, prepaymentPenalty,
          gstOnPenalty, netPrepayment, remainingMonths, prepaymentType,
        );
      }
      const newEmiCalc = this.calculateEmi({
        principal: balanceAfterPrepayment,
        annualRate,
        tenureMonths,
      });
      newEmi = newEmiCalc.emiAmount;
      newSchedule = this.buildAmortizationSchedule({
        principal: balanceAfterPrepayment,
        annualRate,
        tenureMonths,
      });
    }

    return {
      prepaymentMonth: 0,
      prepaymentAmount,
      balanceAfterPrepayment: Math.round(balanceAfterPrepayment),
      remainingMonths: remainingMonths - newSchedule.tenureMonths,
      originalTotalInterest: originalSchedule.totalInterest,
      newTotalInterest: newSchedule.totalInterest,
      interestSaved: Math.max(0, originalSchedule.totalInterest - newSchedule.totalInterest),
      originalTenureMonths: remainingMonths,
      newTenureMonths: newSchedule.tenureMonths,
      monthsSaved: remainingMonths - newSchedule.tenureMonths,
      newEmi,
      prepaymentType,
      prepaymentPenalty: Math.round(prepaymentPenalty + gstOnPenalty),
      netSavings: Math.max(
        0,
        originalSchedule.totalInterest -
          newSchedule.totalInterest -
          prepaymentPenalty -
          gstOnPenalty,
      ),
    };
  }

  private buildFullPrepaymentResult(
    originalPrincipal: number,
    originalSchedule: AmortizationScheduleResult,
    prepaymentAmount: number,
    prepaymentPenalty: number,
    gstOnPenalty: number,
    netPrepayment: number,
    remainingMonths: number,
    prepaymentType: 'TENURE_REDUCTION' | 'EMI_REDUCTION',
  ): PrepaymentScenario {
    return {
      prepaymentMonth: 0,
      prepaymentAmount,
      balanceAfterPrepayment: 0,
      remainingMonths: 0,
      originalTotalInterest: originalSchedule.totalInterest,
      newTotalInterest: 0,
      interestSaved: originalSchedule.totalInterest,
      originalTenureMonths: remainingMonths,
      newTenureMonths: 0,
      monthsSaved: remainingMonths,
      prepaymentType,
      prepaymentPenalty: Math.round(prepaymentPenalty + gstOnPenalty),
      netSavings:
        originalSchedule.totalInterest - prepaymentPenalty - gstOnPenalty,
    };
  }

  calculateForeclosure(params: {
    originalPrincipal: number;
    annualRate: number;
    tenureMonths: number;
    disbursementDate: Date;
    foreclosureDate: Date;
    foreclosureProcessingFeePercent: number;
    gstPercent?: number;
  }): ForeclosureResult {
    const {
      originalPrincipal,
      annualRate,
      tenureMonths,
      disbursementDate,
      foreclosureDate,
      foreclosureProcessingFeePercent,
      gstPercent = 18,
    } = params;

    const monthsElapsed = this.monthsBetween(disbursementDate, foreclosureDate);
    const tenureCompletedMonths = Math.min(monthsElapsed, tenureMonths);
    const tenureRemainingMonths = tenureMonths - tenureCompletedMonths;

    const monthlyRate = annualRate / (12 * 100);
    const emi = this.calculateEmi({ principal: originalPrincipal, annualRate, tenureMonths }).emiAmount;

    const fullSchedule = this.buildAmortizationSchedule({
      principal: originalPrincipal,
      annualRate,
      tenureMonths,
    });

    const interestPaidTillDate = fullSchedule.schedule
      .slice(0, tenureCompletedMonths)
      .reduce((sum, e) => sum + e.interestComponent, 0);

    const outstandingPrincipal =
      tenureCompletedMonths < fullSchedule.schedule.length
        ? fullSchedule.schedule[tenureCompletedMonths]?.outstandingBalance ?? 0
        : 0;

    const foreclosureProcessingFee =
      outstandingPrincipal * (foreclosureProcessingFeePercent / 100);
    const gstOnFee = foreclosureProcessingFee * (gstPercent / 100);
    const totalAmountDue = outstandingPrincipal + foreclosureProcessingFee + gstOnFee;

    return {
      originalPrincipal,
      outstandingPrincipal: Math.round(outstandingPrincipal),
      foreclosureProcessingFee: Math.round(foreclosureProcessingFee),
      gstOnFee: Math.round(gstOnFee),
      totalAmountDue: Math.round(totalAmountDue),
      foreclosureDate: foreclosureDate.toISOString().split('T')[0],
      tenureCompletedMonths,
      tenureRemainingMonths,
      originalTotalInterest: fullSchedule.totalInterest,
      interestPaidTillDate: Math.round(interestPaidTillDate),
      interestSavedVsOriginal: fullSchedule.totalInterest - interestPaidTillDate,
    };
  }

  compareEmiScenarios(
    scenarios: Array<{
      label: string;
      principal: number;
      annualRate: number;
      tenureMonths: number;
    }>,
  ): Array<{
    label: string;
    emiAmount: number;
    totalInterest: number;
    totalPayment: number;
    emiToIncomeRatio?: number;
    monthlyIncome?: number;
  }> {
    return scenarios.map((s) => {
      const result = this.calculateEmi({
        principal: s.principal,
        annualRate: s.annualRate,
        tenureMonths: s.tenureMonths,
      });
      return {
        label: s.label,
        emiAmount: result.emiAmount,
        totalInterest: result.totalInterest,
        totalPayment: result.totalPayment,
        monthlyIncome: s.monthlyIncome,
        emiToIncomeRatio: s.monthlyIncome
          ? Math.round((result.emiAmount / s.monthlyIncome) * 10000) / 100
          : undefined,
      };
    });
  }

  calculateMaxEligibleEmi(
    netMonthlyIncome: number,
    existingEmi: number,
    maxFoirPercent: number,
  ): { maxTotalEmi: number; maxNewEmi: number } {
    const maxTotalEmi = Math.round(netMonthlyIncome * (maxFoirPercent / 100));
    const maxNewEmi = Math.max(0, maxTotalEmi - existingEmi);
    return { maxTotalEmi, maxNewEmi };
  }

  private monthsBetween(start: Date, end: Date): number {
    const y1 = start.getFullYear();
    const m1 = start.getMonth();
    const y2 = end.getFullYear();
    const m2 = end.getMonth();
    return (y2 - y1) * 12 + (m2 - m1);
  }
}
