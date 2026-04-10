import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { ConfigService } from '@nestjs/config';
import * as PDFDocument from 'pdfkit';
import { v4 as uuidv4 } from 'uuid';
import { LoanAgreementData } from './agreement.types';
import { numberToWords } from './utils/number-format';
import { LoanApplicationService } from './loan-application.service';
import { MinIOService } from './minio.service';
import {
  LoanAgreement,
  LoanAgreementStatus,
  LoanAgreementSignature,
  SignatureStatus,
} from '../entities';
import { AuditService, AuditEventCategory, AuditEventType } from '@los/common';

const BANK_NAME = 'LOS Bank Limited';
const BANK_REG_OFFICE = 'LOS Bank Tower, 123, Bandra Kurla Complex, Bandra (E), Mumbai - 400051';
const CIN = 'CIN: L65990MH2024PLC123456';

@Injectable()
export class LoanAgreementService {
  private readonly logger = new Logger(LoanAgreementService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly applicationService: LoanApplicationService,
    private readonly minioService: MinIOService,
    private readonly auditService: AuditService,
    @InjectRepository(LoanAgreement)
    private readonly agreementRepo: Repository<LoanAgreement>,
    @InjectRepository(LoanAgreementSignature)
    private readonly signatureRepo: Repository<LoanAgreementSignature>,
  ) {}

