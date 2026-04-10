import {
  Controller,
  Get,
  Post,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiProperty, ApiQuery, ApiPropertyOptional } from '@nestjs/swagger';
import { EmiCalculatorService } from '../services/emi-calculator.service';
import { RolesGuard, Roles } from '@los/common';

export class CalculateEmiDto {
  @ApiProperty({ description: 'Loan principal amount in rupees' })
  principal: number;

  @ApiProperty({ description: 'Annual interest rate in percent (e.g. 10.5)' })
  annualRate: number;

  @ApiProperty({ description: 'Loan tenure in months' })
  tenureMonths: number;

  @ApiPropertyOptional({ description: 'Monthly income for FOIR calculation' })
  monthlyIncome?: number;
}

export class AmortizationQueryDto {
  @ApiProperty()
  principal: number;

  @ApiProperty()
  annualRate: number;

  @ApiProperty()
  tenureMonths: number;

  @ApiPropertyOptional({ description: 'Start month for schedule slice (1-based)' })
  startMonth?: number;

  @ApiPropertyOptional({ description: 'End month for schedule slice' })
  endMonth?: number;
}

export class PrepaymentDto {
  @ApiProperty()
  originalPrincipal: number;

  @ApiProperty()
  annualRate: number;

  @ApiProperty()
  remainingMonths: number;

  @ApiProperty()
  prepaymentAmount: number;

  @ApiProperty()
  currentMonthEmi: number;

  @ApiProperty({ enum: ['TENURE_REDUCTION', 'EMI_REDUCTION'] })
  prepaymentType: 'TENURE_REDUCTION' | 'EMI_REDUCTION';

  @ApiProperty()
  prepaymentPenaltyPercent: number;

  @ApiPropertyOptional()
  gstPercent?: number;
}

export class ForeclosureDto {
  @ApiProperty()
  originalPrincipal: number;

  @ApiProperty()
  annualRate: number;

  @ApiProperty()
  tenureMonths: number;

  @ApiProperty({ description: 'Date of loan disbursement (ISO date string)' })
  disbursementDate: string;

  @ApiProperty({ description: 'Proposed foreclosure date (ISO date string)' })
  foreclosureDate: string;

  @ApiProperty({ description: 'Foreclosure processing fee as percentage' })
  foreclosureProcessingFeePercent: number;

  @ApiPropertyOptional()
  gstPercent?: number;
}

@ApiTags('EMI Calculator')
@ApiBearerAuth()
@Controller('emi')
@UseGuards(RolesGuard)
export class EmiCalculatorController {
  constructor(private readonly emiCalculator: EmiCalculatorService) {}

  @Post('calculate')
  @Roles('APPLICANT', 'LOAN_OFFICER', 'CREDIT_ANALYST', 'BRANCH_MANAGER')
  @ApiOperation({ summary: 'Calculate EMI for a loan scenario' })
  @ApiResponse({ status: 200, description: 'EMI calculation result' })
  calculateEmi(@Body() dto: CalculateEmiDto) {
    const result = this.emiCalculator.calculateEmi({
      principal: dto.principal,
      annualRate: dto.annualRate,
      tenureMonths: dto.tenureMonths,
    });

    if (dto.monthlyIncome) {
      const foir = Math.round((result.emiAmount / dto.monthlyIncome) * 10000) / 100;
      return { ...result, foirPercent: foir };
    }

    return result;
  }

  @Get('breakdown')
  @Roles('APPLICANT', 'LOAN_OFFICER', 'BRANCH_MANAGER')
  @ApiOperation({ summary: 'Get EMI breakdown (principal vs interest components)' })
  @ApiResponse({ status: 200, description: 'EMI breakdown' })
  @ApiQuery({ name: 'principal', type: Number, description: 'Loan principal amount' })
  @ApiQuery({ name: 'annualRate', type: Number, description: 'Annual interest rate in percent' })
  @ApiQuery({ name: 'tenureMonths', type: Number, description: 'Loan tenure in months' })
  getEmiBreakdown(
    @Query('principal') principal: number,
    @Query('annualRate') annualRate: number,
    @Query('tenureMonths') tenureMonths: number,
  ) {
    return this.emiCalculator.getEmiBreakdown({
      principal: +principal,
      annualRate: +annualRate,
      tenureMonths: +tenureMonths,
    });
  }

