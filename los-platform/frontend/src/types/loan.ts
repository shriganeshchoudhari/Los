// ─────────────────────────────────────────────────────────────
// 5. LOAN APPLICATION
// ─────────────────────────────────────────────────────────────

import type { UUID, PaisaAmount, ISODateString, ISODateTimeString, MobileNumber, PANNumber } from './shared';
import type { Address, IndianState } from './shared';

export type LoanType =
  | 'HOME_LOAN'
  | 'HOME_LOAN_TOP_UP'
  | 'LAP'
  | 'PERSONAL_LOAN'
  | 'VEHICLE_LOAN_TWO_WHEELER'
  | 'VEHICLE_LOAN_FOUR_WHEELER'
  | 'VEHICLE_LOAN_COMMERCIAL'
  | 'GOLD_LOAN'
  | 'EDUCATION_LOAN'
  | 'KISAN_CREDIT_CARD'
  | 'MUDRA_SHISHU'
  | 'MUDRA_KISHORE'
  | 'MUDRA_TARUN'
  | 'MSME_TERM_LOAN'
  | 'MSME_WORKING_CAPITAL'
  | 'OVERDRAFT';

export type ApplicationStatus =
  | 'DRAFT'
  | 'SUBMITTED'
  | 'KYC_IN_PROGRESS'
  | 'KYC_COMPLETE'
  | 'DOCUMENT_COLLECTION'
  | 'UNDER_PROCESSING'
  | 'BUREAU_PULL_IN_PROGRESS'
  | 'BUREAU_PULL_COMPLETE'
  | 'CREDIT_ASSESSMENT'
  | 'PENDING_FIELD_INVESTIGATION'
  | 'FIELD_INVESTIGATION_DONE'
  | 'PENDING_LEGAL_TECHNICAL'
  | 'LEGAL_TECHNICAL_DONE'
  | 'CREDIT_COMMITTEE'
  | 'APPROVED'
  | 'CONDITIONALLY_APPROVED'
  | 'REJECTED'
  | 'WITHDRAWN'
  | 'CANCELLED'
  | 'SANCTIONED'
  | 'DISBURSEMENT_IN_PROGRESS'
  | 'DISBURSED'
  | 'CLOSED';

export type EmploymentType =
  | 'SALARIED_PRIVATE'
  | 'SALARIED_GOVERNMENT'
  | 'SALARIED_PSU'
  | 'SELF_EMPLOYED_PROFESSIONAL'
  | 'SELF_EMPLOYED_BUSINESS'
  | 'AGRICULTURALIST'
  | 'PENSIONER'
  | 'NRI'
  | 'UNEMPLOYED';

export type CustomerSegment = 'RETAIL' | 'MSME' | 'AGRI' | 'NRI';
export type ChannelCode = 'BRANCH' | 'ONLINE' | 'DSA' | 'MOBILE_APP' | 'API_PARTNER';

export type RejectionReasonCode =
  | 'LOW_CREDIT_SCORE'
  | 'HIGH_FOIR'
  | 'NEGATIVE_BUREAU_HISTORY'
  | 'INCOME_INSUFFICIENT'
  | 'EMPLOYMENT_INSTABILITY'
  | 'KYC_FAILURE'
  | 'DOCUMENT_DEFICIENCY'
  | 'POLICY_DEVIATION'
  | 'FRAUD_SUSPECTED'
  | 'DEFAULTER_LIST'
  | 'LEGAL_ISSUE_PROPERTY'
  | 'TECHNICAL_DEVIATION'
  | 'WILFUL_DEFAULTER'
  | 'NEGATIVE_GEOGRAPHY'
  | 'OTHER';

// ── Applicant Profile ──

