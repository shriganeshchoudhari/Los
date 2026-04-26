import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import Cookies from 'js-cookie';
import { toast } from 'sonner';

const DSA_API_BASE = process.env.NEXT_PUBLIC_DSA_API_BASE_URL || 'http://localhost:3008';

const dsaApi: AxiosInstance = axios.create({
  baseURL: DSA_API_BASE,
  timeout: 30_000,
  headers: { 'Content-Type': 'application/json' },
});

dsaApi.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = Cookies.get('dsa_access_token');
  if (token && config.headers) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

dsaApi.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<{ message?: string; status?: number }>) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & { _retry?: boolean };

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = Cookies.get('dsa_refresh_token');
      if (refreshToken) {
        try {
          const { data } = await axios.post(`${DSA_API_BASE}/auth/refresh`, { refreshToken });
          Cookies.set('dsa_access_token', data.accessToken, { expires: 1 / 96 });
          Cookies.set('dsa_refresh_token', data.refreshToken, { expires: 7 });
          originalRequest.headers!.Authorization = `Bearer ${data.accessToken}`;
          return dsaApi(originalRequest);
        } catch {
          Cookies.remove('dsa_access_token');
          Cookies.remove('dsa_refresh_token');
          window.location.href = '/dsa/login';
        }
      } else {
        window.location.href = '/dsa/login';
      }
    }

    if (error.response?.status === 409) {
      toast.error(error.response?.data?.message || 'Conflict — please try again.');
    }
    if (error.response?.status === 429) {
      toast.error('Too many requests. Please wait a moment.');
    }
    if ((error.response?.status ?? 0) >= 500) {
      toast.error('Server error. Please try again later.');
    }

    return Promise.reject(error);
  },
);

export const dsaAuthApi = {
  login: (partnerCode: string, password: string) =>
    dsaApi.post('/auth/login', { partnerCode, password }),

  officerLogin: (employeeCode: string, password: string) =>
    dsaApi.post('/officers/login', { employeeCode, password }),

  register: (data: {
    partnerName: string;
    partnerType: string;
    pan: string;
    gstin?: string;
    registeredAddress: string;
    city: string;
    state: string;
    pincode: string;
    contactName: string;
    contactMobile: string;
    contactEmail: string;
    primaryBankAccount: string;
    primaryIfsc: string;
    bankAccountHolder: string;
    commissionType?: string;
    territoryCodes?: string[];
    allowedProducts?: string[];
    minLoanAmount?: number;
    maxLoanAmount?: number;
  }) => dsaApi.post('/auth/register', data),

  refresh: (refreshToken: string) =>
    dsaApi.post('/auth/refresh', { refreshToken }),
};

export const dsaDashboardApi = {
  get: () => dsaApi.get('/dashboard'),
};

export const dsaApplicationApi = {
  list: (params?: { status?: string; page?: number; size?: number }) =>
    dsaApi.get('/applications', { params }),

  get: (id: string) => dsaApi.get(`/applications/${id}`),

  create: (data: {
    customerName: string;
    customerMobile: string;
    customerPan?: string;
    loanType: string;
    requestedAmount: number;
    requestedTenureMonths: number;
    purpose?: string;
    utmSource?: string;
    utmMedium?: string;
    utmCampaign?: string;
    sourceLeadId?: string;
    remarks?: string;
  }) => dsaApi.post('/applications', data),
};

export const dsaOfficerApi = {
  list: () => dsaApi.get('/officers'),

  create: (data: {
    fullName: string;
    mobile: string;
    email: string;
    designation: string;
    department?: string;
    territoryCodes?: string[];
    allowedProducts?: string[];
    maxSanctionAuthority?: number;
  }) => dsaApi.post('/officers', data),
};

export const dsaCommissionApi = {
  summary: () => dsaApi.get('/commissions'),

  history: (params?: { page?: number; size?: number }) =>
    dsaApi.get('/commissions/history', { params }),
};

export const dsaProfileApi = {
  get: () => dsaApi.get('/profile'),
};

export const dsaBankApi = {
  listPartners: (params?: { status?: string; partnerType?: string; search?: string; page?: number; size?: number }) =>
    dsaApi.get('/admin/partners', { params }),

  approvePartner: (partnerId: string, data: {
    status: string;
    rejectionReason?: string;
    upfrontCommissionBps?: number;
    trailCommissionBps?: number;
    remarks?: string;
  }) => dsaApi.patch(`/admin/partners/${partnerId}/approve`, data),

  processPayout: (partnerId: string, payoutMonth: string) =>
    dsaApi.post('/admin/commissions/payout', { partnerId, payoutMonth }),
};

export default dsaApi;
