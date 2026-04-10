'use client';
import { useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { OTPDigitInput, StatusBadge } from '@/components/ui/components';
import { kycApi } from '@/lib/api';
import { maskAadhaar, maskPAN } from '@/lib/utils';

type KYCStep = 'CONSENT' | 'AADHAAR' | 'PAN' | 'FACE' | 'COMPLETE';

const KYC_STEPS = [
  { key: 'CONSENT', label: 'Consent' },
  { key: 'AADHAAR', label: 'Aadhaar' },
  { key: 'PAN', label: 'PAN' },
  { key: 'FACE', label: 'Photo' },
  { key: 'COMPLETE', label: 'Complete' },
];

export default function KYCPackage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [step, setStep] = useState<KYCStep>('CONSENT');
  const [loading, setLoading] = useState(false);

  const [aadhaar, setAadhaar] = useState('');
  const [aadhaarOtp, setAadhaarOtp] = useState('');
  const [txnId, setTxnId] = useState('');
  const [pan, setPan] = useState('');
  const [panName, setPanName] = useState('');
  const [panDob, setPanDob] = useState('');
  const [selfieFile, setSelfieFile] = useState<File | null>(null);
  const [selfiePreview, setSelfiePreview] = useState<string | null>(null);
  const [livenessDone, setLivenessDone] = useState(false);
  const [faceScore, setFaceScore] = useState<number | null>(null);

  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [cameraActive, setCameraActive] = useState(false);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setCameraActive(true);
      }
    } catch {
      toast.error('Camera access denied. Please allow camera permission.');
    }
  };

  const captureSelfie = () => {
    if (!videoRef.current || !canvasRef.current) return;
    const canvas = canvasRef.current;
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext('2d')?.drawImage(videoRef.current, 0, 0);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    setSelfiePreview(dataUrl);
    setCameraActive(false);
    videoRef.current.srcObject = null;
  };

  const initAadhaar = async () => {
    if (aadhaar.length !== 12) {
      toast.error('Please enter a valid 12-digit Aadhaar number');
      return;
    }
    setLoading(true);
    try {
      const { data } = await kycApi.initiateAadhaarOtp(aadhaar, id);
      setTxnId(data.txnId);
      setStep('AADHAAR');
      toast.success(`OTP sent to your Aadhaar-linked mobile`);
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Failed to initiate Aadhaar verification');
    } finally {
      setLoading(false);
    }
  };

  const verifyAadhaarOtp = async () => {
    if (aadhaarOtp.length !== 6) {
      toast.error('Please enter 6-digit OTP');
      return;
    }
    setLoading(true);
    try {
      await kycApi.verifyAadhaarOtp(txnId, aadhaarOtp, id);
      toast.success('Aadhaar verified successfully!');
      setStep('PAN');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string; code?: string } } };
      if (error.response?.data?.code === 'AADHAAR_OTP_INVALID') {
        toast.error('Invalid OTP. Please try again.');
      } else {
        toast.error(error.response?.data?.message || 'Aadhaar verification failed');
      }
    } finally {
      setLoading(false);
    }
  };

  const verifyPAN = async () => {
    if (!/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan.toUpperCase())) {
      toast.error('Please enter a valid PAN number (e.g., ABCDE1234F)');
      return;
    }
    if (!panName) {
      toast.error('Please enter your name as on PAN card');
      return;
    }
    setLoading(true);
    try {
      await kycApi.verifyPAN(pan.toUpperCase(), panName, panDob, id);
      toast.success('PAN verified successfully!');
      setStep('FACE');
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'PAN verification failed');
    } finally {
      setLoading(false);
    }
  };

  const submitFaceMatch = async () => {
    if (!selfiePreview) {
      toast.error('Please capture a selfie first');
      return;
    }
    setLoading(true);
    try {
      await kycApi.livenessCheck(id, selfiePreview.replace('data:image/jpeg;base64,', ''));
      setLivenessDone(true);

      const { data: faceData } = await kycApi.faceMatch(id, selfiePreview.replace('data:image/jpeg;base64,', ''));
      setFaceScore(faceData.matchScore);

      if (faceData.passed) {
        toast.success(`Face match score: ${faceData.matchScore}/100 — Verified!`);
        setStep('COMPLETE');
      } else {
        toast.error(`Face match failed (score: ${faceData.matchScore}/100). Please try again.`);
      }
    } catch (err: unknown) {
      const error = err as { response?: { data?: { message?: string } } };
      toast.error(error.response?.data?.message || 'Face verification failed');
    } finally {
      setLoading(false);
    }
  };

  const proceedToDocuments = () => {
    router.push(`/application/${id}/documents`);
  };

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="container py-4">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white font-bold text-sm">₹</div>
              <span className="font-bold">LOS Bank — KYC Verification</span>
            </div>
            <div className="ml-auto">
              <StatusBadge status="KYC_IN_PROGRESS" />
            </div>
          </div>
        </div>
      </header>

      <main id="main-content" className="container py-8">
        <div className="max-w-2xl mx-auto">
          <div className="mb-8">
            <div className="flex justify-between items-center">
              {KYC_STEPS.map((s, idx) => (
                <div key={s.key} className="flex items-center">
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold
                    ${step === s.key ? 'bg-primary text-white' :
                      KYC_STEPS.findIndex(x => x.key === step) > idx ? 'bg-green-600 text-white' : 'bg-gray-200 text-gray-500'}`}>
                    {KYC_STEPS.findIndex(x => x.key === step) > idx ? (
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" /></svg>
                    ) : idx + 1}
                  </div>
                  <span className={`ml-2 text-xs hidden sm:block ${step === s.key ? 'font-semibold text-primary' : 'text-gray-500'}`}>{s.label}</span>
                  {idx < KYC_STEPS.length - 1 && <div className={`w-8 sm:w-16 h-0.5 mx-1 ${KYC_STEPS.findIndex(x => x.key === step) > idx ? 'bg-green-500' : 'bg-gray-200'}`} />}
                </div>
              ))}
            </div>
          </div>

          {step === 'CONSENT' && (
            <Card>
              <CardHeader>
                <CardTitle>KYC Verification</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  We need to verify your identity using Aadhaar eKYC and PAN verification as per RBI guidelines. This process is secure and your data is encrypted.
                </p>
                <div className="space-y-3">
                  {[
                    { icon: '🔒', title: 'Aadhaar eKYC', desc: 'OTP-based verification via UIDAI. Your Aadhaar number is encrypted and never stored in plain text.' },
                    { icon: '📋', title: 'PAN Verification', desc: 'Verify your PAN card details against ITD records.' },
                    { icon: '📸', title: 'Photo Verification', desc: 'Selfie capture for liveness check and face matching.' },
                  ].map(({ icon, title, desc }) => (
                    <div key={title} className="flex gap-3 p-3 rounded-lg bg-muted/50">
                      <span className="text-2xl">{icon}</span>
                      <div>
                        <h4 className="font-medium text-sm">{title}</h4>
                        <p className="text-xs text-muted-foreground">{desc}</p>
                      </div>
                    </div>
                  ))}
                </div>
                <div className="flex items-start gap-2 p-3 bg-blue-50 rounded-lg text-sm text-blue-800">
                  <svg className="w-4 h-4 mt-0.5 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                  <span>By proceeding, you consent to LOS Bank verifying your identity. Your Aadhaar number is hashed with SHA-256 and not stored in plain text.</span>
                </div>
                <Button onClick={() => setStep('AADHAAR')} className="w-full" size="lg">
                  Start KYC Verification
                </Button>
              </CardContent>
            </Card>
          )}

          {step === 'AADHAAR' && !txnId && (
            <Card>
              <CardHeader>
                <CardTitle>Verify Aadhaar</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">Enter your 12-digit Aadhaar number. An OTP will be sent to your Aadhaar-linked mobile number.</p>
                <div>
                  <label className="label mb-1.5 block">Aadhaar Number</label>
                  <Input
                    type="tel"
                    inputMode="numeric"
                    maxLength={12}
                    placeholder="12-digit Aadhaar"
                    value={aadhaar}
                    onChange={(e) => setAadhaar(e.target.value.replace(/\D/g, ''))}
                    className="text-center font-mono text-xl tracking-[0.3em]"
                  />
                </div>
                {aadhaar.length === 12 && (
                  <p className="text-xs text-muted-foreground">
                    Masked: {maskAadhaar(aadhaar)}
                  </p>
                )}
                <Button onClick={initAadhaar} disabled={loading || aadhaar.length !== 12} className="w-full" size="lg">
                  {loading ? 'Sending OTP...' : 'Send OTP'}
                </Button>
              </CardContent>
            </Card>
          )}

          {step === 'AADHAAR' && txnId && (
            <Card>
              <CardHeader>
                <CardTitle>Enter Aadhaar OTP</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Enter the 6-digit OTP sent to your Aadhaar-linked mobile number ending in XXXX.
                </p>
                <div className="flex justify-center">
                  <OTPDigitInput value={aadhaarOtp} onChange={setAadhaarOtp} />
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => { setTxnId(''); setAadhaarOtp(''); }} className="flex-1">
                    ← Back
                  </Button>
                  <Button onClick={verifyAadhaarOtp} disabled={loading || aadhaarOtp.length !== 6} className="flex-1">
                    {loading ? 'Verifying...' : 'Verify OTP'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {step === 'PAN' && (
            <Card>
              <CardHeader>
                <CardTitle>Verify PAN Card</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">Enter your PAN details exactly as printed on the card.</p>
                <div>
                  <label className="label mb-1.5 block">PAN Number</label>
                  <Input
                    placeholder="ABCDE1234F"
                    value={pan}
                    onChange={(e) => setPan(e.target.value.toUpperCase())}
                    maxLength={10}
                    className="text-center font-mono text-xl tracking-[0.2em]"
                  />
                </div>
                <div>
                  <label className="label mb-1.5 block">Name as on PAN Card *</label>
                  <Input
                    placeholder="RAVI KUMAR SHARMA"
                    value={panName}
                    onChange={(e) => setPanName(e.target.value.toUpperCase())}
                    className="uppercase"
                  />
                </div>
                <div>
                  <label className="label mb-1.5 block">Date of Birth</label>
                  <Input type="date" value={panDob} onChange={(e) => setPanDob(e.target.value)} />
                </div>
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep('AADHAAR')} className="flex-1">
                    ← Back
                  </Button>
                  <Button onClick={verifyPAN} disabled={loading || !pan || !panName} className="flex-1">
                    {loading ? 'Verifying...' : 'Verify PAN'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {step === 'FACE' && (
            <Card>
              <CardHeader>
                <CardTitle>Photo Verification</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">Take a clear selfie for face matching with your Aadhaar photo.</p>

                {!selfiePreview && !cameraActive && (
                  <Button onClick={startCamera} className="w-full" variant="outline" size="lg">
                    📷 Open Camera
                  </Button>
                )}

                {cameraActive && (
                  <div className="relative rounded-lg overflow-hidden bg-black aspect-square">
                    <video ref={videoRef} className="w-full h-full object-cover" playsInline muted />
                    <div className="absolute inset-0 border-4 border-dashed border-white/30 rounded-lg pointer-events-none" />
                    <div className="absolute bottom-4 left-0 right-0 flex justify-center">
                      <Button onClick={captureSelfie} size="lg" className="rounded-full w-16 h-16 bg-white text-primary">
                        <svg className="w-8 h-8" fill="currentColor" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" /></svg>
                      </Button>
                    </div>
                  </div>
                )}

                {selfiePreview && (
                  <div className="relative rounded-lg overflow-hidden bg-gray-100 aspect-square">
                    <img src={selfiePreview} alt="Selfie" className="w-full h-full object-cover" />
                    <Button variant="secondary" size="sm" className="absolute top-2 right-2" onClick={() => { setSelfiePreview(null); startCamera(); }}>
                      Retake
                    </Button>
                  </div>
                )}

                <canvas ref={canvasRef} className="hidden" />
                <div className="flex gap-3">
                  <Button variant="outline" onClick={() => setStep('PAN')} className="flex-1">
                    ← Back
                  </Button>
                  <Button onClick={submitFaceMatch} disabled={loading || !selfiePreview} className="flex-1">
                    {loading ? 'Verifying...' : 'Verify Face'}
                  </Button>
                </div>
              </CardContent>
            </Card>
          )}

          {step === 'COMPLETE' && (
            <Card className="decision-card-approved">
              <CardContent className="p-8 text-center space-y-4">
                <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto">
                  <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                  </svg>
                </div>
                <h3 className="text-xl font-bold text-green-800">KYC Verification Complete!</h3>
                <p className="text-sm text-green-700">
                  Your identity has been verified. Face match score: {faceScore}/100. Proceeding to document upload.
                </p>
                <Button onClick={proceedToDocuments} className="w-full" size="lg">
                  Upload Documents →
                </Button>
              </CardContent>
            </Card>
          )}
        </div>
      </main>
    </div>
  );
}
