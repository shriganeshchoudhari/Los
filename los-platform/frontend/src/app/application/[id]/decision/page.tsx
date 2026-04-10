'use client';
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge, ProgressStages } from '@/components/ui/components';
import { decisionApi, bureauApi } from '@/lib/api';
import { formatCurrency, formatCurrencyFull } from '@/lib/utils';

const DECISION_STEPS = [
  { key: 'SUBMITTED', label: 'Submitted' },
  { key: 'KYC_COMPLETE', label: 'KYC Done' },
  { key: 'DOCUMENT_COLLECTION', label: 'Documents' },
  { key: 'BUREAU_PULL_COMPLETE', label: 'Bureau' },
  { key: 'CREDIT_ASSESSMENT', label: 'Decision' },
];

const STAGE_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  KYC_IN_PROGRESS: 'KYC',
  KYC_COMPLETE: 'KYC Complete',
  DOCUMENT_COLLECTION: 'Documents',
  UNDER_PROCESSING: 'Processing',
  BUREAU_PULL_IN_PROGRESS: 'Bureau Pull',
  BUREAU_PULL_COMPLETE: 'Bureau Complete',
  CREDIT_ASSESSMENT: 'Assessment',
  PENDING_FIELD_INVESTIGATION: 'Field Investigation',
  PENDING_LEGAL_TECHNICAL: 'Legal/Technical',
  CREDIT_COMMITTEE: 'Credit Committee',
  APPROVED: 'Approved',
  CONDITIONALLY_APPROVED: 'Conditional',
  REJECTED: 'Rejected',
  SANCTIONED: 'Sanctioned',
  DISBURSEMENT_IN_PROGRESS: 'Disbursement',
  DISBURSED: 'Disbursed',
};

