import * as React from 'react';
import { cn, getStatusColor, getStatusLabel } from '@/lib/utils';

interface ProgressStagesProps {
  stages: Array<{ key: string; label: string }>;
  currentStage: string;
  completedStages?: string[];
}

export function ProgressStages({ stages, currentStage, completedStages = [] }: ProgressStagesProps) {
  const currentIndex = stages.findIndex(s => s.key === currentStage);
  const progress = completedStages.length > 0
    ? (completedStages.length / stages.length) * 100
    : Math.max(0, currentIndex) / Math.max(1, stages.length - 1) * 100;

  return (
    <div className="space-y-4" aria-label={`Application progress: ${currentIndex + 1} of ${stages.length} steps`}>
      <div
        className="relative"
        role="progressbar"
        aria-valuenow={Math.round(progress)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Application completion progress"
      >
        <div className="absolute top-4 left-0 right-0 h-1 bg-gray-200 rounded" />
        <div
          className="absolute top-4 left-0 h-1 bg-primary rounded transition-all duration-500"
          style={{ width: `${progress}%` }}
        />
        <div className="relative flex justify-between">
          {stages.map((stage, idx) => {
            const isCompleted = completedStages.includes(stage.key);
            const isCurrent = stage.key === currentStage;
            const isPast = idx < currentIndex || isCompleted;

            return (
              <div
                key={stage.key}
                className="flex flex-col items-center"
                aria-current={isCurrent ? 'step' : undefined}
              >
                <div
                  className={cn(
                    'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors z-10',
                    isCompleted && 'bg-green-600 text-white',
                    isCurrent && !isCompleted && 'bg-primary text-white ring-4 ring-primary/20',
                    !isPast && !isCurrent && 'bg-gray-200 text-gray-500',
                  )}
                  aria-label={`Step ${idx + 1}: ${stage.label}${isCompleted ? ' (completed)' : isCurrent ? ' (current)' : ''}`}
                >
                  {isCompleted ? (
                    <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <span aria-hidden="true">{idx + 1}</span>
                  )}
                </div>
                <span
                  className={cn(
                    'mt-2 text-xs text-center max-w-[80px]',
                    isCurrent && 'font-semibold text-primary',
                    isCompleted && 'text-green-600',
                    !isPast && !isCurrent && 'text-gray-500',
                  )}
                >
                  {stage.label}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  return (
    <span
      className={cn('status-badge', getStatusColor(status), className)}
      aria-label={`Application status: ${getStatusLabel(status)}`}
    >
      {getStatusLabel(status)}
    </span>
  );
}

interface ApplicationCardProps {
  application: {
    id: string;
    applicationNumber: string;
    status: string;
    loanType: string;
    applicantName: string;
    requestedAmount: number;
    sanctionedAmount?: number;
    submittedAt?: string;
    updatedAt: string;
  };
  onClick?: () => void;
}

export function ApplicationCard({ application, onClick }: ApplicationCardProps) {
  const { formatCurrency, timeAgo } = require('@/lib/utils');

  return (
    <div className="application-card" onClick={onClick}>
      <div className="flex items-start justify-between">
        <div className="space-y-1">
          <p className="text-sm font-mono text-muted-foreground">{application.applicationNumber}</p>
          <h4 className="font-semibold">{application.applicantName}</h4>
          <p className="text-sm text-muted-foreground">{application.loanType.replace(/_/g, ' ')}</p>
        </div>
        <StatusBadge status={application.status} />
      </div>
      <div className="mt-4 flex items-end justify-between">
        <div>
          <p className="text-xs text-muted-foreground">Requested</p>
          <p className="text-lg font-bold">{formatCurrency(application.requestedAmount)}</p>
        </div>
        {application.sanctionedAmount && (
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Sanctioned</p>
            <p className="text-lg font-bold text-green-600">{formatCurrency(application.sanctionedAmount)}</p>
          </div>
        )}
        <p className="text-xs text-muted-foreground">{timeAgo(application.updatedAt)}</p>
      </div>
    </div>
  );
}

interface OTPDigitInputProps {
  length?: number;
  value: string;
  onChange: (value: string) => void;
  autoFocus?: boolean;
}

export function OTPDigitInput({ length = 6, value, onChange, autoFocus }: OTPDigitInputProps) {
  const inputRefs = React.useRef<(HTMLInputElement | null)[]>([]);

  const handleChange = (index: number, char: string) => {
    if (!/^\d*$/.test(char)) return;
    // Pad the current value to `length` slots to avoid sparse arrays
    const digits = Array.from({ length }, (_, i) => value[i] || '');
    digits[index] = char.slice(-1); // accept only the last typed char
    onChange(digits.join(''));

    if (char && index < length - 1) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !value[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pastedData = e.clipboardData.getData('text').replace(/\D/g, '').substring(0, length);
    onChange(pastedData);
    if (pastedData.length === length) {
      inputRefs.current[length - 1]?.blur();
    }
  };

  return (
    <div
      className="flex gap-2 justify-center"
      onPaste={handlePaste}
      role="group"
      aria-label="OTP digit entry"
    >
      {Array.from({ length }).map((_, idx) => (
        <input
          key={idx}
          ref={(el) => { inputRefs.current[idx] = el; }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]"
          maxLength={1}
          value={value[idx] || ''}
          onChange={(e) => handleChange(idx, e.target.value)}
          onKeyDown={(e) => handleKeyDown(idx, e)}
          className="w-12 h-14 text-center text-2xl font-bold border-2 border-input rounded-lg focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
          style={{ caretColor: 'transparent' }}
          autoFocus={idx === 0 || autoFocus}
          aria-label={`Digit ${idx + 1} of ${length}`}
          autoComplete="one-time-code"
        />
      ))}
    </div>
  );
}

interface MoneyInputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  onValueChange?: (value: number) => void;
}

export function MoneyInput({ onValueChange, className, ...props }: MoneyInputProps) {
  const [displayValue, setDisplayValue] = React.useState('');

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^\d]/g, '');
    const num = parseInt(raw || '0', 10);
    setDisplayValue(raw ? parseInt(raw).toLocaleString('en-IN') : '');
    onValueChange?.(num);
  };

  return (
    <div className="relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true">₹</span>
      <input
        {...props}
        type="text"
        inputMode="numeric"
        value={displayValue}
        onChange={handleChange}
        className={cn('input pl-8 text-right font-mono', className)}
        placeholder="0"
        aria-label="Loan amount in rupees"
      />
    </div>
  );
}
