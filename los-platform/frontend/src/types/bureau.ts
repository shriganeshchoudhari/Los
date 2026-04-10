// ─────────────────────────────────────────────────────────────
// 6. CREDIT BUREAU
// ─────────────────────────────────────────────────────────────

import type { UUID, PaisaAmount, ISODateString, ISODateTimeString } from './shared';

export type BureauProvider = 'CIBIL' | 'EXPERIAN' | 'EQUIFAX' | 'CRIF_HIGH_MARK';

export interface BureauPullRequest {
  applicationId: UUID;
  panNumber: string;
  fullName: string;
  dob: ISODateString;
  mobile: string;
  address: {
    line1: string;
    city: string;
    state: string;
    pincode: string;
  };
  providers: BureauProvider[];
  consentTimestamp: ISODateTimeString;
  consentIpAddress: string;
}

export type BureauJobStatus =
  | 'PENDING'
  | 'IN_PROGRESS'
  | 'PARTIAL_SUCCESS'
  | 'SUCCESS'
  | 'FAILED'
  | 'TIMEOUT';

export interface BureauPullJob {
  jobId: UUID;
  applicationId: UUID;
  status: BureauJobStatus;
  providers: BureauProviderResult[];
  finalCreditScore?: number;
  aggregatedReport?: AggregatedBureauReport;
  startedAt: ISODateTimeString;
  completedAt?: ISODateTimeString;
  retryCount: number;
  nextRetryAt?: ISODateTimeString;
}

export interface BureauProviderResult {
  provider: BureauProvider;
  status: 'SUCCESS' | 'FAILED' | 'TIMEOUT' | 'NO_HIT';
  creditScore?: number;
  errorCode?: string;
  rawReportKey?: string;
  pulledAt?: ISODateTimeString;
  referenceId?: string;
}

// ── Aggregated Report ──

export interface DPDSummary {
  dpd30: number;
  dpd60: number;
  dpd90: number;
  dpd180: number;
  worstDpdLast12Months: number;
  worstDpdLast24Months: number;
  worstDpdEver: number;
}

export interface BureauEnquiry {
  date: ISODateString;
  institution: string;
  loanType: string;
  amount?: PaisaAmount;
}

export interface BureauAccount {
  accountNumber: string;
  institution: string;
  accountType: string;
  creditLimit?: PaisaAmount;
  currentBalance: PaisaAmount;
  overdueAmount: PaisaAmount;
  emiAmount?: PaisaAmount;
  openDate: ISODateString;
  closedDate?: ISODateString;
  accountStatus: 'ACTIVE' | 'CLOSED' | 'WRITTEN_OFF' | 'SETTLED';
  ownershipType: 'INDIVIDUAL' | 'JOINT' | 'GUARANTOR';
  worstDpd: number;
}

export interface WriteOffRecord {
  institution: string;
  amount: PaisaAmount;
  writeOffDate: ISODateString;
  accountType: string;
}

export interface SettlementRecord {
  institution: string;
  originalAmount: PaisaAmount;
  settledAmount: PaisaAmount;
  settlementDate: ISODateString;
}

export interface AggregatedBureauReport {
  creditScore: number;
  scoreModel: string;
  activeAccounts: number;
  closedAccounts: number;
  overdueAccounts: number;
  totalExposure: PaisaAmount;
  creditCardExposure: PaisaAmount;
  securedExposure: PaisaAmount;
  unsecuredExposure: PaisaAmount;
  overdueAmount: PaisaAmount;
  dpdSummary: DPDSummary;
  enquiries: BureauEnquiry[];
  accounts: BureauAccount[];
  writeoffs: WriteOffRecord[];
  settlements: SettlementRecord[];
  fraudFlag: boolean;
  suitFiled: boolean;
  wilfulDefaulter: boolean;
}
