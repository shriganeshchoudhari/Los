'use client';
import { useState, useEffect } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { MoneyInput, ProgressStages, StatusBadge } from '@/components/ui/components';
import { loanApi, kycApi } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

const STEPS = [
  { key: 'PERSONAL', label: 'Personal Details' },
  { key: 'EMPLOYMENT', label: 'Employment' },
  { key: 'LOAN', label: 'Loan Details' },
  { key: 'COAPPLICANTS', label: 'Co-Applicants' },
  { key: 'REVIEW', label: 'Review & Submit' },
];

interface FormData {
  firstName: string;
  lastName: string;
  fatherName: string;
  dob: string;
  gender: 'MALE' | 'FEMALE' | 'TRANSGENDER';
  maritalStatus: 'SINGLE' | 'MARRIED' | 'DIVORCED' | 'WIDOWED';
  email: string;
  mobile: string;
  alternateMobile: string;
  employmentType: string;
  employerName: string;
  designation: string;
  grossMonthlyIncome: number;
  netMonthlyIncome: number;
  totalAnnualIncome: number;
  requestedAmount: number;
  requestedTenureMonths: number;
  purposeDescription: string;
  pincode: string;
  city: string;
  state: string;
  addressLine1: string;
  productType: string;
}

interface CoApplicant {
  name: string;
  relationship: string;
  pan: string;
  aadhaar: string;
  grossMonthlyIncome: number;
}

interface Guarantor {
  name: string;
  relationship: string;
  pan: string;
  aadhaar: string;
  address: string;
}

