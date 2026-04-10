import { Controller, Get, Param, Res, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { Inject } from '@nestjs/common';
import { SanctionLetterService } from '../services/sanction-letter.service';
import { SanctionLetterData } from '../services/sanction-letter.types';
import { RolesGuard, Roles } from '@los/common';
import { LoanApplicationService } from '../services/loan-application.service';
import { HttpService } from '@nestjs/axios';
import { calculateEMI, numberToWords, formatDate } from '../services/utils/number-format';

@ApiTags('Sanction Letter')
@ApiBearerAuth()
@Controller('sanction-letter')
@UseGuards(RolesGuard)
export class SanctionLetterController {
  constructor(
    private readonly sanctionLetterService: SanctionLetterService,
    private readonly applicationService: LoanApplicationService,
    private readonly httpService: HttpService,
  ) {}

  @Get(':applicationId/pdf')
  @Roles('LOAN_OFFICER', 'BRANCH_MANAGER', 'CREDIT_ANALYST', 'ZONAL_CREDIT_HEAD')
  @ApiOperation({ summary: 'Generate and download sanction letter PDF for an application' })
  @ApiResponse({ status: 200, description: 'PDF binary stream' })
  @ApiResponse({ status: 404, description: 'Application not found or not in sanctioned state' })
  async getSanctionLetter(
    @Param('applicationId') applicationId: string,
    @Res() res: Response,
  ) {
    const data = await this.buildSanctionLetterData(applicationId);
    const pdfBuffer = await this.sanctionLetterService.generateSanctionLetter(data);

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="Sanction_Letter_${data.applicationNumber}.pdf"`,
      'Content-Length': pdfBuffer.length,
      'Cache-Control': 'no-cache',
    });

    res.end(pdfBuffer);
  }

  @Get(':applicationId/preview')
  @Roles('LOAN_OFFICER', 'BRANCH_MANAGER', 'CREDIT_ANALYST', 'ZONAL_CREDIT_HEAD')
  @ApiOperation({ summary: 'Preview sanction letter data (JSON) without generating PDF' })
  @ApiResponse({ status: 200, description: 'Sanction letter data JSON' })
  @ApiResponse({ status: 404, description: 'Application not found or not in sanctioned state' })
  async previewSanctionLetter(@Param('applicationId') applicationId: string): Promise<SanctionLetterData> {
    return this.buildSanctionLetterData(applicationId);
  }

  private async buildSanctionLetterData(applicationId: string): Promise<SanctionLetterData> {
    const application = await this.applicationService.getApplicationRaw(applicationId);
    if (!application) {
      throw new Error(`Application ${applicationId} not found`);
    }

    const sanctionedStatuses = ['APPROVED', 'CONDITIONALLY_APPROVED', 'SANCTIONED', 'DISBURSED'];
    if (!sanctionedStatuses.includes(application.status)) {
      throw new Error(`Application is not in a sanctioned state. Current status: ${application.status}`);
    }

    let decision = null;
    try {
      const decisionRes = await this.httpService.axiosRef.get(
        `${process.env.DECISION_SERVICE_URL || 'http://localhost:3005'}/decision/${applicationId}`,
        { timeout: 5000 },
      );
      decision = decisionRes.data;
    } catch {
      decision = null;
    }

    const approvedAmount = decision?.approvedAmount || application.requestedAmount;
    const rateOfInterestBps = decision?.rateOfInterestBps || 1050;
    const rateOfInterestPercent = rateOfInterestBps / 100;
    const tenureMonths = decision?.approvedTenureMonths || application.loanRequirement?.tenureMonths || 36;
    const processingFeePct = 2.0;
    const processingFeeAmount = Math.round(approvedAmount * processingFeePct / 100);

    const emiAmount = calculateEMI(approvedAmount, rateOfInterestPercent, tenureMonths);
    const totalPayment = emiAmount * tenureMonths;
    const totalInterest = totalPayment - approvedAmount;

    const sanctionDate = new Date();
    const validUntil = new Date(sanctionDate);
    validUntil.setDate(validUntil.getDate() + 30);

    const firstEmiDate = new Date(sanctionDate);
    firstEmiDate.setMonth(firstEmiDate.getMonth() + 1);
    const lastEmiDate = new Date(firstEmiDate);
    lastEmiDate.setMonth(lastEmiDate.getMonth() + tenureMonths);

    const loanAccountNumber = `LOSB/${application.loanType?.slice(0, 2) || 'PL'}/${new Date().getFullYear()}/${application.applicationNumber?.slice(-6) || applicationId.slice(0, 6)}`;

    const branchData = this.getBranchData(application.branchCode);
    const productName = this.getProductName(application.loanType);

    const sanitizedAmountInWords = numberToWords(approvedAmount);
    const approvedAmountInWords = sanitizedAmountInWords + ' Only';

    const applicant = application.applicantProfile || {};
    const employment = application.employmentDetails || {};
    const address = applicant.addresses?.[0] || {};

    const customerAddress = [
      applicant.addressLine1 || applicant.addressLine2,
      address.city || '',
      address.state || '',
      applicant.pincode || '',
    ].filter(Boolean).join(', ');

    return {
      applicationNumber: application.applicationNumber,
      customerName: application.applicantFullName,
      customerAddress: customerAddress || 'Address on record',
      sanctionedAmount: approvedAmount,
      sanctionedAmountInWords: approvedAmountInWords,
      rateOfInterestPercent,
      rateOfInterestBps,
      tenureMonths,
      emiAmount,
      processingFeeAmount,
      totalPayableAmount: totalPayment + processingFeeAmount,
      firstEmiDate: formatDate(firstEmiDate),
      lastEmiDate: formatDate(lastEmiDate),
      productName,
      productCode: application.loanType,
      sanctionDate: formatDate(sanctionDate),
      validUntil: formatDate(validUntil),
      disbursementConditions: [
        employment.employerName ? `Employer: ${employment.employerName}` : null,
        applicant.panNumber ? `PAN: ${applicant.panNumber}` : null,
      ].filter(Boolean),
      sanctioningAuthority: branchData.managerName,
      authorityDesignation: branchData.managerDesignation,
      loanAccountNumber,
      ifscCode: branchData.ifscCode,
      branchName: branchData.branchName,
      prepaymentTerms: {
        allowed: true,
        lockInMonths: 12,
        maxPercentPerYear: 25.00,
        penaltyPercent: 0.00,
        penaltyClause: 'No penalty for floating rate loans as per RBI Master Direction on Interest Rates on Loans.',
      },
      foreclosureTerms: {
        allowed: true,
        lockInMonths: 6,
        minOutstandingBalance: 100000,
        processingFeePercent: 3.00,
        processingFeeClause: 'GST @ 18% applicable on processing fee.',
      },
    };
  }

  private getBranchData(branchCode: string): {
    managerName: string;
    managerDesignation: string;
    ifscCode: string;
    branchName: string;
  } {
    const branches: Record<string, any> = {
      BR001: { managerName: 'Rajesh Kumar', managerDesignation: 'Branch Manager', ifscCode: 'LOSB0000001', branchName: 'Mumbai Main Branch' },
      BR002: { managerName: 'Priya Sharma', managerDesignation: 'Branch Manager', ifscCode: 'LOSB0000002', branchName: 'Delhi NCR Branch' },
      BR003: { managerName: 'Anil Gupta', managerDesignation: 'Branch Manager', ifscCode: 'LOSB0000003', branchName: 'Bangalore MG Road' },
      BR004: { managerName: 'Meera Devi', managerDesignation: 'Branch Manager', ifscCode: 'LOSB0000004', branchName: 'Chennai T Nagar' },
      BR005: { managerName: 'Vikram Patel', managerDesignation: 'Branch Manager', ifscCode: 'LOSB0000005', branchName: 'Hyderabad Hitec City' },
      HQ001: { managerName: 'Sunita Rao', managerDesignation: 'Head - Credit Operations', ifscCode: 'LOSB0000001', branchName: 'Head Office' },
    };
    return branches[branchCode] || branches['BR001'];
  }

  private getProductName(loanType: string): string {
    const names: Record<string, string> = {
      PERSONAL_LOAN: 'Personal Loan',
      HOME_LOAN: 'Home Loan',
      LAP: 'Loan Against Property',
      VEHICLE_LOAN_TWO_WHEELER: 'Two Wheeler Loan',
      VEHICLE_LOAN_FOUR_WHEELER: 'Four Wheeler Loan',
      EDUCATION_LOAN: 'Education Loan',
      GOLD_LOAN: 'Gold Loan',
      MSME_TERM_LOAN: 'MSME Term Loan',
      MUDRA_KISHORE: 'Mudra Kishore Loan',
      MUDRA_TARUN: 'Mudra Tarun Loan',
      KISAN_CREDIT_CARD: 'Kisan Credit Card',
    };
    return names[loanType] || 'Personal Loan';
  }
}
