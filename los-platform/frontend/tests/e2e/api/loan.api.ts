import { APIRequestContext } from '@playwright/test';

export class LoanApplicationApi {
  private readonly baseUrl: string;
  private readonly accessToken: string;

  constructor(baseUrl: string, accessToken: string) {
    this.baseUrl = baseUrl;
    this.accessToken = accessToken;
  }

  private async request(): Promise<APIRequestContext> {
    const req = await globalThis.request.newContext({ baseURL: this.baseUrl });
    return req;
  }

  private authHeaders() {
    return { Authorization: `Bearer ${this.accessToken}` };
  }

  async createApplication(payload: {
    loanType: string;
    branchCode?: string;
    applicant: {
      fullName: string;
      dob: string;
      mobile: string;
      panNumber?: string;
    };
    employmentDetails: {
      employmentType: string;
      employerName?: string;
      netMonthlyIncome: number;
    };
    loanRequirement: {
      requestedAmount: number;
      tenureMonths: number;
    };
  }) {
    const req = await this.request();
    const response = await req.post('/applications', {
      headers: this.authHeaders(),
      data: payload,
    });
    const body = await response.json();
    return { status: response.status(), body, applicationId: body.applicationId };
  }

  async getApplication(applicationId: string) {
    const req = await this.request();
    const response = await req.get(`/applications/${applicationId}`, {
      headers: this.authHeaders(),
    });
    const body = await response.json();
    return { status: response.status(), body };
  }

  async submitApplication(applicationId: string) {
    const req = await this.request();
    const response = await req.post(`/applications/${applicationId}/submit`, {
      headers: this.authHeaders(),
    });
    const body = await response.json();
    return { status: response.status(), body };
  }

  async autoSave(applicationId: string, section: string, data: Record<string, unknown>) {
    const req = await this.request();
    const response = await req.patch(`/applications/${applicationId}/autosave`, {
      headers: { ...this.authHeaders(), 'X-Idempotency-Key': `autosave-${Date.now()}` },
      data: { section, data },
    });
    const body = await response.json();
    return { status: response.status(), body };
  }

  async calculateFOIR(applicationId: string) {
    const req = await this.request();
    const response = await req.get(`/applications/${applicationId}/foir`, {
      headers: this.authHeaders(),
    });
    const body = await response.json();
    return { status: response.status(), body };
  }

  async assignOfficer(applicationId: string) {
    const req = await this.request();
    const response = await req.post(`/applications/${applicationId}/assign-officer`, {
      headers: this.authHeaders(),
    });
    const body = await response.json();
    return { status: response.status(), body };
  }

  async listApplications(status?: string, page = 0, size = 20) {
    const req = await this.request();
    const params = new URLSearchParams({ page: String(page), size: String(size) });
    if (status) params.set('status', status);
    const response = await req.get(`/applications?${params}`, {
      headers: this.authHeaders(),
    });
    const body = await response.json();
    return { status: response.status(), body, applications: body.content || [] };
  }
}
