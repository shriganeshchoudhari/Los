export interface TestCustomer {
  id: string;
  mobile: string;
  fullName: string;
  pan: string;
  dob: string;
  email: string;
  employeeId?: string;
  role?: string;
}

let mobileCounter = 9876540000;
let panCounter = 1000;

export function generateUniqueMobile(): string {
  return String(mobileCounter++);
}

export function generateUniquePAN(): string {
  const num = String(panCounter++).padStart(4, '0');
  return `AATPB${num}Z`;
}

export function generateUUID(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export const testData = {
  customers: new Map<string, TestCustomer>(),

  async createCustomer(mobile?: string, role = 'APPLICANT'): Promise<TestCustomer> {
    const customer: TestCustomer = {
      id: generateUUID(),
      mobile: mobile || generateUniqueMobile(),
      fullName: 'Test User',
      pan: generateUniquePAN(),
      dob: '1990-04-21',
      email: `test.${Date.now()}@test.com`,
      role,
    };
    this.customers.set(customer.mobile, customer);
    return customer;
  },

  getCustomerByMobile(mobile: string): TestCustomer | undefined {
    return this.customers.get(mobile);
  },

  getGoodCustomer(): TestCustomer {
    return {
      id: generateUUID(),
      mobile: '9999999999',
      fullName: 'Good Customer',
      pan: 'AAUPG9999Z',
      dob: '1985-01-15',
      email: 'good@test.com',
    };
  },

  getBadCustomer(): TestCustomer {
    return {
      id: generateUUID(),
      mobile: '9999999998',
      fullName: 'Bad Customer',
      pan: 'AAUPB9998Z',
      dob: '1992-06-30',
      email: 'bad@test.com',
    };
  },

  getSalarySlipFixture(): Buffer {
    return Buffer.from('%PDF-1.4\nMock Salary Slip PDF\n%%EOF');
  },

  getBankStatementFixture(): Buffer {
    return Buffer.from('%PDF-1.4\nMock Bank Statement PDF\n%%EOF');
  },

  getOversizedFileFixture(): Buffer {
    return Buffer.alloc(11 * 1024 * 1024);
  },
};

export async function cleanUpCustomer(customerId: string): Promise<void> {
  try {
    await fetch(`http://localhost:3001/test/cleanup/${customerId}`, {
      method: 'DELETE',
    }).catch(() => {});
  } catch {}
}

export const SEED_DATA = {
  products: {
    personalLoan: {
      code: 'PL',
      minAmount: 50000,
      maxAmount: 2500000,
      minTenure: 12,
      maxTenure: 60,
      minIncome: 15000,
    },
    homeLoan: {
      code: 'HL',
      minAmount: 500000,
      maxAmount: 50000000,
      minTenure: 60,
      maxTenure: 360,
      minIncome: 25000,
    },
  },

  bureauScoreProfiles: {
    excellent: { score: 850, grade: 'A+', dpd90: 0, activeAccounts: 3 },
    good: { score: 750, grade: 'A', dpd90: 0, activeAccounts: 2 },
    fair: { score: 650, grade: 'B+', dpd90: 0, activeAccounts: 1 },
    poor: { score: 550, grade: 'C', dpd90: 1, activeAccounts: 4 },
    veryPoor: { score: 400, grade: 'D', dpd90: 2, activeAccounts: 8 },
  },

  decisionScenarios: {
    autoApprove: { income: 100000, amount: 500000, tenure: 36, score: 850 },
    manualReview: { income: 50000, amount: 1000000, tenure: 60, score: 650 },
    autoReject: { income: 15000, amount: 2000000, tenure: 60, score: 400 },
  },
};