export interface ApplicantProfile {
  userId: UUID;
  fullName: string;
  fatherName?: string;
  motherName?: string;
  spouseName?: string;
  dob: ISODateString;
  age: number;
  gender: 'MALE' | 'FEMALE' | 'TRANSGENDER' | 'PREFER_NOT_TO_SAY';
  maritalStatus: 'SINGLE' | 'MARRIED' | 'DIVORCED' | 'WIDOWED';
  mobile: MobileNumber;
  alternateMobile?: MobileNumber;
  email?: string;
  residentialStatus: 'RESIDENT_INDIAN' | 'NRI' | 'OCI' | 'PIO';
  religion?: string;
  caste?: 'GENERAL' | 'SC' | 'ST' | 'OBC' | 'NT';
  addresses: Address[];
  yearsAtCurrentAddress: number;
  ownOrRentedResidence: 'OWNED' | 'RENTED' | 'PARENTAL' | 'COMPANY_PROVIDED';
}

// ── Employment & Income ──

export type OtherIncomeSource = 'RENTAL' | 'AGRICULTURAL' | 'PENSION' | 'INTEREST' | 'DIVIDEND' | 'OTHER';

export interface OtherIncome {
  source: OtherIncomeSource;
  monthlyAmount: PaisaAmount;
  description?: string;
}

export interface BusinessDetails {
  businessName: string;
  businessType: 'PROPRIETORSHIP' | 'PARTNERSHIP' | 'LLP' | 'PVT_LTD' | 'PUBLIC_LTD' | 'HUF';
  gstin?: string;
  businessPAN?: PANNumber;
  yearOfIncorporation?: number;
  industryCode?: string;
  annualTurnover: PaisaAmount;
  netProfit: PaisaAmount;
}

export interface EmploymentDetails {
  employmentType: EmploymentType;
  employerName?: string;
  employerPAN?: PANNumber;
  employerAddress?: Address;
  designation?: string;
  department?: string;
  dateOfJoining?: ISODateString;
  totalWorkExperienceMonths: number;
  currentJobExperienceMonths: number;
  grossMonthlyIncome: PaisaAmount;
  netMonthlyIncome: PaisaAmount;
  otherMonthlyIncome?: OtherIncome[];
  totalAnnualIncome: PaisaAmount;
  businessDetails?: BusinessDetails;
}

// ── Loan Requirement ──

export type CollateralType =
  | 'RESIDENTIAL_PROPERTY'
  | 'COMMERCIAL_PROPERTY'
  | 'AGRICULTURAL_LAND'
  | 'VEHICLE'
  | 'GOLD'
  | 'FIXED_DEPOSIT'
  | 'INSURANCE_POLICY'
  | 'SHARES_DEBENTURES'
  | 'NONE';

export type PropertyType = 'FLAT' | 'INDEPENDENT_HOUSE' | 'PLOT' | 'COMMERCIAL' | 'AGRICULTURAL';

export interface LegalClearanceResult {
  clearedBy: string;
  clearanceDate: ISODateString;
  certificateRef: string;
  titleClear: boolean;
  remarks?: string;
}

export interface ValuationReport {
  valuedBy: string;
  marketValue: PaisaAmount;
  distressValue: PaisaAmount;
  valuationDate: ISODateString;
  reportRef: string;
}

export interface PropertyDetails {
  type: PropertyType;
  surveyNumber?: string;
  registrationNumber?: string;
  builtUpAreaSqFt?: number;
  plotAreaSqFt?: number;
  yearOfConstruction?: number;
  currentOwner: string;
  encumbered: boolean;
  legalClearance?: LegalClearanceResult;
  valuationReport?: ValuationReport;
}

export interface VehicleDetails {
  make: string;
  model: string;
  variant?: string;
  year: number;
  registrationNumber?: string;
  chassisNumber?: string;
  engineNumber?: string;
  exShowroomPrice?: PaisaAmount;
  onRoadPrice?: PaisaAmount;
  dealerCode?: string;
}

export interface GoldDetails {
  weightGrams: number;
  purity: '18K' | '22K' | '24K';
  estimatedValue: PaisaAmount;
  ornamentDescription?: string;
}

