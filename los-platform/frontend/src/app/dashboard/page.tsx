'use client';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { ApplicationCard, StatusBadge } from '@/components/ui/components';
import { loanApi } from '@/lib/api';
import { formatCurrency, timeAgo } from '@/lib/utils';
import { useAuth } from '@/lib/use-auth';

type Tab = 'ALL' | 'MY_QUEUE' | 'PENDING_DOCS' | 'PENDING_APPROVAL' | 'SANCTIONED';

const TABS: { key: Tab; label: string; color: string }[] = [
  { key: 'ALL', label: 'All', color: '' },
  { key: 'MY_QUEUE', label: 'My Queue', color: 'bg-blue-500' },
  { key: 'PENDING_DOCS', label: 'Pending Docs', color: 'bg-orange-500' },
  { key: 'PENDING_APPROVAL', label: 'Pending Approval', color: 'bg-purple-500' },
  { key: 'SANCTIONED', label: 'Sanctioned', color: 'bg-green-500' },
];

export default function DashboardPage() {
  const router = useRouter();
  const { logout } = useAuth();
  const [activeTab, setActiveTab] = useState<Tab>('ALL');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [profile, setProfile] = useState<{ fullName?: string; role?: string; branchName?: string } | null>(null);

  useEffect(() => {
    import('@/lib/api').then(({ authApi }) => {
      authApi.getProfile()
        .then(res => setProfile(res.data?.data ?? res.data))
        .catch(() => {});
    });
  }, []);

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['applications', activeTab, page, search],
    queryFn: async () => {
      const params: Record<string, unknown> = { page, limit: 20 };
      if (activeTab === 'PENDING_DOCS') params.status = 'DOCUMENT_COLLECTION';
      if (activeTab === 'PENDING_APPROVAL') params.status = 'CREDIT_ASSESSMENT';
      if (activeTab === 'SANCTIONED') params.status = 'SANCTIONED';
      if (search) params.search = search;
      const { data: res } = await loanApi.list(params);
      return res;
    },
    refetchInterval: 30_000,
  });

  const applications = data?.applications || [];
  const total = data?.total || 0;

  const stats = {
    total,
    inProgress: applications.filter((a: any) => ['SUBMITTED', 'KYC_COMPLETE', 'DOCUMENT_COLLECTION', 'CREDIT_ASSESSMENT'].includes(a.status as string)).length,
    approved: applications.filter((a: any) => ['SANCTIONED', 'DISBURSED'].includes(a.status as string)).length,
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b sticky top-0 z-20">
        <div className="container">
          <div className="flex items-center justify-between py-4">
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-2">
                <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center text-white font-bold">₹</div>
                <div>
                  <h1 className="font-bold leading-none">LOS Bank</h1>
                  <p className="text-xs text-muted-foreground">Loan Origination System</p>
                </div>
              </div>
              <div className="border-l pl-4 hidden md:block">
                <p className="text-xs text-muted-foreground">Branch</p>
                <p className="font-semibold text-sm">{profile?.branchName ?? '—'}</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="hidden sm:block text-right">
                <p className="text-sm font-medium">{profile?.fullName ?? 'Loading...'}</p>
                <p className="text-xs text-muted-foreground">{profile?.role ? profile.role.replace(/_/g, ' ') : '—'}</p>
              </div>
              <div className="w-9 h-9 bg-primary/10 rounded-full flex items-center justify-center text-primary font-bold text-sm">
                {profile?.fullName ? profile.fullName.split(' ').map((n: string) => n[0]).join('').toUpperCase() : '??'}
              </div>
              <Button variant="ghost" size="sm" onClick={logout}>Logout</Button>
            </div>
          </div>
        </div>
      </header>

      <main id="main-content" className="container py-6 space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl font-bold">Worklist</h2>
            <p className="text-sm text-muted-foreground">{total || applications.length} applications</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={() => router.push('/')}>
              + New Application
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Total</p>
                  <p className="text-2xl font-bold">{stats.total}</p>
                </div>
                <span className="text-2xl">📋</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">In Progress</p>
                  <p className="text-2xl font-bold text-blue-600">{stats.inProgress}</p>
                </div>
                <span className="text-2xl">⏳</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Approved</p>
                  <p className="text-2xl font-bold text-green-600">{stats.approved}</p>
                </div>
                <span className="text-2xl">✅</span>
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-xs text-muted-foreground">Avg TAT</p>
                  <p className="text-2xl font-bold">4.2d</p>
                </div>
                <span className="text-2xl">⚡</span>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <div className="flex gap-1 flex-wrap" role="tablist" aria-label="Application filters">
                {TABS.map(tab => (
                  <button
                    key={tab.key}
                    role="tab"
                    aria-selected={activeTab === tab.key}
                    aria-controls="application-list"
                    onClick={() => setActiveTab(tab.key)}
                    className={`px-3 py-1.5 text-sm rounded-md transition-colors ${activeTab === tab.key ? 'bg-primary text-white' : 'hover:bg-muted'}`}
                  >
                    {tab.label}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <Input
                  placeholder="Search..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-32 sm:w-64"
                />
                <Button variant="outline" size="icon" onClick={() => refetch()}>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                  </svg>
                </Button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="space-y-3">
                {[1, 2, 3].map(i => <div key={i} className="h-24 bg-gray-100 rounded-lg animate-pulse" />)}
              </div>
            ) : applications.length === 0 ? (
              <div className="text-center py-12">
                <span className="text-4xl">📭</span>
                <p className="mt-2 text-muted-foreground">No applications found</p>
              </div>
            ) : (
              <div id="application-list" role="tabpanel" aria-label="Application results" className="space-y-3">
                {applications.map((app: any) => (
                  <div
                    key={app.id}
                    className="flex items-center gap-4 p-4 bg-white border rounded-lg hover:shadow-md transition-shadow cursor-pointer"
                    onClick={() => router.push(`/application/${app.id}`)}
                  >
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="font-mono text-xs text-muted-foreground">{app.applicationNumber}</span>
                        <StatusBadge status={app.status} />
                      </div>
                      <h4 className="font-semibold truncate">{app.applicantName}</h4>
                      <p className="text-xs text-muted-foreground">
                        {(app.loanType || '').replace(/_/g, ' ')} • {timeAgo(app.updatedAt)}
                      </p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-sm font-semibold">{formatCurrency(app.requestedAmount)}</p>
                    </div>
                    <ChevronRight className="w-5 h-5 text-muted-foreground flex-shrink-0" />
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

function ChevronRight(props: any) {
  return (
    <svg {...props} fill="none" viewBox="0 0 24 24" stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}
