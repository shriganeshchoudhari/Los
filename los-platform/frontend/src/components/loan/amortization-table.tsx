'use client';
import { useMemo } from 'react';
import { formatCurrency } from '@/lib/utils';

interface AmortizationEntry {
  month: number;
  emi: number;
  principalComponent: number;
  interestComponent: number;
  balance: number;
  principalPaid: number;
  interestPaid: number;
  date: Date;
}

interface AmortizationTableProps {
  principal: number;
  annualRate: number;
  tenureMonths: number;
  emiDate?: number;
  startDate?: Date;
  showSummary?: boolean;
  highlightMonth?: number;
}

export function generateAmortizationSchedule(
  principal: number,
  annualRate: number,
  tenureMonths: number,
  startDate?: Date,
): AmortizationEntry[] {
  const monthlyRate = annualRate / 12 / 100;
  const emi = Math.round(
    (principal * monthlyRate * Math.pow(1 + monthlyRate, tenureMonths)) /
    (Math.pow(1 + monthlyRate, tenureMonths) - 1),
  );

  const schedule: AmortizationEntry[] = [];
  let balance = principal;
  let cumulativePrincipal = 0;
  let cumulativeInterest = 0;
  const start = startDate || new Date();
  start.setDate(start.getDate());

  for (let month = 1; month <= tenureMonths; month++) {
    const interestComponent = Math.round(balance * monthlyRate);
    const principalComponent = emi - interestComponent;
    balance = Math.max(0, balance - principalComponent);
    cumulativePrincipal += principalComponent;
    cumulativeInterest += interestComponent;

    const paymentDate = new Date(start);
    paymentDate.setMonth(paymentDate.getMonth() + month);

    schedule.push({
      month,
      emi,
      principalComponent,
      interestComponent,
      balance: Math.max(0, balance),
      principalPaid: cumulativePrincipal,
      interestPaid: cumulativeInterest,
      date: paymentDate,
    });
  }

  return schedule;
}

export function AmortizationTable({
  principal,
  annualRate,
  tenureMonths,
  startDate,
  showSummary = true,
  highlightMonth,
}: AmortizationTableProps) {
  const schedule = useMemo(
    () => generateAmortizationSchedule(principal, annualRate, tenureMonths, startDate),
    [principal, annualRate, tenureMonths, startDate],
  );

  const totalPayment = schedule[0].emi * tenureMonths;
  const totalInterest = schedule[0].emi * tenureMonths - principal;
  const monthlyRate = annualRate / 12 / 100;
  const emi = schedule[0].emi;

  const formatDate = (d: Date) =>
    d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });

  return (
    <div className="space-y-4">
      {showSummary && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">Principal</p>
            <p className="font-bold font-mono">{formatCurrency(principal)}</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">Total Interest</p>
            <p className="font-bold font-mono text-orange-600">{formatCurrency(totalInterest)}</p>
          </div>
          <div className="bg-muted/50 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">Total Payment</p>
            <p className="font-bold font-mono">{formatCurrency(totalPayment)}</p>
          </div>
          <div className="bg-primary/5 rounded-lg p-3 text-center">
            <p className="text-xs text-muted-foreground">EMI</p>
            <p className="font-bold font-mono text-primary">{formatCurrency(emi)}</p>
          </div>
        </div>
      )}

      <div className="border rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-muted/50">
              <tr>
                <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">#</th>
                <th className="px-3 py-2 text-left text-xs font-semibold text-muted-foreground">Payment Date</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">EMI</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Principal</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Interest</th>
                <th className="px-3 py-2 text-right text-xs font-semibold text-muted-foreground">Balance</th>
                <th className="px-3 py-2 w-24 text-xs font-semibold text-muted-foreground">Principal %</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {schedule.map((entry) => {
                const principalPct = Math.round((entry.principalComponent / emi) * 100);
                const isHighlighted = highlightMonth === entry.month;
                const isLast = entry.month === tenureMonths;

                return (
                  <tr
                    key={entry.month}
                    className={`hover:bg-muted/20 transition-colors ${isHighlighted ? 'bg-primary/5' : ''} ${isLast ? 'bg-green-50/50' : ''}`}
                  >
                    <td className="px-3 py-2 font-medium">
                      {entry.month}
                      {isLast && <span className="ml-1 text-xs text-green-600 font-semibold">(Final)</span>}
                    </td>
                    <td className="px-3 py-2 text-muted-foreground">{formatDate(entry.date)}</td>
                    <td className="px-3 py-2 text-right font-mono">{formatCurrency(entry.emi)}</td>
                    <td className="px-3 py-2 text-right font-mono text-green-700">{formatCurrency(entry.principalComponent)}</td>
                    <td className="px-3 py-2 text-right font-mono text-orange-600">{formatCurrency(entry.interestComponent)}</td>
                    <td className="px-3 py-2 text-right font-mono">{formatCurrency(entry.balance)}</td>
                    <td className="px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="flex-1 bg-gray-200 rounded-full h-2">
                          <div
                            className="bg-green-500 h-2 rounded-full transition-all"
                            style={{ width: `${principalPct}%` }}
                          />
                        </div>
                        <span className="text-xs text-muted-foreground w-8 text-right">{principalPct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 text-xs text-muted-foreground">
        <div>
          <p className="font-semibold mb-2">Interest vs Principal Breakdown</p>
          <div className="space-y-1">
            <div className="flex justify-between">
              <span>Principal Amount</span>
              <span className="font-mono">{formatCurrency(principal)}</span>
            </div>
            <div className="flex justify-between">
              <span>Total Interest ({annualRate}% p.a.)</span>
              <span className="font-mono">{formatCurrency(totalInterest)}</span>
            </div>
            <div className="flex justify-between font-semibold text-foreground border-t pt-1">
              <span>Total Amount Payable</span>
              <span className="font-mono">{formatCurrency(totalPayment)}</span>
            </div>
          </div>
        </div>
        <div>
          <p className="font-semibold mb-2">Rate Breakdown</p>
          <div className="space-y-1">
            <div className="flex justify-between">
              <span>Interest Rate</span>
              <span className="font-mono">{annualRate}% p.a.</span>
            </div>
            <div className="flex justify-between">
              <span>Monthly Rate</span>
              <span className="font-mono">{(monthlyRate * 100).toFixed(4)}%</span>
            </div>
            <div className="flex justify-between">
              <span>Tenure</span>
              <span className="font-mono">{tenureMonths} months</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
