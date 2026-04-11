'use client';
import { useState, useEffect, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { OTPDigitInput } from '@/components/ui/components';
import { sanctionLetterApi, loanAgreementApi } from '@/lib/api';
import { formatCurrency, formatDate } from '@/lib/utils';

type FlowStep = 'KFS_REVIEW' | 'SANCTION_REVIEW' | 'GENERATING' | 'AGREEMENT_REVIEW' | 'ESIGN_INITIATING' | 'ESIGN_WAITING' | 'ESIGN_VERIFYING' | 'ESIGN_SUCCESS' | 'ESIGN_FAILED';

interface SanctionData {
  applicationNumber: string;
  customerName: string;
  customerAddress: string;
  sanctionedAmount: number;
  sanctionedAmountInWords: string;
  rateOfInterestPercent: number;
  tenureMonths: number;
  emiAmount: number;
  processingFeeAmount: number;
  totalPayableAmount: number;
  firstEmiDate: string;
  lastEmiDate: string;
  productName: string;
  sanctionDate: string;
  validUntil: string;
  sanctioningAuthority: string;
  authorityDesignation: string;
  loanAccountNumber: string;
  ifscCode: string;
  branchName: string;
  prepaymentTerms: { allowed: boolean; lockInMonths: number; maxPercentPerYear: number; penaltyPercent: number; penaltyClause: string };
  foreclosureTerms: { allowed: boolean; lockInMonths: number; minOutstandingBalance: number; processingFeePercent: number };
}

interface ESignState {
  transactionId: string;
  status: string;
  provider: string;
}

export default function SanctionLetterPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;

  const [step, setStep] = useState<FlowStep>('KFS_REVIEW');
  const [sanctionData, setSanctionData] = useState<SanctionData | null>(null);
  const [agreementId, setAgreementId] = useState<string>('');
  const [agreementNumber, setAgreementNumber] = useState<string>('');
  const [esignState, setEsignState] = useState<ESignState | null>(null);
  const [loading, setLoading] = useState(false);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [kfsAcknowledged, setKfsAcknowledged] = useState(false);

  const [signerName, setSignerName] = useState('');
  const [signerMobile, setSignerMobile] = useState('');
  const [signerEmail, setSignerEmail] = useState('');
  const [aadhaarLast4, setAadhaarLast4] = useState('');
  const [otp, setOtp] = useState('');
  const [otpCountdown, setOtpCountdown] = useState(0);

  const fetchSanctionData = useCallback(async () => {
    setLoading(true);
    try {
      const res = await sanctionLetterApi.getPreview(id);
      setSanctionData(res.data);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load sanction letter');
      router.back();
    } finally {
      setLoading(false);
    }
  }, [id, router]);

  useEffect(() => {
    fetchSanctionData();
  }, [fetchSanctionData]);

  useEffect(() => {
    const saved = sessionStorage.getItem(`kfs_acknowledged_${id}`);
    if (saved === 'true') {
      setKfsAcknowledged(true);
      setStep('SANCTION_REVIEW');
    }
  }, [id]);

  useEffect(() => {
    if (otpCountdown <= 0) return;
    const t = setTimeout(() => setOtpCountdown(otpCountdown - 1), 1000);
    return () => clearTimeout(t);
  }, [otpCountdown]);

  const handleDownloadSanctionPdf = async () => {
    try {
      const res = await sanctionLetterApi.downloadPdf(id);
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Sanction_Letter_${sanctionData?.applicationNumber || id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to download sanction letter');
    }
  };

  const handleAcceptAndGenerate = async () => {
    if (!termsAccepted) {
      toast.error('Please accept the sanction terms to continue');
      return;
    }
    setStep('GENERATING');
    setLoading(true);
    try {
      const res = await loanAgreementApi.generate(id);
      setAgreementId(res.data.id);
      setAgreementNumber(res.data.agreementNumber);
      setStep('AGREEMENT_REVIEW');
      toast.success('Loan agreement generated successfully');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to generate agreement');
      setStep('SANCTION_REVIEW');
    } finally {
      setLoading(false);
    }
  };

  const handleInitiateESign = async () => {
    if (!signerName.trim()) { toast.error('Signer name is required'); return; }
    if (!/^\d{10}$/.test(signerMobile)) { toast.error('Enter a valid 10-digit mobile number'); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(signerEmail)) { toast.error('Enter a valid email address'); return; }
    if (!/^\d{4}$/.test(aadhaarLast4)) { toast.error('Enter last 4 digits of Aadhaar'); return; }

    setStep('ESIGN_INITIATING');
    setLoading(true);
    try {
      const res = await loanAgreementApi.initiateESign(id, signerName.trim(), signerMobile, signerEmail);
      setEsignState({ transactionId: res.data.esignTransactionId, status: 'PENDING', provider: res.data.esignProvider });
      setStep('ESIGN_WAITING');
      setOtpCountdown(300);
      toast.success('OTP sent to registered mobile number');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to initiate eSign');
      setStep('AGREEMENT_REVIEW');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOTP = async () => {
    if (otp.length !== 6) { toast.error('Please enter the 6-digit OTP'); return; }
    if (!esignState) return;

    setStep('ESIGN_VERIFYING');
    setLoading(true);
    try {
      await loanAgreementApi.verifyESign(esignState.transactionId, otp, aadhaarLast4);
      setStep('ESIGN_SUCCESS');
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'eSign verification failed');
      setStep('ESIGN_WAITING');
      setOtp('');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOTP = async () => {
    setOtpCountdown(300);
    await handleInitiateESign();
  };

  const handleDownloadAgreementPdf = async () => {
    try {
      const res = await loanAgreementApi.downloadPdf(id);
      const blob = new Blob([res.data], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Loan_Agreement_${agreementNumber || id}.pdf`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error('Failed to download agreement');
    }
  };

  if (loading && !sanctionData) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading sanction letter...</p>
        </div>
      </div>
    );
  }

  if (!sanctionData) return null;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b sticky top-0 z-20">
        <div className="container py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <button onClick={() => router.back()} className="text-sm text-muted-foreground hover:text-foreground">← Back</button>
            <div>
              <h1 className="font-bold leading-none">Sanction Letter &amp; eSign</h1>
              <p className="text-xs text-muted-foreground">Application #{sanctionData.applicationNumber}</p>
            </div>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={handleDownloadSanctionPdf}>
              Download Sanction Letter
            </Button>
          </div>
        </div>
      </header>

      <main id="main-content" className="container py-6 space-y-6 max-w-4xl">
        {step === 'KFS_REVIEW' && (
          <>
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 flex items-start gap-3">
              <span className="text-2xl mt-0.5">📋</span>
              <div>
                <p className="font-semibold text-amber-800">Key Facts Statement (KFS)</p>
                <p className="text-sm text-amber-700 mt-0.5">
                  Per RBI's Fair Practices Code &amp; Digital Lending Guidelines, please review all cost disclosures below before proceeding.
                </p>
              </div>
            </div>

            <Card className="border-amber-300">
              <CardHeader>
                <CardTitle>Key Facts Statement</CardTitle>
                <CardDescription>
                  {sanctionData.customerName} · {sanctionData.productName} · Sanction Date: {formatDate(sanctionData.sanctionDate)}
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm text-green-700 font-medium">Principal Loan Amount</p>
                      <p className="text-2xl font-bold text-green-800">{formatCurrency(sanctionData.sanctionedAmount)}</p>
                      <p className="text-sm text-green-600">{sanctionData.sanctionedAmountInWords}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-sm text-green-700 font-medium">Net Disbursement (after fees)</p>
                      <p className="text-2xl font-bold text-green-800">{formatCurrency(Math.max(0, sanctionData.sanctionedAmount - sanctionData.processingFeeAmount))}</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Rate of Interest (p.a.)</p>
                    <p className="font-bold text-base">{sanctionData.rateOfInterestPercent}%</p>
                    <p className="text-xs text-muted-foreground">Simple Annual Rate</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Processing Fee</p>
                    <p className="font-bold text-base">{formatCurrency(sanctionData.processingFeeAmount)}</p>
                    <p className="text-xs text-muted-foreground">+ applicable GST</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">EMI Amount</p>
                    <p className="font-bold text-base">{formatCurrency(sanctionData.emiAmount)}</p>
                    <p className="text-xs text-muted-foreground">Monthly</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Tenure</p>
                    <p className="font-bold text-base">{sanctionData.tenureMonths} months</p>
                    <p className="text-xs text-muted-foreground">{sanctionData.firstEmiDate ? `From ${formatDate(sanctionData.firstEmiDate)}` : ''}</p>
                  </div>
                </div>

                <div className="border-t pt-4 space-y-2">
                  <div className="flex justify-between text-sm">
                    <span>Principal Loan Amount</span>
                    <span className="font-semibold">{formatCurrency(sanctionData.sanctionedAmount)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Total Interest Payable</span>
                    <span className="font-semibold">{formatCurrency(sanctionData.totalPayableAmount - sanctionData.sanctionedAmount)}</span>
                  </div>
                  <div className="flex justify-between text-sm">
                    <span>Processing Fee (+ GST)</span>
                    <span className="font-semibold">{formatCurrency(sanctionData.processingFeeAmount * 1.18)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-bold border-t pt-2">
                    <span>Total Amount Payable</span>
                    <span>{formatCurrency(sanctionData.totalPayableAmount + sanctionData.processingFeeAmount * 1.18)}</span>
                  </div>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <div className="flex justify-between items-center">
                    <div>
                      <p className="text-sm text-blue-800 font-semibold">Annual Percentage Rate (APR)</p>
                      <p className="text-xs text-blue-600">Effective annual cost of credit, including all charges</p>
                    </div>
                    <p className="text-2xl font-bold text-blue-800">
                      {sanctionData.rateOfInterestPercent}%
                    </p>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">First EMI Date</p>
                    <p className="font-semibold">{formatDate(sanctionData.firstEmiDate)}</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Last EMI Date</p>
                    <p className="font-semibold">{formatDate(sanctionData.lastEmiDate)}</p>
                  </div>
                </div>

                {sanctionData.sanctionedAmount <= 50000 && (
                  <div className="bg-orange-50 border border-orange-200 rounded-lg p-4 flex items-start gap-3">
                    <span className="text-xl mt-0.5">⏱️</span>
                    <div>
                      <p className="font-semibold text-orange-800 text-sm">Cooling-off Period — 3-Day Cancellation Right</p>
                      <p className="text-sm text-orange-700 mt-1">
                        As per RBI's Digital Lending Guidelines, for loans up to ₹50,000, you have the right to cancel this loan within <strong>3 working days</strong>
                        from the date of disbursement by contacting the bank and repaying the full disbursed amount. No foreclosure charges will apply during this period.
                      </p>
                    </div>
                  </div>
                )}

                <div className="bg-red-50 border border-red-200 rounded-lg p-3 text-xs text-red-700 space-y-1">
                  <p><strong>Interest rate is subject to revision</strong> based on the bank's Base Rate / MCLR changes. Please refer to the sanction letter for detailed terms.</p>
                  <p><strong>Insurance:</strong> Life/asset insurance is optional and not linked to loan approval.</p>
                  <p><strong>Grievance Redressal:</strong> Contact our GRO at gro@bankname.com or call 1800-XXX-XXXX.</p>
                </div>
              </CardContent>
            </Card>

            <Card className="border-blue-200 bg-blue-50/50">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="kfs"
                    checked={kfsAcknowledged}
                    onChange={(e) => setKfsAcknowledged(e.target.checked)}
                    className="mt-1"
                  />
                  <label htmlFor="kfs" className="text-sm cursor-pointer">
                    I/We confirm that I/We have read and understood the Key Facts Statement (KFS) containing all cost disclosures, 
                    including the Annual Percentage Rate (APR), processing fees, and total amount payable. I/We accept the information provided herein.
                  </label>
                </div>
              </CardContent>
            </Card>

            <Button
              className="w-full"
              size="lg"
              disabled={!kfsAcknowledged}
              onClick={() => { 
                sessionStorage.setItem(`kfs_acknowledged_${id}`, 'true');
                setKfsAcknowledged(true);
                setStep('SANCTION_REVIEW');
              }}
            >
              Proceed to Sanction Letter
            </Button>
          </>
        )}

        {step === 'SANCTION_REVIEW' && (
          <>
            <Card>
              <CardHeader>
                <CardTitle>Sanction Letter</CardTitle>
                <CardDescription>Sanctioned on {formatDate(sanctionData.sanctionDate)} — Valid until {formatDate(sanctionData.validUntil)}</CardDescription>
              </CardHeader>
              <CardContent className="space-y-6">
                <div className="bg-green-50 border border-green-200 rounded-lg p-4 text-center">
                  <p className="text-sm text-green-700 font-medium">Sanctioned Amount</p>
                  <p className="text-3xl font-bold text-green-800">{formatCurrency(sanctionData.sanctionedAmount)}</p>
                  <p className="text-sm text-green-600">{sanctionData.sanctionedAmountInWords}</p>
                </div>

                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Interest Rate (p.a.)</p>
                    <p className="font-bold">{sanctionData.rateOfInterestPercent}%</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">EMI</p>
                    <p className="font-bold">{formatCurrency(sanctionData.emiAmount)}</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Tenure</p>
                    <p className="font-bold">{sanctionData.tenureMonths} months</p>
                  </div>
                  <div className="bg-muted/50 rounded-lg p-3">
                    <p className="text-xs text-muted-foreground">Processing Fee</p>
                    <p className="font-bold">{formatCurrency(sanctionData.processingFeeAmount)}</p>
                  </div>
                </div>

                <div className="border-t pt-4 space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Total Payable</span>
                    <span className="font-semibold">{formatCurrency(sanctionData.totalPayableAmount)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">First EMI Date</span>
                    <span className="font-semibold">{formatDate(sanctionData.firstEmiDate)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Last EMI Date</span>
                    <span className="font-semibold">{formatDate(sanctionData.lastEmiDate)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Loan Account</span>
                    <span className="font-mono font-semibold">{sanctionData.loanAccountNumber}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">IFSC Code</span>
                    <span className="font-mono font-semibold">{sanctionData.ifscCode}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted-foreground">Branch</span>
                    <span className="font-semibold">{sanctionData.branchName}</span>
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="text-base">Key Terms</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4 text-sm">
                <div className="border rounded-lg p-3">
                  <p className="font-semibold text-green-700 mb-1">Prepayment</p>
                  {sanctionData.prepaymentTerms.allowed ? (
                    <p>
                      Allowed after {sanctionData.prepaymentTerms.lockInMonths} months lock-in.
                      Max {sanctionData.prepaymentTerms.maxPercentPerYear}% of outstanding per year.
                      {sanctionData.prepaymentTerms.penaltyClause}
                    </p>
                  ) : (
                    <p>Prepayment not allowed.</p>
                  )}
                </div>
                <div className="border rounded-lg p-3">
                  <p className="font-semibold text-orange-700 mb-1">Foreclosure</p>
                  {sanctionData.foreclosureTerms.allowed ? (
                    <p>
                      Allowed after {sanctionData.foreclosureTerms.lockInMonths} months.
                      Min balance ₹{sanctionData.foreclosureTerms.minOutstandingBalance.toLocaleString()}.
                      Fee {sanctionData.foreclosureTerms.processingFeePercent}% + GST.
                    </p>
                  ) : (
                    <p>Foreclosure not allowed.</p>
                  )}
                </div>
              </CardContent>
            </Card>

            <Card className="border-blue-200 bg-blue-50/50">
              <CardContent className="p-4">
                <div className="flex items-start gap-3">
                  <input
                    type="checkbox"
                    id="terms"
                    checked={termsAccepted}
                    onChange={(e) => setTermsAccepted(e.target.checked)}
                    className="mt-1"
                  />
                  <label htmlFor="terms" className="text-sm cursor-pointer">
                    I/We have read and understood the sanction letter and agree to the terms and conditions stated therein.
                    I accept that this offer is valid until {formatDate(sanctionData.validUntil)}.
                  </label>
                </div>
              </CardContent>
            </Card>

            <Button
              className="w-full"
              size="lg"
              disabled={!termsAccepted || loading}
              onClick={handleAcceptAndGenerate}
            >
              Accept Terms &amp; Generate Loan Agreement
            </Button>
          </>
        )}

        {step === 'GENERATING' && (
          <Card>
            <CardContent className="py-16 text-center">
              <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-lg font-semibold">Generating Loan Agreement...</p>
              <p className="text-sm text-muted-foreground mt-1">Please wait while we prepare your agreement.</p>
            </CardContent>
          </Card>
        )}

        {(step === 'AGREEMENT_REVIEW' || step === 'ESIGN_INITIATING') && (
          <>
            <Card className="border-green-200">
              <CardContent className="p-4">
                <div className="flex items-center gap-3 text-green-700">
                  <span className="text-2xl">✓</span>
                  <div>
                    <p className="font-semibold">Agreement Generated</p>
                    <p className="text-sm text-green-600">Agreement #{agreementNumber}</p>
                  </div>
                  <Button variant="outline" size="sm" className="ml-auto" onClick={handleDownloadAgreementPdf}>
                    Download PDF
                  </Button>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>eSign — Aadhaar-based Digital Signature</CardTitle>
                <CardDescription>Your loan agreement will be digitally signed using your Aadhaar-linked mobile number.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-sm text-blue-700">
                  <strong>Note:</strong> An OTP will be sent to your Aadhaar-registered mobile number. Keep your mobile ready.
                </div>
                <div className="grid gap-4">
                  <div>
                    <label className="text-sm font-medium">Full Name (as per Aadhaar)</label>
                    <input
                      type="text"
                      value={signerName}
                      onChange={(e) => setSignerName(e.target.value)}
                      placeholder="Enter full name"
                      className="input mt-1"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="text-sm font-medium">Mobile Number</label>
                      <input
                        type="tel"
                        value={signerMobile}
                        onChange={(e) => setSignerMobile(e.target.value.replace(/\D/g, '').slice(0, 10))}
                        placeholder="10-digit mobile"
                        className="input mt-1"
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium">Email Address</label>
                      <input
                        type="email"
                        value={signerEmail}
                        onChange={(e) => setSignerEmail(e.target.value)}
                        placeholder="your@email.com"
                        className="input mt-1"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="text-sm font-medium">Last 4 Digits of Aadhaar</label>
                    <input
                      type="text"
                      value={aadhaarLast4}
                      onChange={(e) => setAadhaarLast4(e.target.value.replace(/\D/g, '').slice(0, 4))}
                      placeholder="XXXX"
                      maxLength={4}
                      className="input mt-1 max-w-24"
                    />
                  </div>
                </div>
                <Button
                  className="w-full"
                  onClick={handleInitiateESign}
                  disabled={loading}
                >
                  {loading ? 'Sending OTP...' : 'Send OTP for eSign'}
                </Button>
              </CardContent>
            </Card>
          </>
        )}

        {step === 'ESIGN_WAITING' && (
          <Card>
            <CardHeader>
              <CardTitle>Enter OTP</CardTitle>
              <CardDescription>
                OTP sent to your Aadhaar-linked mobile. Expires in {Math.floor(otpCountdown / 60)}:{String(otpCountdown % 60).padStart(2, '0')}
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="text-center">
                <OTPDigitInput
                  value={otp}
                  onChange={(v) => setOtp(v)}
                  length={6}
                />
              </div>
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={handleResendOTP}
                  disabled={otpCountdown > 240}
                >
                  Resend OTP
                </Button>
                <Button
                  className="flex-1"
                  onClick={handleVerifyOTP}
                  disabled={otp.length !== 6 || loading}
                >
                  {loading ? 'Verifying...' : 'Verify & Sign'}
                </Button>
              </div>
              <div className="text-center text-sm text-muted-foreground">
                Powered by NSDL eSign · Transaction: <span className="font-mono">{esignState?.transactionId}</span>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 'ESIGN_VERIFYING' && (
          <Card>
            <CardContent className="py-16 text-center">
              <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
              <p className="text-lg font-semibold">Verifying OTP &amp; Signing...</p>
              <p className="text-sm text-muted-foreground mt-1">Please do not close or refresh this page.</p>
            </CardContent>
          </Card>
        )}

        {step === 'ESIGN_SUCCESS' && (
          <Card className="border-green-300">
            <CardContent className="py-12 text-center space-y-4">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                <span className="text-3xl">✓</span>
              </div>
              <div>
                <h2 className="text-2xl font-bold text-green-700">Agreement Signed Successfully</h2>
                <p className="text-muted-foreground mt-1">
                  Your loan agreement #{agreementNumber} has been digitally signed.
                </p>
              </div>
              <div className="bg-green-50 border border-green-200 rounded-lg p-4 max-w-sm mx-auto text-sm text-green-700 space-y-1">
                <p><strong>Agreement:</strong> #{agreementNumber}</p>
                <p><strong>Transaction ID:</strong> {esignState?.transactionId}</p>
                <p><strong>Provider:</strong> {esignState?.provider}</p>
                <p><strong>Signed:</strong> {new Date().toLocaleString()}</p>
              </div>
              <div className="flex gap-3 justify-center">
                <Button variant="outline" onClick={handleDownloadAgreementPdf}>
                  Download Signed Agreement
                </Button>
                <Button onClick={() => router.push(`/application/${id}/documents`)}>
                  Continue to Disbursement
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {step === 'ESIGN_FAILED' && (
          <Card className="border-red-300">
            <CardHeader>
              <CardTitle className="text-red-700">eSign Failed</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                The eSign process could not be completed. You may try again or contact support.
              </p>
              <Button onClick={() => setStep('AGREEMENT_REVIEW')}>
                Try Again
              </Button>
            </CardContent>
          </Card>
        )}
      </main>
    </div>
  );
}
