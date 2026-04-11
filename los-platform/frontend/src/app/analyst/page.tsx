'use client';
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/components';
import { formatCurrency } from '@/lib/utils';
import { loanApi, bureauApi, documentApi } from '@/lib/api';

export default function CreditAnalystPage() {
  const [activeTab, setActiveTab] = useState<'UNDERWRITING' | 'DOCUMENTS' | 'BUREAU'>('UNDERWRITING');
  const [applications, setApplications] = useState<any[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [bureauReports, setBureauReports] = useState<any[]>([]);
  const [bureauLoading, setBureauLoading] = useState(false);
  const [documents, setDocuments] = useState<any[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);

  const selected = applications.find(a => a.id === selectedId);

  useEffect(() => {
    setLoading(true);
    loanApi.list({ status: 'CREDIT_ASSESSMENT', limit: 50 })
      .then(res => {
        setApplications(res.data?.content || res.data?.data || res.data || []);
        if (!selectedId && (res.data?.content?.length || res.data?.data?.length || 0) > 0) {
          const first = res.data?.content?.[0] || res.data?.data?.[0];
          if (first) setSelectedId(first.id);
        }
      })
      .catch(() => setApplications([]))
      .finally(() => setLoading(false));
  }, [selectedId]);

  const fetchBureauReports = useCallback(async (applicationId: string) => {
    setBureauLoading(true);
    try {
      const res = await bureauApi.getReports(applicationId);
      setBureauReports(res.data?.reports || res.data || []);
    } catch {
      setBureauReports([]);
    } finally {
      setBureauLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId && activeTab === 'BUREAU') {
      fetchBureauReports(selectedId);
    }
  }, [selectedId, activeTab, fetchBureauReports]);

  const fetchDocuments = useCallback(async (applicationId: string) => {
    setDocsLoading(true);
    try {
      const res = await documentApi.list(applicationId);
      setDocuments(res.data?.documents || res.data?.data || res.data || []);
    } catch {
      setDocuments([]);
    } finally {
      setDocsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId && activeTab === 'DOCUMENTS') {
      fetchDocuments(selectedId);
    }
  }, [selectedId, activeTab, fetchDocuments]);

  const foir = selected
    ? Math.round(((selected.existingEMI || 0) / (selected.grossMonthlyIncome || 1)) * 100)
    : 0;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b sticky top-0 z-20">
        <div className="container py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center text-white font-bold">₹</div>
              <div>
                <h1 className="font-bold leading-none">LOS Bank</h1>
                <p className="text-xs text-muted-foreground">Credit Analyst Portal</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main id="main-content" className="container py-6 space-y-6">
        <div>
          <h2 className="text-xl font-bold">Underwriting Worklist</h2>
          <p className="text-sm text-muted-foreground">Review application details, bureau data, and provide underwriting recommendation</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-12 text-muted-foreground">Loading applications...</div>
        ) : applications.length === 0 ? (
          <Card><CardContent className="py-12 text-center text-muted-foreground">No applications pending credit assessment.</CardContent></Card>
        ) : (
          <>
            <div className="flex gap-1 bg-muted p-1 rounded-lg w-fit flex-wrap" role="tablist" aria-label="Analysis tabs">
              {(['UNDERWRITING', 'DOCUMENTS', 'BUREAU'] as const).map(tab => (
                <button
                  key={tab}
                  id={`tab-${tab.toLowerCase()}`}
                  role="tab"
                  aria-selected={activeTab === tab}
                  aria-controls={`panel-${tab.toLowerCase()}`}
                  onClick={() => setActiveTab(tab)}
                  className={`px-4 py-1.5 text-sm rounded-md transition-colors ${activeTab === tab ? 'bg-white shadow-sm font-medium' : 'hover:bg-white/50'}`}
                >
                  {tab.charAt(0) + tab.slice(1).toLowerCase()}
                </button>
              ))}
            </div>

            <div className="flex gap-4 overflow-x-auto pb-2">
              {applications.map(app => (
                <button
                  key={app.id}
                  onClick={() => setSelectedId(app.id)}
                  className={`flex-shrink-0 p-3 rounded-lg border text-left min-w-[200px] transition-all ${selectedId === app.id ? 'border-primary bg-primary/5 ring-1 ring-primary' : 'hover:border-muted-foreground/30'}`}
                >
                  <p className="font-mono font-semibold text-xs">{app.applicationNumber || app.applicationId || app.id}</p>
                  <p className="text-sm font-medium truncate">{app.applicantName || app.customerName || app.applicant?.fullName}</p>
                  <p className="text-xs text-muted-foreground">{app.loanType?.replace(/_/g, ' ')}</p>
                  <p className="text-sm font-bold mt-1">{formatCurrency(app.requestedAmount || app.loanAmount)}</p>
                </button>
              ))}
            </div>

            {selected && (
              <div className="grid lg:grid-cols-3 gap-6">
                <div className="lg:col-span-2 space-y-4">
                  {activeTab === 'UNDERWRITING' && (
                    <div role="tabpanel" id="panel-underwriting" aria-labelledby="tab-underwriting">
                      <Card>
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <CardTitle className="text-base">Application Details</CardTitle>
                            <StatusBadge status={selected.status || 'CREDIT_ASSESSMENT'} />
                          </div>
                        </CardHeader>
                        <CardContent>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                            <div>
                              <p className="text-xs text-muted-foreground">Application No.</p>
                              <p className="font-mono font-semibold">{selected.applicationNumber || selected.id}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Applicant</p>
                              <p className="font-semibold">{selected.applicantName || selected.customerName || '—'}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Loan Type</p>
                              <p className="font-medium text-sm">{(selected.loanType || '').replace(/_/g, ' ')}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Requested</p>
                              <p className="font-bold">{formatCurrency(selected.requestedAmount || selected.loanAmount)}</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Gross Income</p>
                              <p className="font-semibold">{formatCurrency(selected.grossMonthlyIncome)}/mo</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Existing EMI</p>
                              <p className="font-semibold">{formatCurrency(selected.existingEMI || 0)}/mo</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">FOIR</p>
                              <p className={`font-bold ${foir > 50 ? 'text-red-600' : 'text-green-600'}`}>{foir}%</p>
                            </div>
                            <div>
                              <p className="text-xs text-muted-foreground">Tenure</p>
                              <p className="font-semibold">{selected.tenureMonths || selected.tenure} months</p>
                            </div>
                          </div>
                        </CardContent>
                      </Card>

                      <Card>
                        <CardHeader>
                          <CardTitle className="text-base">Credit Bureau Analysis</CardTitle>
                        </CardHeader>
                        <CardContent>
                          {bureauReports.length > 0 ? (
                            <div className="space-y-4">
                              {bureauReports.map((report: any, i: number) => (
                                <div key={i} className="border rounded-lg p-4">
                                  <div className="flex items-center justify-between mb-2">
                                    <span className="font-semibold text-sm">{report.provider || report.bureau}</span>
                                    <span className="text-xs bg-blue-100 text-blue-800 px-2 py-0.5 rounded">
                                      Score: {report.score || report.cibilScore || 'N/A'}
                                    </span>
                                  </div>
                                  <div className="grid grid-cols-3 gap-2 text-xs">
                                    <div><span className="text-muted-foreground">Active Accounts: </span>{report.activeAccounts || 0}</div>
                                    <div><span className="text-muted-foreground">Max DPD: </span>{report.maxDpd || report.dpd || 0}</div>
                                    <div><span className="text-muted-foreground">Enquiries 30D: </span>{report.enquiries30d || 0}</div>
                                  </div>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <p className="text-sm text-muted-foreground text-center py-4">
                              No bureau reports available.{' '}
                              <button
                                className="text-primary underline"
                                onClick={() => fetchBureauReports(selected.id)}
                              >
                                Pull reports
                              </button>
                            </p>
                          )}
                        </CardContent>
                      </Card>
                    </div>
                  )}

                  {activeTab === 'DOCUMENTS' && (
                    <div role="tabpanel" id="panel-documents" aria-labelledby="tab-documents">
                      {docsLoading ? (
                        <div className="text-center py-8 text-sm text-muted-foreground">Loading documents...</div>
                      ) : selectedId ? (
                        <Card>
                          <CardHeader>
                            <CardTitle className="text-base">Document Checklist</CardTitle>
                          </CardHeader>
                          <CardContent>
                            {documents.length === 0 ? (
                              <p className="text-sm text-muted-foreground text-center py-4">No documents found for this application.</p>
                            ) : (
                              <div className="space-y-3">
                                {documents.map((doc: any) => (
                                  <div key={doc.id} className="flex items-center justify-between border rounded-lg px-4 py-3">
                                    <div className="flex items-center gap-3">
                                      <div className={`w-2 h-2 rounded-full ${doc.status === 'APPROVED' ? 'bg-green-500' : doc.status === 'REJECTED' ? 'bg-red-500' : 'bg-yellow-500'}`} />
                                      <div>
                                        <p className="font-medium text-sm">{doc.documentType || doc.type}</p>
                                        <p className="text-xs text-muted-foreground">{doc.fileName || doc.name || '—'}</p>
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <StatusBadge status={doc.status || 'PENDING'} />
                                      {doc.uploadedAt && (
                                        <span className="text-xs text-muted-foreground">{new Date(doc.uploadedAt).toLocaleDateString('en-IN')}</span>
                                      )}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </CardContent>
                        </Card>
                      ) : (
                        <div className="text-center py-8 text-sm text-muted-foreground">Select an application to view documents.</div>
                      )}
                    </div>
                  )}

                  {activeTab === 'BUREAU' && (
                    <div role="tabpanel" id="panel-bureau" aria-labelledby="tab-bureau">
                      <Card>
                        <CardHeader>
                        <div className="flex items-center justify-between">
                          <CardTitle className="text-base">Bureau Reports</CardTitle>
                          <button
                            className="btn btn-secondary text-xs"
                            onClick={() => selectedId && fetchBureauReports(selectedId)}
                          >
                            {bureauLoading ? 'Pulling...' : 'Pull Reports'}
                          </button>
                        </div>
                      </CardHeader>
                      <CardContent>
                        {bureauLoading ? (
                          <p className="text-center text-muted-foreground py-8">Loading bureau data...</p>
                        ) : bureauReports.length > 0 ? (
                          <div className="space-y-4">
                            {bureauReports.map((report: any, i: number) => (
                              <div key={i} className="border rounded-lg p-4">
                                <div className="flex justify-between items-center mb-3">
                                  <span className="font-semibold">{report.provider || report.bureau}</span>
                                  <span className={`text-xl font-bold ${(report.score || 0) >= 700 ? 'text-green-600' : (report.score || 0) >= 600 ? 'text-yellow-600' : 'text-red-600'}`}>
                                    {report.score || report.cibilScore || 'N/A'}
                                  </span>
                                </div>
                                <div className="grid grid-cols-2 gap-2 text-xs">
                                  <div>Active Accounts: <b>{report.activeAccounts || 0}</b></div>
                                  <div>Max DPD: <b>{report.maxDpd || 0}</b></div>
                                  <div>Enquiries 30D: <b>{report.enquiries30d || 0}</b></div>
                                  <div>Enquiries 90D: <b>{report.enquiries90d || 0}</b></div>
                                  <div>Write-offs: <b className={report.writeoffs > 0 ? 'text-red-600' : ''}>{report.writeoffs || 0}</b></div>
                                  <div>Suit Filed: <b>{report.suitFiled ? 'Yes' : 'No'}</b></div>
                                </div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <p className="text-sm text-muted-foreground text-center py-8">No bureau reports yet.</p>
                        )}
                      </CardContent>
                    </Card>
                  </div>
                )}
                </div>

                <div className="space-y-4">
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base">Recommendation</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div className={`p-3 rounded-lg text-center font-semibold ${selected.analystRecommendation === 'APPROVE' ? 'bg-green-50 text-green-700' : 'bg-yellow-50 text-yellow-700'}`}>
                        {(selected.analystRecommendation || 'PENDING').replace(/_/g, ' ')}
                      </div>
                      <textarea
                        className="input resize-none text-sm"
                        rows={4}
                        placeholder="Enter underwriting notes..."
                        defaultValue={selected.analystNotes || selected.notes}
                      />
                      <div className="grid grid-cols-2 gap-2">
                        <button className="px-4 py-2 bg-green-600 text-white rounded-lg text-sm font-medium hover:bg-green-700">
                          Recommend Approve
                        </button>
                        <button className="px-4 py-2 bg-red-600 text-white rounded-lg text-sm font-medium hover:bg-red-700">
                          Recommend Reject
                        </button>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
}
