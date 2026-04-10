'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { dsaApplicationApi } from '@/services/dsa-api';
import { DSAApplication, APPLICATION_STATUS_COLORS, LOAN_PRODUCTS } from '@/types/dsa';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Plus, Search, Filter, ArrowUpRight, Clock, CheckCircle2,
  XCircle, Loader2, FileText, ChevronRight, RefreshCw
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

const STATUS_FILTERS = [
  { value: '', label: 'All' },
  { value: 'SUBMITTED', label: 'Submitted' },
  { value: 'UNDER_PROCESSING', label: 'Under Processing' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'DISBURSED', label: 'Disbursed' },
  { value: 'REJECTED', label: 'Rejected' },
];

function StatusBadge({ status }: { status: string }) {
  const color = APPLICATION_STATUS_COLORS[status] || 'bg-gray-100 text-gray-700';
  const label = status.replace(/_/g, ' ');
  return <span className={`px-2 py-0.5 rounded text-xs font-medium capitalize ${color}`}>{label.toLowerCase()}</span>;
}

export default function DSAApplicationsPage() {
  const router = useRouter();
  const [apps, setApps] = useState<DSAApplication[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(0);
  const pageSize = 20;

  const fetchApps = (resetPage = false) => {
    setLoading(true);
    const currentPage = resetPage ? 0 : page;
    if (resetPage) setPage(0);
    dsaApplicationApi.list({ status: statusFilter || undefined, page: currentPage, size: pageSize })
      .then((r) => {
        setApps(r.data.data);
        setTotal(r.data.total);
      })
      .catch(() => toast.error('Failed to load applications'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchApps(); }, [statusFilter, page]);

  const filtered = apps.filter((a) =>
    !search ||
    a.applicationNumber?.toLowerCase().includes(search.toLowerCase()) ||
    a.customerName?.toLowerCase().includes(search.toLowerCase()) ||
    a.customerMobile?.includes(search)
  );

  const getProductLabel = (code: string) => LOAN_PRODUCTS.find((p) => p.code === code)?.label || code;

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Applications</h1>
          <p className="text-muted-foreground mt-0.5">{total} total applications</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => fetchApps(true)} className="gap-2">
            <RefreshCw className="w-4 h-4" />
            Refresh
          </Button>
          <Button onClick={() => router.push('/dsa/applications/new')} className="gap-2">
            <Plus className="w-4 h-4" />
            New Application
          </Button>
        </div>
      </div>

      <div className="flex gap-3 items-center flex-wrap">
        <div className="relative flex-1 min-w-[240px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
          <Input
            placeholder="Search by name, mobile, or application number..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-1 p-1 bg-gray-100 rounded-lg">
          {STATUS_FILTERS.map((f) => (
            <button
              key={f.value}
              onClick={() => { setStatusFilter(f.value); setPage(0); }}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                statusFilter === f.value ? 'bg-white shadow-sm text-primary' : 'text-muted-foreground'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <FileText className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground font-medium">No applications found</p>
            <p className="text-sm text-muted-foreground mt-1">
              {search ? 'Try adjusting your search or filters' : 'Start by creating your first application'}
            </p>
            <Button onClick={() => router.push('/dsa/applications/new')} className="mt-4 gap-2">
              <Plus className="w-4 h-4" />
              New Application
            </Button>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardContent className="p-0">
            <div className="divide-y">
              {filtered.map((app) => (
                <div
                  key={app.id}
                  className="flex items-center gap-4 p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                  onClick={() => router.push(`/dsa/applications/${app.id}`)}
                >
                  <div className="w-10 h-10 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0">
                    <FileText className="w-5 h-5 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold text-sm">{app.customerName}</p>
                      <StatusBadge status={app.status} />
                    </div>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {app.applicationNumber} · {getProductLabel(app.loanType)} · {app.customerMobile.slice(-4).padStart(10, 'X')}
                    </p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-semibold">₹{(app.requestedAmount / 100000).toFixed(1)}L</p>
                    <p className="text-xs text-muted-foreground">{app.requestedTenureMonths} months</p>
                  </div>
                  <div className="text-right flex-shrink-0 hidden md:block">
                    <p className="text-xs text-muted-foreground">
                      {formatDistanceToNow(new Date(app.createdAt), { addSuffix: true })}
                    </p>
                  </div>
                  <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {total > pageSize && (
        <div className="flex items-center justify-center gap-2">
          <Button variant="outline" size="sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)}>
            Previous
          </Button>
          <span className="text-sm text-muted-foreground">
            Page {page + 1} of {Math.ceil(total / pageSize)}
          </span>
          <Button variant="outline" size="sm" disabled={(page + 1) * pageSize >= total} onClick={() => setPage((p) => p + 1)}>
            Next
          </Button>
        </div>
      )}
    </div>
  );
}
