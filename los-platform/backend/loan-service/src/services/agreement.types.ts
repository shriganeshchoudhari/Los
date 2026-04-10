export interface LoanAgreementData {
  applicationNumber: string;
  loanAccountNumber: string;
  customerName: string;
  customerAddress: string;
  customerPAN: string;
  customerMobile: string;
  customerEmail: string;
  coBorrowerName?: string;
  coBorrowerAddress?: string;
  coBorrowerPAN?: string;
  guarantorName?: string;
  guarantorAddress?: string;
  guarantorPAN?: string;
  sanctionedAmount: number;
  sanctionedAmountInWords: string;
  rateOfInterestPercent: number;
  rateOfInterestBps: number;
  tenureMonths: number;
  emiAmount: number;
  moratoriumPeriodMonths?: number;
  moratoriumEMI?: number;
  processingFee: number;
  agreementDate: string;
  agreementNumber: string;
  productName: string;
  productCode: string;
  disbursementAccountNumber: string;
  disbursementIFSC: string;
  disbursementBankName: string;
  branchName: string;
  branchAddress: string;
  securityDescription: string;
  insurancePolicyNumber?: string;
  insurancePremium?: number;
  firstEMIDate: string;
  lastEMIDate: string;
  prepaymentPenaltyClause: string;
  defaultInterestRatePercent: number;
  bounceCharge: number;
  partPaymentAllowed: boolean;
  partPaymentMinAmount: number;
  partPaymentTenureReduction: boolean;
  foreclosureAllowed: boolean;
  foreclosureNoticePeriodDays: number;
  foreclosurePenaltyPercent: number;
  specialConditions: string[];
  jurisdiction: string;
  witnessingOfficerName: string;
  witnessingOfficerDesignation: string;
}

export interface AgreementSigningResult {
  documentId: string;
  esignTransactionId: string;
  esignProvider: string;
  otpSentTo: string;
  signingUrl?: string;
  status: 'PENDING' | 'SIGNED' | 'FAILED' | 'EXPIRED';
  expiresAt: Date;
}

export interface PolicyVersionData {
  versionId: string;
  policyType: string;
  version: string;
  effectiveFrom: Date;
  effectiveTo?: Date;
  rules: PolicyRule[];
  rateConfigSnapshot: Record<string, any>;
  isActive: boolean;
  createdBy: string;
  createdAt: Date;
}

export interface PolicyRule {
  ruleId: string;
  name: string;
  category: string;
  severity: string;
  conditions: Record<string, any>;
  thenClause: Record<string, any>;
  productOverrides?: Record<string, any>;
}
