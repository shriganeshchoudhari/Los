'use client';
import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { OTPDigitInput } from '@/components/ui/components';
import { authApi } from '@/lib/api';

type Step = 'MOBILE' | 'OTP';

export default function LoginPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('MOBILE');
  const [mobile, setMobile] = useState('');
  const [otp, setOtp] = useState('');
  const [sessionId, setSessionId] = useState('');
  const [otpExpiresAt, setOtpExpiresAt] = useState<Date | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [loading, setLoading] = useState(false);
  const [channel, setChannel] = useState<'SMS' | 'WHATSAPP'>('SMS');

  const sendOtp = async () => {
    if (!/^[6-9]\d{9}$/.test(mobile)) {
      toast.error('Please enter a valid 10-digit mobile number');
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.sendOtp(mobile, 'LOGIN', channel);
      // Backend wraps response: { success, data: { sessionId, expiresIn }, message }
      const payload = res.data?.data ?? res.data;
      setSessionId(payload.sessionId);
      setOtpExpiresAt(new Date(Date.now() + (payload.expiresIn ?? 600) * 1000));
      setStep('OTP');
      setCountdown(300);
      toast.success(`OTP sent via ${channel === 'SMS' ? 'SMS' : 'WhatsApp'} to ${mobile.substring(0, 3)}XXXX${mobile.substring(8)}`);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Failed to send OTP. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const verifyOtp = async () => {
    if (otp.length !== 6) {
      toast.error('Please enter the 6-digit OTP');
      return;
    }
    setLoading(true);
    try {
      const res = await authApi.verifyOtp(sessionId, mobile, otp);
      // Backend wraps response: { success, data: { accessToken, refreshToken, expiresIn }, message }
      const payload = res.data?.data ?? res.data;
      await fetch('/api/auth/callback', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          accessToken: payload.accessToken,
          refreshToken: payload.refreshToken,
          expiresIn: payload.expiresIn ?? 900,
        }),
      });
      toast.success('Login successful!');
      router.push('/dashboard');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { code?: string; message?: string } } };
      if (error.response?.data?.code === 'OTP_INVALID') {
        toast.error('Invalid OTP. Please try again.');
      } else if (error.response?.data?.code === 'OTP_EXPIRED') {
        toast.error('OTP has expired. Please request a new one.');
        setOtp('');
      } else {
        toast.error(error.response?.data?.message || 'Verification failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (countdown <= 0) return;
    const timer = setInterval(() => setCountdown(c => Math.max(0, c - 1)), 1000);
    return () => clearInterval(timer);
  }, [countdown]);

  const formatCountdown = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  return (
    <div className="min-h-screen flex">
      <div className="hidden lg:flex lg:w-1/2 bg-[#003366] text-white flex-col justify-between p-12">
        <div>
          <div className="flex items-center gap-3 mb-12">
            <div className="w-12 h-12 bg-white/10 rounded-lg flex items-center justify-center">
              <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            </div>
            <div>
              <h1 className="text-2xl font-bold tracking-tight">LOS Bank</h1>
              <p className="text-sm text-blue-200">Loan Origination System</p>
            </div>
          </div>
          <h2 className="text-4xl font-bold leading-tight mb-4">
            Your dream loan,<br />just minutes away.
          </h2>
          <p className="text-blue-200 text-lg mb-8">
            Apply for personal loans, home loans, vehicle loans and more — fully digital, with instant decisions.
          </p>
          <div className="space-y-4">
            {[
              { icon: '⚡', label: 'Instant decisions on personal loans up to ₹25L', sub: 'Straight-through processing in 45 minutes' },
              { icon: '🔒', label: 'Aadhaar-based KYC', sub: 'OTP verification, no document submission needed' },
              { icon: '📱', label: 'Track your application 24×7', sub: 'Real-time status updates on mobile' },
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

      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">
          <div className="lg:hidden mb-8">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 bg-primary rounded-lg flex items-center justify-center text-white">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
              </div>
              <h1 className="text-xl font-bold">LOS Bank</h1>
            </div>
          </div>

          <div>
            <h2 className="text-2xl font-bold">
              {step === 'MOBILE' ? 'Get Started' : 'Verify OTP'}
            </h2>
            <p className="text-muted-foreground mt-1">
              {step === 'MOBILE'
                ? 'Enter your mobile number to continue'
                : `Enter the 6-digit code sent to ${mobile.substring(0, 3)}XXXX${mobile.substring(8)}`}
            </p>
          </div>

          {step === 'MOBILE' ? (
            <div className="space-y-4">
              <div>
                <label className="label mb-1.5 block">Mobile Number</label>
                <div className="flex gap-2">
                  <div className="flex items-center px-3 border rounded-md bg-muted text-sm font-medium">
                    +91
                  </div>
                  <Input
                    type="tel"
                    inputMode="numeric"
                    maxLength={10}
                    placeholder="9876543210"
                    value={mobile}
                    onChange={(e) => setMobile(e.target.value.replace(/\D/g, ''))}
                    className="flex-1 font-mono text-lg tracking-widest"
                  />
                </div>
              </div>
              <div className="flex gap-2 p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
                <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                <span>OTP delivery channel</span>
                <div className="flex gap-2 ml-auto">
                  <button
                    onClick={() => setChannel('SMS')}
                    className={`px-2 py-0.5 rounded text-xs font-medium ${channel === 'SMS' ? 'bg-primary text-white' : 'bg-white border'}`}
                  >
                    SMS
                  </button>
                  <button
                    onClick={() => setChannel('WHATSAPP')}
                    className={`px-2 py-0.5 rounded text-xs font-medium ${channel === 'WHATSAPP' ? 'bg-green-600 text-white' : 'bg-white border'}`}
                  >
                    WhatsApp
                  </button>
                </div>
              </div>
              <Button onClick={sendOtp} disabled={loading || mobile.length !== 10} className="w-full" size="lg">
                {loading ? 'Sending OTP...' : 'Send OTP'}
              </Button>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="flex justify-center">
                <OTPDigitInput
                  value={otp}
                  onChange={setOtp}
                />
              </div>
              <Button
                onClick={verifyOtp}
                disabled={loading || otp.length !== 6}
                className="w-full"
                size="lg"
              >
                {loading ? 'Verifying...' : 'Verify & Login'}
              </Button>
              <div className="flex justify-between text-sm">
                <button
                  onClick={() => { setOtp(''); sendOtp(); }}
                  disabled={countdown > 0}
                  className="text-primary hover:underline disabled:text-muted-foreground disabled:no-underline"
                >
                  {countdown > 0 ? `Resend in ${formatCountdown(countdown)}` : 'Resend OTP'}
                </button>
                <button onClick={() => { setStep('MOBILE'); setOtp(''); }} className="text-muted-foreground hover:text-foreground">
                  Change number
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
