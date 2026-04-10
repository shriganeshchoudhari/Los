'use client';
import React, { useEffect, useState } from 'react';
import { useDSAAuth } from '@/lib/dsa-auth';
import { dsaProfileApi } from '@/services/dsa-api';
import { DSAPartnerProfile, LOAN_PRODUCTS } from '@/types/dsa';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, Building2, MapPin, Phone, Mail, CreditCard, Calendar, Shield } from 'lucide-react';

function formatCurrency(n: number) {
  if (n >= 10000000) return `₹${(n / 10000000).toFixed(2)} Cr`;
  if (n >= 100000) return `₹${(n / 100000).toFixed(2)} L`;
  return `₹${n.toLocaleString('en-IN')}`;
}

function InfoRow({ icon: Icon, label, value }: { icon: React.ElementType; label: string; value: string | number | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex items-center gap-3 py-2">
      <Icon className="w-4 h-4 text-muted-foreground flex-shrink-0" />
      <span className="text-sm text-muted-foreground w-36">{label}</span>
      <span className="text-sm font-medium">{String(value)}</span>
    </div>
  );
}

export default function DSAProfilePage() {
  const { partnerCode, partnerName, role } = useDSAAuth();
  const [profile, setProfile] = useState<DSAPartnerProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    dsaProfileApi.get()
      .then((r) => setProfile(r.data))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-primary" />
      </div>
    );
  }

  if (!profile) {
    return <div className="p-8 text-center text-muted-foreground">Unable to load profile.</div>;
  }

  const allowedProducts = profile.allowedProducts || [];
  const allowedProductLabels = allowedProducts.map((c) => LOAN_PRODUCTS.find((p) => p.code === c)?.label || c).join(', ');

  return (
    <div className="p-8 max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Partner Profile</h1>
        <p className="text-muted-foreground mt-0.5">Your DSA partnership details</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Building2 className="w-4 h-4" />
                Business Details
              </CardTitle>
            </CardHeader>
            <CardContent className="divide-y">
              <InfoRow icon={Building2} label="Business Name" value={profile.partnerName} />
              <InfoRow icon={Shield} label="Partner Code" value={profile.partnerCode} />
              <InfoRow icon={Shield} label="Business Type" value={profile.partnerType.replace(/_/g, ' ')} />
              <InfoRow icon={MapPin} label="City" value={`${profile.city}, ${profile.state}`} />
              <InfoRow icon={MapPin} label="Territories" value={profile.territoryCodes?.join(', ')} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Phone className="w-4 h-4" />
                Contact Information
              </CardTitle>
            </CardHeader>
            <CardContent className="divide-y">
              <InfoRow icon={Mail} label="Email" value={profile.contactEmail} />
              <InfoRow icon={Phone} label="Mobile" value={`+91 ${profile.contactMobile.slice(-4).padStart(10, 'X')}`} />
              <InfoRow icon={Building2} label="Contact Person" value={profile.contactName} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <CreditCard className="w-4 h-4" />
                Commission Structure
              </CardTitle>
            </CardHeader>
            <CardContent className="divide-y">
              <InfoRow icon={CreditCard} label="Commission Type" value={profile.commissionType} />
              <InfoRow icon={CreditCard} label="Upfront Rate" value={`${profile.upfrontCommissionBps / 100}%`} />
              <InfoRow icon={CreditCard} label="Trail Rate" value={`${profile.trailCommissionBps / 100}% p.a.`} />
              <InfoRow icon={Shield} label="Allowed Products" value={allowedProductLabels || 'All products'} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardContent className="pt-6">
              <div className="text-center">
                <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-3">
                  <Building2 className="w-8 h-8 text-primary" />
                </div>
                <h3 className="font-bold text-lg">{profile.partnerName}</h3>
                <p className="text-sm text-muted-foreground font-mono">{profile.partnerCode}</p>
                <div className="mt-2 inline-flex items-center gap-1.5">
                  <span className={`w-2 h-2 rounded-full ${profile.status === 'APPROVED' ? 'bg-green-500' : profile.status === 'PENDING_APPROVAL' ? 'bg-yellow-500' : 'bg-gray-400'}`} />
                  <span className="text-xs font-medium capitalize">{profile.status.replace(/_/g, ' ').toLowerCase()}</span>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base">Performance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {[
                { label: 'Total Applications', value: profile.totalApplications },
                { label: 'Disbursements', value: profile.totalDisbursements },
                { label: 'Total Disbursed', value: formatCurrency(profile.totalDisbursedAmount) },
                { label: 'Commission Paid', value: formatCurrency(profile.totalCommissionPaid) },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between items-center py-1.5 border-b last:border-0">
                  <span className="text-sm text-muted-foreground">{label}</span>
                  <span className="font-semibold text-sm">{value}</span>
                </div>
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center gap-2 mb-2">
                <Calendar className="w-4 h-4 text-muted-foreground" />
                <span className="text-sm font-medium">Agreement Period</span>
              </div>
              <p className="text-sm">
                {profile.agreementValidFrom
                  ? `${new Date(profile.agreementValidFrom).toLocaleDateString('en-IN')} — ${profile.agreementValidTo ? new Date(profile.agreementValidTo).toLocaleDateString('en-IN') : 'N/A'}`
                  : 'Agreement not yet signed'
                }
              </p>
              <p className="text-xs text-muted-foreground mt-1">
                Joined {new Date(profile.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })}
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
