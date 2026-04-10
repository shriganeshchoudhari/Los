import http from 'k6/http';
import { check, sleep } from 'k6/';
import { Counter, Trend } from 'k6/metrics';
import { getBaseUrls } from '../lib/config';
import { handleError, getAuthHeaders, loginAndGetToken } from '../lib/helpers';

const urls = getBaseUrls();

export const emiCalculateSuccess = new Counter('emi_calculate_success');
export const amortizationSuccess = new Counter('emi_amortization_success');
export const prepaymentSuccess = new Counter('emi_prepayment_success');
export const foreclosureSuccess = new Counter('emi_foreclosure_success');
export const maxEmiSuccess = new Counter('emi_max_emi_success');

export const emiCalcDuration = new Trend('emi_calculate_duration');
export const amortizationDuration = new Trend('emi_amortization_duration');
export const prepaymentDuration = new Trend('emi_prepayment_duration');
export const foreclosureDuration = new Trend('emi_foreclosure_duration');

const RATES = [8.5, 9, 9.5, 10, 10.5, 11, 12, 13, 14, 15];
const TENURES = [6, 12, 18, 24, 36, 48, 60, 84, 120, 180, 240];

export function scenarios() {
  const vu = __VU;
  const vuMod = vu % 7;

  const tokenResult = loginAndGetToken(urls.auth, 'LOAN_OFFICER');
  const token = tokenResult.token;

  if (vuMod === 0) {
    testEmiCalculation(token);
  } else if (vuMod === 1) {
    testAmortizationSchedule(token);
  } else if (vuMod === 2) {
    testPrepaymentCalculation(token);
  } else if (vuMod === 3) {
    testForeclosureCalculation(token);
  } else if (vuMod === 4) {
    testMaxEligibleEmi(token);
  } else if (vuMod === 5) {
    testEmiValidationErrors(token);
  } else {
    testEmiProductVariants(token);
  }

  sleep(0.3 + Math.random() * 0.7);
}

export function testEmiCalculation(token: string) {
  const principal = [100000, 200000, 300000, 500000, 1000000, 2000000, 5000000, 10000000][Math.floor(Math.random() * 8)];
  const annualRate = RATES[Math.floor(Math.random() * RATES.length)];
  const tenureMonths = TENURES[Math.floor(Math.random() * TENURES.length)];

  const res = http.post(
    `${urls.loan}/api/emi/calculate`,
    JSON.stringify({ principal, annualRate, tenureMonths, monthlyIncome: 150000 }),
    {
      headers: getAuthHeaders(token),
      tags: { name: 'emi/calculate' },
    },
  );

  emiCalcDuration.add(res.timings.duration);
  handleError(res, 'EMI calculate');

  check(res, {
    'emi calculate returns 200': (r) => r.status === 200,
    'returns emiAmount': (r) => {
      const b = r.json() as any;
      return b && typeof b.emiAmount === 'number' && b.emiAmount > 0;
    },
    'returns totalInterest': (r) => {
      const b = r.json() as any;
      return b && typeof b.totalInterest === 'number' && b.totalInterest >= 0;
    },
    'returns totalPayment': (r) => {
      const b = r.json() as any;
      return b && typeof b.totalPayment === 'number';
    },
    'returns foirPercent': (r) => {
      const b = r.json() as any;
      return b && typeof b.foirPercent === 'number';
    },
    'emi is positive': (r) => {
      const b = r.json() as any;
      return b && b.emiAmount > 0;
    },
    'totalPayment = emi * tenure': (r) => {
      const b = r.json() as any;
      return b && Math.abs(b.totalPayment - b.emiAmount * tenureMonths) < 1000;
    },
  });

  if (res.status === 200) {
    emiCalculateSuccess.add(1);
  }
}

