'use client';
import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { dsaApplicationApi } from '@/services/dsa-api';
import { DSAApplication, APPLICATION_STATUS_COLORS, LOAN_PRODUCTS } from '@/types/dsa';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Loader2, FileText, Phone, CreditCard, Clock, ExternalLink } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

function StatusBadge({ status }: { status: string }) {
  const color = APPLICATION_STATUS_COLORS[status] || 'bg-gray-100 text-gray-700';
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold capitalize ${color}`}>
      {status.replace(/_/g, ' ').toLowerCase()}
    </span>
  );
}

const STATUS_FLOW = [
  'SUBMITTED', 'UNDER_PROCESSING', 'KYC_IN_PROGRESS', 'KYC_COMPLETE',
  'DOCUMENT_COLLECTION', 'CREDIT_ASSESSMENT', 'APPROVED', 'DISBURSEMENT_IN_PROGRESS', 'DISBURSED'
];
const TERMINAL = ['DISBURSED', 'REJECTED', 'WITHDRAWN', 'CANCELLED'];

export default function DSAApplicationDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [app, setApp] = useState<DSAApplication | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    dsaApplicationApi.get(id)
      .then((r) => setApp(r.data))
      .catch(() => toast.error('Application not found'))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!app) {
    return (
      <div className="p-8 text-center">
        <p className="text-muted-foreground">Application not found.</p>
        <Button variant="outline" onClick={() => router.push('/dsa/applications')} className="mt-4">
          Back to Applications
        </Button>
      </div>
    );
  }

  const product = LOAN_PRODUCTS.find((p) => p.code === app.loanType);
  const currentStep = STATUS_FLOW.indexOf(app.status);
  const isTerminal = TERMINAL.includes(app.status);

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <Link href="/dsa/applications" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3">
          <ArrowLeft className="w-4 h-4" /> Back to Applications
        </Link>
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold">{app.customerName}</h1>
              <StatusBadge status={app.status} />
            </div>
            <p className="text-muted-foreground font-mono text-sm mt-1">{app.applicationNumber}</p>
          </div>
          <div className="text-right">
            <p className="text-2xl font-bold">₹{(app.requestedAmount / 100000).toFixed(1)}L</p>
            <p className="text-sm text-muted-foreground">{app.requestedTenureMonths} months</p>
          </div>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Application Progress</CardTitle>
        </CardHeader>
        <CardContent>
          {isTerminal ? (
            <div className={`p-4 rounded-lg text-center font-medium ${
              app.status === 'DISBURSED' ? 'bg-green-50 text-green-700' :
              app.status === 'REJECTED' ? 'bg-red-50 text-red-700' :
              'bg-gray-50 text-gray-600'
            }`}>
              Application has {app.status === 'DISBURSED' ? 'been disbursed' : app.status === 'REJECTED' ? 'been rejected' : 'ended'}
            </div>
          ) : (
            <div className="space-y-3">
              {STATUS_FLOW.slice(0, -2).map((s, i) => {
                const isDone = i < currentStep;
                const isCurrent = i === currentStep;
                return (
                  <div key={s} className="flex items-center gap-3">
                    <div className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                      isDone ? 'bg-green-500 text-white' : isCurrent ? 'bg-primary text-white animate-pulse' : 'bg-gray-200 text-gray-400'
                    }`}>
                      {isDone ? '✓' : i + 1}
                    </div>
                    <div className={`flex-1 text-sm ${isCurrent ? 'font-semibold' : isDone ? 'text-green-700' : 'text-muted-foreground'}`}>
                      {s.replace(/_/g, ' ')}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardHeader><CardTitle className="text-base">Customer Details</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2">
              <Phone className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm">+91 {app.customerMobile}</span>
            </div>
            {app.customerPan && (
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-mono">{app.customerPan}</span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm text-muted-foreground">
                Submitted {formatDistanceToNow(new Date(app.createdAt), { addSuffix: true })}
              </span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle className="text-base">Loan Details</CardTitle></CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2">
              <CreditCard className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm">{product?.label || app.loanType}</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Amount:</span>
              <span className="text-sm font-semibold">₹{(app.requestedAmount / 100000).toFixed(1)}L</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Tenure:</span>
              <span className="text-sm font-semibold">{app.requestedTenureMonths} months</span>
            </div>
            {app.remarks && (
              <div className="pt-2 border-t mt-2">
                <p className="text-xs text-muted-foreground mb-1">Remarks</p>
                <p className="text-sm">{app.remarks}</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
