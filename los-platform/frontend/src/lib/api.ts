import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { toast } from 'sonner';

// Evaluate URLs dynamically to support potential changes at runtime (though usually static in build-time Next.js)
const getBaseURL = (envVar: string, fallback: string) => 
  (typeof process !== 'undefined' && process.env[envVar]) || fallback;

const AUTH_SERVICE_URL = getBaseURL('NEXT_PUBLIC_AUTH_SERVICE_URL', 'http://localhost:8082/api');
const KYC_SERVICE_URL = getBaseURL('NEXT_PUBLIC_KYC_SERVICE_URL', 'http://localhost:8082/api');
const LOAN_SERVICE_URL = getBaseURL('NEXT_PUBLIC_LOAN_SERVICE_URL', 'http://localhost:8082/api');
const DOCUMENT_SERVICE_URL = getBaseURL('NEXT_PUBLIC_DOCUMENT_SERVICE_URL', 'http://localhost:8082/api');
const DECISION_SERVICE_URL = getBaseURL('NEXT_PUBLIC_DECISION_SERVICE_URL', 'http://localhost:8082/api');
const INTEGRATION_SERVICE_URL = getBaseURL('NEXT_PUBLIC_INTEGRATION_SERVICE_URL', 'http://localhost:8082/api');
const NOTIFICATION_SERVICE_URL = getBaseURL('NEXT_PUBLIC_NOTIFICATION_SERVICE_URL', 'http://localhost:8082/api');
const DSA_SERVICE_URL = getBaseURL('NEXT_PUBLIC_DSA_SERVICE_URL', 'http://localhost:8082/api');

