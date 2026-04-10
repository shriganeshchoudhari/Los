import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsNumber,
  IsUUID,
  IsDateString,
  ValidateNested,
  IsBoolean,
  Min,
  Max,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaymentMode, DisbursementStatus } from '../entities/payment.entity';

export class DisbursementInitDto {
  @ApiProperty({ description: 'Application ID' })
  @IsUUID()
  @IsNotEmpty()
  applicationId: string;

  @ApiPropertyOptional({ description: 'Loan ID (for subsequent tranches)' })
  @IsOptional()
  @IsUUID()
  loanId?: string;

  @ApiPropertyOptional({ description: 'Existing CBS customer ID (skip CBS customer creation)' })
  @IsOptional()
  @IsString()
  existingCbsCustomerId?: string;

  @ApiProperty({ description: 'Disbursement amount in INR' })
  @IsNumber()
  @Min(100)
  amount: number;

  @ApiProperty({ description: 'Tranche number (1 for first, up to 10 for home loans)' })
  @IsNumber()
  @Min(1)
  @Max(10)
  trancheNumber: number;

  @ApiProperty({ description: 'Beneficiary account number' })
  @IsString()
  @IsNotEmpty()
  beneficiaryAccountNumber: string;

  @ApiProperty({ description: 'Beneficiary IFSC code (11 characters)' })
  @IsString()
  @IsNotEmpty()
  @Min(11)
  @Max(11)
  beneficiaryIfsc: string;

  @ApiProperty({ description: 'Beneficiary name as per bank records' })
  @IsString()
  @IsNotEmpty()
  beneficiaryName: string;

  @ApiPropertyOptional({ description: 'Beneficiary mobile number (10 digits)' })
  @IsOptional()
  @IsString()
  @Min(10)
  @Max(10)
  beneficiaryMobile?: string;

  @ApiPropertyOptional({ description: 'Idempotency key to prevent duplicate disbursement' })
  @IsOptional()
  @IsString()
  @Max(64)
  idempotencyKey?: string;

  @ApiPropertyOptional({ description: 'Remarks for this disbursement' })
  @IsOptional()
  @IsString()
  remarks?: string;
}

export class DisbursementResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  disbursementNumber: string;

  @ApiProperty()
  applicationId: string;

  @ApiProperty({ enum: PaymentMode })
  paymentMode: PaymentMode;

  @ApiProperty()
  amount: number;

  @ApiProperty({ enum: DisbursementStatus })
  status: DisbursementStatus;

  @ApiPropertyOptional()
  cbsCustomerId?: string;

  @ApiPropertyOptional()
  loanAccountId?: string;

  @ApiPropertyOptional()
  utrNumber?: string;

  @ApiPropertyOptional()
  npciReferenceId?: string;

  @ApiPropertyOptional()
  nachMandateId?: string;

  @ApiPropertyOptional()
  failureReason?: string;

  @ApiPropertyOptional()
  initiatedAt?: Date;

  @ApiPropertyOptional()
  settlementAt?: Date;

  @ApiPropertyOptional()
  retryCount?: number;
}

export class NACHMandateInitDto {
  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  applicationId: string;

  @ApiProperty()
  @IsUUID()
  @IsNotEmpty()
  loanId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  loanAccountId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  debtorAccountNumber: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  debtorIfsc: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  debtorName: string;

  @ApiProperty()
  @IsNumber()
  @Min(1)
  maxAmount: number;

  @ApiProperty()
  @IsDateString()
  startDate: string;

  @ApiProperty()
  @IsDateString()
  endDate: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  frequency?: string;
}

export class NACHMandateResponseDto {
  @ApiProperty()
  id: string;

  @ApiProperty()
  emandateId: string;

  @ApiProperty()
  registrationStatus: string;

  @ApiPropertyOptional()
  umrn?: string;

  @ApiPropertyOptional()
  confirmationStatus?: string;

  @ApiPropertyOptional()
  rejectionReason?: string;
}

export class PaymentCallbackDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  utrNumber: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  status: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  statusCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reasonCode?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  reasonDescription?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  settlementDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  amount?: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @IsDateString()
  callbackTimestamp?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  checksum?: string;
}

export class PennyDropVerifyDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  accountNumber: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  ifsc: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  beneficiaryName?: string;
}

export class PennyDropResponseDto {
  @ApiProperty()
  verified: boolean;

  @ApiPropertyOptional()
  accountExists?: boolean;

  @ApiPropertyOptional()
  @IsString()
  bankName?: string;

  @ApiPropertyOptional()
  @IsString()
  accountHolderName?: string;

  @ApiPropertyOptional()
  @IsString()
  accountType?: string;

  @ApiPropertyOptional()
  @IsString()
  impsEnabled?: string;

  @ApiPropertyOptional()
  @IsString()
  errorCode?: string;

  @ApiPropertyOptional()
  @IsString()
  errorMessage?: string;
}

export class DisbursementQueryDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  applicationId?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsUUID()
  loanId?: string;

  @ApiPropertyOptional({ enum: DisbursementStatus })
  @IsOptional()
  @IsEnum(DisbursementStatus)
  status?: DisbursementStatus;

  @ApiPropertyOptional({ enum: PaymentMode })
  @IsOptional()
  @IsEnum(PaymentMode)
  paymentMode?: PaymentMode;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  fromDate?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  toDate?: string;
}

export class CBSCustomerCreateDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  applicationId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  applicantId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  firstName: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  lastName: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  dateOfBirth: string;

  @ApiProperty()
  @IsString()
  @IsEnum(['MALE', 'FEMALE', 'OTHER'])
  gender: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  panNumber: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  mobileNumber: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  emailId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  addressLine1: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  city: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  state: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  pincode: string;

  @ApiProperty()
  @IsString()
  @IsEnum(['INDIVIDUAL', 'JOINT', 'GUARANTOR'])
  customerType: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  aadhaarHash?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  branchCode?: string;
}

export class CBSLoanAccountCreateDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  applicationId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  cbsCustomerId: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  productCode: string;

  @ApiProperty()
  @IsNumber()
  @Min(1)
  sanctionedAmount: number;

  @ApiProperty()
  @IsNumber()
  @Min(1)
  tenureMonths: number;

  @ApiProperty()
  @IsNumber()
  @Min(0)
  interestRate: number;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  disbursementAccountNumber: string;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  disbursementIfsc: string;

  @ApiProperty()
  @IsDateString()
  disbursementDate: string;

  @ApiProperty()
  @IsNumber()
  @Min(1)
  emiAmount: number;

  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(1)
  firstEMI Date?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  purposeOfLoan?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  branchCode?: string;
}