  async generateAndStoreAgreement(applicationId: string, userId: string): Promise<LoanAgreement> {
    const app = await this.applicationService.getApplicationRaw(applicationId);
    if (!app) {
      throw new NotFoundException(`Application ${applicationId} not found`);
    }

    const sanction = app.sanctionDetails;
    if (!sanction) {
      throw new NotFoundException(`No sanction details found for application ${applicationId}`);
    }

    const agreementDate = new Date();
    const agreementNumber = `LOAN-AGR-${agreementDate.getFullYear()}-${applicationId.split('-')[0].toUpperCase()}`;

    const productName = this.getProductName(app.loanProduct);
    const firstEmiDate = new Date(agreementDate);
    firstEmiDate.setDate(firstEmiDate.getDate() + 30);
    const lastEmiDate = new Date(firstEmiDate);
    lastEmiDate.setMonth(lastEmiDate.getMonth() + (sanction.tenureMonths || 60));

    const agreementData: LoanAgreementData = {
      applicationNumber: app.applicationNumber,
      loanAccountNumber: sanction.loanAccountNumber || '',
      customerName: app.applicantFullName || app.applicantProfile?.fullName || '',
      customerAddress: this.formatAddress(app),
      customerPAN: app.applicantProfile?.panNumber || '',
      customerMobile: app.applicantProfile?.mobileNumber || '',
      customerEmail: app.applicantProfile?.email || '',
      coBorrowerName: app.coBorrower?.fullName,
      coBorrowerAddress: app.coBorrower ? this.formatAddress(app.coBorrower) : undefined,
      coBorrowerPAN: app.coBorrower?.panNumber,
      guarantorName: app.guarantor?.fullName,
      guarantorAddress: app.guarantor ? this.formatAddress(app.guarantor) : undefined,
      guarantorPAN: app.guarantor?.panNumber,
      sanctionedAmount: Number(sanction.approvedAmount),
      sanctionedAmountInWords: numberToWords(Number(sanction.approvedAmount)),
      rateOfInterestPercent: Number(sanction.interestRate),
      rateOfInterestBps: Math.round(Number(sanction.interestRate) * 100),
      tenureMonths: sanction.tenureMonths || 60,
      emiAmount: Number(sanction.emiAmount),
      moratoriumPeriodMonths: sanction.moratoriumMonths,
      moratoriumEMI: sanction.moratoriumEMI ? Number(sanction.moratoriumEMI) : undefined,
      processingFee: Number(sanction.processingFee || 0),
      agreementDate: agreementDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      agreementNumber,
      productName,
      productCode: app.loanProduct?.toUpperCase() || 'BL',
      disbursementAccountNumber: app.bankAccount?.accountNumber || '',
      disbursementIFSC: app.bankAccount?.ifscCode || '',
      disbursementBankName: app.bankAccount?.bankName || '',
      branchName: app.branchName || 'Main Branch',
      branchAddress: app.branchAddress || '',
      securityDescription: sanction.securityDescription || 'Hypothecation of current and future assets.',
      insurancePolicyNumber: undefined,
      insurancePremium: undefined,
      firstEMIDate: firstEmiDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      lastEMIDate: lastEmiDate.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' }),
      prepaymentPenaltyClause: 'NIL — As per RBI guidelines for floating rate loans',
      defaultInterestRatePercent: 2,
      bounceCharge: 500,
      partPaymentAllowed: true,
      partPaymentMinAmount: 50000,
      partPaymentTenureReduction: true,
      foreclosureAllowed: true,
      foreclosureNoticePeriodDays: 6,
      foreclosurePenaltyPercent: 0,
      specialConditions: sanction.specialConditions || [],
      jurisdiction: 'Mumbai, Maharashtra',
      witnessingOfficerName: 'Priya Sharma',
      witnessingOfficerDesignation: 'Deputy Vice President - Credit',
    };

    const pdfBuffer = await this.generateAgreement(agreementData);
    const documentHash = this.minioService['client']
      ? require('crypto').createHash('sha256').update(pdfBuffer).digest('hex')
      : pdfBuffer.toString('base64').slice(0, 64);

    const objectKey = this.minioService.generateObjectKey(applicationId, `${agreementNumber}.pdf`);
    await this.minioService.uploadBuffer(objectKey, pdfBuffer);

    let agreement = await this.agreementRepo.findOne({ where: { applicationId } });
    if (agreement) {
      agreement.documentKey = objectKey;
      agreement.documentHash = documentHash;
      agreement.agreementDate = agreementDate;
      agreement.loanAccountNumber = agreementData.loanAccountNumber;
      agreement.sanctionedAmount = agreementData.sanctionedAmount;
      agreement.sanctionedAmountWords = agreementData.sanctionedAmountInWords;
      agreement.rateOfInterest = agreementData.rateOfInterestPercent;
      agreement.rateOfInterestBps = agreementData.rateOfInterestBps;
      agreement.tenureMonths = agreementData.tenureMonths;
      agreement.emiAmount = agreementData.emiAmount;
      agreement.moratoriumPeriodMonths = agreementData.moratoriumPeriodMonths || null;
      agreement.moratoriumEmi = agreementData.moratoriumEMI || null;
      agreement.processingFee = agreementData.processingFee;
      agreement.firstEmiDate = firstEmiDate;
      agreement.lastEmiDate = lastEmiDate;
      agreement.disbursementAccount = agreementData.disbursementAccountNumber;
      agreement.disbursementIfsc = agreementData.disbursementIFSC;
      agreement.disbursementBank = agreementData.disbursementBankName;
      agreement.branchName = agreementData.branchName;
      agreement.branchAddress = agreementData.branchAddress;
      agreement.securityDescription = agreementData.securityDescription;
      agreement.prepaymentPenaltyClause = agreementData.prepaymentPenaltyClause;
      agreement.defaultInterestRate = agreementData.defaultInterestRatePercent;
      agreement.bounceCharge = agreementData.bounceCharge;
      agreement.partPaymentAllowed = agreementData.partPaymentAllowed;
      agreement.partPaymentMinAmount = agreementData.partPaymentMinAmount;
      agreement.partPaymentTenureReduction = agreementData.partPaymentTenureReduction;
      agreement.foreclosureAllowed = agreementData.foreclosureAllowed;
      agreement.foreclosureNoticePeriodDays = agreementData.foreclosureNoticePeriodDays;
      agreement.foreclosurePenaltyPercent = agreementData.foreclosurePenaltyPercent;
      agreement.specialConditions = agreementData.specialConditions;
      agreement.jurisdiction = agreementData.jurisdiction;
      agreement.witnessingOfficerName = agreementData.witnessingOfficerName;
      agreement.witnessingOfficerDesignation = agreementData.witnessingOfficerDesignation;
      agreement.status = LoanAgreementStatus.PENDING_SIGNATURE;
      agreement.coBorrowerName = agreementData.coBorrowerName || null;
      agreement.coBorrowerAddress = agreementData.coBorrowerAddress || null;
      agreement.coBorrowerPan = agreementData.coBorrowerPAN || null;
      agreement.guarantorName = agreementData.guarantorName || null;
      agreement.guarantorAddress = agreementData.guarantorAddress || null;
      agreement.guarantorPan = agreementData.guarantorPAN || null;
      await this.agreementRepo.save(agreement);
    } else {
      agreement = this.agreementRepo.create({
        applicationId,
        agreementNumber,
        documentKey: objectKey,
        documentHash,
        agreementDate,
        loanAccountNumber: agreementData.loanAccountNumber,
        sanctionedAmount: agreementData.sanctionedAmount,
        sanctionedAmountWords: agreementData.sanctionedAmountInWords,
        rateOfInterest: agreementData.rateOfInterestPercent,
        rateOfInterestBps: agreementData.rateOfInterestBps,
        tenureMonths: agreementData.tenureMonths,
        emiAmount: agreementData.emiAmount,
        moratoriumPeriodMonths: agreementData.moratoriumPeriodMonths || null,
        moratoriumEmi: agreementData.moratoriumEMI || null,
        processingFee: agreementData.processingFee,
        firstEmiDate,
        lastEmiDate,
        disbursementAccount: agreementData.disbursementAccountNumber,
        disbursementIfsc: agreementData.disbursementIFSC,
        disbursementBank: agreementData.disbursementBankName,
        branchName: agreementData.branchName,
        branchAddress: agreementData.branchAddress,
        securityDescription: agreementData.securityDescription,
        prepaymentPenaltyClause: agreementData.prepaymentPenaltyClause,
        defaultInterestRate: agreementData.defaultInterestRatePercent,
        bounceCharge: agreementData.bounceCharge,
        partPaymentAllowed: agreementData.partPaymentAllowed,
        partPaymentMinAmount: agreementData.partPaymentMinAmount,
        partPaymentTenureReduction: agreementData.partPaymentTenureReduction,
        foreclosureAllowed: agreementData.foreclosureAllowed,
        foreclosureNoticePeriodDays: agreementData.foreclosureNoticePeriodDays,
        foreclosurePenaltyPercent: agreementData.foreclosurePenaltyPercent,
        specialConditions: agreementData.specialConditions,
        jurisdiction: agreementData.jurisdiction,
        witnessingOfficerName: agreementData.witnessingOfficerName,
        witnessingOfficerDesignation: agreementData.witnessingOfficerDesignation,
        coBorrowerName: agreementData.coBorrowerName || null,
        coBorrowerAddress: agreementData.coBorrowerAddress || null,
        coBorrowerPan: agreementData.coBorrowerPAN || null,
        guarantorName: agreementData.guarantorName || null,
        guarantorAddress: agreementData.guarantorAddress || null,
        guarantorPan: agreementData.guarantorPAN || null,
        status: LoanAgreementStatus.PENDING_SIGNATURE,
        createdBy: userId,
      });
      agreement = await this.agreementRepo.save(agreement);
    }

    await this.auditService.log({
      eventCategory: AuditEventCategory.APPLICATION,
      eventType: AuditEventType.SANCTION_LETTER_GENERATED,
      entityType: 'LoanAgreement',
      entityId: agreement.id,
      userId,
      metadata: {
        applicationId,
        agreementNumber,
        sanctionedAmount: agreementData.sanctionedAmount,
      },
    });

    this.logger.log(`Agreement ${agreementNumber} generated and stored for application ${applicationId}`);
    return agreement;
  }