export default function ApplicationFormPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [currentStep, setCurrentStep] = useState(0);
  const [application, setApplication] = useState<Record<string, unknown>>({});
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [autosaveTimer, setAutosaveTimer] = useState<ReturnType<typeof setTimeout> | null>(null);

  const { register, handleSubmit, setValue, watch, formState: { errors, isDirty } } = useForm<FormData>({
    defaultValues: {
      gender: 'MALE',
      maritalStatus: 'SINGLE',
      requestedTenureMonths: 36,
      employmentType: 'SALARIED_PRIVATE',
    },
  });

  const watchAmount = watch('requestedAmount', 0);
  const watchTenure = watch('requestedTenureMonths', 36);
  const watchIncome = watch('grossMonthlyIncome', 0);
  const watchProductType = watch('productType', '');

  const REQUIRES_COAPPLICANTS = ['HOME_LOAN', 'LOAN_AGAINST_PROPERTY'].includes(watchProductType);

  const [coApplicants, setCoApplicants] = useState<CoApplicant[]>([
    { name: '', relationship: '', pan: '', aadhaar: '', grossMonthlyIncome: 0 },
  ]);
  const [guarantors, setGuarantors] = useState<Guarantor[]>([
    { name: '', relationship: '', pan: '', aadhaar: '', address: '' },
  ]);

  useEffect(() => {
    loadApplication();
  }, [id]);

  const loadApplication = async () => {
    setLoading(true);
    try {
      const { data } = await loanApi.get(id);
      setApplication(data);
    } catch {
      toast.error('Failed to load application');
    } finally {
      setLoading(false);
    }
  };

  const autosave = async (section: string, formData: Partial<FormData>) => {
    if (autosaveTimer) clearTimeout(autosaveTimer);
    const timer = setTimeout(async () => {
      try {
        await loanApi.autosave(id, section, formData);
      } catch {
        // silent autosave failure
      }
    }, 2000);
    setAutosaveTimer(timer);
  };

  const nextStep = () => {
    let next = currentStep + 1;
    while (next < STEPS.length && STEPS[next].key === 'COAPPLICANTS' && !REQUIRES_COAPPLICANTS) {
      next++;
    }
    if (next < STEPS.length) setCurrentStep(next);
  };
  const prevStep = () => {
    let prev = currentStep - 1;
    while (prev >= 0 && STEPS[prev].key === 'COAPPLICANTS' && !REQUIRES_COAPPLICANTS) {
      prev--;
    }
    if (prev >= 0) setCurrentStep(prev);
  };

  const onSubmit = async (data: FormData) => {
    if (currentStep < STEPS.length - 1) {
      nextStep();
      return;
    }
    setSubmitting(true);
    try {
      await loanApi.update(id, {
        section: 'APPLICANT',
        data: {
          firstName: data.firstName,
          lastName: data.lastName,
          fatherName: data.fatherName,
          dob: data.dob,
          gender: data.gender,
          maritalStatus: data.maritalStatus,
          email: data.email,
          mobile: data.mobile,
          alternateMobile: data.alternateMobile,
          addressLine1: data.addressLine1,
          city: data.city,
          state: data.state,
          pincode: data.pincode,
        },
      });
      await loanApi.update(id, {
        section: 'EMPLOYMENT',
        data: {
          employmentType: data.employmentType,
          employerName: data.employerName,
          designation: data.designation,
          grossMonthlyIncome: data.grossMonthlyIncome,
          netMonthlyIncome: data.netMonthlyIncome,
          totalAnnualIncome: data.totalAnnualIncome,
        },
      });
      await loanApi.update(id, {
        section: 'LOAN_REQUIREMENT',
        data: {
          requestedAmount: data.requestedAmount,
          requestedTenureMonths: data.requestedTenureMonths,
          purposeDescription: data.purposeDescription,
          productType: data.productType,
        },
      });

      if (REQUIRES_COAPPLICANTS) {
        await loanApi.update(id, {
          section: 'COAPPLICANTS',
          data: {
            coApplicants: coApplicants.filter(c => c.name.trim()),
            guarantors: guarantors.filter(g => g.name.trim()),
          },
        });
      }

      await loanApi.submit(id);
      toast.success('Application submitted! Proceeding to KYC...');
      router.push(`/application/${id}/kyc`);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Failed to submit application');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return <div className="min-h-screen flex items-center justify-center"><div className="animate-spin w-8 h-8 border-4 border-primary border-t-transparent rounded-full" /></div>;
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="container py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white font-bold text-sm">₹</div>
              <span className="font-bold">LOS Bank</span>
            </div>
            {application.applicationNumber && (
              <div className="border-l pl-4">
                <p className="text-xs text-muted-foreground">Application</p>
                <p className="font-mono text-sm font-semibold">{application.applicationNumber as string}</p>
              </div>
            )}
          </div>
          {application.status && (
            <StatusBadge status={application.status as string} />
          )}
        </div>
      </header>

      <main id="main-content" className="container py-8">
        <div className="max-w-3xl mx-auto">
          <div className="mb-8">
            <ProgressStages
              stages={STEPS}
              currentStage={STEPS[currentStep].key}
              completedStages={STEPS.slice(0, currentStep).map(s => s.key)}
            />
          </div>

          <form onSubmit={handleSubmit(onSubmit)} className="space-y-6">
            {currentStep === 0 && (
              <Card>
                <CardHeader>
                  <CardTitle>Personal Details</CardTitle>
                  <p className="text-sm text-muted-foreground">Enter your personal information as per PAN card</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label mb-1.5 block">First Name *</label>
                      <Input {...register('firstName', { required: 'Required' })} placeholder="Ravi" />
                      {errors.firstName && <p className="text-xs text-red-500 mt-1">{errors.firstName.message}</p>}
                    </div>
                    <div>
                      <label className="label mb-1.5 block">Last Name *</label>
                      <Input {...register('lastName', { required: 'Required' })} placeholder="Sharma" />
                    </div>
                  </div>
                  <div>
                    <label className="label mb-1.5 block">Father's Name</label>
                    <Input {...register('fatherName')} placeholder="Suresh Kumar Sharma" />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label mb-1.5 block">Date of Birth *</label>
                      <Input type="date" {...register('dob', { required: 'Required' })} />
                    </div>
                    <div>
                      <label className="label mb-1.5 block">Gender *</label>
                      <select {...register('gender')} className="input">
                        <option value="MALE">Male</option>
                        <option value="FEMALE">Female</option>
                        <option value="TRANSGENDER">Transgender</option>
                      </select>
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label mb-1.5 block">Marital Status</label>
                      <select {...register('maritalStatus')} className="input">
                        <option value="SINGLE">Single</option>
                        <option value="MARRIED">Married</option>
                        <option value="DIVORCED">Divorced</option>
                        <option value="WIDOWED">Widowed</option>
                      </select>
                    </div>
                    <div>
                      <label className="label mb-1.5 block">Email</label>
                      <Input type="email" {...register('email')} placeholder="ravi@example.com" />
                    </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label mb-1.5 block">Mobile Number *</label>
                      <div className="flex gap-2">
                        <div className="flex items-center px-3 border rounded-md bg-muted text-sm">+91</div>
                        <Input {...register('mobile', { required: 'Required' })} type="tel" inputMode="numeric" maxLength={10} placeholder="9876543210" className="flex-1 font-mono" />
                      </div>
                    </div>
                    <div>
                      <label className="label mb-1.5 block">Alternate Mobile</label>
                      <Input {...register('alternateMobile')} type="tel" inputMode="numeric" maxLength={10} placeholder="9876543210" className="font-mono" />
                    </div>
                  </div>
                  <div>
                    <label className="label mb-1.5 block">Current Address *</label>
                    <Input {...register('addressLine1', { required: 'Required' })} placeholder="House/Flat No, Street, Area" />
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="label mb-1.5 block">Pincode *</label>
                      <Input {...register('pincode', { required: 'Required' })} inputMode="numeric" maxLength={6} placeholder="411001" />
                    </div>
                    <div>
                      <label className="label mb-1.5 block">City *</label>
                      <Input {...register('city', { required: 'Required' })} placeholder="Pune" />
                    </div>
                    <div>
                      <label className="label mb-1.5 block">State *</label>
                      <select {...register('state', { required: 'Required' })} className="input">
                        <option value="">Select State</option>
                        {['Maharashtra', 'Karnataka', 'Tamil Nadu', 'Delhi', 'Gujarat', 'Uttar Pradesh', 'West Bengal', 'Telangana', 'Andhra Pradesh', 'Rajasthan'].map(s => <option key={s} value={s}>{s}</option>)}
                      </select>
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {currentStep === 1 && (
              <Card>
                <CardHeader>
                  <CardTitle>Employment Details</CardTitle>
                  <p className="text-sm text-muted-foreground">Enter your employment information</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <label className="label mb-1.5 block">Employment Type *</label>
                    <select {...register('employmentType')} className="input">
                      <option value="SALARIED_PRIVATE">Salaried - Private</option>
                      <option value="SALARIED_GOVERNMENT">Salaried - Government</option>
                      <option value="SALARIED_PSU">Salaried - PSU</option>
                      <option value="SELF_EMPLOYED_PROFESSIONAL">Self-Employed Professional</option>
                      <option value="SELF_EMPLOYED_BUSINESS">Self-Employed Business</option>
                      <option value="BUSINESS">Business Owner</option>
                    </select>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="label mb-1.5 block">Employer Name</label>
                      <Input {...register('employerName')} placeholder="TCS Pvt Ltd" />
                    </div>
                    <div>
                      <label className="label mb-1.5 block">Designation</label>
                      <Input {...register('designation')} placeholder="Software Engineer" />
                    </div>
                  </div>
                  <div className="grid grid-cols-3 gap-4">
                    <div>
                      <label className="label mb-1.5 block">Gross Monthly Income *</label>
                      <MoneyInput onValueChange={(v) => { setValue('grossMonthlyIncome', v, { shouldDirty: true }); autosave('EMPLOYMENT', { grossMonthlyIncome: v }); }} />
                    </div>
                    <div>
                      <label className="label mb-1.5 block">Net Monthly Income</label>
                      <MoneyInput onValueChange={(v) => setValue('netMonthlyIncome', v, { shouldDirty: true })} />
                    </div>
                    <div>
                      <label className="label mb-1.5 block">Annual Income</label>
                      <MoneyInput onValueChange={(v) => setValue('totalAnnualIncome', v, { shouldDirty: true })} />
                    </div>
                  </div>
                  {watchIncome > 0 && (
                    <div className={`p-3 rounded-lg text-sm ${watchIncome >= 25_000 ? 'bg-green-50 text-green-800' : 'bg-yellow-50 text-yellow-800'}`}>
                      {watchIncome >= 25_000
                        ? '✓ You meet the minimum income criteria for most loan products.'
                        : 'Your income may limit loan eligibility. Consider applying for smaller amounts.'}
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {currentStep === 2 && (
              <Card>
                <CardHeader>
                  <CardTitle>Loan Details</CardTitle>
                  <p className="text-sm text-muted-foreground">Specify your loan requirements</p>
                </CardHeader>
                <CardContent className="space-y-6">
                  <div>
                    <label className="label mb-1.5 block">Product Type *</label>
                    <select {...register('productType')} className="input">
                      <option value="">Select Product</option>
                      <option value="PERSONAL_LOAN">Personal Loan</option>
                      <option value="HOME_LOAN">Home Loan</option>
                      <option value="LOAN_AGAINST_PROPERTY">Loan Against Property (LAP)</option>
                      <option value="BUSINESS_LOAN">Business Loan</option>
                      <option value="EDUCATION_LOAN">Education Loan</option>
                      <option value="CAR_LOAN">Car Loan</option>
                      <option value="BLENDED_LOAN">Blended Loan</option>
                    </select>
                    {REQUIRES_COAPPLICANTS && (
                      <p className="text-xs text-orange-600 mt-1">
                        ⚠ Home Loans and LAP require co-applicants and/or guarantors. This section will appear next.
                      </p>
                    )}
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <label className="label">Loan Amount *</label>
                      <span className="font-mono font-bold text-lg">₹{watchAmount.toLocaleString('en-IN')}</span>
                    </div>
                    <MoneyInput
                      value={watchAmount}
                      onValueChange={(v) => { setValue('requestedAmount', v, { shouldDirty: true }); autosave('LOAN_REQUIREMENT', { requestedAmount: v }); }}
                    />
                  </div>
                  <div>
                    <div className="flex justify-between mb-2">
                      <label className="label">Tenure</label>
                      <span className="font-semibold">{watchTenure} months</span>
                    </div>
                    <input type="range" min={12} max={60} step={6} {...register('requestedTenureMonths')} className="w-full accent-primary" />
                    <div className="flex justify-between text-xs text-muted-foreground mt-1">
                      <span>12 months</span><span>60 months</span>
                    </div>
                  </div>
                  <div>
                    <label className="label mb-1.5 block">Purpose of Loan</label>
                    <textarea
                      {...register('purposeDescription')}
                      rows={3}
                      className="input resize-none"
                      placeholder="Describe the purpose of this loan..."
                    />
                  </div>
                  {watchAmount > 0 && watchTenure > 0 && (
                    <div className="bg-muted/50 rounded-lg p-4">
                      <div className="flex justify-between text-sm mb-1">
                        <span>Est. EMI @ 10.75% p.a.</span>
                        <span className="font-bold text-primary">₹{Math.round((watchAmount * (10.75 / 12 / 100) * Math.pow(1 + 10.75 / 12 / 100, watchTenure)) / (Math.pow(1 + 10.75 / 12 / 100, watchTenure) - 1)).toLocaleString('en-IN')}/mo</span>
                      </div>
                      <div className="flex justify-between text-xs text-muted-foreground">
                        <span>Total Interest Payable</span>
                        <span>₹{Math.round((Math.round((watchAmount * (10.75 / 12 / 100) * Math.pow(1 + 10.75 / 12 / 100, watchTenure)) / (Math.pow(1 + 10.75 / 12 / 100, watchTenure) - 1)) * watchTenure - watchAmount)).toLocaleString('en-IN')}</span>
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            )}

            {currentStep === 3 && REQUIRES_COAPPLICANTS && (
              <div className="space-y-6">
                <Card>
                  <CardHeader>
                    <CardTitle>Co-Applicants</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Home Loans and LAP require at least one co-applicant. You can add up to 3 co-applicants.
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {coApplicants.map((ca, i) => (
                      <div key={i} className="border rounded-lg p-4 space-y-3">
                        <div className="flex justify-between items-center">
                          <p className="font-medium text-sm">Co-Applicant {i + 1}</p>
                          {i > 0 && (
                            <button
                              type="button"
                              onClick={() => setCoApplicants(prev => prev.filter((_, j) => j !== i))}
                              className="text-xs text-red-500 hover:underline"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="label mb-1 block">Full Name</label>
                            <Input
                              value={ca.name}
                              onChange={(e) => {
                                const updated = [...coApplicants];
                                updated[i].name = e.target.value;
                                setCoApplicants(updated);
                              }}
                              placeholder="Co-applicant name as per PAN"
                            />
                          </div>
                          <div>
                            <label className="label mb-1 block">Relationship</label>
                            <select
                              value={ca.relationship}
                              onChange={(e) => {
                                const updated = [...coApplicants];
                                updated[i].relationship = e.target.value;
                                setCoApplicants(updated);
                              }}
                              className="input"
                            >
                              <option value="">Select</option>
                              <option value="SPOUSE">Spouse</option>
                              <option value="PARENT">Parent</option>
                              <option value="SIBLING">Sibling</option>
                              <option value="CHILD">Child</option>
                              <option value="OTHER">Other</option>
                            </select>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="label mb-1 block">PAN</label>
                            <Input
                              value={ca.pan}
                              onChange={(e) => {
                                const updated = [...coApplicants];
                                updated[i].pan = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
                                setCoApplicants(updated);
                              }}
                              placeholder="ABCDE1234F"
                              maxLength={10}
                              className="font-mono"
                            />
                          </div>
                          <div>
                            <label className="label mb-1 block">Aadhaar (last 4 digits)</label>
                            <Input
                              value={ca.aadhaar}
                              onChange={(e) => {
                                const updated = [...coApplicants];
                                updated[i].aadhaar = e.target.value.replace(/\D/g, '').slice(0, 4);
                                setCoApplicants(updated);
                              }}
                              placeholder="XXXX"
                              maxLength={4}
                              className="font-mono"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="label mb-1 block">Gross Monthly Income</label>
                          <MoneyInput
                            value={ca.grossMonthlyIncome}
                            onValueChange={(v) => {
                              const updated = [...coApplicants];
                              updated[i].grossMonthlyIncome = v;
                              setCoApplicants(updated);
                            }}
                          />
                        </div>
                      </div>
                    ))}
                    {coApplicants.length < 3 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setCoApplicants(prev => [...prev, { name: '', relationship: '', pan: '', aadhaar: '', grossMonthlyIncome: 0 }])}
                      >
                        + Add Co-Applicant
                      </Button>
                    )}
                  </CardContent>
                </Card>

                <Card>
                  <CardHeader>
                    <CardTitle>Guarantors</CardTitle>
                    <p className="text-sm text-muted-foreground">
                      Guarantors may be required for LAP. You can add up to 2 guarantors.
                    </p>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {guarantors.map((g, i) => (
                      <div key={i} className="border rounded-lg p-4 space-y-3">
                        <div className="flex justify-between items-center">
                          <p className="font-medium text-sm">Guarantor {i + 1}</p>
                          {i > 0 && (
                            <button
                              type="button"
                              onClick={() => setGuarantors(prev => prev.filter((_, j) => j !== i))}
                              className="text-xs text-red-500 hover:underline"
                            >
                              Remove
                            </button>
                          )}
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="label mb-1 block">Full Name</label>
                            <Input
                              value={g.name}
                              onChange={(e) => {
                                const updated = [...guarantors];
                                updated[i].name = e.target.value;
                                setGuarantors(updated);
                              }}
                              placeholder="Guarantor name as per PAN"
                            />
                          </div>
                          <div>
                            <label className="label mb-1 block">Relationship</label>
                            <select
                              value={g.relationship}
                              onChange={(e) => {
                                const updated = [...guarantors];
                                updated[i].relationship = e.target.value;
                                setGuarantors(updated);
                              }}
                              className="input"
                            >
                              <option value="">Select</option>
                              <option value="SPOUSE">Spouse</option>
                              <option value="PARENT">Parent</option>
                              <option value="SIBLING">Sibling</option>
                              <option value="BUSINESS_PARTNER">Business Partner</option>
                              <option value="OTHER">Other</option>
                            </select>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 gap-3">
                          <div>
                            <label className="label mb-1 block">PAN</label>
                            <Input
                              value={g.pan}
                              onChange={(e) => {
                                const updated = [...guarantors];
                                updated[i].pan = e.target.value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 10);
                                setGuarantors(updated);
                              }}
                              placeholder="ABCDE1234F"
                              maxLength={10}
                              className="font-mono"
                            />
                          </div>
                          <div>
                            <label className="label mb-1 block">Aadhaar (last 4 digits)</label>
                            <Input
                              value={g.aadhaar}
                              onChange={(e) => {
                                const updated = [...guarantors];
                                updated[i].aadhaar = e.target.value.replace(/\D/g, '').slice(0, 4);
                                setGuarantors(updated);
                              }}
                              placeholder="XXXX"
                              maxLength={4}
                              className="font-mono"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="label mb-1 block">Address</label>
                          <Input
                            value={g.address}
                            onChange={(e) => {
                              const updated = [...guarantors];
                              updated[i].address = e.target.value;
                              setGuarantors(updated);
                            }}
                            placeholder="Guarantor's current address"
                          />
                        </div>
                      </div>
                    ))}
                    {guarantors.length < 2 && (
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => setGuarantors(prev => [...prev, { name: '', relationship: '', pan: '', aadhaar: '', address: '' }])}
                      >
                        + Add Guarantor
                      </Button>
                    )}
                  </CardContent>
                </Card>
              </div>
            )}

            {currentStep === 4 && (
              <Card>
                <CardHeader>
                  <CardTitle>Review &amp; Submit</CardTitle>
                  <p className="text-sm text-muted-foreground">Verify your details before submission</p>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="bg-muted/30 rounded-lg divide-y">
                    <div className="flex justify-between py-2 px-3">
                      <span className="text-sm text-muted-foreground">Name</span>
                      <span className="text-sm font-medium">{watch('firstName')} {watch('lastName')}</span>
                    </div>
                    <div className="flex justify-between py-2 px-3">
                      <span className="text-sm text-muted-foreground">Mobile</span>
                      <span className="text-sm font-medium font-mono">{watch('mobile')}</span>
                    </div>
                    <div className="flex justify-between py-2 px-3">
                      <span className="text-sm text-muted-foreground">Employment</span>
                      <span className="text-sm font-medium">{watch('employmentType')?.replace(/_/g, ' ')}</span>
                    </div>
                    <div className="flex justify-between py-2 px-3">
                      <span className="text-sm text-muted-foreground">Monthly Income</span>
                      <span className="text-sm font-medium">{formatCurrency(watchIncome)}</span>
                    </div>
                    <div className="flex justify-between py-2 px-3">
                      <span className="text-sm text-muted-foreground">Loan Amount</span>
                      <span className="text-sm font-bold">{formatCurrency(watchAmount)}</span>
                    </div>
                    <div className="flex justify-between py-2 px-3">
                      <span className="text-sm text-muted-foreground">Product Type</span>
                      <span className="text-sm font-medium">{watchProductType?.replace(/_/g, ' ')}</span>
                    </div>
                    <div className="flex justify-between py-2 px-3">
                      <span className="text-sm text-muted-foreground">Tenure</span>
                      <span className="text-sm font-medium">{watchTenure} months</span>
                    </div>
                    {REQUIRES_COAPPLICANTS && (
                      <>
                        <div className="flex justify-between py-2 px-3">
                          <span className="text-sm text-muted-foreground">Co-Applicants</span>
                          <span className="text-sm font-medium">
                            {coApplicants.filter(c => c.name.trim()).length} added
                          </span>
                        </div>
                        <div className="flex justify-between py-2 px-3">
                          <span className="text-sm text-muted-foreground">Guarantors</span>
                          <span className="text-sm font-medium">
                            {guarantors.filter(g => g.name.trim()).length} added
                          </span>
                        </div>
                      </>
                    )}
                  </div>
                  <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
                    <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span>By submitting, you authorize LOS Bank to fetch your credit information from credit bureaus. Your data is processed as per RBI guidelines.</span>
                  </div>
                </CardContent>
              </Card>
            )}

            <div className="flex justify-between">
              <Button type="button" variant="outline" onClick={prevStep} disabled={currentStep === 0}>
                ← Previous
              </Button>
              <Button type="submit" disabled={submitting} className="min-w-32">
                {submitting ? 'Submitting...' : currentStep < STEPS.length - 1 ? 'Continue →' : 'Submit Application'}
              </Button>
            </div>
          </form>
        </div>
      </main>
    </div>
  );
}
