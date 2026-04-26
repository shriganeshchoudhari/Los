'use client';
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useQuery, useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { StatusBadge } from '@/components/ui/components';
import { loanApi, decisionApi } from '@/lib/api';
import { formatCurrency, formatCurrencyFull, timeAgo } from '@/lib/utils';
import { ChevronLeft, CheckCircle2, XCircle, AlertCircle, Info } from 'lucide-react';

export default function UnderwritingPage() {
  const router = useRouter();
  const { id } = useParams() as { id: string };
  const [remarks, setRemarks] = useState('');
  const [overrideAmount, setOverrideAmount] = useState<number>(0);
  const [overrideTenure, setOverrideTenure] = useState<number>(36);

  const { data: applicationRes, isLoading: appLoading } = useQuery({
    queryKey: ['application', id],
    queryFn: () => loanApi.get(id),
  });

  const { data: decisionRes, isLoading: decLoading, refetch: refetchDecision } = useQuery({
    queryKey: ['decision', id],
    queryFn: () => decisionApi.get(id),
  });

  const application = applicationRes?.data?.data || applicationRes?.data;
  const decision = decisionRes?.data?.data || decisionRes?.data;

  useEffect(() => {
    if (application) {
      setOverrideAmount(application.requestedAmount);
      setOverrideTenure(application.tenureMonths || 36);
    }
  }, [application]);

  const mutation = useMutation({
    mutationFn: (data: { status: string; decision: string; remarks: string; approvedAmount?: number; approvedTenureMonths?: number }) => 
      decisionApi.override({
        applicationId: id,
        ...data
      }),
    onSuccess: () => {
      toast.success('Manual decision recorded successfully');
      router.push('/dashboard');
    },
    onError: (err: any) => {
      toast.error(err.response?.data?.message || 'Failed to submit decision');
    }
  });

  const handleDecision = (type: 'APPROVE' | 'REJECT') => {
    if (!remarks.trim()) {
      toast.error('Please provide remarks for the decision');
      return;
    }

    mutation.mutate({
      status: type === 'APPROVE' ? 'APPROVED' : 'REJECTED',
      decision: type,
      remarks,
      approvedAmount: type === 'APPROVE' ? overrideAmount : undefined,
      approvedTenureMonths: type === 'APPROVE' ? overrideTenure : undefined,
    });
  };

  if (appLoading || decLoading) {
    return <div className="p-8 flex justify-center"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      <div className="bg-white border-b sticky top-0 z-20">
        <div className="container py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => router.back()}>
              <ChevronLeft className="w-5 h-5" />
            </Button>
            <div>
              <h1 className="text-lg font-bold flex items-center gap-2">
                Underwriting Review
                <span className="text-xs font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{application?.applicationNumber}</span>
              </h1>
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <span>{application?.applicantName || 'Applicant'}</span>
                <span>•</span>
                <span>{application?.loanType?.replace(/_/g, ' ')}</span>
              </div>
            </div>
          </div>
          <StatusBadge status={application?.status} />
        </div>
      </div>

      <main id="main-content" className="container py-6 grid md:grid-cols-3 gap-6">
        {/* Left Column: Application Details */}
        <div className="md:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Application Summary</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-muted-foreground uppercase">Requested Amount</p>
                <p className="font-bold text-lg">{formatCurrencyFull(application?.requestedAmount)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase">Tenure</p>
                <p className="font-semibold">{application?.tenureMonths || application?.requestedTenureMonths || 0} months</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase">Income (Monthly)</p>
                <p className="font-semibold">{formatCurrency(application?.annualIncome ? application.annualIncome / 12 : 0)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase">Credit Score</p>
                <p className={`font-bold ${(application?.creditScore || 0) > 700 ? 'text-green-600' : 'text-orange-600'}`}>
                  {application?.creditScore || 'N/A'}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase">Employment</p>
                <p className="font-medium text-sm">{application?.employmentType?.replace(/_/g, ' ')}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground uppercase">Submitted At</p>
                <p className="text-sm">{timeAgo(application?.submittedAt)}</p>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0">
              <div>
                <CardTitle className="text-base">Rule Engine Results</CardTitle>
                <CardDescription>Automated assessment output</CardDescription>
              </div>
              {(!decision || decision.status === 'IN_PROGRESS') && (
                <Button variant="outline" size="sm" onClick={() => refetchDecision()}>Run Rules</Button>
              )}
            </CardHeader>
            <CardContent>
              {!decision ? (
                <div className="text-center py-8 bg-muted/20 rounded-lg border border-dashed">
                  <AlertCircle className="w-8 h-8 text-muted-foreground mx-auto mb-2" />
                  <p className="text-sm text-muted-foreground">No automated decision has been triggered yet.</p>
                </div>
              ) : (
                <div className="space-y-1">
                  {decision.ruleResults?.map((rule: any) => (
                    <div key={rule.ruleId} className="flex items-start gap-3 p-3 border-b last:border-0">
                      {rule.outcome === 'PASS' ? (
                        <CheckCircle2 className="w-5 h-5 text-green-500 mt-0.5" />
                      ) : (
                        <XCircle className="w-5 h-5 text-red-500 mt-0.5" />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="flex justify-between">
                          <p className="text-sm font-semibold">{rule.ruleName}</p>
                          <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${rule.isHardStop ? 'bg-red-100 text-red-700' : 'bg-orange-100 text-orange-700'}`}>
                            {rule.isHardStop ? 'HARD STOP' : 'SOFT STOP'}
                          </span>
                        </div>
                        <p className="text-xs text-muted-foreground line-clamp-1">{rule.message}</p>
                        {rule.actualValue && (
                          <p className="text-[10px] mt-1 bg-slate-100 inline-block px-1 rounded">Actual: {rule.actualValue}</p>
                        )}
                      </div>
                    </div>
                  ))}
                  {(!decision.ruleResults || decision.ruleResults.length === 0) && (
                    <div className="p-4 text-center text-sm text-muted-foreground">
                      No rules were triggered for this application.
                    </div>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Right Column: Underwriting Action */}
        <div className="space-y-6">
          <Card className="border-primary/20 shadow-lg">
            <CardHeader className="bg-primary/5">
              <CardTitle className="text-base">Underwriting Action</CardTitle>
              <CardDescription>Final credit decision</CardDescription>
            </CardHeader>
            <CardContent className="p-5 space-y-4">
              <div className="space-y-3">
                <div>
                  <label className="text-xs font-semibold text-muted-foreground mb-1 block">Decision Remarks *</label>
                  <textarea 
                    className="input min-h-[100px] resize-none text-sm"
                    placeholder="Provide justification for approval or rejection..."
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                  />
                </div>

                <div className="space-y-3 pt-2">
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground mb-1 block">Approved Amount</label>
                    <div className="relative">
                      <span className="absolute left-3 top-2.5 text-muted-foreground text-sm">₹</span>
                      <Input 
                        type="number" 
                        className="pl-7" 
                        value={overrideAmount}
                        onChange={(e) => setOverrideAmount(Number(e.target.value))}
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-xs font-semibold text-muted-foreground mb-1 block">Approved Tenure (Months)</label>
                    <Input 
                      type="number" 
                      value={overrideTenure}
                      onChange={(e) => setOverrideTenure(Number(e.target.value))}
                    />
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-4">
                <Button 
                  variant="outline" 
                  className="border-red-200 text-red-600 hover:bg-red-50"
                  onClick={() => handleDecision('REJECT')}
                  disabled={mutation.isPending}
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Reject
                </Button>
                <Button 
                  className="bg-green-600 hover:bg-green-700"
                  onClick={() => handleDecision('APPROVE')}
                  disabled={mutation.isPending}
                >
                  <CheckCircle2 className="w-4 h-4 mr-2" />
                  Approve
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Audit & Context</CardTitle>
            </CardHeader>
            <CardContent className="text-xs space-y-3">
              <div className="flex items-center gap-2">
                <Info className="w-3.5 h-3.5 text-blue-500" />
                <span>Automated Decision: <span className="font-semibold text-blue-600">{decision?.decision || 'N/A'}</span></span>
              </div>
              <div className="flex items-center gap-2">
                <AlertCircle className="w-3.5 h-3.5 text-orange-500" />
                <span>Rejection Reason: {decision?.rejectionReason || 'None'}</span>
              </div>
              <div className="pt-2 border-t text-muted-foreground">
                Last modified {timeAgo(application?.updatedAt)}
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}
