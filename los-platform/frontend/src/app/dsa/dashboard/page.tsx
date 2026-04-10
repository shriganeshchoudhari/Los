'use client';
import React, { useEffect, useState } from 'react';
import { useDSAAuth } from '@/lib/dsa-auth';
import { dsaDashboardApi } from '@/services/dsa-api';
import { DSADashboard } from '@/types/dsa';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import {
  TrendingUp, TrendingDown, Users, FileText, CreditCard,
  CheckCircle2, XCircle, Clock, IndianRupee, ArrowUpRight,
} from 'lucide-react';

function StatCard({
  title, value, sub, icon: Icon, color, trend
}: {
  title: string; value: string | number; sub?: string;
  icon: React.ElementType; color: string; trend?: { value: number; label: string };
}) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground font-medium">{title}</p>
            <p className="text-3xl font-bold mt-1">{value}</p>
            {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
            {trend && (
              <div className={`flex items-center gap-1 mt-2 text-xs font-medium ${trend.value >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {trend.value >= 0 ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {Math.abs(trend.value)}% {trend.label}
              </div>
            )}
          </div>
          <div className={`w-11 h-11 rounded-xl flex items-center justify-center ${color}`}>
            <Icon className="w-5 h-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function formatCurrency(n: number) {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)} L`;
  return `₹${n.toLocaleString('en-IN')}`;
}

export default function DSADashboardPage() {
  const { partnerName } = useDSAAuth();
  const [data, setData] = useState<DSADashboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dsaDashboardApi.get()
      .then((r) => setData(r.data))
      .catch(() => null)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-gray-200 rounded w-64" />
          <div className="grid grid-cols-4 gap-4">
            {[1, 2, 3, 4].map((i) => <div key={i} className="h-32 bg-gray-200 rounded-lg" />)}
          </div>
        </div>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        <p>Unable to load dashboard. Please try again later.</p>
      </div>
    );
  }

  const conversionColor = data.conversionRate >= 60 ? 'text-green-600' : data.conversionRate >= 30 ? 'text-yellow-600' : 'text-red-600';

  return (
    <div id="main-content" className="p-8 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Welcome back, {partnerName}</h1>
        <p className="text-muted-foreground mt-0.5">
          Here&apos;s your performance overview for {new Date().toLocaleString('en-IN', { month: 'long', year: 'numeric' })}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          title="Total Applications"
          value={data.totalApplications}
          icon={FileText}
          color="bg-blue-100 text-blue-700"
          sub={`${data.submittedApplications} in progress`}
        />
        <StatCard
          title="Disbursements"
          value={data.disbursedApplications}
          icon={CheckCircle2}
          color="bg-green-100 text-green-700"
          sub={`₹${(data.totalDisbursedAmount / 100000).toFixed(1)}L total disbursed`}
        />
        <StatCard
          title="Rejected"
          value={data.rejectedApplications}
          icon={XCircle}
          color="bg-red-50 text-red-600"
          sub="Applications not approved"
        />
        <StatCard
          title="Commission Earned"
          value={formatCurrency(data.totalCommissionEarned)}
          icon={IndianRupee}
          color="bg-amber-100 text-amber-700"
          sub={`${formatCurrency(data.pendingCommission)} pending`}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="w-4 h-4" />
              Monthly Trend (Last 6 Months)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {data.monthlyTrend && data.monthlyTrend.length > 0 ? (
              <div className="space-y-3">
                {data.monthlyTrend.map((m) => {
                  const maxApps = Math.max(...data.monthlyTrend!.map((t) => t.applications), 1);
                  const maxDisb = Math.max(...data.monthlyTrend!.map((t) => t.disbursed), 1);
                  return (
                    <div key={m.month} className="grid grid-cols-[80px_1fr] gap-3 items-center">
                      <span className="text-xs text-muted-foreground font-medium">
                        {new Date(m.month + '-01').toLocaleString('en-IN', { month: 'short', year: '2-digit' })}
                      </span>
                      <div className="flex gap-3">
                        <div className="flex-1">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-muted-foreground">Applications</span>
                            <span className="font-semibold">{m.applications}</span>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-blue-500 rounded-full transition-all"
                              style={{ width: `${(m.applications / maxApps) * 100}%` }}
                            />
                          </div>
                        </div>
                        <div className="flex-1">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="text-muted-foreground">Disbursed</span>
                            <span className="font-semibold">{m.disbursed}</span>
                          </div>
                          <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                            <div
                              className="h-full bg-green-500 rounded-full transition-all"
                              style={{ width: `${(m.disbursed / maxDisb) * 100}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm py-4 text-center">No data available yet. Start submitting applications!</p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Key Metrics
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm text-muted-foreground">Conversion Rate</p>
                <p className={`text-lg font-bold ${conversionColor}`}>{data.conversionRate.toFixed(1)}%</p>
              </div>
              <ArrowUpRight className={`w-5 h-5 ${conversionColor}`} />
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm text-muted-foreground">Disbursement Rate</p>
                <p className="text-lg font-bold text-green-600">{data.disbursementRate.toFixed(1)}%</p>
              </div>
              <ArrowUpRight className="w-5 h-5 text-green-600" />
            </div>
            <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
              <div>
                <p className="text-sm text-muted-foreground">Commission Paid</p>
                <p className="text-lg font-bold">{formatCurrency(data.totalCommissionPaid)}</p>
              </div>
              <CreditCard className="w-5 h-5 text-muted-foreground" />
            </div>
          </CardContent>
        </Card>
      </div>

      {data.officerStats && data.officerStats.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base flex items-center gap-2">
              <Users className="w-4 h-4" />
              Officer Performance
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b">
                    <th className="text-left py-2 px-3 font-medium text-muted-foreground">Officer</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">Applications</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">Disbursements</th>
                    <th className="text-right py-2 px-3 font-medium text-muted-foreground">Conversion</th>
                  </tr>
                </thead>
                <tbody>
                  {data.officerStats.map((o) => (
                    <tr key={o.officerId} className="border-b last:border-0">
                      <td className="py-2.5 px-3 font-medium">{o.officerName}</td>
                      <td className="py-2.5 px-3 text-right">{o.applications}</td>
                      <td className="py-2.5 px-3 text-right">{o.disbursements}</td>
                      <td className="py-2.5 px-3 text-right">
                        <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                          o.applications > 0 && o.disbursements / o.applications >= 0.5
                            ? 'bg-green-100 text-green-700'
                            : 'bg-yellow-100 text-yellow-700'
                        }`}>
                          {o.applications > 0 ? ((o.disbursements / o.applications) * 100).toFixed(0) : 0}%
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
