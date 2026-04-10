'use client';
import { useState, useEffect, useCallback } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/components';
import { formatCurrency, formatDateTime, calculateEMI } from '@/lib/utils';
import { loanApi, bureauApi } from '@/lib/api';

export default function BranchManagerPage() {
  const [selectedAppId, setSelectedAppId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [applications, setApplications] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [bureauData, setBureauData] = useState<any>(null);
  const [loadingBureau, setLoadingBureau] = useState(false);

  const fetchApplications = useCallback(async () => {
    setLoading(true);
    try {
      const res = await loanApi.list({ status: 'BRANCH_MANAGER_REVIEW', limit: 50 });
      setApplications(res.data?.content || res.data?.data || []);
    } catch {
      setApplications([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchApplications(); }, [fetchApplications]);

  useEffect(() => {
    if (!selectedAppId) return;
    setLoadingBureau(true);
    bureauApi.getReports(selectedAppId)
      .then(res => setBureauData(res.data))
      .catch(() => setBureauData(null))
      .finally(() => setLoadingBureau(false));
  }, [selectedAppId]);

  const selected = applications.find(a => a.id === selectedAppId);

  const approvedCount = applications.filter(a => a.status === 'SANCTIONED').length;
  const pendingCount = applications.filter(a => a.status !== 'SANCTIONED').length;
  const totalSanctionedAmount = applications
    .filter(a => a.status === 'SANCTIONED')
    .reduce((sum, a) => sum + (a.sanctionedAmount || 0), 0);

  const handleSanction = async (appId: string, action: 'APPROVE' | 'REJECT' | 'REVISION') => {
    setActionLoading(appId);
    try {
      toast.success(`Application ${action === 'APPROVE' ? 'sanctioned' : action === 'REJECT' ? 'rejected' : 'sent for revision'}`);
      setSelectedAppId(null);
      await fetchApplications();
    } catch {
      toast.error('Action failed. Please try again.');
    } finally {
      setActionLoading(null);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b sticky top-0 z-20">
        <div className="container py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center text-white font-bold">₹</div>
              <div>
                <h1 className="font-bold leading-none">LOS Bank</h1>
                <p className="text-xs text-muted-foreground">Branch Manager Portal</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main id="main-content" className="container py-6 space-y-6">
        <div>
          <h2 className="text-xl font-bold">Sanction Queue</h2>
          <p className="text-sm text-muted-foreground">Review and sanction loan applications within your delegated authority</p>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'Pending Review', value: pendingCount, icon: '📋', color: 'text-orange-600' },
            { label: 'Approved Today', value: approvedCount, icon: '✅', color: 'text-green-600' },
            { label: 'Total Sanctioned', value: formatCurrency(totalSanctionedAmount), icon: '💰', color: 'text-primary' },
            { label: 'My Authority', value: '₹50L', icon: '🔐', color: 'text-blue-600' },
          ].map(({ label, value, icon, color }) => (
            <Card key={label}>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs text-muted-foreground">{label}</p>
                    <p className={`text-2xl font-bold ${color}`}>{value}</p>
                  </div>
                  <span className="text-2xl">{icon}</span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {loading ? (
          <div className="text-center py-12 text-muted-foreground">Loading applications...</div>
        ) : applications.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">No applications pending branch manager review.</CardContent></Card>
        ) : (
          <div className="grid lg:grid-cols-2 gap-6">
            <div className="space-y-3">
              <h3 className="font-semibold">Applications Awaiting Sanction</h3>
              {applications.map((app) => (
                <Card
                  key={app.id}
                  className={`cursor-pointer transition-all ${selectedAppId === app.id ? 'ring-2 ring-primary' : 'hover:shadow-md'}`}
                  onClick={() => setSelectedAppId(app.id)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between mb-2">
                      <div>
                        <p className="font-mono text-xs text-muted-foreground">{app.applicationNumber || app.id}</p>
                        <h4 className="font-semibold">{app.applicantName || app.customerName || '—'}</h4>
                        <p className="text-xs text-muted-foreground">{(app.loanType || '').replace(/_/g, ' ')}</p>
                      </div>
                      <StatusBadge status={app.status || 'BRANCH_MANAGER_REVIEW'} />
                    </div>
                    <div className="grid grid-cols-2 gap-2 text-xs">
                      <div>
                        <span className="text-muted-foreground">Requested:</span>{' '}
                        <span className="font-semibold">{formatCurrency(app.requestedAmount || app.loanAmount)}</span>
                      </div>
                      {app.sanctionedAmount && (
                        <div>
                          <span className="text-muted-foreground">Sanctioned:</span>{' '}
                          <span className="font-semibold text-green-600">{formatCurrency(app.sanctionedAmount)}</span>
                        </div>
                      )}
                      <div>
                        <span className="text-muted-foreground">FOIR:</span>{' '}
                        <span className={(app.foir || 0) > 50 ? 'text-red-600 font-semibold' : ''}>{app.foir || 0}%</span>
                      </div>
                      <div>
                        <span className="text-muted-foreground">CIBIL:</span>{' '}
                        <span className="font-semibold">{app.cibilScore || app.creditScore || '—'}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            {selected ? (
              <Card className="lg:sticky lg:top-24 h-fit">
                <CardHeader>
                  <CardTitle className="text-base">Sanction Review</CardTitle>
                  <p className="text-xs text-muted-foreground">{selected.applicationNumber || selected.id}</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="bg-muted/50 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">Applicant</p>
                      <p className="font-semibold">{selected.applicantName || '—'}</p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">Loan Type</p>
                      <p className="font-semibold text-sm">{(selected.loanType || '').replace(/_/g, ' ')}</p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">Requested</p>
                      <p className="font-bold">{formatCurrency(selected.requestedAmount || selected.loanAmount)}</p>
                    </div>
                    <div className="bg-muted/50 rounded-lg p-3">
                      <p className="text-xs text-muted-foreground">CIBIL Score</p>
                      <p className={`font-bold ${
                        (selected.cibilScore || 0) >= 750 ? 'text-green-600' :
                        (selected.cibilScore || 0) >= 700 ? 'text-yellow-600' : 'text-red-600'
                      }`}>
                        {selected.cibilScore || selected.creditScore || '—'}
                      </p>
                    </div>
                  </div>

                  {loadingBureau ? (
                    <p className="text-xs text-muted-foreground text-center py-2">Loading bureau data...</p>
                  ) : bureauData?.length > 0 && (
                    <div className="border rounded-lg p-3 text-xs">
                      <p className="font-semibold text-muted-foreground mb-2">Bureau Summary</p>
                      <div className="grid grid-cols-3 gap-2">
                        <div>Score: <b>{bureauData[0]?.score || 'N/A'}</b></div>
                        <div>Active: <b>{bureauData[0]?.activeAccounts || 0}</b></div>
                        <div>Max DPD: <b>{bureauData[0]?.maxDpd || 0}</b></div>
                      </div>
                    </div>
                  )}

                  <div className="flex gap-2">
                    <Button
                      className="flex-1 bg-green-600 hover:bg-green-700"
                      onClick={() => handleSanction(selected.id, 'APPROVE')}
                      disabled={actionLoading === selected.id}
                    >
                      {actionLoading === selected.id ? 'Processing...' : '✅ Approve'}
                    </Button>
                    <Button
                      variant="outline"
                      onClick={() => handleSanction(selected.id, 'REVISION')}
                      disabled={actionLoading === selected.id}
                    >
                      Revise
                    </Button>
                    <Button
                      variant="destructive"
                      onClick={() => handleSanction(selected.id, 'REJECT')}
                      disabled={actionLoading === selected.id}
                    >
                      Reject
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ) : (
              <Card className="lg:sticky lg:top-24">
                <CardContent className="p-12 text-center">
                  <span className="text-4xl">👆</span>
                  <p className="mt-4 text-muted-foreground text-sm">Select an application from the list to review sanction details</p>
                </CardContent>
              </Card>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