  @Post('amortization')
  @Roles('APPLICANT', 'LOAN_OFFICER', 'CREDIT_ANALYST', 'BRANCH_MANAGER')
  @ApiOperation({ summary: 'Build full amortization schedule (month-by-month breakdown)' })
  @ApiResponse({ status: 200, description: 'Amortization schedule' })
  getAmortizationSchedule(@Body() dto: AmortizationQueryDto) {
    const full = this.emiCalculator.buildAmortizationSchedule({
      principal: dto.principal,
      annualRate: dto.annualRate,
      tenureMonths: dto.tenureMonths,
    });

    const startMonth = dto.startMonth ?? 1;
    const endMonth = dto.endMonth ?? full.schedule.length;

    return {
      ...full,
      schedule: full.schedule.slice(startMonth - 1, endMonth),
      startMonth,
      endMonth,
      totalEntries: full.schedule.length,
    };
  }

  @Post('prepayment')
  @Roles('LOAN_OFFICER', 'BRANCH_MANAGER', 'CREDIT_ANALYST')
  @ApiOperation({ summary: 'Calculate partial prepayment impact — tenor reduction vs EMI reduction' })
  @ApiResponse({ status: 200, description: 'Prepayment scenario comparison' })
  calculatePrepayment(
    @Body() dto: PrepaymentDto,
  ) {
    const tenureReduction = this.emiCalculator.calculatePartialPrepayment({
      ...dto,
      prepaymentType: 'TENURE_REDUCTION',
    });

    const emiReduction = this.emiCalculator.calculatePartialPrepayment({
      ...dto,
      prepaymentType: 'EMI_REDUCTION',
    });

    return {
      scenario: 'PREPAYMENT_ANALYSIS',
      originalLoan: {
        principal: dto.originalPrincipal,
        annualRate: dto.annualRate,
        remainingMonths: dto.remainingMonths,
        prepaymentAmount: dto.prepaymentAmount,
      },
      optionA_TenureReduction: tenureReduction,
      optionB_EmiReduction: emiReduction,
      recommendation:
        tenureReduction.netSavings >= emiReduction.netSavings
          ? 'TENURE_REDUCTION'
          : 'EMI_REDUCTION',
      recommendedOption:
        tenureReduction.netSavings >= emiReduction.netSavings
          ? tenureReduction
          : emiReduction,
    };
  }

  @Post('foreclosure')
  @Roles('LOAN_OFFICER', 'BRANCH_MANAGER', 'CREDIT_ANALYST')
  @ApiOperation({ summary: 'Calculate foreclosure amount — outstanding principal + processing fee + GST' })
  @ApiResponse({ status: 200, description: 'Foreclosure calculation' })
  calculateForeclosure(@Body() dto: ForeclosureDto) {
    return this.emiCalculator.calculateForeclosure({
      originalPrincipal: dto.originalPrincipal,
      annualRate: dto.annualRate,
      tenureMonths: dto.tenureMonths,
      disbursementDate: new Date(dto.disbursementDate),
      foreclosureDate: new Date(dto.foreclosureDate),
      foreclosureProcessingFeePercent: dto.foreclosureProcessingFeePercent,
      gstPercent: dto.gstPercent,
    });
  }

  @Post('compare')
  @Roles('APPLICANT', 'LOAN_OFFICER', 'BRANCH_MANAGER')
  @ApiOperation({ summary: 'Compare multiple EMI scenarios side by side' })
  @ApiResponse({ status: 200, description: 'Scenario comparison' })
  compareScenarios(
    @Body()
    @ApiProperty({ description: 'Array of loan scenarios to compare', type: [Object] })
    body: {
      scenarios: Array<{
        label: string;
        principal: number;
        annualRate: number;
        tenureMonths: number;
        monthlyIncome?: number;
      }>;
    },
  ) {
    return this.emiCalculator.compareEmiScenarios(body.scenarios);
  }

  @Get('max-eligible-emi')
  @Roles('APPLICANT', 'LOAN_OFFICER', 'CREDIT_ANALYST')
  @ApiOperation({ summary: 'Calculate maximum eligible EMI based on FOIR limits' })
  @ApiResponse({ status: 200, description: 'Max eligible EMI' })
  @ApiQuery({ name: 'netMonthlyIncome', type: Number, description: 'Net monthly income' })
  @ApiQuery({ name: 'existingEmi', type: Number, description: 'Existing EMI obligations' })
  @ApiQuery({ name: 'maxFoirPercent', type: Number, description: 'Maximum FOIR percentage (e.g. 50)' })
  getMaxEligibleEmi(
    @Query('netMonthlyIncome') netMonthlyIncome: number,
    @Query('existingEmi') existingEmi: number,
    @Query('maxFoirPercent') maxFoirPercent: number,
  ) {
    return this.emiCalculator.calculateMaxEligibleEmi(
      +netMonthlyIncome,
      +existingEmi,
      +maxFoirPercent,
    );
  }
}
