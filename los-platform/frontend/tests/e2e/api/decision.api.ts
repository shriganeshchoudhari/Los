import { APIRequestContext } from '@playwright/test';

export class DecisionApi {
  private readonly baseUrl: string;
  private readonly accessToken: string;

  constructor(baseUrl: string, accessToken: string) {
    this.baseUrl = baseUrl;
    this.accessToken = accessToken;
  }

  private async request(): Promise<APIRequestContext> {
    return globalThis.request.newContext({ baseURL: this.baseUrl });
  }

  private authHeaders() {
    return { Authorization: `Bearer ${this.accessToken}` };
  }

  async triggerDecision(applicationId: string) {
    const req = await this.request();
    const response = await req.post('/decisions/trigger', {
      headers: this.authHeaders(),
      data: { applicationId },
    });
    const body = await response.json();
    return { status: response.status(), body, decisionId: body.decisionId };
  }

  async getDecision(applicationId: string) {
    const req = await this.request();
    const response = await req.get(`/decisions/${applicationId}`, {
      headers: this.authHeaders(),
    });
    const body = await response.json();
    return { status: response.status(), body };
  }

  async requestOverride(
    applicationId: string,
    requestedDecision: string,
    requestedAmount?: number,
    requestedTenure?: number,
    requestedRate?: number,
    remarks?: string,
  ) {
    const req = await this.request();
    const response = await req.post('/decisions/override/request', {
      headers: this.authHeaders(),
      data: {
        applicationId,
        requestedDecision,
        requestedAmount,
        requestedTenure,
        requestedRate,
        remarks: remarks || 'Test override request',
        authorityLevel: 'BRANCH_MANAGER',
      },
    });
    const body = await response.json();
    return { status: response.status(), body, requestId: body.requestId };
  }

  async approveOverride(requestId: string, remarks?: string) {
    const req = await this.request();
    const response = await req.post('/decisions/override/approve', {
      headers: this.authHeaders(),
      data: { requestId, action: 'APPROVED', remarks: remarks || 'Approved' },
    });
    const body = await response.json();
    return { status: response.status(), body };
  }

  async rejectOverride(requestId: string, reason?: string) {
    const req = await this.request();
    const response = await req.post('/decisions/override/approve', {
      headers: this.authHeaders(),
      data: { requestId, action: 'REJECTED', remarks: reason || 'Rejected' },
    });
    const body = await response.json();
    return { status: response.status(), body };
  }

  async listPendingOverrides() {
    const req = await this.request();
    const response = await req.get('/decisions/override/pending', {
      headers: this.authHeaders(),
    });
    const body = await response.json();
    return { status: response.status(), body, overrides: body.content || [] };
  }

  async getRatePreview(productCode: string, amount: number, tenure: number, creditGrade: string) {
    const req = await this.request();
    const response = await req.get('/rates/preview', {
      headers: this.authHeaders(),
      params: { productCode, amount: String(amount), tenure: String(tenure), creditGrade },
    });
    const body = await response.json();
    return { status: response.status(), body };
  }
}
