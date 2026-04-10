'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { Eye, EyeOff, Building2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { dsaAuthApi } from '@/services/dsa-api';
import { useDSAAuth } from '@/lib/dsa-auth';
import { DSALoginResponse } from '@/types/dsa';

export default function DSALoginPage() {
  const router = useRouter();
  const { login } = useDSAAuth();
  const [loginType, setLoginType] = useState<'partner' | 'officer'>('partner');
  const [partnerCode, setPartnerCode] = useState('');
  const [employeeCode, setEmployeeCode] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      let res;
      if (loginType === 'partner') {
        if (!partnerCode.trim()) {
          toast.error('Partner code is required');
          setLoading(false);
          return;
        }
        res = await dsaAuthApi.login(partnerCode.trim(), password);
      } else {
        if (!employeeCode.trim()) {
          toast.error('Employee code is required');
          setLoading(false);
          return;
        }
        res = await dsaAuthApi.officerLogin(employeeCode.trim(), password);
      }

      login(res.data as DSALoginResponse);
      toast.success('Login successful!');
      router.push('/dsa/dashboard');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Login failed. Please check your credentials.');
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
            Grow your loan business<br />with LOS Bank.
          </h2>
          <p className="text-blue-200 text-lg mb-8">
            Competitive commissions, digital onboarding, and real-time application tracking — all in one place.
          </p>
          <div className="space-y-4">
            {[
              { icon: '💰', label: 'Upfront + Trail commission', sub: 'Earn on every disbursement with our hybrid model' },
              { icon: '📊', label: 'Real-time dashboards', sub: 'Track applications, conversions, and payouts instantly' },
              { icon: '⚡', label: 'Digital lead capture', sub: 'Submit applications in minutes from your phone' },
              { icon: '🔗', label: 'API-backed systems', sub: 'Seamless integration with LOS Bank platform' },
            ].map(({ icon, label, sub }) => (
              <div key={label} className="flex items-start gap-3">
                <span className="text-2xl mt-0.5">{icon}</span>
                <div>
                  <p className="font-medium">{label}</p>
                  <p className="text-sm text-blue-200">{sub}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
        <div className="text-sm text-blue-200">
          <p>Regulated by RBI • Data stored in India • 256-bit encryption</p>
        </div>
      </div>

      <div className="flex-1 flex items-center justify-center p-8 bg-gray-50">
        <div className="w-full max-w-md">
          <div className="lg:hidden mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center text-white">
                <Building2 className="w-5 h-5" />
              </div>
              <h1 className="text-xl font-bold">DSA Partner Portal</h1>
            </div>
          </div>

          <Card>
            <CardHeader className="space-y-1">
              <CardTitle className="text-2xl">Sign in</CardTitle>
              <CardDescription>
                Access your DSA Partner Portal to manage applications and commissions
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 mb-6 p-1 bg-gray-100 rounded-lg">
                <button
                  type="button"
                  onClick={() => setLoginType('partner')}
                  className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                    loginType === 'partner' ? 'bg-white shadow-sm text-primary' : 'text-muted-foreground'
                  }`}
                >
                  Partner Login
                </button>
                <button
                  type="button"
                  onClick={() => setLoginType('officer')}
                  className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                    loginType === 'officer' ? 'bg-white shadow-sm text-primary' : 'text-muted-foreground'
                  }`}
                >
                  Officer Login
                </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-4">
                {loginType === 'partner' ? (
                  <div>
                    <label className="label mb-1.5 block text-sm font-medium">
                      Partner Code
                    </label>
                    <Input
                      placeholder="e.g. DSAPLMH00001"
                      value={partnerCode}
                      onChange={(e) => setPartnerCode(e.target.value)}
                      className="uppercase font-mono"
                      autoComplete="username"
                    />
                  </div>
                ) : (
                  <div>
                    <label className="label mb-1.5 block text-sm font-medium">
                      Employee Code
                    </label>
                    <Input
                      placeholder="e.g. DSAPLMH00001-OFF001"
                      value={employeeCode}
                      onChange={(e) => setEmployeeCode(e.target.value)}
                      className="uppercase font-mono"
                      autoComplete="username"
                    />
                  </div>
                )}

                <div>
                  <label className="label mb-1.5 block text-sm font-medium">
                    Password
                  </label>
                  <div className="relative">
                    <Input
                      type={showPassword ? 'text' : 'password'}
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="pr-10"
                      autoComplete="current-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <Button type="submit" disabled={loading || !password} className="w-full" size="lg">
                  {loading ? 'Signing in...' : 'Sign In'}
                </Button>
              </form>

              <div className="mt-4 text-center text-sm">
                <span className="text-muted-foreground">Want to partner with us? </span>
                <Link href="/dsa/register" className="text-primary hover:underline font-medium">
                  Apply now
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
