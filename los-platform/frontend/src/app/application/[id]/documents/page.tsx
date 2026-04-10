'use client';
import { useState, useRef, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { StatusBadge } from '@/components/ui/components';
import { documentApi } from '@/lib/api';
import { formatCurrency } from '@/lib/utils';

const DOCUMENT_CHECKLIST = [
  { type: 'SALARY_SLIP_1', label: 'Salary Slip (Month 1)', required: true, category: 'income' },
  { type: 'SALARY_SLIP_2', label: 'Salary Slip (Month 2)', required: true, category: 'income' },
  { type: 'SALARY_SLIP_3', label: 'Salary Slip (Month 3)', required: true, category: 'income' },
  { type: 'BANK_STATEMENT_3M', label: 'Bank Statement (3 months)', required: true, category: 'income' },
  { type: 'PAN_CARD', label: 'PAN Card', required: true, category: 'id' },
  { type: 'AADHAAR_CARD', label: 'Aadhaar Card', required: true, category: 'id' },
  { type: 'ADDRESS_PROOF', label: 'Address Proof', required: false, category: 'address' },
  { type: 'ITR_2Y', label: 'ITR (Last 2 years)', required: false, category: 'income' },
];

export default function DocumentsPage() {
  const router = useRouter();
  const params = useParams();
  const id = params.id as string;
  const [documents, setDocuments] = useState<Record<string, { file: File; status: 'pending' | 'uploading' | 'uploaded' | 'ocr_failed'; ocrData?: Record<string, unknown> }>>({});
  const [dragging, setDragging] = useState<string | null>(null);
  const fileInputRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const handleFileSelect = useCallback(async (docType: string, file: File) => {
    if (file.size > 10 * 1024 * 1024) {
      toast.error('File size must be less than 10MB');
      return;
    }
    const allowedTypes = ['application/pdf', 'image/jpeg', 'image/png'];
    if (!allowedTypes.includes(file.type)) {
      toast.error('Only PDF, JPG, and PNG files are allowed');
      return;
    }

    setDocuments(prev => ({ ...prev, [docType]: { file, status: 'uploading' } }));

    try {
      const { data: presigned } = await documentApi.getPresignedUrl(id, docType, file.type);
      await documentApi.upload(presigned.url, file);
      const { data: ocrResult } = await documentApi.getOcrResult(presigned.documentId);
      setDocuments(prev => ({
        ...prev,
        [docType]: { file, status: 'uploaded', ocrData: ocrResult },
      }));
      toast.success(`${DOCUMENT_CHECKLIST.find(d => d.type === docType)?.label} uploaded${ocrResult?.validated ? ' & verified' : ''}`);
    } catch (err) {
      setDocuments(prev => ({ ...prev, [docType]: { file, status: 'ocr_failed' } }));
      toast.error('Upload failed. Please try again.');
    }
  }, [id]);

  const handleDrop = (e: React.DragEvent, docType: string) => {
    e.preventDefault();
    setDragging(null);
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(docType, file);
  };

  const handleSubmit = () => {
    const requiredDocs = DOCUMENT_CHECKLIST.filter(d => d.required);
    const missing = requiredDocs.filter(d => documents[d.type]?.status !== 'uploaded');
    if (missing.length > 0) {
      toast.error(`Please upload required documents: ${missing.map(d => d.label).join(', ')}`);
      return;
    }
    toast.success('Documents submitted! Proceeding to credit assessment...');
    router.push(`/application/${id}/decision`);
  };

  const completedCount = Object.values(documents).filter(d => d.status === 'uploaded').length;
  const progress = (completedCount / DOCUMENT_CHECKLIST.length) * 100;

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b sticky top-0 z-10">
        <div className="container py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 bg-primary rounded-lg flex items-center justify-center text-white font-bold text-sm">₹</div>
              <span className="font-bold">Documents</span>
            </div>
            <span className="text-muted-foreground">|</span>
            <span className="font-mono text-sm">{id.substring(0, 8)}...</span>
          </div>
          <StatusBadge status="DOCUMENT_COLLECTION" />
        </div>
      </header>

      <main id="main-content" className="container py-8">
        <div className="max-w-3xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-bold mb-1">Upload Documents</h1>
            <p className="text-muted-foreground">Upload the required documents. OCR will auto-validate your data.</p>
          </div>

          <div className="bg-white rounded-lg border p-4">
            <div className="flex justify-between text-sm mb-2">
              <span>{completedCount} of {DOCUMENT_CHECKLIST.length} uploaded</span>
              <span>{Math.round(progress)}%</span>
            </div>
            <div className="w-full bg-gray-200 rounded-full h-2">
              <div className="bg-primary h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
            </div>
          </div>

          <div className="grid gap-4">
            {DOCUMENT_CHECKLIST.map((doc) => {
              const uploaded = documents[doc.type];
              const statusIcon = {
                pending: '📄',
                uploading: '⏳',
                uploaded: '✅',
                ocr_failed: '⚠️',
              }[uploaded?.status || 'pending'];

              return (
                <Card key={doc.type} className={uploaded?.status === 'uploaded' ? 'border-green-300 bg-green-50/50' : ''}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <span className="text-2xl">{statusIcon}</span>
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <h4 className="font-medium">{doc.label}</h4>
                          {doc.required && <span className="text-xs bg-red-100 text-red-700 px-1.5 py-0.5 rounded">Required</span>}
                          {uploaded?.status === 'uploaded' && <span className="text-xs bg-green-100 text-green-700 px-1.5 py-0.5 rounded">Uploaded</span>}
                        </div>
                        {uploaded?.status === 'uploaded' && uploaded?.file && (
                          <p className="text-xs text-muted-foreground mt-1">{uploaded.file.name} • {(uploaded.file.size / 1024 / 1024).toFixed(1)} MB</p>
                        )}
                        {uploaded?.status === 'ocr_failed' && (
                          <p className="text-xs text-yellow-600 mt-1">Upload successful but OCR validation failed. Manual review needed.</p>
                        )}
                      </div>

                      {uploaded?.status !== 'uploaded' && (
                        <div
                          className={`document-upload-zone p-4 min-w-[200px] transition-all ${dragging === doc.type ? 'active' : ''}`}
                          onDragOver={(e) => { e.preventDefault(); setDragging(doc.type); }}
                          onDragLeave={() => setDragging(null)}
                          onDrop={(e) => handleDrop(e, doc.type)}
                          onClick={() => fileInputRefs.current[doc.type]?.click()}
                        >
                          <input
                            ref={(el) => { fileInputRefs.current[doc.type] = el; }}
                            type="file"
                            accept=".pdf,.jpg,.jpeg,.png"
                            className="hidden"
                            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileSelect(doc.type, f); }}
                          />
                          <div className="text-center">
                            <svg className="w-8 h-8 mx-auto text-gray-400 mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                            <p className="text-xs text-muted-foreground">
                              {uploaded?.status === 'uploading' ? 'Uploading...' : 'Drop or click'}
                            </p>
                            <p className="text-xs text-gray-400 mt-1">PDF, JPG, PNG • Max 10MB</p>
                          </div>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          <div className="flex justify-between">
            <Button variant="outline" onClick={() => router.push(`/application/${id}/kyc`)}>
              ← Back to KYC
            </Button>
            <Button onClick={handleSubmit} disabled={completedCount === 0}>
              Submit Documents & Proceed
            </Button>
          </div>
        </div>
      </main>
    </div>
  );
}
