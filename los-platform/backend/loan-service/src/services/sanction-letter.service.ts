import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as PDFDocument from 'pdfkit';
import { SanctionLetterData } from './sanction-letter.types';
import { calculateEMI, numberToWords, formatDate } from './utils/number-format';

const BANK_NAME = 'LOS Bank Limited';
const BANK_TAGLINE = 'Your Trusted Financial Partner';
const BANK_ADDRESS = 'LOS Bank Tower, 123, Bandra Kurla Complex, Bandra (E), Mumbai - 400051';
const BANK_CONTACT = 'Toll Free: 1800-123-4567 | Email: customercare@losbank.in | Website: www.losbank.in';
const BANK_CIN = 'CIN: L65990MH2024PLC123456';
const GRIEVANCE_REDRESSAL = 'For grievance redressal, contact: grievance@losbank.in | Toll Free: 1800-123-4568';

@Injectable()
export class SanctionLetterService {
  private readonly logger = new Logger(SanctionLetterService.name);

  constructor(private readonly configService: ConfigService) {}

  async generateSanctionLetter(data: SanctionLetterData): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      try {
        const chunks: Buffer[] = [];
        const doc = new PDFDocument({
          size: 'A4',
          margins: { top: 60, bottom: 50, left: 50, right: 50 },
          info: {
            Title: `Sanction Letter - ${data.applicationNumber}`,
            Author: BANK_NAME,
            Subject: 'Loan Sanction Letter',
            Keywords: 'sanction letter, loan, LOS Bank',
            CreationDate: new Date(),
          },
        });

        doc.on('data', (chunk: Buffer) => chunks.push(chunk));
        doc.on('end', () => resolve(Buffer.concat(chunks)));
        doc.on('error', reject);

        this.renderLetterhead(doc);
        this.renderSanctionHeader(doc, data);
        this.renderCustomerDetails(doc, data);
        this.renderSanctionTerms(doc, data);
        this.renderInterestRateClause(doc, data);
        this.renderFeeAndCharges(doc, data);
        this.renderEMISchedulePreview(doc, data);
        this.renderDisbursementClause(doc, data);
        this.renderConditionsPrecedent(doc, data);
        this.renderTermsAndConditions(doc);
        this.renderPrepaymentAndForeclosureTerms(doc, data);
        this.renderDigitalSignature(doc, data);
        this.renderFooter(doc);

        doc.end();
      } catch (err) {
        reject(err);
      }
    });
  }

  private renderLetterhead(doc: PDFKit.PDFDocument): void {
    const pageW = doc.page.width;

    doc.rect(0, 0, pageW, 90).fill('#1a365d');

    doc.fillColor('#ffffff')
      .fontSize(20)
      .font('Helvetica-Bold')
      .text(BANK_NAME, 50, 20, { align: 'center' })
      .fontSize(9)
      .font('Helvetica')
      .text(BANK_TAGLINE, 50, 44, { align: 'center' });

    doc.fillColor('#e2e8f0')
      .fontSize(7)
      .text(BANK_ADDRESS, 50, 60, { align: 'center' })
      .text(BANK_CONTACT, 50, 72, { align: 'center' });

    doc.rect(0, 90, pageW, 3).fill('#c9a227');

    doc.fillColor('#1a365d')
      .fontSize(8)
      .text(BANK_CIN, 50, 100, { align: 'center' });
  }

  private renderSanctionHeader(doc: PDFKit.PDFDocument, data: SanctionLetterData): void {
    doc.moveDown(1.5);

    doc.fontSize(14)
      .font('Helvetica-Bold')
      .fillColor('#1a365d')
      .text('SANCTION LETTER', { align: 'center' });

    doc.moveDown(0.5);
    doc.fontSize(10)
      .font('Helvetica')
      .fillColor('#4a5568')
      .text(`Ref No: LOSB/SLC/${new Date().getFullYear()}/${data.applicationNumber}`, { align: 'center' });

    doc.moveDown(0.5);
    doc.fontSize(10)
      .fillColor('#2d3748')
      .text(`Date: ${data.sanctionDate}`, { align: 'center' });

    doc.moveDown(1);
    doc.fontSize(10)
      .fillColor('#1a365d')
      .font('Helvetica-Bold')
      .text(`Dear ${data.customerName},`, { underline: false });

    doc.moveDown(0.5);
    doc.fontSize(10)
      .font('Helvetica')
      .fillColor('#2d3748')
      .text(
        `We are pleased to inform you that your application for a ${data.productName} (Application No: ${data.applicationNumber}) has been processed and sanctioned as per the details mentioned below. This letter, along with the Terms and Conditions enclosed herewith, constitutes the agreement between you and ${BANK_NAME}.`,
      );

    doc.moveDown(0.5);
    doc.fontSize(9)
      .fillColor('#718096')
      .text(
        'Please read this sanction letter carefully. If you accept the terms and conditions, sign and return the duplicate copy of this letter within 30 days from the date of this letter.',
      );

    doc.moveDown(1);
  }

  private renderCustomerDetails(doc: PDFKit.PDFDocument, data: SanctionLetterData): void {
    doc.rect(50, doc.y, 500, 3).fill('#c9a227');
    doc.moveDown(0.5);

    doc.fontSize(11)
      .font('Helvetica-Bold')
      .fillColor('#1a365d')
      .text('CUSTOMER DETAILS');

    doc.moveDown(0.5);

    const details = [
      ['Applicant Name:', data.customerName],
      ['Communication Address:', data.customerAddress],
      ['Sanctioned Product:', `${data.productName} (${data.productCode})`],
      ['Sanction Date:', data.sanctionDate],
      ['Valid Until:', data.validUntil],
    ];

    details.forEach(([label, value]) => {
      doc.fontSize(10)
        .font('Helvetica-Bold')
        .fillColor('#2d3748')
        .text(label, 60, doc.y, { continued: true, width: 180 })
        .font('Helvetica')
        .text(value);
    });

    doc.moveDown(1);
  }

  private renderSanctionTerms(doc: PDFKit.PDFDocument, data: SanctionLetterData): void {
    doc.rect(50, doc.y, 500, 3).fill('#c9a227');
    doc.moveDown(0.5);

    doc.fontSize(11)
      .font('Helvetica-Bold')
      .fillColor('#1a365d')
      .text('SANCTION TERMS');

    doc.moveDown(0.5);

    const terms = [
      ['Sanctioned Amount (in figures):', `Rs. ${data.sanctionedAmount.toLocaleString('en-IN')}/-`],
      ['Sanctioned Amount (in words):', data.sanctionedAmountInWords],
      ['Rate of Interest:', `${data.rateOfInterestPercent}% p.a. (${data.rateOfInterestBps} bps) (Floating)`],
      ['Loan Tenure:', `${data.tenureMonths} months`],
      ['Equated Monthly Instalment (EMI):', `Rs. ${data.emiAmount.toLocaleString('en-IN')}/-`],
      ['Interest Rate Type:', 'Floating Rate (Subject to revision as per MCLR policy)'],
      ['Repayment Type:', 'Monthly Instalments (EMI)'],
    ];

    if (data.loanAccountNumber) {
      terms.push(['Loan Account Number:', data.loanAccountNumber]);
    }
    if (data.ifscCode) {
      terms.push(['IFSC Code:', data.ifscCode]);
    }
    if (data.branchName) {
      terms.push(['Home Branch:', data.branchName]);
    }

    terms.forEach(([label, value]) => {
      doc.fontSize(10)
        .font('Helvetica-Bold')
        .fillColor('#2d3748')
        .text(label, 60, doc.y, { continued: true, width: 200 })
        .font('Helvetica')
        .fillColor('#1a365d')
        .text(value);
      doc.moveDown(0.3);
    });

    doc.moveDown(0.5);

    doc.rect(50, doc.y, 500, 60).stroke('#e2e8f0');
    doc.fillColor('#1a365d')
      .fontSize(10)
      .font('Helvetica-Bold')
      .text('PRINCIPAL AMOUNT', 60, doc.y + 5, { align: 'center' })
      .fontSize(16)
      .text(`Rs. ${data.sanctionedAmount.toLocaleString('en-IN')}/-`, { align: 'center' })
      .fontSize(9)
      .font('Helvetica')
      .fillColor('#718096')
      .text(`Rupees ${data.sanctionedAmountInWords} Only`, { align: 'center' });

    doc.moveDown(6);
  }

  private renderInterestRateClause(doc: PDFKit.PDFDocument, data: SanctionLetterData): void {
    doc.rect(50, doc.y, 500, 3).fill('#c9a227');
    doc.moveDown(0.5);

    doc.fontSize(11)
      .font('Helvetica-Bold')
      .fillColor('#1a365d')
      .text('INTEREST RATE CLAUSE');

    doc.moveDown(0.5);

    doc.fontSize(9)
      .font('Helvetica')
      .fillColor('#2d3748')
      .text(
        `The applicable rate of interest is ${data.rateOfInterestPercent}% per annum (${data.rateOfInterestBps} basis points) linked to the Bank's Marginal Cost of Funds based Lending Rate (MCLR). The current MCLR for 1-year tenor is 8.90% p.a. Any change in the MCLR will result in a corresponding change in the applicable rate of interest, which will be communicated to you in writing.`,
      );

    doc.moveDown(0.5);
    doc.fontSize(9)
      .fillColor('#2d3748')
      .text(
        `The effective interest rate calculation: MCLR (8.90%) + Spread (${((data.rateOfInterestBps - 890) / 100).toFixed(2)}%) = ${data.rateOfInterestPercent}% p.a.`,
      );

    doc.moveDown(0.5);
    doc.fontSize(9)
      .fillColor('#e53e3e')
      .text(
        'Note: Interest shall be charged on a monthly reducing balance basis. The rate of interest is subject to revision based on changes in MCLR, which may increase or decrease. In case of default, the applicable penal interest rate of 2% per month (24% p.a.) will be charged on the overdue instalment amount.',
      );

    doc.moveDown(1);
  }

  private renderFeeAndCharges(doc: PDFKit.PDFDocument, data: SanctionLetterData): void {
    doc.rect(50, doc.y, 500, 3).fill('#c9a227');
    doc.moveDown(0.5);

    doc.fontSize(11)
      .font('Helvetica-Bold')
      .fillColor('#1a365d')
      .text('FEES AND CHARGES');

    doc.moveDown(0.5);

    doc.fontSize(10)
      .font('Helvetica')
      .fillColor('#2d3748')
      .text(`Processing Fee: Rs. ${data.processingFeeAmount.toLocaleString('en-IN')}/- (to be recovered at the time of first disbursement)`);

    if (data.insurancePremium) {
      doc.moveDown(0.3);
      doc.text(`Life Insurance Premium: Rs. ${data.insurancePremium.toLocaleString('en-IN')}/- (mandatory, subject to sum assured and policy terms)`);
    }

    doc.moveDown(0.5);
    doc.fontSize(9)
      .fillColor('#718096')
      .text('Other applicable charges as per the Bank\'s schedule of charges (available at www.losbank.in/charges).');

    doc.moveDown(1);
  }

  private renderEMISchedulePreview(doc: PDFKit.PDFDocument, data: SanctionLetterData): void {
    if (doc.y > 680) {
      doc.addPage();
      this.renderPageHeader(doc);
    }

    doc.rect(50, doc.y, 500, 3).fill('#c9a227');
    doc.moveDown(0.5);

    doc.fontSize(11)
      .font('Helvetica-Bold')
      .fillColor('#1a365d')
      .text('EMI SCHEDULE PREVIEW');

    doc.moveDown(0.5);

    const headers = ['Installment No.', 'Due Date', 'Principal (Rs.)', 'Interest (Rs.)', 'EMI (Rs.)', 'Balance (Rs.)'];
    const colWidths = [60, 70, 90, 90, 90, 100];
    let x = 50;
    let y = doc.y;

    doc.rect(50, y, 500, 20).fill('#1a365d');
    doc.fillColor('#ffffff')
      .fontSize(8)
      .font('Helvetica-Bold');
    headers.forEach((h, i) => {
      doc.text(h, x + 2, y + 6, { width: colWidths[i] - 4, align: 'center' });
      x += colWidths[i];
    });

    doc.fillColor('#2d3748').font('Helvetica').fontSize(8);
    const rate = data.rateOfInterestPercent;
    const p = data.sanctionedAmount;
    const r = rate / (12 * 100);
    const n = data.tenureMonths;
    const emi = data.emiAmount;

    const sampleRows = Math.min(6, n);
    const principalPerMonth = p / n;

    for (let i = 1; i <= sampleRows; i++) {
      x = 50;
      y += 20;
      const interest = Math.round(p * r);
      const principal = emi - interest;
      p -= principal;
      const dueDate = new Date(data.firstEmiDate);
      dueDate.setMonth(dueDate.getMonth() + i - 1);
      const rowData = [
        String(i),
        `${dueDate.getDate().toString().padStart(2, '0')}-${(dueDate.getMonth() + 1).toString().padStart(2, '0')}-${dueDate.getFullYear()}`,
        principal.toLocaleString('en-IN'),
        interest.toLocaleString('en-IN'),
        emi.toLocaleString('en-IN'),
        Math.max(0, p).toLocaleString('en-IN'),
      ];

      if (i % 2 === 0) {
        doc.rect(50, y, 500, 20).fill('#f7fafc');
      }

      rowData.forEach((cell, j) => {
        doc.fillColor(i % 2 === 0 ? '#2d3748' : '#1a365d').text(cell, x + 2, y + 6, { width: colWidths[j] - 4, align: 'center' });
        x += colWidths[j];
      });
    }

    y += 20;
    doc.fontSize(8)
      .fillColor('#718096')
      .text(`Note: This is a preview of the first ${sampleRows} instalments. The complete amortization schedule will be provided with the loan documents. Total instalments: ${data.tenureMonths}`, 50, y + 5);

    doc.moveDown(2);
  }

  private renderDisbursementClause(doc: PDFKit.PDFDocument, data: SanctionLetterData): void {
    if (doc.y > 680) {
      doc.addPage();
      this.renderPageHeader(doc);
    }

    doc.rect(50, doc.y, 500, 3).fill('#c9a227');
    doc.moveDown(0.5);

    doc.fontSize(11)
      .font('Helvetica-Bold')
      .fillColor('#1a365d')
      .text('DISBURSEMENT INSTRUCTIONS');

    doc.moveDown(0.5);

    doc.fontSize(9)
      .font('Helvetica')
      .fillColor('#2d3748')
      .text(
        `1. The sanctioned amount of Rs. ${data.sanctionedAmount.toLocaleString('en-IN')}/- will be disbursed in your account subject to compliance with all terms and conditions herein and the General Terms and Conditions.`,
      )
      .moveDown(0.3)
      .text('2. Disbursement will be made within 3 working days of receipt of your acceptance of this sanction letter and completion of all conditions.')
      .moveDown(0.3)
      .text('3. The first EMI is due on ' + data.firstEmiDate + ' and will be auto-debited from your designated account.')
      .moveDown(0.3)
      .text('4. This sanction is valid for ' + data.validUntil + '. If not accepted within this period, the sanction will lapse automatically.');

    doc.moveDown(1);
  }

  private renderConditionsPrecedent(doc: PDFKit.PDFDocument, data: SanctionLetterData): void {
    if (doc.y > 600) {
      doc.addPage();
      this.renderPageHeader(doc);
    }

    doc.rect(50, doc.y, 500, 3).fill('#c9a227');
    doc.moveDown(0.5);

    doc.fontSize(11)
      .font('Helvetica-Bold')
      .fillColor('#1a365d')
      .text('CONDITIONS PRECEDENT TO DISBURSEMENT');

    doc.moveDown(0.5);

    const conditions = [
      'Submission of accepted duplicate copy of this Sanction Letter within 15 days.',
      'Submission of KYC documents as per bank norms (Aadhaar, PAN, Address Proof, Photo).',
      'Submission of latest salary slips / ITR with Form 16 / audited financials as applicable.',
      'Execution of Loan Agreement and other documents in the bank\'s standard format.',
      'Payment of processing fee as applicable.',
      'Obtaining life insurance / asset insurance as required by the bank.',
      'Submission of post-dated cheques (PDCs) / ECS mandate as per bank requirement.',
      'Verification of all documents to the bank\'s satisfaction.',
      'Completion of CIBIL/tri-bureau verification.',
      'Any other condition as specified by the bank.',
    ];

    if (data.disbursementConditions && data.disbursementConditions.length > 0) {
      conditions.unshift(...data.disbursementConditions);
    }

    doc.fontSize(9)
      .font('Helvetica')
      .fillColor('#2d3748');

    conditions.forEach((condition, i) => {
      doc.text(`${i + 1}. ${condition}`, { indent: 10 });
      doc.moveDown(0.2);
    });

    doc.moveDown(1);
  }

  private renderTermsAndConditions(doc: PDFKit.PDFDocument): void {
    if (doc.y > 500) {
      doc.addPage();
      this.renderPageHeader(doc);
    }

    doc.rect(50, doc.y, 500, 3).fill('#c9a227');
    doc.moveDown(0.5);

    doc.fontSize(11)
      .font('Helvetica-Bold')
      .fillColor('#1a365d')
      .text('GENERAL TERMS AND CONDITIONS');

    doc.moveDown(0.5);

    const tnc = [
      '1. The loan and all interest thereon shall be repayable by way of EMIs as scheduled.',
      '2. Interest shall be calculated on monthly reducing balance method.',
      '3. The bank reserves the right to revise the rate of interest in line with changes in MCLR.',
      '4. Penal interest at 2% per month will be charged on overdue EMIs.',
      '5. Prepayment charges: Nil for floating rate loans (as per RBI guidelines). Lock-in period of 6 months for fixed rate portion.',
      '6. The bank has the right to recall the entire loan facility in case of default or breach of any terms.',
      '7. All disputes shall be subject to the jurisdiction of courts in Mumbai only.',
      '8. The borrower shall keep the bank informed of any change in address/employment.',
      '9. Insurance of the asset (where applicable) shall be maintained throughout the tenure.',
      '10. The bank\'s decision in all matters relating to the loan shall be final and binding.',
      '11. Loan documents to be executed within 30 days of sanction date.',
      '12. Borrower\'s acknowledgment of having read and understood the Key Fact Statement (KFS).',
    ];

    doc.fontSize(8)
      .font('Helvetica')
      .fillColor('#2d3748');

    tnc.forEach((t) => {
      doc.text(t, { indent: 10 });
      doc.moveDown(0.2);
    });

    doc.moveDown(1);
  }

  private renderPrepaymentAndForeclosureTerms(doc: PDFKit.PDFDocument, data: SanctionLetterData): void {
    if (doc.y > 500) { doc.addPage(); this.renderPageHeader(doc); }

    doc.rect(50, doc.y, 500, 3).fill('#c9a227');
    doc.moveDown(0.5);

    doc.fontSize(11).font('Helvetica-Bold').fillColor('#1a365d').text('PREPAYMENT AND FORECLOSURE TERMS');
    doc.moveDown(0.5);

    doc.fontSize(9).font('Helvetica').fillColor('#2d3748');

    if (data.prepaymentTerms) {
      doc.font('Helvetica-Bold').fillColor('#1a365d').text('Prepayment:');
      doc.font('Helvetica').fillColor('#2d3748');
      doc.text(`Lock-in Period: ${data.prepaymentTerms.lockInMonths} months from first disbursement.`);
      doc.text(`Maximum Prepayment: ${data.prepaymentTerms.maxPercentPerYear}% of outstanding principal per calendar year.`);
      doc.text(`Prepayment Penalty: ${data.prepaymentTerms.penaltyPercent}% of amount prepaid (plus applicable GST).`);
      if (data.prepaymentTerms.penaltyClause) doc.text(`Note: ${data.prepaymentTerms.penaltyClause}`);
      doc.text(`Note: As per RBI Master Direction, no prepayment penalty is chargeable on floating rate loans.`);
      doc.moveDown(0.5);
    } else {
      doc.text('Prepayment: Allowed after 12 months lock-in. No penalty for floating rate loans as per RBI guidelines.');
      doc.moveDown(0.5);
    }

    if (data.foreclosureTerms) {
      doc.font('Helvetica-Bold').fillColor('#1a365d').text('Foreclosure:');
      doc.font('Helvetica').fillColor('#2d3748');
      doc.text(`Foreclosure Allowed: ${data.foreclosureTerms.allowed ? 'Yes' : 'No'}.`);
      if (data.foreclosureTerms.allowed) {
        doc.text(`Lock-in Period: ${data.foreclosureTerms.lockInMonths} months from first disbursement.`);
        doc.text(`Minimum Outstanding: Rs. ${data.foreclosureTerms.minOutstandingBalance.toLocaleString('en-IN')}/-`);
        doc.text(`Processing Fee: ${data.foreclosureTerms.processingFeePercent}% of outstanding principal + 18% GST.`);
        if (data.foreclosureTerms.processingFeeClause) doc.text(`Note: ${data.foreclosureTerms.processingFeeClause}`);
      }
      doc.moveDown(0.5);
    } else {
      doc.text('Foreclosure: Allowed after 6 months lock-in. Foreclosure charges as applicable.');
      doc.moveDown(0.5);
    }

    doc.moveDown(0.5);
  }

  private renderDigitalSignature(doc: PDFKit.PDFDocument, data: SanctionLetterData): void {
    if (doc.y > 450) {
      doc.addPage();
      this.renderPageHeader(doc);
    }

    doc.rect(50, doc.y, 500, 3).fill('#c9a227');
    doc.moveDown(0.5);

    doc.fontSize(11)
      .font('Helvetica-Bold')
      .fillColor('#1a365d')
      .text('AUTHORIZATION & ACCEPTANCE');

    doc.moveDown(0.5);

    doc.fontSize(9)
      .font('Helvetica')
      .fillColor('#2d3748')
      .text(
        `Certified that the above terms and conditions are read and understood by me/us. I/We agree to abide by the same and execute the necessary documents.`,
      );

    doc.moveDown(1.5);

    const sigY = doc.y;
    doc.fontSize(9)
      .fillColor('#2d3748')
      .text('Borrower Signature: _____________________________', 60, sigY)
      .text(`Name: ${data.customerName}`, 60, sigY + 20)
      .text('Date: _____________________', 60, sigY + 35);

    doc.fontSize(9)
      .text('Co-Borrower Signature: _____________________________', 300, sigY)
      .text('Name: _____________________________', 300, sigY + 20)
      .text('Date: _____________________', 300, sigY + 35);

    doc.moveDown(3);

    doc.fontSize(11)
      .font('Helvetica-Bold')
      .fillColor('#1a365d')
      .text('FOR LOS BANK LIMITED', { align: 'center' });

    doc.moveDown(1);

    doc.rect(200, doc.y, 200, 60).stroke('#e2e8f0');

    doc.fontSize(8)
      .font('Helvetica')
      .fillColor('#718096')
      .text('Authorized Signatory', 200, doc.y + 5, { width: 200, align: 'center' })
      .text(data.sanctioningAuthority, 200, doc.y + 18, { width: 200, align: 'center' })
      .text(data.authorityDesignation, 200, doc.y + 30, { width: 200, align: 'center' });

    doc.moveDown(5);

    doc.rect(200, doc.y, 200, 40).stroke('#e2e8f0');
    doc.fontSize(7)
      .fillColor('#718096')
      .text(`Digitally Signed on: ${data.sanctionDate} at ${new Date().toLocaleTimeString('en-IN')}`, 200, doc.y + 5, { width: 200, align: 'center' })
      .text(`Document ID: SLC-${data.applicationNumber}-${Date.now()}`, 200, doc.y + 18, { width: 200, align: 'center' })
      .text('This is a system-generated document.', 200, doc.y + 30, { width: 200, align: 'center' });

    doc.moveDown(2);
  }

  private renderPageHeader(doc: PDFKit.PDFDocument): void {
    const pageW = doc.page.width;
    doc.rect(0, 0, pageW, 30).fill('#1a365d');
    doc.fillColor('#ffffff')
      .fontSize(8)
      .font('Helvetica')
      .text(BANK_NAME + ' | ' + 'Sanction Letter', 50, 10, { align: 'center' })
      .text('CONFIDENTIAL', pageW - 120, 10);
  }

  private renderFooter(doc: PDFKit.PDFDocument): void {
    const pageH = doc.page.height;
    doc.rect(0, pageH - 30, doc.page.width, 30).fill('#1a365d');
    doc.fillColor('#ffffff')
      .fontSize(7)
      .font('Helvetica')
      .text(GRIEVANCE_REDRESSAL, 50, pageH - 22, { align: 'center' });
  }
}
