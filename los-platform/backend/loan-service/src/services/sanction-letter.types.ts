export interface SanctionLetterData {
  applicationNumber: string;
  customerName: string;
  customerAddress: string;
  sanctionedAmount: number;
  sanctionedAmountInWords: string;
  rateOfInterestPercent: number;
  rateOfInterestBps: number;
  tenureMonths: number;
  emiAmount: number;
  processingFeeAmount: number;
  insurancePremium?: number;
  totalPayableAmount: number;
  firstEmiDate: string;
  lastEmiDate: string;
  productName: string;
  productCode: string;
  bankName?: string;
  bankAddress?: string;
  sanctionDate: string;
  validUntil: string;
  disbursementConditions: string[];
  sanctioningAuthority: string;
  authorityDesignation: string;
  loanAccountNumber?: string;
  ifscCode?: string;
  branchName?: string;
  prepaymentTerms?: {
    allowed: boolean;
    lockInMonths: number;
    maxPercentPerYear: number;
    penaltyPercent: number;
    penaltyClause: string;
  };
  foreclosureTerms?: {
    allowed: boolean;
    lockInMonths: number;
    minOutstandingBalance: number;
    processingFeePercent: number;
    processingFeeClause: string;
  };
}
