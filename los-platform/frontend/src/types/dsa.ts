export type DSAPartnerStatus = 'PENDING_APPROVAL' | 'UNDER_REVIEW' | 'APPROVED' | 'REJECTED' | 'SUSPENDED' | 'TERMINATED';
export type DSAPartnerType = 'INDIVIDUAL' | 'SOLE_PROPRIETORSHIP' | 'PARTNERSHIP' | 'PRIVATE_LIMITED' | 'PUBLIC_LIMITED' | 'NBFC';
export type CommissionType = 'UPFRONT' | 'TRAIL' | 'HYBRID';
export type DSARole = 'DSA_PARTNER' | 'DSA_OFFICER';

export interface DSALoginResponse {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  partnerId: string;
  partnerCode: string;
  partnerName: string;
  role: DSARole;
}

export interface DSADashboard {
  partnerId: string;
  partnerName: string;
  status: DSAPartnerStatus;
  totalApplications: number;
  submittedApplications: number;
  approvedApplications: number;
  disbursedApplications: number;
  rejectedApplications: number;
  totalDisbursedAmount: number;
  totalCommissionEarned: number;
  totalCommissionPaid: number;
  pendingCommission: number;
  conversionRate: number;
  disbursementRate: number;
  monthlyTrend?: { month: string; applications: number; disbursed: number; commission: number }[];
  officerStats?: { officerId: string; officerName: string; applications: number; disbursements: number }[];
}

export interface DSAApplication {
  id: string;
  applicationNumber: string;
  customerName: string;
  customerMobile: string;
  customerPan?: string;
  loanType: string;
  requestedAmount: number;
  requestedTenureMonths: number;
  status: string;
  branchCode?: string;
  officerId: string;
  remarks?: string;
  createdAt: string;
  updatedAt: string;
}

export interface DSAOfficer {
  id: string;
  employeeCode: string;
  fullName: string;
  mobile: string;
  email: string;
  designation: string;
  department: string;
  status: string;
  territoryCodes?: string[];
  allowedProducts?: string[];
  maxSanctionAuthority: number;
  totalApplications: number;
  totalDisbursements: number;
  lastLoginAt?: string;
  createdAt: string;
}

export interface CommissionSummary {
  partnerId: string;
  totalEarned: number;
  totalTDS: number;
  totalGST: number;
  totalPaid: number;
  pendingPayout: number;
  lastPayoutDate: string | null;
  lastPayoutAmount: number;
}

export interface CommissionDetail {
  id: string;
  applicationId: string;
  loanApplicationId: string;
  loanType: string;
  disbursedAmount: number;
  commissionType: CommissionType;
  commissionRateBps: number;
  commissionAmount: number;
  gstAmount: number;
  tdsAmount: number;
  netPayable: number;
  disbursementDate: string;
  payoutMonth: string;
  status: string;
  processedAt: string | null;
}

export interface DSAPartnerProfile {
  id: string;
  partnerCode: string;
  partnerName: string;
  partnerType: DSAPartnerType;
  status: DSAPartnerStatus;
  contactName: string;
  contactMobile: string;
  contactEmail: string;
  city: string;
  state: string;
  commissionType: CommissionType;
  upfrontCommissionBps: number;
  trailCommissionBps: number;
  territoryCodes: string[];
  allowedProducts: string[];
  totalApplications: number;
  totalDisbursements: number;
  totalDisbursedAmount: number;
  totalCommissionPaid: number;
  agreementValidFrom: string | null;
  agreementValidTo: string | null;
  createdAt: string;
}

export const LOAN_PRODUCTS = [
  { code: 'PL', label: 'Personal Loan', minAmount: 50000, maxAmount: 5000000, maxTenure: 60 },
  { code: 'BL', label: 'Business Loan', minAmount: 100000, maxAmount: 10000000, maxTenure: 84 },
  { code: 'HL', label: 'Home Loan', minAmount: 500000, maxAmount: 100000000, maxTenure: 360 },
  { code: 'LAP', label: 'Loan Against Property', minAmount: 200000, maxAmount: 50000000, maxTenure: 240 },
  { code: 'AL', label: 'Auto Loan', minAmount: 100000, maxAmount: 5000000, maxTenure: 84 },
  { code: 'EL', label: 'Education Loan', minAmount: 100000, maxAmount: 20000000, maxTenure: 180 },
  { code: 'SL', label: 'Silver Loan / Gold Loan', minAmount: 10000, maxAmount: 5000000, maxTenure: 36 },
  { code: 'TL', label: 'Term Loan (MSME)', minAmount: 200000, maxAmount: 50000000, maxTenure: 120 },
];

export const APPLICATION_STATUS_COLORS: Record<string, string> = {
  SUBMITTED: 'bg-blue-100 text-blue-800',
  UNDER_PROCESSING: 'bg-yellow-100 text-yellow-800',
  KYC_IN_PROGRESS: 'bg-purple-100 text-purple-800',
  KYC_COMPLETE: 'bg-indigo-100 text-indigo-800',
  DOCUMENT_COLLECTION: 'bg-indigo-100 text-indigo-800',
  CREDIT_ASSESSMENT: 'bg-orange-100 text-orange-800',
  APPROVED: 'bg-green-100 text-green-800',
  CONDITIONALLY_APPROVED: 'bg-green-100 text-green-800',
  SANCTIONED: 'bg-green-100 text-green-800',
  REJECTED: 'bg-red-100 text-red-800',
  DISBURSEMENT_IN_PROGRESS: 'bg-teal-100 text-teal-800',
  DISBURSED: 'bg-emerald-100 text-emerald-800',
  WITHDRAWN: 'bg-gray-100 text-gray-600',
  CANCELLED: 'bg-gray-100 text-gray-600',
};
