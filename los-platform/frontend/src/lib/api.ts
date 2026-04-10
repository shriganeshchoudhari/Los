import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import Cookies from 'js-cookie';
import { toast } from 'sonner';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';

const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
});

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = Cookies.get('access_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  config.headers['X-Request-Id'] = `req-${Date.now()}-${Math.random().toString(36).substring(7)}`;
  config.headers['X-Correlation-Id'] = config.headers['X-Request-Id'];
  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<{ message?: string; code?: string }>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = Cookies.get('refresh_token');

      if (refreshToken) {
        try {
          const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });
          Cookies.set('access_token', data.accessToken, { expires: 1 / 96 });
          if (data.refreshToken) Cookies.set('refresh_token', data.refreshToken, { expires: 7 });
          originalRequest.headers!.Authorization = `Bearer ${data.accessToken}`;
          return api(originalRequest);
        } catch {
          Cookies.remove('access_token');
          Cookies.remove('refresh_token');
          window.location.href = '/login';
        }
      } else {
        window.location.href = '/login';
      }
    }

    if (error.response?.status === 409) {
      toast.error('Version conflict — please refresh and try again.');
    }
    if (error.response?.status === 429) {
      toast.error('Too many requests. Please wait a moment.');
    }
    if (error.response?.status >= 500) {
      toast.error('Server error. Please try again later.');
    }

    return Promise.reject(error);
  },
);

export const authApi = {
  sendOtp: (mobile: string, purpose: string, channel: 'SMS' | 'WHATSAPP' = 'SMS') =>
    api.post('/auth/otp/send', { mobile, purpose, channel }),

  verifyOtp: (sessionId: string, mobile: string, otp: string) =>
    api.post('/auth/otp/verify', { sessionId, mobile, otp }),

  refresh: (refreshToken: string) => api.post('/auth/refresh', { refreshToken }),

  logout: () => api.post('/auth/logout'),

  getProfile: () => api.get('/auth/profile'),
};

export const loanApi = {
  list: (params?: { page?: number; limit?: number; status?: string; branchCode?: string }) =>
    api.get('/applications', { params }),

  get: (id: string) => api.get(`/applications/${id}`),

  create: (data: unknown) => api.post('/applications', data),

  update: (id: string, data: unknown) => api.patch(`/applications/${id}`, data),

  submit: (id: string) => api.post(`/applications/${id}/submit`),

  autosave: (id: string, section: string, data: unknown) =>
    api.patch(`/applications/${id}/autosave`, { section, data }),

  getStageHistory: (id: string) => api.get(`/applications/${id}/history`),

  assign: (id: string, officerId: string) =>
    api.post(`/applications/${id}/assign`, { officerId }),
};

export const kycApi = {
  initiateAadhaarOtp: (aadhaarNumber: string, applicationId: string) =>
    api.post('/kyc/aadhaar/init', { aadhaarNumber, applicationId }),

  verifyAadhaarOtp: (txnId: string, otp: string, applicationId: string) =>
    api.post('/kyc/aadhaar/verify', { txnId, otp, applicationId }),

  verifyPAN: (panNumber: string, fullName: string, dob: string, applicationId: string) =>
    api.post('/kyc/pan/verify', { panNumber, fullName, dob, applicationId }),

  faceMatch: (applicationId: string, selfieImageBase64: string) =>
    api.post('/kyc/face/match', { applicationId, selfieImageBase64 }),

  livenessCheck: (applicationId: string, selfieImageBase64: string) =>
    api.post('/kyc/face/liveness', { applicationId, selfieImageBase64 }),

  getConsent: (applicationId: string) =>
    api.get(`/kyc/consent/${applicationId}`),

  captureConsent: (applicationId: string, consentType: string) =>
    api.post('/kyc/consent', { applicationId, consentType }),
};