function addCorrelationId(config: InternalAxiosRequestConfig): InternalAxiosRequestConfig {
  const requestId = `req-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  config.headers['X-Request-Id'] = requestId;
  config.headers['X-Correlation-Id'] = requestId;
  return config;
}

function handleError(error: AxiosError<{ message?: string; code?: string }>): Promise<never> {
  const status = error.response?.status;
  const message = error.response?.data?.message || 'An unexpected error occurred.';

  if (status === 401) {
    // 401 is primarily handled by the interceptor, but we fallback here if needed
    console.warn('Unauthorized access — redirecting or refreshing...');
  } else if (status === 403) {
    toast.error('Permission denied: You do not have access to this resource.');
  } else if (status === 404) {
    toast.error('Resource not found.');
  } else if (status === 409) {
    toast.error('Version conflict — please refresh and try again.');
  } else if (status === 422) {
    toast.error(`Validation error: ${message}`);
  } else if (status === 429) {
    toast.error('Too many requests. Please wait a moment.');
  } else if (status && status >= 500) {
    toast.error('Server error. Please try again later.');
  }
  
  return Promise.reject(error);
}

function createServiceApi(baseURL: string, requiresAuth = true): AxiosInstance {
  const instance = axios.create({ 
    baseURL, 
    timeout: 30_000, 
    headers: { 'Content-Type': 'application/json' },
    withCredentials: true 
  });

  instance.interceptors.request.use((config) => {
    config = addCorrelationId(config);
    return config;
  });

  instance.interceptors.response.use(
    (response) => response,
    async (error: AxiosError<{ message?: string; code?: string }>) => {
      const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

      if (error.response?.status === 401 && !originalRequest._retry && requiresAuth) {
        originalRequest._retry = true;
        try {
          const refreshRes = await fetch('/api/auth/refresh', { method: 'POST' });
          if (refreshRes.ok) {
            return instance(originalRequest);
          }
        } catch {
          // ignore network error
        }
        if (typeof window !== 'undefined') window.location.href = '/login';
        return Promise.reject(error);
      }
      return handleError(error);
    },
  );

  return instance;
}

const authSvc = createServiceApi(AUTH_SERVICE_URL, false);
const kycSvc = createServiceApi(KYC_SERVICE_URL);
const loanSvc = createServiceApi(LOAN_SERVICE_URL);
const docSvc = createServiceApi(DOCUMENT_SERVICE_URL);
const decisionSvc = createServiceApi(DECISION_SERVICE_URL);
const integrationSvc = createServiceApi(INTEGRATION_SERVICE_URL);
const notificationSvc = createServiceApi(NOTIFICATION_SERVICE_URL);
const dsaSvc = createServiceApi(DSA_SERVICE_URL);

export const authApi = {
  sendOtp: (mobile: string, purpose: string, channel: 'SMS' | 'WHATSAPP' = 'SMS') =>
    authSvc.post('/auth/otp/send', { mobile, purpose, channel }),
  verifyOtp: (sessionId: string, mobile: string, otp: string) =>
    authSvc.post('/auth/otp/verify', { sessionId, mobile, otp }),
  refresh: (refreshToken: string) => authSvc.post('/auth/token/refresh', { refreshToken }),
  logout: () => authSvc.post('/auth/logout'),
  getProfile: () => authSvc.get('/auth/profile'),
};

export const loanApi = {
  list: (params?: { page?: number; limit?: number; status?: string; branchCode?: string }) =>
    loanSvc.get('/applications', { params }),
  get: (id: string) => loanSvc.get(`/applications/${id}`),
  create: (data: unknown) => loanSvc.post('/applications', data),
  update: (id: string, data: unknown) => loanSvc.patch(`/applications/${id}`, data),
  submit: (id: string) => loanSvc.post(`/applications/${id}/submit`),
  autosave: (id: string, section: string, data: unknown) =>
    loanSvc.patch(`/applications/${id}/autosave`, { section, data }),
  getStageHistory: (id: string) => loanSvc.get(`/applications/${id}/history`),
  assign: (id: string, officerId: string) =>
    loanSvc.post(`/applications/${id}/assign`, { officerId }),
  submitDecision: (
    id: string,
    decision: { action: 'APPROVED' | 'CONDITIONALLY_APPROVED' | 'REJECTED'; remarks?: string; sanctionedAmount?: number; rateOfInterestBps?: number; tenureMonths?: number },
  ) => loanSvc.patch(`/applications/${id}/decision`, decision),
};

export const kycApi = {
  initiateAadhaarOtp: (aadhaarNumber: string, applicationId: string) =>
    kycSvc.post('/kyc/aadhaar/init', { aadhaarNumber, applicationId }),
  verifyAadhaarOtp: (txnId: string, otp: string, applicationId: string) =>
    kycSvc.post('/kyc/aadhaar/verify', { txnId, otp, applicationId }),
  verifyPAN: (panNumber: string, fullName: string, dob: string, applicationId: string) =>
    kycSvc.post('/kyc/pan/verify', { panNumber, fullName, dob, applicationId }),
  faceMatch: (applicationId: string, selfieImageBase64: string) =>
    kycSvc.post('/kyc/face/match', { applicationId, selfieImageBase64 }),
  livenessCheck: (applicationId: string, selfieImageBase64: string) =>
    kycSvc.post('/kyc/face/liveness', { applicationId, selfieImageBase64 }),
  getConsent: (applicationId: string) =>
    kycSvc.get(`/kyc/consent/${applicationId}`),
  captureConsent: (applicationId: string, consentType: string) =>
    kycSvc.post('/kyc/consent', { applicationId, consentType }),
};

export const documentApi = {
  getPresignedUrl: (applicationId: string, documentType: string, mimeType: string) =>
    docSvc.post('/documents/presigned-url', { applicationId, documentType, mimeType }),
  upload: async (presignedUrl: string, file: File): Promise<void> => {
    await axios.put(presignedUrl, file, {
      headers: { 'Content-Type': file.type },
      timeout: 60_000,
    });
  },
  list: (applicationId: string) => docSvc.get(`/documents/application/${applicationId}`),
  getOcrResult: (documentId: string) => docSvc.get(`/documents/${documentId}/ocr`),
  approve: (documentId: string, remarks?: string) =>
    docSvc.post(`/documents/${documentId}/approve`, { remarks }),
  reject: (documentId: string, reason: string) =>
    docSvc.post(`/documents/${documentId}/reject`, { reason }),
};

export const bureauApi = {
  pull: (applicationId: string, consentOtp: string) =>
    integrationSvc.post('/integration/bureau/pull', { applicationId, consentOtp }),
  getReports: (applicationId: string) =>
    integrationSvc.get(`/integration/bureau/${applicationId}`),
};

export const decisionApi = {
  trigger: (applicationId: string) =>
    decisionSvc.post(`/decisions/trigger`, { applicationId }),
  get: (applicationId: string) => decisionSvc.get(`/decisions/${applicationId}`),
  override: (applicationId: string, decision: string, status: string, reason: string) =>
    decisionSvc.post('/decisions/override', { 
      applicationId, 
      decision, 
      status, 
      remarks: reason 
    }),
};

export const disbursementApi = {
  initiate: (applicationId: string, amount: number, accountNumber: string, ifsc: string) =>
    integrationSvc.post('/integration/disburse', {
      applicationId, amount, beneficiaryAccountNumber: accountNumber, beneficiaryIfsc: ifsc,
    }),
  getStatus: (loanId: string) =>
    integrationSvc.get(`/integration/disburse/${loanId}`),
  list: (loanId: string) =>
    integrationSvc.get(`/integration/disburse/${loanId}`),
};

export const sanctionLetterApi = {
  getPreview: (applicationId: string) =>
    loanSvc.get(`/sanction-letter/${applicationId}/preview`),
  downloadPdf: (applicationId: string) =>
    loanSvc.get(`/sanction-letter/${applicationId}/pdf`, { responseType: 'blob' }),
};

export const loanAgreementApi = {
  generate: (applicationId: string) =>
    loanSvc.post('/loan-agreement/generate', { applicationId }),
  get: (applicationId: string) =>
    loanSvc.get(`/loan-agreement/application/${applicationId}`),
  initiateESign: (applicationId: string, signerName: string, signerMobile: string, signerEmail: string) =>
    loanSvc.post('/loan-agreement/esign/initiate', { applicationId, signerName, signerMobile, signerEmail }),
  verifyESign: (transactionId: string, otp: string, aadhaarLast4: string) =>
    loanSvc.post('/loan-agreement/esign/verify', { transactionId, otp, aadhaarLast4 }),
  cancelESign: (transactionId: string, reason: string) =>
    loanSvc.post('/loan-agreement/esign/cancel', { transactionId, reason }),
  getSignatures: (agreementId: string) =>
    loanSvc.get(`/loan-agreement/signatures/${agreementId}`),
  downloadPdf: (applicationId: string) =>
    loanSvc.get(`/loan-agreement/document/${applicationId}/pdf`, { responseType: 'blob' }),
};

export const auditApi = {
  list: (params?: { category?: string; applicationId?: string; actorId?: string; dateRange?: string; page?: number; size?: number }) =>
    loanSvc.get('/audit-logs', { params }),
  exportCsv: (params?: { category?: string; dateRange?: string }) =>
    loanSvc.get('/audit-logs/export', { params }),
};

export const notificationApi = {
  send: (channel: string, recipientId: string, templateName: string, variables: Record<string, unknown>, applicationId?: string) =>
    notificationSvc.post('/notifications/send', { channel, recipientId, templateName, variables, applicationId }),
  history: (recipientId: string, params?: { page?: number; limit?: number }) =>
    notificationSvc.get(`/notifications/history/${recipientId}`, { params }),
};

export const dsaApi = {
  login: (partnerCode: string, password: string) =>
    dsaSvc.post('/dsa/auth/login', { partnerCode, password }),
  register: (data: unknown) => dsaSvc.post('/dsa/partners/register', data),
  getDashboard: () => dsaSvc.get('/dsa/dashboard'),
  listApplications: (params?: { page?: number; limit?: number }) =>
    dsaSvc.get('/dsa/applications', { params }),
  getApplication: (id: string) => dsaSvc.get(`/dsa/applications/${id}`),
  listOfficers: () => dsaSvc.get('/dsa/officers'),
  getCommissions: (params?: { status?: string }) =>
    dsaSvc.get('/dsa/commissions', { params }),
  getProfile: () => dsaSvc.get('/dsa/profile'),
};

export {
  authSvc,
  kycSvc,
  loanSvc,
  docSvc,
  decisionSvc,
  integrationSvc,
  notificationSvc,
  dsaSvc,
};
