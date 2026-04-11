'use client';

import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { loanApi } from '@/lib/api';
import { AmortizationTable } from '@/components/loan/amortization-table';

export default function EmiPage() {
  const params = useParams();
  const router = useRouter();
  const id = params?.id as string;

  const [loading, setLoading] = useState(true);
  const [application, setApplication] = useState<Record<string, unknown> | null>(null);
  const [activeTab, setActiveTab] = useState<'schedule' | 'summary'>('schedule');

  useEffect(() => {
    if (!id) return;
    setLoading(true);
    loanApi
      .get(id)
      .then((res) => setApplication(res.data?.data ?? res.data))
      .catch(() => toast.error('Failed to load application'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[40vh]">
        <div className="text-center">
          <div className="w-8 h-8 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mx-auto mb-3" />
          <p className="text-sm text-muted-foreground">Loading EMI schedule...</p>
        </div>
      </div>
    );
  }

  if (!application) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">Application not found.</p>
        <Button variant="outline" className="mt-4" onClick={() => router.push('/dashboard')}>
          Back to Dashboard
        </Button>
      </div>
    );
  }

  const loanAmount = (application.loanAmount as number) || 0;
  const interestRate = (application.approvedInterestRate as number) ||
    (application.interestRate as number) || 12;
  const tenureMonths = (application.tenureMonths as number) || 36;
  const sanctionedAmount = (application.sanctionedAmount as number) || loanAmount;

  const applicationNo = (application.applicationNumber as string) || id;
  const customerName = (application.customerName as string) ||
    ((application.customer as Record<string, unknown>)?.fullName as string) || 'Customer';

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">EMI Schedule</h1>
          <p className="text-sm text-muted-foreground">
            {applicationNo} &mdash; {customerName}
          </p>
        </div>
        <Button variant="outline" onClick={() => router.back()}>
          Back
        </Button>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground mb-1">Sanctioned Amount</p>
            <p className="text-xl font-bold font-mono">₹{sanctionedAmount.toLocaleString('en-IN')}</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground mb-1">Interest Rate</p>
            <p className="text-xl font-bold font-mono">{interestRate}% p.a.</p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="pt-4">
            <p className="text-xs text-muted-foreground mb-1">Tenure</p>
            <p className="text-xl font-bold font-mono">{tenureMonths} months</p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center gap-4">
            <CardTitle className="text-base">Loan Details</CardTitle>
            <div className="flex border rounded-md overflow-hidden text-sm">
              <button
                className={`px-3 py-1 transition-colors ${activeTab === 'schedule' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                onClick={() => setActiveTab('schedule')}
              >
                Schedule
              </button>
              <button
                className={`px-3 py-1 transition-colors ${activeTab === 'summary' ? 'bg-primary text-primary-foreground' : 'hover:bg-muted'}`}
                onClick={() => setActiveTab('summary')}
              >
                Summary
              </button>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {activeTab === 'schedule' ? (
            <AmortizationTable
              principal={sanctionedAmount}
              annualRate={interestRate}
              tenureMonths={tenureMonths}
              showSummary={false}
            />
          ) : (
            <AmortizationTable
              principal={sanctionedAmount}
              annualRate={interestRate}
              tenureMonths={tenureMonths}
              showSummary
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