export interface CollateralDetails {
  collateralType: CollateralType;
  estimatedValue: PaisaAmount;
  ownerName: string;
  ownerRelationship: string;
  address?: Address;
  propertyDetails?: PropertyDetails;
  vehicleDetails?: VehicleDetails;
  goldDetails?: GoldDetails;
}

export interface CoApplicant {
  relationship: 'SPOUSE' | 'PARENT' | 'SIBLING' | 'SON_DAUGHTER' | 'OTHER';
  applicantProfile: ApplicantProfile;
  employmentDetails: EmploymentDetails;
  isGuarantor: boolean;
}

export interface LoanRequirement {
  loanType: LoanType;
  requestedAmount: PaisaAmount;
  requestedTenureMonths: number;
  purposeDescription?: string;
  preferredEmiDate?: number;
  coApplicants?: CoApplicant[];
  collateral?: CollateralDetails;
  subventionCode?: string;
}

// ── DSA ──

export interface DSADetails {
  dsaCode: string;
  dsaName: string;
  dsaMobile: MobileNumber;
  commissionRate?: number;
}

// ── Loan Application Entity ──

export interface LoanApplication {
  id: UUID;
  applicationNumber: string;
  status: ApplicationStatus;
  loanType: LoanType;
  customerSegment: CustomerSegment;
  applicant: ApplicantProfile;
  employmentDetails: EmploymentDetails;
  loanRequirement: LoanRequirement;
  kycId?: UUID;
  assignedOfficerId?: UUID;
  assignedAnalystId?: UUID;
  branchCode: string;
  channelCode: ChannelCode;
  dsa?: DSADetails;
  bureauReportId?: UUID;
  decisionId?: UUID;
  sanctionedAmount?: PaisaAmount;
  sanctionedTenureMonths?: number;
  sanctionedROI?: number;
  conditionsPreDisbursal?: string[];
  rejectionReasonCode?: RejectionReasonCode;
  rejectionRemarks?: string;
  submittedAt?: ISODateTimeString;
  sanctionedAt?: ISODateTimeString;
  disbursedAt?: ISODateTimeString;
  createdAt: ISODateTimeString;
  updatedAt: ISODateTimeString;
  version: number;
}

export interface ApplicationStageHistory {
  id: UUID;
  applicationId: UUID;
  fromStatus: ApplicationStatus;
  toStatus: ApplicationStatus;
  actionBy: UUID;
  actionByRole: string;
  remarks?: string;
  timestamp: ISODateTimeString;
}

// ── Application Next Steps ──

export type ApplicationNextStep =
  | 'COMPLETE_KYC'
  | 'UPLOAD_DOCUMENTS'
  | 'AWAIT_PROCESSING'
  | 'PAYMENT_PENDING'
  | 'SIGN_AGREEMENT';

export interface CreateApplicationRequest {
  loanType: LoanType;
  channelCode: ChannelCode;
  branchCode?: string;
  dsaCode?: string;
  applicant: Omit<ApplicantProfile, 'userId'>;
  employmentDetails: EmploymentDetails;
  loanRequirement: Omit<LoanRequirement, 'coApplicants'>;
}

export interface CreateApplicationResponse {
  applicationId: UUID;
  applicationNumber: string;
  status: ApplicationStatus;
  nextStep: ApplicationNextStep;
  createdAt: ISODateTimeString;
}

export interface UpdateApplicationRequest {
  section: 'APPLICANT' | 'EMPLOYMENT' | 'LOAN_REQUIREMENT' | 'COLLATERAL';
  data: Partial<ApplicantProfile | EmploymentDetails | LoanRequirement | CollateralDetails>;
  version: number;
}

export interface ApplicationSummaryResponse {
  applicationId: UUID;
  applicationNumber: string;
  status: ApplicationStatus;
  loanType: LoanType;
  applicantName: string;
  requestedAmount: PaisaAmount;
  sanctionedAmount?: PaisaAmount;
  nextStep?: ApplicationNextStep;
  pendingDocuments?: DocumentType[];
  submittedAt?: ISODateTimeString;
  lastUpdatedAt: ISODateTimeString;
}