export function testAmortizationSchedule(token: string) {
  const principal = [300000, 500000, 1000000, 2000000][Math.floor(Math.random() * 4)];
  const annualRate = RATES[Math.floor(Math.random() * RATES.length)];
  const tenureMonths = [12, 24, 36, 60][Math.floor(Math.random() * 4)];

  const res = http.post(
    `${urls.loan}/api/emi/amortization`,
    JSON.stringify({ principal, annualRate, tenureMonths }),
    {
      headers: getAuthHeaders(token),
      tags: { name: 'emi/amortization' },
    },
  );

  amortizationDuration.add(res.timings.duration);
  handleError(res, 'Amortization schedule');

  check(res, {
    'amortization returns 200': (r) => r.status === 200,
    'returns schedule array': (r) => {
      const b = r.json() as any;
      return b && Array.isArray(b.schedule);
    },
    'schedule has correct length': (r) => {
      const b = r.json() as any;
      return b && b.schedule && b.schedule.length === tenureMonths;
    },
    'first entry has principal component': (r) => {
      const b = r.json() as any;
      return b && b.schedule && b.schedule[0] && typeof b.schedule[0].principalComponent === 'number';
    },
    'schedule entries sum to principal': (r) => {
      const b = r.json() as any;
      if (!b || !b.schedule) return false;
      const totalPrincipal = b.schedule.reduce((sum: number, e: any) => sum + e.principalComponent, 0);
      return Math.abs(totalPrincipal - principal) < 100;
    },
    'totalEntries matches tenure': (r) => {
      const b = r.json() as any;
      return b && b.totalEntries === tenureMonths;
    },
  });

  if (res.status === 200) {
    amortizationSuccess.add(1);
  }
}

export function testPrepaymentCalculation(token: string) {
  const originalPrincipal = [1000000, 2000000, 5000000, 10000000][Math.floor(Math.random() * 4)];
  const annualRate = RATES[Math.floor(Math.random() * RATES.length)];
  const remainingMonths = [6, 12, 24, 36, 48, 60][Math.floor(Math.random() * 6)];
  const prepaymentAmount = [50000, 100000, 200000, 500000][Math.floor(Math.random() * 4)];
  const prepaymentType = ['TENURE_REDUCTION', 'EMI_REDUCTION'][Math.floor(Math.random() * 2)];

  const res = http.post(
    `${urls.loan}/api/emi/prepayment`,
    JSON.stringify({
      originalPrincipal,
      annualRate,
      remainingMonths,
      prepaymentAmount,
      currentMonthEmi: 21247,
      prepaymentType,
      prepaymentPenaltyPercent: 2,
      gstPercent: 18,
    }),
    {
      headers: getAuthHeaders(token),
      tags: { name: 'emi/prepayment' },
    },
  );

  prepaymentDuration.add(res.timings.duration);
  handleError(res, 'Prepayment calculation');

  check(res, {
    'prepayment returns 200': (r) => r.status === 200,
    'returns tenure reduction': (r) => {
      const b = r.json() as any;
      return b && b.optionA_TenureReduction && typeof b.optionA_TenureReduction.newTenure === 'number';
    },
    'new tenure < original tenure': (r) => {
      const b = r.json() as any;
      return b && b.optionA_TenureReduction && b.optionA_TenureReduction.newTenure < remainingMonths;
    },
    'returns net savings': (r) => {
      const b = r.json() as any;
      return b && typeof b.netSavings === 'number';
    },
  });

  if (res.status === 200) {
    prepaymentSuccess.add(1);
  }
}

