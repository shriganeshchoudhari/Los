'use client';
import React, { useEffect, useState } from 'react';
import { dsaCommissionApi } from '@/services/dsa-api';
import { CommissionSummary, CommissionDetail, APPLICATION_STATUS_COLORS } from '@/types/dsa';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, RefreshCw, IndianRupee, Building2, Clock, CheckCircle2 } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

function formatCurrency(n: number) {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)} L`;
  return `₹${n.toLocaleString('en-IN')}`;
}

function StatCard({ title, value, sub, icon: Icon, color }: {
  title: string; value: string; sub?: string; icon: React.ElementType; color: string;
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
          </div>
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${color}`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function DSACommissionsPage() {
  const [summary, setSummary] = useState<CommissionSummary | null>(null);
  const [history, setHistory] = useState<CommissionDetail[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const pageSize = 15;

  useEffect(() => {
    Promise.all([
      dsaCommissionApi.summary(),
      dsaCommissionApi.history({ page, size: pageSize }),
    ])
      .then(([s, h]) => {
        setSummary(s.data);
        setHistory(h.data.data);
        setTotal(h.data.total);
      })
      .finally(() => setLoading(false));
  }, [page]);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!summary) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Unable to load commission data.
      </div>
    );
  }

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Commissions</h1>
          <p className="text-muted-foreground mt-0.5">Track your earnings and payout history</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Last Payout</p>
          <p className="font-semibold">
            {summary.lastPayoutDate
              ? formatDistanceToNow(new Date(summary.lastPayoutDate), { addSuffix: true })
              : 'No payouts yet'}
          </p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <StatCard
          title="Total Earned"
          value={formatCurrency(summary.totalEarned)}
          icon={IndianRupee}
          color="bg-blue-100 text-blue-700"
        />
        <StatCard
          title="Total TDS Deducted"
          value={formatCurrency(summary.totalTDS)}
          icon={Building2}
          color="bg-red-50 text-red-600"
          sub="10% on gross"
        />
        <StatCard
          title="Total GST"
          value={formatCurrency(summary.totalGST)}
          icon={Building2}
          color="bg-amber-50 text-amber-600"
          sub="18% on commission"
        />
        <StatCard
          title="Pending Payout"
          value={formatCurrency(summary.pendingPayout)}
          icon={Clock}
          color="bg-yellow-100 text-yellow-700"
          sub={summary.lastPayoutAmount > 0 ? `Last: ${formatCurrency(summary.lastPayoutAmount)}` : undefined}
        />
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center justify-between">
            <span>Payout History</span>
            <span className="text-sm font-normal text-muted-foreground">{total} records</span>
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {history.length === 0 ? (
            <div className="py-12 text-center text-muted-foreground text-sm">
              No commission records yet. Commissions are generated when loans are disbursed.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b bg-gray-50">
                    {['Application', 'Loan Type', 'Disbursed Amount', 'Commission', 'GST', 'TDS', 'Net Payable', 'Status', 'Date'].map((h) => (
                      <th key={h} className="text-left py-2.5 px-4 font-medium text-muted-foreground">{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {history.map((c) => (
                    <tr key={c.id} className="border-b last:border-0 hover:bg-gray-50">
                      <td className="py-2.5 px-4 font-mono text-xs">{c.applicationId.slice(0, 8)}...</td>
                      <td className="py-2.5 px-4">{c.loanType}</td>
                      <td className="py-2.5 px-4 text-right font-mono">{formatCurrency(c.disbursedAmount)}</td>
                      <td className="py-2.5 px-4 text-right font-mono text-green-700">{formatCurrency(c.commissionAmount)}</td>
                      <td className="py-2.5 px-4 text-right font-mono text-amber-700">{formatCurrency(c.gstAmount)}</td>
                      <td className="py-2.5 px-4 text-right font-mono text-red-600">{formatCurrency(c.tdsAmount)}</td>
                      <td className="py-2.5 px-4 text-right font-mono font-semibold">{formatCurrency(c.netPayable)}</td>
                      <td className="py-2.5 px-4">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${c.status === 'PAID' ? 'bg-green-100 text-green-700' : 'bg-yellow-100 text-yellow-700'}`}>
                          {c.status}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-muted-foreground text-xs">
                        {new Date(c.disbursementDate).toLocaleDateString('en-IN')}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      {total > pageSize && (
        <div className="flex items-center justify-center gap-3">
          <button
            className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-50"
            disabled={page === 0}
            onClick={() => setPage((p) => p - 1)}
          >
            Previous
          </button>
          <span className="text-sm text-muted-foreground">Page {page + 1} of {Math.ceil(total / pageSize)}</span>
          <button
            className="px-3 py-1.5 text-sm border rounded-lg disabled:opacity-50"
            disabled={(page + 1) * pageSize >= total}
            onClick={() => setPage((p) => p + 1)}
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
}