  async getAgreementByApplication(applicationId: string): Promise<LoanAgreement | null> {
    return this.agreementRepo.findOne({ where: { applicationId } });
  }

  async getAgreementPdf(applicationId: string): Promise<Buffer> {
    const agreement = await this.agreementRepo.findOne({ where: { applicationId } });
    if (!agreement?.documentKey) {
      throw new NotFoundException('Agreement PDF not found');
    }
    return this.minioService.getObject(agreement.documentKey);
  }

  async createSignatureRecord(
    agreementId: string,
    signerType: string,
    signerName: string,
    signerMobile: string | null,
    signerEmail: string | null,
    signerRole: string | null,
  ): Promise<LoanAgreementSignature> {
    const signature = this.signatureRepo.create({
      agreementId,
      signerType,
      signerName,
      signerMobile,
      signerEmail,
      signerRole,
      signatureStatus: SignatureStatus.PENDING,
      consentTaken: false,
    });
    return this.signatureRepo.save(signature);
  }

  async updateAgreementStatus(agreementId: string, status: LoanAgreementStatus): Promise<LoanAgreement> {
    const agreement = await this.agreementRepo.findOne({ where: { id: agreementId } });
    if (!agreement) throw new NotFoundException('Agreement not found');
    agreement.status = status;
    return this.agreementRepo.save(agreement);
  }

