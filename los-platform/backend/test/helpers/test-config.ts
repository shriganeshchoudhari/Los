export class TestConfig {
  static get() {
    return {
      AUTH_SERVICE_URL: process.env.AUTH_SERVICE_URL || 'http://localhost:3001',
      LOAN_SERVICE_URL: process.env.LOAN_SERVICE_URL || 'http://localhost:3003',
      KYC_SERVICE_URL: process.env.KYC_SERVICE_URL || 'http://localhost:3002',
      DECISION_SERVICE_URL: process.env.DECISION_SERVICE_URL || 'http://localhost:3004',
      INTEGRATION_SERVICE_URL: process.env.INTEGRATION_SERVICE_URL || 'http://localhost:3006',
      DB_HOST: process.env.DB_HOST || 'localhost',
      DB_PORT: parseInt(process.env.DB_PORT || '5432'),
      DB_USERNAME: process.env.DB_USERNAME || 'los_user',
      DB_PASSWORD: process.env.DB_PASSWORD || 'los_password',
      DB_NAME: process.env.DB_NAME || 'los_shared',
      JWT_SECRET: process.env.JWT_SECRET || 'test_jwt_secret_32_chars_minimum',
    };
  }
}

export function randomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function generateMobile(): string {
  return `9${String(randomInt(100000000, 999999999))}`;
}

export function generatePAN(): string {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const numbers = '0123456789';
  return (
    letters[randomInt(0, 25)] +
    letters[randomInt(0, 25)] +
    letters[randomInt(0, 25)] +
    letters[randomInt(0, 25)] +
    numbers[randomInt(0, 9)] +
    numbers[randomInt(0, 9)] +
    numbers[randomInt(0, 9)] +
    numbers[randomInt(0, 9)] +
    numbers[randomInt(0, 9)] +
    letters[randomInt(0, 25)]
  );
}

export class AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
  scope: string[];
  userId: string;
  role: string;
}
