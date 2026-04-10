import * as crypto from 'crypto';
import * as bcrypt from 'bcrypt';

export const SALT_ROUNDS = 12;

export function generateOtp(length: number = 6): string {
  const digits = '0123456789';
  let otp = '';
  const randomBytes = crypto.randomBytes(length);
  for (let i = 0; i < length; i++) {
    otp += digits[randomBytes[i] % 10];
  }
  return otp;
}

export async function hashOtp(otp: string): Promise<string> {
  return bcrypt.hash(otp, SALT_ROUNDS);
}

export async function verifyOtp(otp: string, hash: string): Promise<boolean> {
  return bcrypt.compare(otp, hash);
}

export function hashMobile(mobile: string): string {
  return crypto.createHash('sha256').update(mobile).digest('hex');
}

export function hashPan(pan: string): string {
  return crypto.createHash('sha256').update(pan.toUpperCase()).digest('hex');
}

export function hashAadhaar(aadhaar: string): string {
  return crypto.createHash('sha256').update(aadhaar).digest('hex');
}

export function maskMobile(mobile: string): string {
  if (mobile.length !== 10) return mobile;
  return `XXXXXX${mobile.slice(-4)}`;
}

export function maskPan(pan: string): string {
  if (pan.length !== 10) return pan;
  return `${pan.slice(0, 5)}####${pan.slice(-1)}`;
}

export function maskAadhaar(aadhaar: string): string {
  if (aadhaar.length !== 12) return aadhaar;
  return `XXXX-XXXX-${aadhaar.slice(-4)}`;
}

export function maskAccountNumber(accountNumber: string): string {
  if (accountNumber.length < 4) return accountNumber;
  return `${'X'.repeat(accountNumber.length - 3)}${accountNumber.slice(-3)}`;
}

export function generateUUID(): string {
  return crypto.randomUUID();
}

export function generateIdempotencyKey(): string {
  return crypto.randomUUID();
}

export interface EncryptedData {
  ciphertext: string;
  iv: string;
  authTag: string;
  version: number;
}

export function encryptAes256Gcm(plaintext: string, key: Buffer): EncryptedData {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);

  let ciphertext = cipher.update(plaintext, 'utf8', 'base64');
  ciphertext += cipher.final('base64');
  const authTag = cipher.getAuthTag();

  return {
    ciphertext,
    iv: iv.toString('base64'),
    authTag: authTag.toString('base64'),
    version: 1,
  };
}

export function decryptAes256Gcm(data: EncryptedData, key: Buffer): string {
  if (data.version !== 1) {
    throw new Error(`Unsupported encryption version: ${data.version}`);
  }

  const iv = Buffer.from(data.iv, 'base64');
  const authTag = Buffer.from(data.authTag, 'base64');
  const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
  decipher.setAuthTag(authTag);

  let decrypted = decipher.update(data.ciphertext, 'base64', 'utf8');
  decrypted += decipher.final('utf8');
  return decrypted;
}

export function deriveKeyFromMasterKey(masterKey: string, purpose: string): Buffer {
  return crypto.pbkdf2Sync(masterKey, purpose, 100000, 32, 'sha256');
}

export function hashForStorage(value: string, salt: string): string {
  return crypto.createHash('sha512').update(value + salt).digest('hex');
}