  private getProductName(productCode: string): string {
    const products: Record<string, string> = {
      PL: 'Personal Loan',
      BL: 'Business Loan',
      HL: 'Home Loan',
      LAP: 'Loan Against Property',
      VL: 'Vehicle Loan',
      EL: 'Education Loan',
      HL_PLUS: 'Home Loan Plus',
    };
    return products[productCode?.toUpperCase()] || 'Loan';
  }

  private formatAddress(profile: any): string {
    if (!profile) return '';
    const parts = [
      profile.addressLine1,
      profile.addressLine2,
      profile.city,
      profile.state,
      profile.pincode,
    ].filter(Boolean);
    return parts.join(', ');
  }

  async generateAgreement(data: LoanAgreementData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const chunks: Buffer[] = [];
        const doc = new PDFDocument({
          size: 'A4',
          margins: { top: 50, bottom: 50, left: 50, right: 50 },
          info: {
            Title: `Loan Agreement - ${data.agreementNumber}`,
            Author: BANK_NAME,
            Subject: 'Loan Agreement',
            CreationDate: new Date(),
          },
        });

        doc.on('data', (c: Buffer) => chunks.push(c));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        this.renderHeader(doc);
        this.renderAgreementTitle(doc, data);
        this.renderParties(doc, data);
        this.renderRecitals(doc, data);
        this.renderDefinitions(doc);
        this.renderLoanTerms(doc, data);
        this.renderInterestTerms(doc, data);
        this.renderRepaymentTerms(doc, data);
        this.renderSecurityTerms(doc, data);
        this.renderCovenants(doc, data);
        this.renderDefaultRemedies(doc, data);
        this.renderGeneralTerms(doc, data);
        this.renderSignatures(doc, data);

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  private renderHeader(doc: PDFKit.PDFDocument): void {
    const pageW = doc.page.width;
    doc.rect(0, 0, pageW, 60).fill('#1a365d');
    doc.fillColor('#ffffff')
      .fontSize(16).font('Helvetica-Bold')
      .text(BANK_NAME, 50, 10, { align: 'center' })
      .fontSize(8).font('Helvetica')
      .text(BANK_REG_OFFICE, 50, 30, { align: 'center' })
      .text(CIN, 50, 42, { align: 'center' });
    doc.rect(0, 60, pageW, 2).fill('#c9a227');
  }

  private renderAgreementTitle(doc: PDFKit.PDFDocument, data: LoanAgreementData): void {
    doc.moveDown(1.5);
    doc.fontSize(13).font('Helvetica-Bold').fillColor('#1a365d')
      .text('LOAN AGREEMENT', { align: 'center' });
    doc.moveDown(0.3);
    doc.fontSize(10).font('Helvetica').fillColor('#2d3748')
      .text(`Agreement No: ${data.agreementNumber}`, { align: 'center' })
      .text(`Date: ${data.agreementDate}`, { align: 'center' })
      .text(`Loan Account No: ${data.loanAccountNumber}`, { align: 'center' });
    doc.moveDown(1);
  }

  private renderParties(doc: PDFKit.PDFDocument, data: LoanAgreementData): void {
    this.sectionDivider(doc, 'PARTIES TO THIS AGREEMENT');
    doc.moveDown(0.5);

    doc.fontSize(10).font('Helvetica-Bold').fillColor('#1a365d')
      .text('PARTY A - THE LENDER');
    doc.moveDown(0.2);
    doc.fontSize(9).font('Helvetica').fillColor('#2d3748')
      .text(`${BANK_NAME}, a company incorporated under the Companies Act, 2013, having its Registered Office at ${BANK_REG_OFFICE} (hereinafter referred to as "the Bank" or "Party A", which expression shall, unless it be repugnant to the context or meaning thereof, be deemed to include its successors and assigns).`)
      .moveDown(0.8);

    doc.fontSize(10).font('Helvetica-Bold').fillColor('#1a365d')
      .text('PARTY B - THE BORROWER');
    doc.moveDown(0.2);
    doc.fontSize(9).font('Helvetica').fillColor('#2d3748')
      .text(`Name: ${data.customerName}`)
      .text(`Address: ${data.customerAddress}`)
      .text(`PAN: ${data.customerPAN}`)
      .text(`Mobile: ${data.customerMobile}`)
      .text(`Email: ${data.customerEmail}`)
      .text(`(hereinafter referred to as "the Borrower" or "Party B", which expression shall, unless it be repugnant to the context or meaning thereof, be deemed to include his/her heirs, executors, administrators, and legal representatives).`)
      .moveDown(0.5);

    if (data.coBorrowerName) {
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#1a365d')
        .text('CO-BORROWER');
      doc.moveDown(0.2);
      doc.fontSize(9).font('Helvetica').fillColor('#2d3748')
        .text(`Name: ${data.coBorrowerName}`)
        .text(`Address: ${data.coBorrowerAddress}`)
        .text(`PAN: ${data.coBorrowerPAN}`)
        .text('(hereinafter referred to as "the Co-Borrower", jointly and severally liable with Party B).')
        .moveDown(0.5);
    }

    if (data.guarantorName) {
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#1a365d')
        .text('GUARANTOR');
      doc.moveDown(0.2);
      doc.fontSize(9).font('Helvetica').fillColor('#2d3748')
        .text(`Name: ${data.guarantorName}`)
        .text(`Address: ${data.guarantorAddress}`)
        .text(`PAN: ${data.guarantorPAN}`)
        .text('(hereinafter referred to as "the Guarantor"). The Guarantor hereby unconditionally and irrevocably guarantees the due repayment of all sums payable by the Borrower under this Agreement.')
        .moveDown(0.5);
    }
  }

  private renderRecitals(doc: PDFKit.PDFDocument, data: LoanAgreementData): void {
    if (doc.y > 650) { doc.addPage(); this.renderHeader(doc); }
    this.sectionDivider(doc, 'RECITALS');
    doc.moveDown(0.5);

    doc.fontSize(9).font('Helvetica').fillColor('#2d3748')
      .text('WHEREAS, Party B has applied to Party A for a loan facility under the following terms and conditions;')
      .text('AND WHEREAS, Party A has agreed to sanction the loan facility to Party B subject to the terms and conditions contained herein;')
      .text(`AND WHEREAS, the loan is for the purpose of financing ${data.productName};`)
      .text('NOW THEREFORE, in consideration of the mutual covenants and agreements hereinafter contained, the parties agree as follows:');
    doc.moveDown(1);
  }

  private renderDefinitions(doc: PDFKit.PDFDocument): void {
    if (doc.y > 620) { doc.addPage(); this.renderHeader(doc); }
    this.sectionDivider(doc, 'DEFINITIONS');
    doc.moveDown(0.5);

    const definitions = [
      '"Loan" or "Facility"', 'means the loan amount of Rs. as sanctioned by the Bank under this Agreement.';
      '"EMI"', 'means Equated Monthly Instalment payable by the Borrower towards repayment of the Loan, as specified in the Sanction Letter.';
      '"Interest"', 'means the rate of interest charged by the Bank on the outstanding Loan amount as specified herein.';
      '"Sanction Letter"', 'means the letter of sanction issued by the Bank to the Borrower.';
      '"Business Day"', 'means any day on which the Bank is open for business in India, excluding Sundays and public holidays.';
      '"Default"', 'means non-payment of any amount due under this Agreement on the due date.';
      '"Security"', 'means the security created or to be created in favour of the Bank.';
    ];

    doc.fontSize(9).font('Helvetica').fillColor('#2d3748');
    definitions.forEach(([term, def]) => {
      doc.font('Helvetica-Bold').fillColor('#1a365d').text(term, { continued: true });
      doc.font('Helvetica').fillColor('#2d3748').text(' ' + def);
      doc.moveDown(0.3);
    });
    doc.moveDown(0.5);
  }

  private renderLoanTerms(doc: PDFKit.PDFDocument, data: LoanAgreementData): void {
    if (doc.y > 620) { doc.addPage(); this.renderHeader(doc); }
    this.sectionDivider(doc, 'LOAN TERMS');
    doc.moveDown(0.5);

    const terms: [string, string][] = [
      ['Loan Account Number', data.loanAccountNumber],
      ['Sanctioned Amount (Rs.)', `${data.sanctionedAmount.toLocaleString('en-IN')}/- (Rupees ${data.sanctionedAmountInWords})`],
      ['Product / Loan Type', `${data.productName} (${data.productCode})`],
      ['Tenure', `${data.tenureMonths} months`],
      ['EMI Amount', `Rs. ${data.emiAmount.toLocaleString('en-IN')}/-`],
      ['Moratorium Period', data.moratoriumPeriodMonths ? `${data.moratoriumPeriodMonths} months` : 'NIL'],
      ['Moratorium EMI', data.moratoriumEMI ? `Rs. ${data.moratoriumEMI.toLocaleString('en-IN')}/-` : 'NIL'],
      ['First EMI Date', data.firstEMIDate],
      ['Last EMI Date', data.lastEMIDate],
      ['Disbursement Account', `${data.disbursementAccountNumber} (${data.disbursementBankName}, IFSC: ${data.disbursementIFSC})`],
      ['Processing Fee', `Rs. ${data.processingFee.toLocaleString('en-IN')}/-`],
      ['Branch', `${data.branchName}, ${data.branchAddress}`],
    ];

    terms.forEach(([label, value]) => {
      doc.fontSize(9).font('Helvetica-Bold').fillColor('#2d3748')
        .text(label + ':', 60, doc.y, { continued: true, width: 200 })
        .font('Helvetica').fillColor('#1a365d')
        .text(value);
    });
    doc.moveDown(1);
  }

  private renderInterestTerms(doc: PDFKit.PDFDocument, data: LoanAgreementData): void {
    if (doc.y > 620) { doc.addPage(); this.renderHeader(doc); }
    this.sectionDivider(doc, 'INTEREST TERMS');
    doc.moveDown(0.5);

    doc.fontSize(9).font('Helvetica').fillColor('#2d3748')
      .text(`1. The rate of interest applicable to the Loan shall be ${data.rateOfInterestPercent}% per annum (${data.rateOfInterestBps} basis points), computed on a monthly reducing balance basis.`)
      .moveDown(0.3)
      .text('2. The interest rate is linked to the Bank\'s Marginal Cost of Funds based Lending Rate (MCLR). Any change in MCLR shall result in a corresponding change in the applicable rate of interest, which shall be communicated to the Borrower.')
      .moveDown(0.3)
      .text('3. Interest shall accrue on the outstanding principal from day to day and shall be payable monthly along with EMI.')
      .moveDown(0.3)
      .text(`4. In the event of default, penal interest at ${data.defaultInterestRatePercent}% per month (${data.defaultInterestRatePercent * 12}% per annum) shall be charged on the overdue amount, from the date of default until realization.`)
      .moveDown(0.3)
      .text(`5. Cheque/NACH bounce charges: Rs. ${data.bounceCharge}/- per instance.`);
    doc.moveDown(1);
  }

  private renderRepaymentTerms(doc: PDFKit.PDFDocument, data: LoanAgreementData): void {
    if (doc.y > 620) { doc.addPage(); this.renderHeader(doc); }
    this.sectionDivider(doc, 'REPAYMENT TERMS');
    doc.moveDown(0.5);

    doc.fontSize(9).font('Helvetica').fillColor('#2d3748')
      .text('1. The Borrower shall pay EMIs on the first day of every month commencing from the First EMI Date, until the entire Loan and interest are repaid.')
      .moveDown(0.3)
      .text('2. EMIs shall be payable by way of NACH (National Automated Clearing House) mandate, post-dated cheques, or auto-debit from the Borrower\'s account.')
      .moveDown(0.3)
      .text('3. All payments shall be made without any deduction or set-off and free and clear of any taxes, levies, duties, charges, etc.')
      .moveDown(0.3)
      .text('4. Receipt by the Bank of any amount shall not be deemed to be a waiver of any rights of the Bank.');

    if (data.partPaymentAllowed) {
      doc.moveDown(0.3)
        .text(`5. Part Payment: Allowed. Minimum part payment amount: Rs. ${data.partPaymentMinAmount.toLocaleString('en-IN')}/-. Part payment will result in ${data.partPaymentTenureReduction ? 'reduction in tenure' : 'reduction in EMI'}.`);
    }

    if (data.foreclosureAllowed) {
      doc.moveDown(0.3)
        .text(`6. Foreclosure: Allowed after ${data.foreclosureNoticePeriodDays} months from first disbursement. Foreclosure penalty: ${data.foreclosurePenaltyPercent}% of outstanding principal (as per RBI guidelines for floating rate loans, NIL penalty applicable).`);
    }

    doc.moveDown(1);
  }

  private renderSecurityTerms(doc: PDFKit.PDFDocument, data: LoanAgreementData): void {
    if (doc.y > 620) { doc.addPage(); this.renderHeader(doc); }
    this.sectionDivider(doc, 'SECURITY');
    doc.moveDown(0.5);

    doc.fontSize(9).font('Helvetica').fillColor('#2d3748')
      .text('1. The Security for the Loan comprises:')
      .moveDown(0.3)
      .text(`   ${data.securityDescription}`)
      .moveDown(0.3)
      .text('2. The Security shall be registered/created in favour of the Bank as per applicable laws.')
      .moveDown(0.3)
      .text('3. The Borrower shall maintain the Security in good condition and shall not create any encumbrance without the Bank\'s prior written consent.')
      .moveDown(0.3)
      .text('4. The Security shall remain deposited with the Bank until the Loan is fully repaid.');

    if (data.insurancePolicyNumber) {
      doc.moveDown(0.3)
        .text(`5. Insurance: Life/Asset insurance with policy number ${data.insurancePolicyNumber}, premium Rs. ${data.insurancePremium?.toLocaleString('en-IN') || '0'}/- (as applicable).`);
    }
    doc.moveDown(1);
  }

  private renderCovenants(doc: PDFKit.PDFDocument, data: LoanAgreementData): void {
    if (doc.y > 580) { doc.addPage(); this.renderHeader(doc); }
    this.sectionDivider(doc, 'COVENANTS');
    doc.moveDown(0.5);

    const borrowerCovenants = [
      'Pay all EMIs on due dates without delay',
      'Inform Bank of any change in address/employment within 15 days',
      'Maintain the Security in good condition',
      'Not create additional loans without Bank consent',
      'Submit periodical statements/confirmations as required',
      'Permit Bank officials to inspect the Security',
      'Comply with all applicable laws and regulations',
      'Not sell/transfer the Security without Bank consent',
    ];

    doc.fontSize(10).font('Helvetica-Bold').fillColor('#1a365d').text('Borrower Covenants');
    doc.moveDown(0.3);
    doc.fontSize(9).font('Helvetica').fillColor('#2d3748');
    borrowerCovenants.forEach((c, i) => {
      doc.text(`${i + 1}. ${c}`);
    });
    doc.moveDown(1);

    if (data.specialConditions.length > 0) {
      doc.fontSize(10).font('Helvetica-Bold').fillColor('#1a365d').text('Special Conditions');
      doc.moveDown(0.3);
      doc.fontSize(9).font('Helvetica').fillColor('#2d3748');
      data.specialConditions.forEach((c, i) => {
        doc.text(`${i + 1}. ${c}`);
      });
      doc.moveDown(1);
    }
  }

  private renderDefaultRemedies(doc: PDFKit.PDFDocument, data: LoanAgreementData): void {
    if (doc.y > 580) { doc.addPage(); this.renderHeader(doc); }
    this.sectionDivider(doc, 'DEFAULT AND REMEDIES');
    doc.moveDown(0.5);

    doc.fontSize(9).font('Helvetica').fillColor('#2d3748')
      .text('1. The occurrence of any of the following shall constitute an Event of Default:')
      .text('   (a) Non-payment of EMI on due date;')
      .text('   (b) Breach of any covenant or condition under this Agreement;')
      .text('   (c) Incorrect/misleading information provided in the loan application;')
      .text('   (d) Insolvency, insolvency proceedings, or attachment of assets;')
      .text('   (e) Any event that, in the Bank\'s opinion, adversely affects the Borrower\'s ability to repay;')
      .text('   (f) Change in ownership/management without Bank consent.')
      .moveDown(0.3)
      .text('2. Upon occurrence of an Event of Default, the Bank shall be entitled to:')
      .text('   (a) Declare the entire outstanding amount (principal + interest + charges) immediately due and payable;')
      .text('   (b) Recover the same through legal proceedings;')
      .text('   (c) Take possession of the Security and dispose of the same;')
      .text(`   (d) Charge penal interest at ${data.defaultInterestRatePercent}% per month on overdue amounts;`)
      .text('   (e) Exercise all other rights and remedies available under law.');
    doc.moveDown(1);
  }

  private renderGeneralTerms(doc: PDFKit.PDFDocument, data: LoanAgreementData): void {
    if (doc.y > 580) { doc.addPage(); this.renderHeader(doc); }
    this.sectionDivider(doc, 'GENERAL TERMS');
    doc.moveDown(0.5);

    const generalTerms = [
      '1. Governing Law: This Agreement shall be governed by and construed in accordance with the laws of India.',
      `2. Jurisdiction: All disputes arising out of this Agreement shall be subject to the exclusive jurisdiction of courts in ${data.jurisdiction}.`,
      '3. Notices: All notices shall be sent to the registered address of the respective parties.',
      '4. Set-off: The Bank shall be entitled to set off any amount lying to the credit of the Borrower against any dues.',
      '5. Assignment: The Bank may assign this Agreement to any other entity without the Borrower\'s consent.',
      '6. Severability: If any provision is found invalid, the remaining provisions shall continue in full force.',
      '7. Amendments: Any amendment to this Agreement shall be binding only if made in writing and signed by both parties.',
      '8. Credit Bureau Reporting: The Bank reserves the right to report borrower information to credit bureaus (CIBIL, Experian, Equifax, CRIF).',
      '9. RBI Guidelines: This Agreement is subject to RBI guidelines on fair practices and recovery.',
      '10. Grievance Redressal: For complaints, contact the Bank\'s Grievance Officer or visit www.losbank.in.',
    ];

    doc.fontSize(9).font('Helvetica').fillColor('#2d3748');
    generalTerms.forEach((t) => {
      if (doc.y > 680) { doc.addPage(); this.renderHeader(doc); }
      doc.text(t);
      doc.moveDown(0.3);
    });
    doc.moveDown(1);
  }

  private renderSignatures(doc: PDFKit.PDFDocument, data: LoanAgreementData): void {
    if (doc.y > 400) { doc.addPage(); this.renderHeader(doc); }
    this.sectionDivider(doc, 'EXECUTION');
    doc.moveDown(0.5);

    doc.fontSize(9).font('Helvetica').fillColor('#2d3748')
      .text('IN WITNESS WHEREOF, the parties hereto have executed this Agreement on the date and year first hereinabove written.')
      .text('This Agreement is accepted by Party B after reading and understanding all the terms and conditions.');

    doc.moveDown(1.5);

    doc.fontSize(10).font('Helvetica-Bold').fillColor('#1a365d').text('FOR PARTY A (THE BANK)');
    doc.fontSize(9).font('Helvetica').fillColor('#2d3748')
      .text(`${data.witnessingOfficerName}, ${data.witnessingOfficerDesignation}`)
      .text('Authorised Signatory')
      .moveDown(1)
      .text('Signature: _________________________')
      .text('Date: _________________________')
      .text('Bank Seal:');

    doc.moveDown(1);

    doc.fontSize(10).font('Helvetica-Bold').fillColor('#1a365d').text('FOR PARTY B (THE BORROWER)');
    doc.fontSize(9).font('Helvetica').fillColor('#2d3748')
      .text(`Name: ${data.customerName}`)
      .text('Signature: _________________________')
      .text(`Date: ${data.agreementDate}`)
      .text('Witness 1: _________________________')
      .text('Witness 2: _________________________');

    doc.moveDown(2);

    doc.rect(200, doc.y, 200, 50).stroke('#e2e8f0');
    doc.fontSize(8).font('Helvetica').fillColor('#718096')
      .text(`eSign Transaction ID: [To be generated upon signing]`, 200, doc.y + 5, { width: 200, align: 'center' })
      .text(`Document Hash: [SHA-256 Hash]`, 200, doc.y + 18, { width: 200, align: 'center' })
      .text(`Generated: ${new Date().toISOString()}`, 200, doc.y + 31, { width: 200, align: 'center' })
      .text('This is a legally binding document.', 200, doc.y + 44, { width: 200, align: 'center' });

    this.renderFooter(doc);
  }

  private renderFooter(doc: PDFKit.PDFDocument): void {
    const pageH = doc.page.height;
    doc.rect(0, pageH - 30, doc.page.width, 30).fill('#1a365d');
    doc.fillColor('#ffffff').fontSize(7).font('Helvetica')
      .text(`Loan Agreement | ${BANK_NAME} | Page 1 of | CONFIDENTIAL`, 50, pageH - 20, { align: 'center' });
  }

  private sectionDivider(doc: PDFKit.PDFDocument, title: string): void {
    doc.rect(50, doc.y, 500, 2).fill('#c9a227');
    doc.moveDown(0.3);
    doc.fontSize(11).font('Helvetica-Bold').fillColor('#1a365d').text(title);
    doc.moveDown(0.3);
  }
}
