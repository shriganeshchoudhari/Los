'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { dsaApplicationApi } from '@/services/dsa-api';
import { LOAN_PRODUCTS } from '@/types/dsa';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ArrowLeft, Loader2, CheckCircle2, Info } from 'lucide-react';
import currency from 'currency.js';

const TENURE_OPTIONS = [6, 12, 18, 24, 30, 36, 48, 60, 72, 84, 120];

export default function DSANewApplicationPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [createdApp, setCreatedApp] = useState<{ id: string; applicationNumber: string } | null>(null);
  const [form, setForm] = useState({
    customerName: '',
    customerMobile: '',
    customerPan: '',
    loanType: 'PL',
    requestedAmount: '',
    requestedTenureMonths: 36,
    purpose: '',
    remarks: '',
  });

  const update = (field: string, value: string | number) => setForm((f) => ({ ...f, [field]: value }));

  const selectedProduct = LOAN_PRODUCTS.find((p) => p.code === form.loanType);
  const minAmt = selectedProduct?.minAmount || 50000;
  const maxAmt = selectedProduct?.maxAmount || 50000000;
  const maxTenure = selectedProduct?.maxTenure || 60;

  const validate = () => {
    if (!form.customerName.trim() || form.customerName.trim().length < 2) {
      toast.error('Please enter a valid customer name');
      return false;
    }
    if (!/^[6-9]\d{9}$/.test(form.customerMobile)) {
      toast.error('Invalid mobile number (10 digits)');
      return false;
    }
    if (form.customerPan && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(form.customerPan)) {
      toast.error('Invalid PAN format (optional field)');
      return false;
    }
    const amt = parseInt(form.requestedAmount.replace(/,/g, ''), 10);
    if (!amt || amt < minAmt) {
      toast.error(`Minimum loan amount is ₹${(minAmt / 100000).toFixed(1)}L`);
      return false;
    }
    if (amt > maxAmt) {
      toast.error(`Maximum loan amount is ₹${(maxAmt / 100000).toFixed(1)}L`);
      return false;
    }
    if (form.requestedTenureMonths > maxTenure) {
      toast.error(`Maximum tenure for this product is ${maxTenure} months`);
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setLoading(true);
    try {
      const amt = parseInt(form.requestedAmount.replace(/,/g, ''), 10);
      const res = await dsaApplicationApi.create({
        customerName: form.customerName.trim(),
        customerMobile: form.customerMobile,
        customerPan: form.customerPan?.toUpperCase() || undefined,
        loanType: form.loanType,
        requestedAmount: amt,
        requestedTenureMonths: form.requestedTenureMonths,
        purpose: form.purpose || undefined,
        remarks: form.remarks || undefined,
      });
      setCreatedApp({ id: res.data.id, applicationNumber: res.data.applicationNumber });
      setStep(3);
      toast.success('Application created! Customer will receive an SMS.');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Failed to create application. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  if (step === 3 && createdApp) {
    return (
      <div className="p-8 max-w-xl mx-auto">
        <Card>
          <CardContent className="pt-8 pb-8 text-center">
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-2xl font-bold mb-2">Application Created!</h2>
            <p className="text-muted-foreground mb-6">
              Application <span className="font-mono font-semibold">{createdApp.applicationNumber}</span> has been submitted successfully.
            </p>
            <div className="bg-blue-50 rounded-lg p-3 mb-6 text-sm text-blue-800 text-left flex gap-2">
              <Info className="w-4 h-4 mt-0.5 flex-shrink-0" />
              <p>Customer has been notified via SMS with login credentials. They can now complete KYC and document upload through the LOS Bank portal.</p>
            </div>
            <div className="flex gap-3 justify-center">
              <Button variant="outline" onClick={() => { setStep(1); setForm(f => ({ ...f, customerName: '', customerMobile: '', customerPan: '', requestedAmount: '', remarks: '' })); setCreatedApp(null); }}>
                Create Another
              </Button>
              <Button onClick={() => router.push('/dsa/applications')}>
                View All Applications
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-8 max-w-2xl mx-auto space-y-6">
      <div>
        <Link href="/dsa/applications" className="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground mb-3">
          <ArrowLeft className="w-4 h-4" /> Back to Applications
        </Link>
        <h1 className="text-2xl font-bold">New Application</h1>
        <p className="text-muted-foreground mt-0.5">Capture a new customer lead and submit to LOS Bank</p>
      </div>

      <div className="flex gap-1.5">
        {[1, 2].map((s) => (
          <div key={s} className={`h-1.5 flex-1 rounded-full ${s <= step ? 'bg-primary' : 'bg-gray-200'}`} />
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {step === 1 ? 'Customer Details' : 'Loan Details'}
          </CardTitle>
          <CardDescription>
            {step === 1 ? 'Enter the customer\'s basic information' : 'Select loan product and amount'}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {step === 1 ? (
            <>
              <div>
                <label className="label mb-1.5 block text-sm font-medium">Customer Full Name *</label>
                <Input
                  placeholder="e.g. Priya Patel"
                  value={form.customerName}
                  onChange={(e) => update('customerName', e.target.value)}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label mb-1.5 block text-sm font-medium">Mobile Number *</label>
                  <div className="flex">
                    <div className="flex items-center px-3 border border-r-0 rounded-l-md bg-muted text-sm font-medium">+91</div>
                    <Input
                      placeholder="9876543210"
                      value={form.customerMobile}
                      onChange={(e) => update('customerMobile', e.target.value.replace(/\D/g, ''))}
                      maxLength={10}
                      className="rounded-l-none"
                    />
                  </div>
                </div>
                <div>
                  <label className="label mb-1.5 block text-sm font-medium">PAN (optional)</label>
                  <Input
                    placeholder="ABCDE1234F"
                    value={form.customerPan}
                    onChange={(e) => update('customerPan', e.target.value.toUpperCase())}
                    maxLength={10}
                    className="uppercase font-mono"
                  />
                </div>
              </div>
              <Button onClick={() => {
                if (!form.customerName.trim()) { toast.error('Customer name is required'); return; }
                if (!/^[6-9]\d{9}$/.test(form.customerMobile)) { toast.error('Valid mobile number is required'); return; }
                setStep(2);
              }} className="w-full" size="lg">
                Continue →
              </Button>
            </>
          ) : (
            <>
              <div>
                <label className="label mb-1.5 block text-sm font-medium">Loan Product *</label>
                <select
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                  value={form.loanType}
                  onChange={(e) => {
                    update('loanType', e.target.value);
                    const p = LOAN_PRODUCTS.find((x) => x.code === e.target.value);
                    if (p) update('requestedAmount', String(p.minAmount));
                  }}
                >
                  {LOAN_PRODUCTS.map((p) => (
                    <option key={p.code} value={p.code}>
                      {p.label} (₹{(p.minAmount / 100000).toFixed(0)}L - ₹{(p.maxAmount / 100000).toFixed(0)}L)
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="label mb-1.5 block text-sm font-medium">
                    Loan Amount (₹) *
                    <span className="text-muted-foreground font-normal ml-1">
                      Min: ₹{(minAmt / 100000).toFixed(0)}L, Max: ₹{(maxAmt / 100000).toFixed(0)}L
                    </span>
                  </label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    placeholder="500000"
                    value={form.requestedAmount}
                    onChange={(e) => {
                      const v = e.target.value.replace(/[^0-9]/g, '');
                      update('requestedAmount', v ? parseInt(v, 10).toLocaleString('en-IN') : '');
                    }}
                    className="font-mono"
                  />
                </div>
                <div>
                  <label className="label mb-1.5 block text-sm font-medium">Tenure (months) *</label>
                  <select
                    className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    value={form.requestedTenureMonths}
                    onChange={(e) => update('requestedTenureMonths', parseInt(e.target.value, 10))}
                  >
                    {TENURE_OPTIONS.filter((t) => t <= maxTenure).map((t) => (
                      <option key={t} value={t}>{t} months</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="label mb-1.5 block text-sm font-medium">Purpose (optional)</label>
                <Input
                  placeholder="e.g. Home renovation, debt consolidation"
                  value={form.purpose}
                  onChange={(e) => update('purpose', e.target.value)}
                />
              </div>

              <div>
                <label className="label mb-1.5 block text-sm font-medium">Remarks (optional)</label>
                <textarea
                  className="flex w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 min-h-[80px]"
                  placeholder="Any additional notes about this lead..."
                  value={form.remarks}
                  onChange={(e) => update('remarks', e.target.value)}
                />
              </div>

              <div className="flex gap-3">
                <Button variant="outline" onClick={() => setStep(1)} className="flex-1" size="lg">
                  ← Back
                </Button>
                <Button onClick={handleSubmit} disabled={loading} className="flex-1" size="lg">
                  {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Submitting...</> : 'Submit Application'}
                </Button>
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
