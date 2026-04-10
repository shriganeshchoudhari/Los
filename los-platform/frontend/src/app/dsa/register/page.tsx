'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Building2, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { dsaAuthApi } from '@/services/dsa-api';
import { DSAPartnerType } from '@/types/dsa';

const PARTNER_TYPES: { value: DSAPartnerType; label: string }[] = [
  { value: 'INDIVIDUAL', label: 'Individual' },
  { value: 'SOLE_PROPRIETORSHIP', label: 'Sole Proprietorship' },
  { value: 'PARTNERSHIP', label: 'Partnership Firm' },
  { value: 'PRIVATE_LIMITED', label: 'Private Limited Company' },
  { value: 'PUBLIC_LIMITED', label: 'Public Limited Company' },
  { value: 'NBFC', label: 'NBFC' },
];

const STATES = ['MH', 'DL', 'KA', 'TN', 'GJ', 'UP', 'RJ', 'WB', 'AP', 'TG', 'KL', 'PB', 'HR', 'BR', 'OR', 'CG', 'MP', 'JK', 'NE', 'UT'];

export default function DSARegisterPage() {
  const router = useRouter();
  const [step, setStep] = useState(1);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState({
    partnerName: '',
    partnerType: '' as DSAPartnerType | '',
    pan: '',
    gstin: '',
    registeredAddress: '',
    city: '',
    state: '',
    pincode: '',
    contactName: '',
    contactMobile: '',
    contactEmail: '',
    primaryBankAccount: '',
    primaryIfsc: '',
    bankAccountHolder: '',
  });

  const update = (field: string, value: string) => setForm((f) => ({ ...f, [field]: value }));

  const validateStep1 = () => {
    const required: (keyof typeof form)[] = ['partnerName', 'partnerType', 'pan', 'registeredAddress', 'city', 'state', 'pincode'];
    for (const k of required) {
      if (!form[k as keyof typeof form]) {
        toast.error(`Please fill in ${k.replace(/([A-Z])/g, ' $1').trim()}`);
        return false;
      }
    }
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(form.pan)) {
      toast.error('Invalid PAN format (e.g., AABCF1234F)');
      return false;
    }
    if (!/^\d{6}$/.test(form.pincode)) {
      toast.error('Invalid pincode (6 digits)');
      return false;
    }
    return true;
  };

  const validateStep2 = () => {
    const required: (keyof typeof form)[] = ['contactName', 'contactMobile', 'contactEmail', 'primaryBankAccount', 'primaryIfsc', 'bankAccountHolder'];
    for (const k of required) {
      if (!form[k as keyof typeof form]) {
        toast.error(`Please fill in ${k.replace(/([A-Z])/g, ' $1').trim()}`);
        return false;
      }
    }
    if (!/^[6-9]\d{9}$/.test(form.contactMobile)) {
      toast.error('Invalid mobile number');
      return false;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.contactEmail)) {
      toast.error('Invalid email address');
      return false;
    }
    if (!/^[A-Z]{4}0[A-Z0-9]{6}$/.test(form.primaryIfsc)) {
      toast.error('Invalid IFSC code (e.g., SBIN0001234)');
      return false;
    }
    if (form.gstin && !/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/.test(form.gstin)) {
      toast.error('Invalid GSTIN format');
      return false;
    }
    return true;
  };

  const handleSubmit = async () => {
    if (!validateStep2()) return;
    setLoading(true);
    try {
      const res = await dsaAuthApi.register({
        partnerName: form.partnerName,
        partnerType: form.partnerType as DSAPartnerType,
        pan: form.pan.toUpperCase(),
        gstin: form.gstin?.toUpperCase() || undefined,
        registeredAddress: form.registeredAddress,
        city: form.city,
        state: form.state,
        pincode: form.pincode,
        contactName: form.contactName,
        contactMobile: form.contactMobile,
        contactEmail: form.contactEmail,
        primaryBankAccount: form.primaryBankAccount,
        primaryIfsc: form.primaryIfsc.toUpperCase(),
        bankAccountHolder: form.bankAccountHolder,
      });
      toast.success('Registration submitted! We will review your application within 2-3 business days.');
      router.push('/dsa/login');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Registration failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 bg-[#003366] text-white flex-col justify-between p-12">
        <div>
          <div className="flex items-center gap-3 mb-12">
            <div className="w-12 h-12 bg-white/10 rounded-lg flex items-center justify-center">
              <Building2 className="w-7 h-7" />
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">LOS Bank</h1>
              <p className="text-sm text-blue-200">DSA Partner Portal</p>
            </div>
          </div>
          <h2 className="text-4xl font-bold leading-tight mb-4">
            Become a LOS Bank<br />Distribution Partner
          </h2>
          <p className="text-blue-200 text-lg mb-8">
            Join India's fastest growing loan origination network. Competitive commissions, digital tools, and dedicated support.
          </p>
          <div className="space-y-3">
            {[
              '✓ Partner onboarding in 2-3 business days',
              '✓ Commission up to 1.5% upfront + 0.5% trail',
              '✓ Dedicated relationship manager',
              '✓ Real-time application tracking dashboard',
              '✓ Multiple loan products (PL, BL, HL, LAP & more)',
              '✓ Secure API-backed platform',
            ].map((item) => (
              <p key={item} className="text-blue-200 text-sm">{item}</p>
            ))}
          </div>
        </div>
        <div className="text-sm text-blue-200">
          <p>Regulated by RBI • Data stored in India • 256-bit encryption</p>
        </div>
      </div>

      <div className="flex-1 overflow-auto p-8 bg-gray-50">
        <div className="max-w-2xl mx-auto">
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-2">
              <Link href="/dsa/login" className="text-muted-foreground hover:text-foreground text-sm">← Back to login</Link>
            </div>
            <h2 className="text-2xl font-bold">Partner Registration</h2>
            <p className="text-muted-foreground text-sm mt-1">Step {step} of 2 — {step === 1 ? 'Business Details' : 'Contact & Banking Details'}</p>
          </div>

          <div className="flex gap-1.5 mb-6">
            {[1, 2].map((s) => (
              <div key={s} className={`h-1.5 flex-1 rounded-full ${s <= step ? 'bg-primary' : 'bg-gray-200'}`} />
            ))}
          </div>

          <Card>
            <CardContent className="pt-6">
              {step === 1 ? (
                <div className="space-y-4">
                  <div>
                    <label className="label mb-1.5 block text-sm font-medium">Business Name *</label>
                    <Input
                      placeholder="e.g. ABC Financial Advisors Pvt Ltd"
                      value={form.partnerName}
                      onChange={(e) => update('partnerName', e.target.value)}
                    />
                  </div>

                  <div>
                    <label className="label mb-1.5 block text-sm font-medium">Business Type *</label>
                    <select
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                      value={form.partnerType}
                      onChange={(e) => update('partnerType', e.target.value)}
                    >
                      <option value="">Select business type</option>
                      {PARTNER_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label mb-1.5 block text-sm font-medium">PAN Number *</label>
                      <Input
                        placeholder="AABCF1234F"
                        value={form.pan}
                        onChange={(e) => update('pan', e.target.value.toUpperCase())}
                        maxLength={10}
                        className="uppercase font-mono"
                      />
                    </div>
                    <div>
                      <label className="label mb-1.5 block text-sm font-medium">GSTIN (optional)</label>
                      <Input
                        placeholder="27AABCF1234F1ZB"
                        value={form.gstin}
                        onChange={(e) => update('gstin', e.target.value.toUpperCase())}
                        maxLength={15}
                        className="uppercase font-mono"
                      />
                    </div>
                  </div>

                  <div>
                    <label className="label mb-1.5 block text-sm font-medium">Registered Address *</label>
                    <Input
                      placeholder="123 Main Road, Andheri West, Mumbai - 400053"
                      value={form.registeredAddress}
                      onChange={(e) => update('registeredAddress', e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="label mb-1.5 block text-sm font-medium">City *</label>
                      <Input
                        placeholder="Mumbai"
                        value={form.city}
                        onChange={(e) => update('city', e.target.value)}
                      />
                    </div>
                    <div>
                      <label className="label mb-1.5 block text-sm font-medium">State *</label>
                      <select
                        className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                        value={form.state}
                        onChange={(e) => update('state', e.target.value)}
                      >
                        <option value="">Select</option>
                        {STATES.map((s) => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                    <div>
                      <label className="label mb-1.5 block text-sm font-medium">Pincode *</label>
                      <Input
                        placeholder="400053"
                        value={form.pincode}
                        onChange={(e) => update('pincode', e.target.value.replace(/\D/g, ''))}
                        maxLength={6}
                      />
                    </div>
                  </div>

                  <Button onClick={() => validateStep1() && setStep(2)} className="w-full" size="lg">
                    Continue →
                  </Button>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <label className="label mb-1.5 block text-sm font-medium">Contact Person Name *</label>
                    <Input
                      placeholder="Rajesh Kumar"
                      value={form.contactName}
                      onChange={(e) => update('contactName', e.target.value)}
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label mb-1.5 block text-sm font-medium">Mobile Number *</label>
                      <div className="flex">
                        <div className="flex items-center px-3 border border-r-0 rounded-l-md bg-muted text-sm font-medium">+91</div>
                        <Input
                          placeholder="9876543210"
                          value={form.contactMobile}
                          onChange={(e) => update('contactMobile', e.target.value.replace(/\D/g, ''))}
                          maxLength={10}
                          className="rounded-l-none"
                        />
                      </div>
                    </div>
                    <div>
                      <label className="label mb-1.5 block text-sm font-medium">Email *</label>
                      <Input
                        type="email"
                        placeholder="rajesh@finadvisors.com"
                        value={form.contactEmail}
                        onChange={(e) => update('contactEmail', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="border-t pt-4">
                    <p className="text-sm font-semibold mb-3">Bank Account Details</p>
                    <div className="grid grid-cols-3 gap-4">
                      <div className="col-span-2">
                        <label className="label mb-1.5 block text-sm font-medium">Account Number *</label>
                        <Input
                          placeholder="1234567890"
                          value={form.primaryBankAccount}
                          onChange={(e) => update('primaryBankAccount', e.target.value.replace(/\D/g, ''))}
                        />
                      </div>
                      <div>
                        <label className="label mb-1.5 block text-sm font-medium">IFSC Code *</label>
                        <Input
                          placeholder="SBIN0001234"
                          value={form.primaryIfsc}
                          onChange={(e) => update('primaryIfsc', e.target.value.toUpperCase())}
                          maxLength={11}
                          className="uppercase font-mono"
                        />
                      </div>
                    </div>
                    <div className="mt-4">
                      <label className="label mb-1.5 block text-sm font-medium">Account Holder Name *</label>
                      <Input
                        placeholder="ABC Financial Advisors Pvt Ltd"
                        value={form.bankAccountHolder}
                        onChange={(e) => update('bankAccountHolder', e.target.value)}
                      />
                    </div>
                  </div>

                  <div className="flex gap-3">
                    <Button variant="outline" onClick={() => setStep(1)} className="flex-1" size="lg">
                      ← Back
                    </Button>
                    <Button onClick={handleSubmit} disabled={loading} className="flex-1" size="lg">
                      {loading ? 'Submitting...' : 'Submit Application'}
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <p className="text-center text-xs text-muted-foreground mt-4">
            By submitting, you agree to our <span className="underline cursor-pointer">Partner Agreement</span> and <span className="underline cursor-pointer">Privacy Policy</span>
          </p>
        </div>
      </div>
    </div>
  );
}