export function testForeclosureCalculation(token: string) {
  const originalPrincipal = [500000, 1000000, 2000000, 5000000][Math.floor(Math.random() * 4)];
  const annualRate = RATES[Math.floor(Math.random() * RATES.length)];
  const tenureMonths = [12, 24, 36, 60, 120, 180, 240][Math.floor(Math.random() * 7)];

  const disbursementDate = new Date();
  disbursementDate.setFullYear(disbursementDate.getFullYear() - Math.floor(Math.random() * 3));
  const foreclosureDate = new Date();

  const res = http.post(
    `${urls.loan}/api/emi/foreclosure`,
    JSON.stringify({
      originalPrincipal,
      annualRate,
      tenureMonths,
      disbursementDate: disbursementDate.toISOString().split('T')[0],
      foreclosureDate: foreclosureDate.toISOString().split('T')[0],
      foreclosureProcessingFeePercent: 2,
      gstPercent: 18,
    }),
    {
      headers: getAuthHeaders(token),
      tags: { name: 'emi/foreclosure' },
    },
  );

  foreclosureDuration.add(res.timings.duration);
  handleError(res, 'Foreclosure calculation');

  check(res, {
    'foreclosure returns 200': (r) => r.status === 200,
    'returns outstanding principal': (r) => {
      const b = r.json() as any;
      return b && typeof b.outstandingPrincipal === 'number' && b.outstandingPrincipal >= 0;
    },
    'returns processing fee': (r) => {
      const b = r.json() as any;
      return b && typeof b.processingFee === 'number';
    },
    'returns total foreclosure amount': (r) => {
      const b = r.json() as any;
      return b && typeof b.totalForeclosureAmount === 'number';
    },
  });

  if (res.status === 200) {
    foreclosureSuccess.add(1);
  }
}

export function testMaxEligibleEmi(token: string) {
  const netMonthlyIncome = [50000, 75000, 100000, 150000, 200000, 300000][Math.floor(Math.random() * 6)];
  const existingEmi = [0, 5000, 10000, 15000, 20000, 30000][Math.floor(Math.random() * 6)];
  const maxFoirPercent = [40, 45, 50, 55][Math.floor(Math.random() * 4)];

  const res = http.get(
    `${urls.loan}/api/emi/max-eligible-emi`,
    {
      params: { netMonthlyIncome, existingEmi, maxFoirPercent },
      headers: getAuthHeaders(token),
      tags: { name: 'emi/max-eligible' },
    },
  );

  handleError(res, 'Max eligible EMI');

  check(res, {
    'max eligible returns 200': (r) => r.status === 200,
    'returns maxEligibleEmi': (r) => {
      const b = r.json() as any;
      return b && typeof b.maxEligibleEmi === 'number' && b.maxEligibleEmi >= 0;
    },
    'returns foirPercent': (r) => {
      const b = r.json() as any;
      return b && typeof b.foirPercent === 'number';
    },
  });

  if (res.status === 200) {
    maxEmiSuccess.add(1);
  }
}

export function testEmiValidationErrors(token: string) {
  const invalidCases = [
    { principal: 0, annualRate: 10, tenureMonths: 12 },
    { principal: -100000, annualRate: 10, tenureMonths: 12 },
    { principal: 100000, annualRate: 0, tenureMonths: 12 },
    { principal: 100000, annualRate: 10, tenureMonths: 0 },
    { principal: 100000, annualRate: 10, tenureMonths: 500 },
  ];

  const invalidCase = invalidCases[Math.floor(Math.random() * invalidCases.length)];

  const res = http.post(
    `${urls.loan}/api/emi/calculate`,
    JSON.stringify(invalidCase),
    {
      headers: getAuthHeaders(token),
      tags: { name: 'emi/validation' },
    },
  );

  check(res, {
    'invalid input returns 400': (r) => r.status === 400,
  });
}

export function testEmiProductVariants(token: string) {
  const products = [
    { principal: 500000, annualRate: 8.5, tenureMonths: 360, monthlyIncome: 200000, product: 'HOME_LOAN' },
    { principal: 500000, annualRate: 10.5, tenureMonths: 60, monthlyIncome: 150000, product: 'PERSONAL_LOAN' },
    { principal: 1000000, annualRate: 9, tenureMonths: 240, monthlyIncome: 300000, product: 'LAP' },
    { principal: 500000, annualRate: 11, tenureMonths: 60, monthlyIncome: 100000, product: 'VEHICLE_LOAN' },
  ];

  const product = products[Math.floor(Math.random() * products.length)];

  const res = http.post(
    `${urls.loan}/api/emi/calculate`,
    JSON.stringify(product),
    {
      headers: getAuthHeaders(token),
      tags: { name: 'emi/product-variant' },
    },
  );

  handleError(res, 'EMI product variant');
  check(res, {
    'product variant returns 200': (r) => r.status === 200,
  });
}
