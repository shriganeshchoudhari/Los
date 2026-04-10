// ─────────────────────────────────────────────────────────────
// 8. LOAN (POST-SANCTION)
// ─────────────────────────────────────────────────────────────

import type { UUID, PaisaAmount, ISODateString, ISODateTimeString, IFSCCode } from './shared';
import type { LoanType, CoApplicant } from './loan';

export type LoanStatus =
  | 'SANCTIONED'
  | 'ACTIVE'
  | 'OVERDUE'
  | 'NPA'
  | 'WRITTEN_OFF'
  | 'SETTLED'
  | 'FORECLOSED'
  | 'CLOSED';

export type PaymentMode = 'NEFT' | 'RTGS' | 'IMPS' | 'UPI' | 'DD' | 'CHEQUE' | 'CASH';

export type NACHStatus =
  | 'PENDING_REGISTRATION'
  | 'REGISTERED'
  | 'ACTIVE'
  | 'PAUSED'
  | 'CANCELLED'
  | 'REJECTED';

export interface RepaymentAccountDetails {
  bankName: string;
  accountNumber: string;
  accountType: 'SAVINGS' | 'CURRENT';
  ifscCode: IFSCCode;
  accountHolderName: string;
  pennyDropVerified: boolean;
  pennyDropVerifiedAt?: ISODateTimeString;
}

export interface NACHMandate {
  umrn: string;
  status: NACHStatus;
  bankAccountNumber: string;
  ifscCode: IFSCCode;
  maxAmount: PaisaAmount;
  frequency: 'MONTHLY';
  startDate: ISODateString;
  endDate: ISODateString;
  registeredAt?: ISODateTimeString;
  cancelledAt?: ISODateTimeString;
}

export interface DisbursementRecord {
  id: UUID;
  loanId: UUID;
  disbursementNumber: number;
  amount: PaisaAmount;
  mode: PaymentMode;
  payeeAccountNumber?: string;
  payeeIFSC?: IFSCCode;
  payeeName?: string;
  utrNumber?: string;
  narration: string;
  status: 'PENDING' | 'PROCESSING' | 'SUCCESS' | 'FAILED' | 'REVERSED';
  initiatedAt: ISODateTimeString;
  settledAt?: ISODateTimeString;
  failureReason?: string;
}

export interface CoApplicantLoanRecord {
  userId: UUID;
  fullName: string;
  relationship: string;
  isGuarantor: boolean;
  liabilityShare?: number;
}

export interface LoanInsurance {
  policyNumber: string;
  insurer: string;
  coverType: 'LIFE' | 'HEALTH' | 'PROPERTY' | 'BUNDLE';
  sumAssured: PaisaAmount;
  premium: PaisaAmount;
  premiumType: 'SINGLE' | 'ANNUAL';
  startDate: ISODateString;
  endDate: ISODateString;
  status: 'ACTIVE' | 'LAPSED' | 'CLAIMED' | 'CANCELLED';
}

export interface Loan {
  id: UUID;
  loanAccountNumber: string;
  applicationId: UUID;
  userId: UUID;
  loanType: LoanType;
  status: LoanStatus;
  principalAmount: PaisaAmount;
  outstandingPrincipal: PaisaAmount;
  outstandingInterest: PaisaAmount;
  tenureMonths: number;
  disbursedTenureMonths: number;
  rateOfInterestBps: number;
  interestRateType: 'FIXED' | 'FLOATING';
  emiAmount: PaisaAmount;
  firstEmiDate: ISODateString;
  nextEmiDate?: ISODateString;
  lastEmiDate: ISODateString;
  emisDue: number;
  emisPaid: number;
  disbursements: DisbursementRecord[];
  repaymentAccount: RepaymentAccountDetails;
  nachMandate?: NACHMandate;
  coApplicants?: CoApplicantLoanRecord[];
  insurance?: LoanInsurance;
  createdAt: ISODateTimeString;
  updatedAt: ISODateTimeString;
}

// ── EMI Schedule ──

export type EMIInstallmentStatus = 'UPCOMING' | 'DUE' | 'PAID' | 'OVERDUE' | 'PARTIALLY_PAID' | 'WAIVED';

export interface EMIInstallment {
  installmentNumber: number;
  dueDate: ISODateString;
  openingBalance: PaisaAmount;
  emiAmount: PaisaAmount;
  principalComponent: PaisaAmount;
  interestComponent: PaisaAmount;
  closingBalance: PaisaAmount;
  status: EMIInstallmentStatus;
  paidAmount?: PaisaAmount;
  paidAt?: ISODateTimeString;
  paymentReference?: string;
  penalInterest?: PaisaAmount;
}

export interface EMISchedule {
  loanId: UUID;
  installments: EMIInstallment[];
}

// ── Loan APIs ──

export interface LoanSummaryResponse {
  loanAccountNumber: string;
  applicantName: string;
  loanType: LoanType;
  status: LoanStatus;
  principalAmount: PaisaAmount;
  outstandingAmount: PaisaAmount;
  nextEmiDate?: ISODateString;
  nextEmiAmount?: PaisaAmount;
  overdueAmount?: PaisaAmount;
  overdueDays?: number;
}

export interface InitiateDisbursementRequest {
  loanId: UUID;
  disbursementAmount: PaisaAmount;
  paymentMode: PaymentMode;
  beneficiary: {
    name: string;
    accountNumber: string;
    ifscCode: IFSCCode;
    accountType: 'SAVINGS' | 'CURRENT' | 'OVERDRAFT' | 'NRE' | 'NRO';
    bankName?: string;
    upiAddress?: string;
    mobileNumber?: string;
  };
  narration?: string;
  checkerUserId: UUID;
}
