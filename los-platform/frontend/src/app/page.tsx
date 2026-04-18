'use client';
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { MoneyInput } from '@/components/ui/components';
import { loanApi } from '@/lib/api';

const LOAN_PRODUCTS = [
  {
    type: 'PERSONAL_LOAN',
    name: 'Personal Loan',
    icon: '💰',
    min: 50_000,
    max: 25_00_000,
    maxTenure: 60,
    tagline: 'Instant approval, minimal documentation',
    color: 'from-blue-500 to-indigo-600',
    eligible: 'Salaried & Self-employed',
    rate: '10.50% p.a.',
    processing: '1% (Min ₹1,000)',
  },
  {
    type: 'HOME_LOAN',
    name: 'Home Loan',
    icon: '🏠',
    min: 10_00_000,
    max: 5_00_00_000,
    maxTenure: 360,
    tagline: 'Finance your dream home',
    color: 'from-emerald-500 to-teal-600',
    eligible: 'Salaried & Self-employed',
    rate: '8.40% p.a.',
    processing: '0.50%',
  },
  {
    type: 'VEHICLE_LOAN_FOUR_WHEELER',
    name: 'Car Loan',
    icon: '🚗',
    min: 2_00_000,
    max: 30_00_000,
    maxTenure: 84,
    tagline: 'Drive home your new car',
    color: 'from-orange-500 to-red-500',
    eligible: 'Salaried & Self-employed',
    rate: '8.60% p.a.',
    processing: '0.50%',
  },
  {
    type: 'VEHICLE_LOAN_TWO_WHEELER',
    name: 'Two-Wheeler Loan',
    icon: '🏍️',
    min: 30_000,
    max: 3_00_000,
    maxTenure: 48,
    tagline: 'Easy EMIs on two-wheelers',
    color: 'from-yellow-500 to-orange-500',
    eligible: 'Salaried & Self-employed',
    rate: '9.50% p.a.',
    processing: 'Nil',
  },
  {
    type: 'EDUCATION_LOAN',
    name: 'Education Loan',
    icon: '🎓',
    min: 1_00_000,
    max: 75_00_000,
    maxTenure: 180,
    tagline: 'Invest in your future',
    color: 'from-purple-500 to-pink-500',
    eligible: 'Students with admission letter',
    rate: '8.15% p.a.',
    processing: 'Nil',
  },
  {
    type: 'GOLD_LOAN',
    name: 'Gold Loan',
    icon: '✨',
    min: 10_000,
    max: 20_00_000,
    maxTenure: 12,
    tagline: 'Quick gold-backed loan',
    color: 'from-yellow-400 to-amber-500',
    eligible: 'Gold ornaments owner',
    rate: '10.50% p.a.',
    processing: 'Nil',
  },
  {
    type: 'LAP',
    name: 'Loan Against Property',
    icon: '🏢',
    min: 5_00_000,
    max: 2_00_00_000,
    maxTenure: 180,
    tagline: 'Unlock your property value',
    color: 'from-slate-600 to-slate-800',
    eligible: 'Property owners',
    rate: '9.50% p.a.',
    processing: '0.50%',
  },
  {
    type: 'MSME_TERM_LOAN',
    name: 'MSME Business Loan',
    icon: '📈',
    min: 5_00_000,
    max: 2_00_00_000,
    maxTenure: 84,
    tagline: 'Grow your business',
    color: 'from-cyan-500 to-blue-600',
    eligible: 'MSME registered businesses',
    rate: '11.00% p.a.',
    processing: '1%',
  },
];