export default function DecisionPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [loading, setLoading] = useState(true);
  const [decision, setDecision] = useState<Record<string, unknown> | null>(null);
  const [bureauReports, setBureauReports] = useState<Record<string, unknown>[]>([]);
  const [application, setApplication] = useState<Record<string, unknown> | null>(null);
  const [showSanction, setShowSanction] = useState(false);

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [decRes, appRes] = await Promise.all([
        decisionApi.get(id).catch(() => ({ data: null })),
        decisionApi.trigger(id).catch(() => ({ data: null })),
      ]);

      setDecision(decRes.data);
      setApplication(appRes.data?.application || application);

      if (decRes.data?.bureauReports) {
        setBureauReports(decRes.data.bureauReports);
      }
    } catch {
      // silent
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center space-y-4">
          <div className="animate-spin w-12 h-12 border-4 border-primary border-t-transparent rounded-full mx-auto" />
          <p className="text-muted-foreground">Running credit assessment...</p>
        </div>
      </div>
    );
  }

  const decisionType = decision?.decision as string || application?.status as string || 'PENDING';

  if (decisionType === 'APPROVED' || decisionType === 'SANCTIONED' || application?.status === 'APPROVED') {
    const sanctionedAmount = Number(application?.sanctionedAmount || decision?.sanctionedAmount || application?.requestedAmount || 0);
    const sanctionedRate = Number(application?.sanctionedROI || decision?.interestRate || 10.75);
    const sanctionedTenure = Number(application?.sanctionedTenureMonths || decision?.tenureMonths || 36);
    const emi = Math.round((sanctionedAmount * (sanctionedRate / 12 / 100) * Math.pow(1 + sanctionedRate / 12 / 100, sanctionedTenure)) / (Math.pow(1 + sanctionedRate / 12 / 100, sanctionedTenure) - 1));

    return (
      <div className="min-h-screen bg-gradient-to-b from-green-50 to-white">
        <main id="main-content" className="container py-12">
          <div className="max-w-2xl mx-auto space-y-6">
            <div className="text-center">
              <div className="w-20 h-20 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4 animate-in">
                <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                </svg>
              </div>
              <h1 className="text-3xl font-bold text-green-800">Congratulations!</h1>
              <p className="text-green-700 mt-2">Your loan has been approved</p>
            </div>

            <Card className="border-green-400 bg-white shadow-lg">
              <CardHeader>
                <CardTitle className="text-center">Sanction Letter</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-green-50 rounded-lg p-4 space-y-3">
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Sanctioned Amount</span>
                    <span className="text-xl font-bold text-green-700">{formatCurrencyFull(sanctionedAmount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Interest Rate</span>
                    <span className="font-semibold">{sanctionedRate}% p.a.</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-sm text-muted-foreground">Tenure</span>
                    <span className="font-semibold">{sanctionedTenure} months</span>
                  </div>
                  <div className="flex justify-between border-t pt-3">
                    <span className="text-sm font-semibold">Monthly EMI</span>
                    <span className="text-xl font-bold text-primary">{formatCurrency(emi)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Total Interest</span>
                    <span>{formatCurrency(emi * sanctionedTenure - sanctionedAmount)}</span>
                  </div>
                  <div className="flex justify-between text-xs text-muted-foreground">
                    <span>Total Payment</span>
                    <span>{formatCurrency(emi * sanctionedTenure)}</span>
                  </div>
                </div>

                <div className="space-y-2 text-sm text-muted-foreground">
                  <p>• EMI starting from ₹{emi.toLocaleString('en-IN')} per month</p>
                  <p>• Processing fee: 1% (Min ₹1,000)</p>
                  <p>• Loan account will be opened within 2 business days</p>
                  <p>• Disbursement to your account within 24 hours of NACH registration</p>
                </div>

                <div className="flex gap-3 pt-2">
                  <Button variant="outline" className="flex-1" onClick={() => router.push(`/application/${id}/sanction-letter`)}>
                    📄 View Sanction Letter
                  </Button>
                  <Button className="flex-1" onClick={() => setShowSanction(true)}>
                    Accept & Continue
                  </Button>
                </div>
              </CardContent>
            </Card>

            {showSanction && (
              <Card className="border-blue-300">
                <CardContent className="p-6 space-y-4">
                  <h3 className="font-semibold">Next Steps</h3>
                  <div className="space-y-3">
                    {[
                      { step: 1, title: 'Accept Terms', desc: 'Review and accept the loan agreement' },
                      { step: 2, title: 'NACH Registration', desc: 'Set up auto-debit for EMI payments' },
                      { step: 3, title: 'eSign', desc: 'Digitally sign the loan agreement via Aadhaar' },
                      { step: 4, title: 'Disbursement', desc: 'Funds credited to your account' },
                    ].map(({ step, title, desc }) => (
                      <div key={step} className="flex gap-3">
                        <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold text-sm flex-shrink-0">
                          {step}
                        </div>
                        <div>
                          <h4 className="font-medium text-sm">{title}</h4>
                          <p className="text-xs text-muted-foreground">{desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                  <Button className="w-full" onClick={() => router.push(`/application/${id}/sanction-letter`)}>
                    Proceed to Loan Agreement →
                  </Button>
                </CardContent>
              </Card>
            )}
          </div>
        </main>
      </div>
    );
  }

  if (decisionType === 'REJECTED') {
    return (
      <div className="min-h-screen bg-gradient-to-b from-red-50 to-white flex items-center justify-center">
        <div className="max-w-md text-center space-y-6 p-8">
          <div className="w-20 h-20 bg-red-500 rounded-full flex items-center justify-center mx-auto">
            <svg className="w-10 h-10 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </div>
          <div>
            <h1 className="text-2xl font-bold text-red-800">Application Not Approved</h1>
            <p className="text-red-700 mt-2">Unfortunately, we are unable to approve your loan application at this time.</p>
          </div>
          <Card className="text-left">
            <CardContent className="p-4 space-y-3">
              <h3 className="font-semibold text-sm">Common reasons for rejection:</h3>
              {[
                'Credit score below minimum requirement',
                'High existing debt burden (FOIR)',
                'Insufficient income for EMI coverage',
                'Negative remarks in credit report',
                'KYC verification not completed',
              ].map((r) => (
                <div key={r} className="flex items-start gap-2 text-sm">
                  <span className="text-red-400 mt-0.5">•</span>
                  <span>{r}</span>
                </div>
              ))}
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground">
                  Reason: {decision?.rejectionReasonCode || application?.rejectionReasonCode || 'Credit assessment criteria not met'}
                </p>
              </div>
            </CardContent>
          </Card>
          <div className="space-y-2">
            <p className="text-xs text-muted-foreground">
              You can reapply after 90 days. Work on improving your credit score by paying EMIs on time and reducing existing debt.
            </p>
            <Button variant="outline" className="w-full" onClick={() => router.push('/')}>
              Return to Home
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b">
        <div className="container py-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white font-bold text-sm">₹</div>
            <span className="font-bold">LOS Bank</span>
          </div>
        </div>
      </header>
      <main className="container py-12">
        <div className="max-w-2xl mx-auto space-y-6">
          <Card className="decision-card-pending">
            <CardContent className="p-8 text-center space-y-4">
              <div className="animate-pulse">
                <div className="w-16 h-16 bg-yellow-400 rounded-full flex items-center justify-center mx-auto">
                  <svg className="w-8 h-8 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                </div>
              </div>
              <h3 className="text-xl font-bold text-yellow-800">Under Credit Assessment</h3>
              <p className="text-sm text-yellow-700">
                Your application is being evaluated. This typically takes a few minutes. You will be notified once the decision is ready.
              </p>
              <div className="bg-yellow-50 rounded-lg p-4 text-sm text-left space-y-2">
                <h4 className="font-semibold">What's happening:</h4>
                <div className="flex items-center gap-2 text-yellow-800">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full animate-pulse" />
                  <span>Validating credit bureau data</span>
                </div>
                <div className="flex items-center gap-2 text-yellow-800/60">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full" />
                  <span>Running rule engine evaluation</span>
                </div>
                <div className="flex items-center gap-2 text-yellow-800/60">
                  <div className="w-2 h-2 bg-yellow-500 rounded-full" />
                  <span>Computing ML credit score</span>
                </div>
              </div>
              <Button onClick={loadData} variant="outline" className="w-full">
                🔄 Check Again
              </Button>
            </CardContent>
          </Card>

          {bureauReports.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Credit Bureau Summary</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {bureauReports.map((report: Record<string, unknown>) => (
                    <div key={report.provider as string} className="text-center p-3 bg-muted/50 rounded-lg">
                      <p className="text-xs text-muted-foreground">{report.provider as string}</p>
                      <p className="text-2xl font-bold">{report.score as number || '—'}</p>
                      <p className="text-xs text-muted-foreground">Credit Score</p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
