import { Injectable, Logger } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { catchError, firstValueFrom } from 'rxjs';
import { ApplicationContextDto, BureauDataDto } from '../dto';

@Injectable()
export class ApplicationContextService {
  private readonly logger = new Logger(ApplicationContextService.name);
  private readonly loanServiceUrl: string;
  private readonly kycServiceUrl: string;
  private readonly integrationServiceUrl: string;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    this.loanServiceUrl = configService.get<string>('LOAN_SERVICE_URL', 'http://loan-service:3003');
    this.kycServiceUrl = configService.get<string>('KYC_SERVICE_URL', 'http://kyc-service:3002');
    this.integrationServiceUrl = configService.get<string>('INTEGRATION_SERVICE_URL', 'http://integration-service:3006');
  }

  async buildApplicationContext(applicationId: string): Promise<ApplicationContextDto | null> {
    const [application, kycData, bureauData] = await Promise.allSettled([
      this.fetchLoanApplication(applicationId),
      this.fetchKycData(applicationId),
      this.fetchBureauData(applicationId),
    ]);

    const app = application.status === 'fulfilled' ? application.value : null;
    if (!app) {
      this.logger.error(`Could not fetch application ${applicationId}`);
      return null;
    }

    const kyc = kycData.status === 'fulfilled' ? kycData.value : null;
    const bureau = bureauData.status === 'fulfilled' ? bureauData.value : null;

    const employmentDetails = app.employmentDetails || {};
    const applicantProfile = app.applicantProfile || {};

    const grossMonthlyIncome = Number(employmentDetails.grossMonthlyIncome ?? applicantProfile.grossMonthlyIncome ?? 0);
    const netMonthlyIncome = Number(employmentDetails.netMonthlyIncome ?? applicantProfile.netMonthlyIncome ?? 0);
    const totalAnnualIncome = grossMonthlyIncome * 12;
    const collateralValue = Number(app.collateralValue ?? applicantProfile.collateralValue ?? 0);

    const ageDob = new Date(app.applicantDob);
    const ageDiffMs = Date.now() - ageDob.getTime();
    const applicantAge = Math.floor(ageDiffMs / (1000 * 60 * 60 * 24 * 365.25));

    const loanRequirement = app.loanRequirement || {};
    const requestedTenure = Number(loanRequirement.tenureMonths ?? app.requestedTenureMonths ?? app.sanctionedTenureMonths ?? 36);

    return {
      applicationId,
      loanType: app.loanType,
      channelCode: app.channelCode,
      requestedAmount: Number(app.requestedAmount),
      requestedTenureMonths: requestedTenure,
      applicantAge,
      employmentType: employmentDetails.employmentType || applicantProfile.employmentType || 'SALARIED_PRIVATE',
      grossMonthlyIncome,
      netMonthlyIncome,
      totalAnnualIncome,
      existingEmi: Number(employmentDetails.existingEmi ?? applicantProfile.existingEmi ?? 0),
      collateralValue: collateralValue || undefined,
      employerCategory: employmentDetails.employerCategory || applicantProfile.employerCategory || undefined,
      bureauData: bureau || undefined,
    };
  }

  private async fetchLoanApplication(applicationId: string): Promise<any> {
    const { data } = await firstValueFrom(
      this.httpService.get(`${this.loanServiceUrl}/applications/${applicationId}`).pipe(
        catchError(err => {
          this.logger.warn(`Loan service unavailable: ${err.message}`);
          throw err;
        }),
      ),
    );
    return data;
  }

  private async fetchKycData(applicationId: string): Promise<any | null> {
    try {
      const { data } = await firstValueFrom(
        this.httpService.get(`${this.kycServiceUrl}/kyc/${applicationId}`).pipe(
          catchError(err => {
            if (err.response?.status === 404) return { data: null };
            this.logger.warn(`KYC service unavailable: ${err.message}`);
            throw err;
          }),
        ),
      );
      return data;
    } catch {
      return null;
    }
  }

  private async fetchBureauData(applicationId: string): Promise<BureauDataDto | null> {
    try {
      const { data } = await firstValueFrom(
        this.httpService.get(`${this.integrationServiceUrl}/integration/bureau/reports`, {
          params: { applicationId },
        }).pipe(
          catchError(err => {
            this.logger.warn(`Integration service unavailable: ${err.message}`);
            throw err;
          }),
        ),
      );

      if (!data?.reports?.length) return null;

      const primaryReport = data.reports[0];
      const allDpdAccounts = data.reports.flatMap((r: any) =>
        (r.parsedAccountSummary || []) as any[],
      );

      const maxDpd = allDpdAccounts.reduce(
        (max: number, acc: any) => Math.max(max, acc.dpd || 0),
        0,
      );

      const recentEnquiries = data.reports.flatMap((r: any) =>
        ((r.parsedEnquirySummary || []) as any[])
          .filter((e: any) => {
            const diffDays = Math.floor(
              (Date.now() - new Date(e.enquiryDate).getTime()) / (1000 * 60 * 60 * 24),
            );
            return diffDays <= 90;
          })
          .map((e: any) => ({
            date: e.enquiryDate,
            institution: e.lender,
            amount: e.enquiryAmount,
          })),
      );

      const totalExposure = data.reports.reduce(
        (sum: number, r: any) => sum + Number(r.parsedTotalExposure || 0),
        0,
      );

      return {
        creditScore: primaryReport.parsedScore ?? primaryReport.score ?? 0,
        scoreModel: `${primaryReport.provider} Score`,
        activeAccounts: data.reports.reduce(
          (sum: number, r: any) => sum + Number(r.parsedActiveAccounts || 0),
          0,
        ),
        closedAccounts: data.reports.reduce(
          (sum: number, r: any) => sum + Number(r.parsedClosedAccounts || 0),
          0,
        ),
        overdueAccounts: allDpdAccounts.filter((a: any) => a.dpd > 0).length,
        totalExposure,
        dpd30: allDpdAccounts.filter((a: any) => a.dpd >= 1 && a.dpd <= 30).length,
        dpd60: allDpdAccounts.filter((a: any) => a.dpd >= 31 && a.dpd <= 60).length,
        dpd90: allDpdAccounts.filter((a: any) => a.dpd >= 61 && a.dpd <= 90).length,
        dpd180: allDpdAccounts.filter((a: any) => a.dpd > 90).length,
        fraudFlag: false,
        suitFiled: data.reports.some((r: any) => r.parsedSuitFiled),
        wilfulDefaulter: false,
        enquiries: recentEnquiries.slice(0, 10),
      } as BureauDataDto;
    } catch {
      return null;
    }
  }
}