export default function HomePage() {
  const router = useRouter();
  const [selectedProduct, setSelectedProduct] = useState<string | null>(null);
  const [amount, setAmount] = useState(0);
  const [tenure, setTenure] = useState(36);
  const [loading, setLoading] = useState(false);

  const product = LOAN_PRODUCTS.find(p => p.type === selectedProduct);
  const formatCurrency = (n: number) => (
    n >= 100_000 ? `₹${(n / 100_000).toFixed(0)}L` : `₹${n.toLocaleString('en-IN')}`
  );
  const maxAmount = product?.max || 0;
  const maxTenure = product?.maxTenure || 60;
  const EMI = product ? Math.round((amount * (product.type === 'HOME_LOAN' ? 8.4 / 12 / 100 : 10.5 / 12 / 100) * Math.pow(1 + (product.type === 'HOME_LOAN' ? 8.4 : 10.5) / 12 / 100, tenure)) / (Math.pow(1 + (product.type === 'HOME_LOAN' ? 8.4 : 10.5) / 12 / 100, tenure) - 1)) : 0;

  const startApplication = async () => {
    if (!selectedProduct || amount < (product?.min || 0)) {
      toast.error(`Minimum loan amount is ${formatCurrency(product?.min || 0)}`);
      return;
    }
    setLoading(true);
    try {
      const { data } = await loanApi.create({
        loanType: selectedProduct,
        channelCode: 'ONLINE',
        loanRequirement: { loanType: selectedProduct, requestedAmount: amount, requestedTenureMonths: tenure },
        applicant: { fullName: '', mobile: '', dob: '', age: 0, gender: 'MALE', maritalStatus: 'SINGLE', addresses: [], residentialStatus: 'RESIDENT_INDIAN', yearsAtCurrentAddress: 0, ownOrRentedResidence: 'OWNED' },
        employmentDetails: { employmentType: 'SALARIED_PRIVATE', totalWorkExperienceMonths: 0, grossMonthlyIncome: 0, netMonthlyIncome: 0, totalAnnualIncome: 0 },
      });
      toast.success('Application created!');
      router.push(`/application/${data.applicationId}`);
    } catch {
      toast.error('Failed to create application. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-white">
      <header className="sticky top-0 z-50 bg-white/95 backdrop-blur border-b">
        <div className="container flex items-center justify-between py-4">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center text-white">
              <span className="text-lg">₹</span>
            </div>
            <span className="font-bold text-lg">LOS Bank</span>
          </div>
          <nav className="hidden md:flex items-center gap-6 text-sm">
            <Link href="/dashboard" className="hover:text-primary">My Applications</Link>
            <Link href="/help" className="hover:text-primary">Help</Link>
          </nav>
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => router.push('/login')}>Login</Button>
          </div>
        </div>
      </header>

      <main id="main-content" className="container py-8">
        <div className="text-center mb-8">
          <h1 className="text-3xl md:text-4xl font-bold mb-2">Apply for a Loan</h1>
          <p className="text-muted-foreground">Select a product and get instant approval</p>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          {LOAN_PRODUCTS.map((p) => (
            <Card
              key={p.type}
              className={`loan-product-card cursor-pointer ${selectedProduct === p.type ? 'selected' : ''}`}
              onClick={() => setSelectedProduct(p.type)}
            >
              <CardContent className="p-4">
                <div className="flex items-start justify-between mb-3">
                  <span className="text-3xl">{p.icon}</span>
                  {selectedProduct === p.type && (
                    <div className="w-6 h-6 bg-primary rounded-full flex items-center justify-center">
                      <svg className="w-4 h-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </div>
                <h3 className="font-semibold mb-1">{p.name}</h3>
                <p className="text-xs text-muted-foreground mb-2">{p.tagline}</p>
                <div className="text-xs space-y-0.5 text-muted-foreground">
                  <p>Up to {formatCurrency(p.max)}</p>
                  <p>{p.rate} onwards</p>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {product && (
          <Card className="max-w-2xl mx-auto animate-in">
            <CardContent className="p-6 space-y-6">
              <div className="flex items-center gap-3">
                <span className="text-3xl">{product.icon}</span>
                <div>
                  <h3 className="font-semibold">{product.name}</h3>
                  <p className="text-sm text-muted-foreground">{product.rate} onwards • Max {product.maxTenure / 12} years</p>
                </div>
              </div>

              <div className="space-y-4">
                <div>
                  <div className="flex justify-between mb-1.5">
                    <label className="text-sm font-medium">Loan Amount</label>
                    <span className="text-sm font-mono font-semibold">₹{amount.toLocaleString('en-IN')}</span>
                  </div>
                  <MoneyInput value={amount} onValueChange={setAmount} className="text-lg" />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>Min {formatCurrency(product.min)}</span>
                    <span>Max {formatCurrency(product.max)}</span>
                  </div>
                  <input
                    type="range"
                    min={product.min}
                    max={product.max}
                    step={product.min}
                    value={amount || product.min}
                    onChange={(e) => setAmount(parseInt(e.target.value))}
                    className="w-full mt-2 accent-primary"
                  />
                </div>

                <div>
                  <div className="flex justify-between mb-1.5">
                    <label className="text-sm font-medium">Tenure</label>
                    <span className="text-sm font-semibold">{tenure} months ({Math.floor(tenure / 12)}y {tenure % 12}m)</span>
                  </div>
                  <input
                    type="range"
                    min={12}
                    max={maxTenure}
                    step={6}
                    value={tenure}
                    onChange={(e) => setTenure(parseInt(e.target.value))}
                    className="w-full accent-primary"
                  />
                  <div className="flex justify-between text-xs text-muted-foreground mt-1">
                    <span>12 months</span>
                    <span>{maxTenure} months</span>
                  </div>
                </div>
              </div>

              {amount > 0 && (
                <div className="bg-muted/50 rounded-lg p-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Interest Rate</span>
                    <span className="font-medium">{product.rate}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Processing Fee</span>
                    <span className="font-medium">{product.processing}</span>
                  </div>
                  <div className="border-t pt-2 flex justify-between">
                    <span className="font-semibold">Estimated EMI / month</span>
                    <span className="font-bold text-lg text-primary">₹{Math.round(EMI).toLocaleString('en-IN')}</span>
                  </div>
                </div>
              )}

              <Button
                onClick={startApplication}
                disabled={loading || amount < product.min}
                className="w-full"
                size="lg"
              >
                {loading ? 'Creating Application...' : 'Apply Now'}
              </Button>

              <p className="text-xs text-center text-muted-foreground">
                By proceeding, you agree to our Terms & Privacy Policy. Final loan approval subject to credit assessment.
              </p>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
