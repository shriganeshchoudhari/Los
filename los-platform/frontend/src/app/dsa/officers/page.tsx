'use client';
import React, { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { dsaOfficerApi } from '@/services/dsa-api';
import { DSAOfficer, LOAN_PRODUCTS } from '@/types/dsa';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Loader2, Plus, Users, UserCircle, Mail, Phone, Briefcase } from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

function AddOfficerModal({ open, onClose, onSuccess }: { open: boolean; onClose: () => void; onSuccess: () => void }) {
  const [form, setForm] = useState({ fullName: '', mobile: '', email: '', designation: '', department: '' });
  const [loading, setLoading] = useState(false);
  const update = (k: string, v: string) => setForm((f) => ({ ...f, [k]: v }));

  const handle = async () => {
    if (!form.fullName || !form.mobile || !form.email || !form.designation) {
      toast.error('Please fill in all required fields');
      return;
    }
    if (!/^[6-9]\d{9}$/.test(form.mobile)) { toast.error('Invalid mobile'); return; }
    setLoading(true);
    try {
      await dsaOfficerApi.create(form);
      toast.success(`Officer ${form.fullName} created. SMS with credentials sent.`);
      onSuccess();
      onClose();
      setForm({ fullName: '', mobile: '', email: '', designation: '', department: '' });
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Failed to create officer');
    } finally {
      setLoading(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
      <Card className="w-full max-w-md mx-4">
        <CardHeader>
          <CardTitle className="text-lg">Add New Officer</CardTitle>
          <CardDescription>Create officer account. Default password will be sent via SMS.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label className="label mb-1 block text-sm font-medium">Full Name *</label>
            <Input placeholder="John DSouza" value={form.fullName} onChange={(e) => update('fullName', e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label mb-1 block text-sm font-medium">Mobile *</label>
              <div className="flex">
                <div className="flex items-center px-2 border border-r-0 rounded-l-md bg-muted text-sm">+91</div>
                <Input placeholder="9876543210" value={form.mobile} onChange={(e) => update('mobile', e.target.value.replace(/\D/g, ''))} maxLength={10} className="rounded-l-none" />
              </div>
            </div>
            <div>
              <label className="label mb-1 block text-sm font-medium">Designation *</label>
              <Input placeholder="Relationship Manager" value={form.designation} onChange={(e) => update('designation', e.target.value)} />
            </div>
          </div>
          <div>
            <label className="label mb-1 block text-sm font-medium">Email *</label>
            <Input type="email" placeholder="john@finadvisors.com" value={form.email} onChange={(e) => update('email', e.target.value)} />
          </div>
          <div>
            <label className="label mb-1 block text-sm font-medium">Department</label>
            <Input placeholder="Sales" value={form.department} onChange={(e) => update('department', e.target.value)} />
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="outline" onClick={onClose} className="flex-1">Cancel</Button>
            <Button onClick={handle} disabled={loading} className="flex-1">
              {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />Creating...</> : 'Create Officer'}
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

export default function DSAOfficersPage() {
  const [officers, setOfficers] = useState<DSAOfficer[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const fetchOfficers = () => {
    dsaOfficerApi.list()
      .then((r) => setOfficers(r.data))
      .catch(() => toast.error('Failed to load officers'))
      .finally(() => setLoading(false));
  };

  useEffect(() => { fetchOfficers(); }, []);

  return (
    <div className="p-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Officers</h1>
          <p className="text-muted-foreground mt-0.5">{officers.length} officer(s) in your team</p>
        </div>
        <Button onClick={() => setShowModal(true)} className="gap-2">
          <Plus className="w-4 h-4" />
          Add Officer
        </Button>
      </div>

      <AddOfficerModal open={showModal} onClose={() => setShowModal(false)} onSuccess={fetchOfficers} />

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 className="w-8 h-8 animate-spin text-primary" />
        </div>
      ) : officers.length === 0 ? (
        <Card>
          <CardContent className="py-16 text-center">
            <Users className="w-12 h-12 mx-auto text-muted-foreground/30 mb-3" />
            <p className="text-muted-foreground font-medium">No officers yet</p>
            <p className="text-sm text-muted-foreground mt-1">Add officers to help manage applications</p>
            <Button onClick={() => setShowModal(true)} className="mt-4 gap-2">
              <Plus className="w-4 h-4" /> Add First Officer
            </Button>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {officers.map((o) => (
            <Card key={o.id}>
              <CardContent className="pt-6">
                <div className="flex items-start gap-4">
                  <div className="w-12 h-12 bg-primary/10 rounded-full flex items-center justify-center flex-shrink-0">
                    <UserCircle className="w-6 h-6 text-primary" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{o.fullName}</p>
                      <span className={`px-2 py-0.5 rounded text-xs font-medium ${
                        o.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-red-50 text-red-600'
                      }`}>
                        {o.status}
                      </span>
                    </div>
                    <p className="text-xs text-muted-foreground font-mono mt-0.5">{o.employeeCode}</p>
                    <div className="mt-2 space-y-1">
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Briefcase className="w-3.5 h-3.5" />
                        {o.designation}{o.department ? ` · ${o.department}` : ''}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Phone className="w-3.5 h-3.5" />
                        +91 {o.mobile.slice(-4).padStart(10, 'X')}
                      </div>
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Mail className="w-3.5 h-3.5" />
                        {o.email}
                      </div>
                    </div>
                    <div className="flex gap-4 mt-3 pt-3 border-t">
                      <div className="text-center">
                        <p className="text-lg font-bold">{o.totalApplications}</p>
                        <p className="text-xs text-muted-foreground">Applications</p>
                      </div>
                      <div className="text-center">
                        <p className="text-lg font-bold">{o.totalDisbursements}</p>
                        <p className="text-xs text-muted-foreground">Disbursements</p>
                      </div>
                      {o.lastLoginAt && (
                        <div className="text-center ml-auto">
                          <p className="text-xs text-muted-foreground">Last login</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDistanceToNow(new Date(o.lastLoginAt), { addSuffix: true })}
                          </p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
