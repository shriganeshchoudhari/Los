import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number | string, currency = 'INR'): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(num);
}

export function formatCurrencyFull(amount: number | string): string {
  const num = typeof amount === 'string' ? parseFloat(amount) : amount;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(num);
}

export function formatDate(date: string | Date | undefined | null, format: 'short' | 'medium' | 'long' = 'medium'): string {
  if (!date) return 'N/A';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return 'N/A';
  const formats: Record<string, Intl.DateTimeFormatOptions> = {
    short: { day: '2-digit', month: '2-digit', year: 'numeric' },
    medium: { day: '2-digit', month: 'short', year: 'numeric' },
    long: { day: '2-digit', month: 'long', year: 'numeric' },
  };
  return new Intl.DateTimeFormat('en-IN', formats[format]).format(d);
}

export function formatDateTime(date: string | Date | undefined | null): string {
  if (!date) return 'N/A';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return 'N/A';
  return new Intl.DateTimeFormat('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  }).format(d);
}

export function maskMobile(mobile: string): string {
  if (!mobile || mobile.length < 10) return 'XXXXXXX';
  return `XXXXXX${mobile.slice(-4)}`;
}

export function maskPAN(pan: string): string {
  if (!pan || pan.length < 5) return 'XXXXX';
  return `${pan.substring(0, 5).toUpperCase()}XXXX`;
}

export function maskAadhaar(aadhaar: string): string {
  if (!aadhaar || aadhaar.length < 4) return 'XXXX';
  return `XXXX-XXXX-${aadhaar.slice(-4)}`;
}

export function calculateAge(dob: string | undefined | null): number {
  if (!dob) return 0;
  const birthDate = new Date(dob);
  if (isNaN(birthDate.getTime())) return 0;
  const today = new Date();
  let age = today.getFullYear() - birthDate.getFullYear();
  const m = today.getMonth() - birthDate.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
    age--;
  }
  return age;
}

export function getStatusColor(status: string): string {
  const colors: Record<string, string> = {
    DRAFT: 'bg-gray-100 text-gray-800',
    SUBMITTED: 'bg-blue-100 text-blue-800',
    KYC_IN_PROGRESS: 'bg-indigo-100 text-indigo-800',
    KYC_COMPLETE: 'bg-indigo-200 text-indigo-900',
    DOCUMENT_COLLECTION: 'bg-purple-100 text-purple-800',
    UNDER_PROCESSING: 'bg-purple-200 text-purple-900',
    BUREAU_PULL_IN_PROGRESS: 'bg-violet-100 text-violet-800',
    CREDIT_ASSESSMENT: 'bg-yellow-100 text-yellow-800',
    APPROVED: 'bg-green-100 text-green-800',
    CONDITIONALLY_APPROVED: 'bg-emerald-100 text-emerald-800',
    REJECTED: 'bg-red-100 text-red-800',
    SANCTIONED: 'bg-green-200 text-green-900',
    DISBURSEMENT_IN_PROGRESS: 'bg-teal-100 text-teal-800',
    DISBURSED: 'bg-green-300 text-green-900',
    WITHDRAWN: 'bg-gray-200 text-gray-700',
    CANCELLED: 'bg-gray-200 text-gray-700',
    KYC_FAILED: 'bg-red-100 text-red-800',
    CANCELLATION_WINDOW: 'bg-orange-100 text-orange-800',
  };
  return colors[status] || 'bg-gray-100 text-gray-800';
}

export function getStatusLabel(status: string): string {
  const labels: Record<string, string> = {
    DRAFT: 'Draft',
    SUBMITTED: 'Submitted',
    KYC_IN_PROGRESS: 'KYC In Progress',
    KYC_COMPLETE: 'KYC Complete',
    DOCUMENT_COLLECTION: 'Documents Pending',
    UNDER_PROCESSING: 'Under Processing',
    BUREAU_PULL_IN_PROGRESS: 'Bureau Pull',
    CREDIT_ASSESSMENT: 'Credit Assessment',
    PENDING_FIELD_INVESTIGATION: 'Field Investigation',
    PENDING_LEGAL_TECHNICAL: 'Legal/Technical',
    CREDIT_COMMITTEE: 'Credit Committee',
    APPROVED: 'Approved',
    CONDITIONALLY_APPROVED: 'Conditional Approval',
    REJECTED: 'Rejected',
    SANCTIONED: 'Sanctioned',
    DISBURSEMENT_IN_PROGRESS: 'Disbursement',
    DISBURSED: 'Disbursed',
    WITHDRAWN: 'Withdrawn',
    CANCELLED: 'Cancelled',
    KYC_FAILED: 'KYC Failed',
    CANCELLATION_WINDOW: 'Cancellation Window',
  };
  return labels[status] || status.replace(/_/g, ' ');
}

export function calculateEMI(principal: number, annualRate: number, tenureMonths: number): number {
  const monthlyRate = annualRate / 12 / 100;
  if (monthlyRate === 0) return principal / tenureMonths;
  const emi = (principal * monthlyRate * Math.pow(1 + monthlyRate, tenureMonths)) / (Math.pow(1 + monthlyRate, tenureMonths) - 1);
  return Math.round(emi);
}

export function calculateFOIR(monthlyIncome: number, existingEMI: number, requestedEMI: number): number {
  return Math.round(((existingEMI + requestedEMI) / monthlyIncome) * 100);
}

export function debounce<T extends (...args: unknown[]) => void>(fn: T, delay: number): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout>;
  return (...args: Parameters<T>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

export function generateAmortizationSchedule(
  principal: number,
  annualRate: number,
  tenureMonths: number,
): Array<{ month: number; emi: number; interest: number; principal: number; balance: number }> {
  const monthlyRate = annualRate / 12 / 100;
  const emi = calculateEMI(principal, annualRate, tenureMonths);
  const schedule = [];
  let balance = principal;

  for (let month = 1; month <= tenureMonths; month++) {
    const interest = Math.round(balance * monthlyRate);
    const principalPaid = emi - interest;
    balance = Math.max(0, balance - principalPaid);
    schedule.push({ month, emi, interest, principal: principalPaid, balance });
  }
  return schedule;
}

export function validateIFSC(ifsc: string): boolean {
  return /^[A-Z]{4}0[A-Z0-9]{6}$/.test(ifsc.toUpperCase());
}

export function validateMobile(mobile: string): boolean {
  return /^[6-9]\d{9}$/.test(mobile);
}

export function validatePAN(pan: string): boolean {
  return /^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan.toUpperCase());
}

export function getInitials(name: string): string {
  return name
    .split(' ')
    .map(n => n[0])
    .join('')
    .toUpperCase()
    .substring(0, 2);
}

export function timeAgo(date: string | Date | undefined | null): string {
  if (!date) return 'N/A';
  const d = typeof date === 'string' ? new Date(date) : date;
  if (isNaN(d.getTime())) return 'invalid date';
  const seconds = Math.floor((Date.now() - d.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  if (months < 12) return `${months}mo ago`;
  return `${Math.floor(months / 12)}y ago`;
}