export const documentApi = {
  getPresignedUrl: (applicationId: string, documentType: string, mimeType: string) =>
    api.post('/documents/presigned-url', { applicationId, documentType, mimeType }),

  upload: async (presignedUrl: string, file: File): Promise<void> => {
    await axios.put(presignedUrl, file, {
      headers: { 'Content-Type': file.type },
      timeout: 60_000,
    });
  },

  list: (applicationId: string) =>
    api.get(`/documents/${applicationId}`),

  getOcrResult: (documentId: string) =>
    api.get(`/documents/${documentId}/ocr`),

  approve: (documentId: string, remarks?: string) =>
    api.post(`/documents/${documentId}/approve`, { remarks }),

  reject: (documentId: string, reason: string) =>
    api.post(`/documents/${documentId}/reject`, { reason }),
};

export const bureauApi = {
  pull: (applicationId: string, consentOtp: string) =>
    api.post('/integration/bureau/pull', { applicationId, consentOtp }),

  getReports: (applicationId: string) =>
    api.get(`/integration/bureau/reports`, { params: { applicationId } }),
};

export const decisionApi = {
  trigger: (applicationId: string) =>
    api.post(`/decisions/trigger`, { applicationId }),

  get: (applicationId: string) =>
    api.get(`/decisions/${applicationId}`),

  override: (applicationId: string, decision: string, reason: string) =>
    api.post(`/decisions/${applicationId}/override`, { decision, reason }),
};

export const disbursementApi = {
  initiate: (applicationId: string, amount: number, accountNumber: string, ifsc: string) =>
    api.post('/integration/disbursement', { applicationId, amount, beneficiaryAccountNumber: accountNumber, beneficiaryIfsc: ifsc }),

  getStatus: (disbursementId: string) =>
    api.get(`/integration/disbursement/${disbursementId}`),

  list: (applicationId?: string) =>
    api.get('/integration/disbursement', { params: { applicationId } }),
};

export const sanctionLetterApi = {
  getPreview: (applicationId: string) =>
    api.get(`/sanction-letter/${applicationId}/preview`),

  downloadPdf: (applicationId: string) =>
    api.get(`/sanction-letter/${applicationId}/pdf`, { responseType: 'blob' }),
};

export const loanAgreementApi = {
  generate: (applicationId: string) =>
    api.post('/loan-agreement/generate', { applicationId }),

  get: (applicationId: string) =>
    api.get(`/loan-agreement/application/${applicationId}`),

  initiateESign: (applicationId: string, signerName: string, signerMobile: string, signerEmail: string) =>
    api.post('/loan-agreement/esign/initiate', { applicationId, signerName, signerMobile, signerEmail }),

  verifyESign: (transactionId: string, otp: string, aadhaarLast4: string) =>
    api.post('/loan-agreement/esign/verify', { transactionId, otp, aadhaarLast4 }),

  cancelESign: (transactionId: string, reason: string) =>
    api.post('/loan-agreement/esign/cancel', { transactionId, reason }),

  getSignatures: (agreementId: string) =>
    api.get(`/loan-agreement/signatures/${agreementId}`),

  downloadPdf: (applicationId: string) =>
    api.get(`/loan-agreement/document/${applicationId}/pdf`, { responseType: 'blob' }),
};

export const auditApi = {
  list: (params?: { category?: string; applicationId?: string; actorId?: string; dateRange?: string; page?: number; size?: number }) =>
    api.get('/audit-logs', { params }),

  exportCsv: (params?: { category?: string; dateRange?: string }) =>
    api.get('/audit-logs/export', { params }),
};

export const notificationApi = {
  send: (channel: string, recipientId: string, templateName: string, variables: Record<string, unknown>, applicationId?: string) =>
    api.post('/notifications/send', { channel, recipientId, templateName, variables, applicationId }),

  history: (params?: { applicationId?: string; page?: number; limit?: number }) =>
    api.get('/notifications/history', { params }),
};

export default api;
