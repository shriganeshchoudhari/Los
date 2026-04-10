// ─────────────────────────────────────────────────────────────
// 9. CBS INTEGRATION (Core Banking SOAP)
// ─────────────────────────────────────────────────────────────

import type { UUID, IFSCCode } from './shared';

export type CBSSystem = 'FINACLE' | 'BANCS' | 'FLEXCUBE' | 'TEMENOS' | 'CUSTOM';

// ── SOAP Headers ──

export interface CBSSoapHeader {
  requestId: UUID;
  channelId: string;
  timestamp: string;
  bankCode: string;
  branchCode: string;
  userId: string;
}

export interface CBSSoapResponseHeader {
  requestId: UUID;
  responseCode: string;
  responseMessage: string;
  timestamp: string;
}

export interface CBSAddress {
  addressLine1: string;
  addressLine2?: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  addressType: string;
}

// ── Customer Creation ──

export interface CBSCreateCustomerBody {
  customerType: 'INDIVIDUAL' | 'CORPORATE';
  shortName: string;
  fullName: string;
  dob: string;
  gender: 'M' | 'F';
  mobile: string;
  email?: string;
  panNumber: string;
  aadhaarNumberHash: string;
  address: CBSAddress;
  kycStatus: 'COMPLETED' | 'PENDING';
  kycRefNumber: string;
  segment: string;
  constitutionCode: string;
  categoryCode: string;
}

export interface CBSCreateCustomerRequest {
  header: CBSSoapHeader;
  body: CBSCreateCustomerBody;
}

export interface CBSCreateCustomerResult {
  customerId: string;
  status: 'SUCCESS' | 'DUPLICATE' | 'ERROR';
  errorCode?: string;
  errorMessage?: string;
}

export interface CBSCreateCustomerResponse {
  header: CBSSoapResponseHeader;
  body: CBSCreateCustomerResult;
}

// ── Loan Account Creation ──

export interface CBSCollateralDetails {
  collateralType: string;
  collateralValue: string;
  securityDescription: string;
}

export interface CBSLoanAccountBody {
  customerId: string;
  schemeCode: string;
  sanctionedAmount: string;
  disbursedAmount: string;
  tenureMonths: number;
  roi: string;
  emiAmount: string;
  firstEmiDate: string;
  branchCode: string;
  repaymentAccountNumber: string;
  processingFee: string;
  collateralDetails?: CBSCollateralDetails;
}

export interface CBSCreateLoanAccountRequest {
  header: CBSSoapHeader;
  body: CBSLoanAccountBody;
}

export interface CBSCreateLoanAccountResponse {
  header: CBSSoapResponseHeader;
  body: {
    loanAccountNumber: string;
    status: 'SUCCESS' | 'ERROR';
    errorCode?: string;
    errorMessage?: string;
  };
}

// ── Account Enquiry ──

export interface CBSAccountEnquiryResponse {
  header: CBSSoapResponseHeader;
  body: {
    accountNumber: string;
    accountStatus: string;
    availableBalance: string;
    ledgerBalance: string;
    holdAmount: string;
    accountName: string;
    currency: string;
  };
}
