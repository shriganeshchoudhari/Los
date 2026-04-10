import { Controller, Get, Post, Query, Body } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { InterestRateService } from './interest-rate.service';
import { RateCalculationInput, CreditGrade } from './rate.types';

@ApiTags('Interest Rate Engine')
@ApiBearerAuth()
@Controller('rates')
export class RatesController {
  constructor(private readonly rateService: InterestRateService) {}

  @Get('preview')
  @ApiOperation({ summary: 'Get rate preview table for a product (grade × tenure matrix)' })
  @ApiResponse({ status: 200, description: 'Rate preview table' })
  async getRatePreview(
    @Query('productCode') productCode: string,
    @Query('amount') amount: number,
    @Query('tenureMonths') tenureMonths: number,
  ) {
    return this.rateService.getRatePreview(productCode, amount, tenureMonths);
  }

  @Post('calculate')
  @ApiOperation({ summary: 'Calculate interest rate for a specific application scenario' })
  @ApiResponse({ status: 200, description: 'Rate calculation result' })
  async calculateRate(@Body() input: RateCalculationInput) {
    return this.rateService.calculateRate(input);
  }

  @Get('config/:productCode')
  @ApiOperation({ summary: 'Get active rate configuration for a product' })
  async getConfig(@Query('productCode') productCode: string) {
    return this.rateService.getActiveConfig(productCode);
  }
}
