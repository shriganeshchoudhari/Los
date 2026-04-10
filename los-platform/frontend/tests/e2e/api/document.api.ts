import { APIRequestContext } from '@playwright/test';

export class DocumentApi {
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

  async getUploadUrl(applicationId: string, documentType: string, fileName: string, mimeType: string) {
    const req = await this.request();
    const response = await req.post('/upload-url', {
      headers: this.authHeaders(),
      data: { applicationId, documentType, fileName, mimeType },
    });
    const body = await response.json();
    return { status: response.status(), body, documentId: body.documentId, uploadUrl: body.uploadUrl };
  }

  async uploadToMinio(uploadUrl: string, fileBuffer: Buffer, mimeType: string) {
    const response = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': mimeType },
      body: fileBuffer,
    });
    return { status: response.status, ok: response.ok };
  }

  async confirmUpload(documentId: string, checksum?: string) {
    const req = await this.request();
    const response = await req.post('/confirm-upload', {
      headers: this.authHeaders(),
      data: { documentId, checksum },
    });
    const body = await response.json();
    return { status: response.status(), body };
  }

  async uploadDocument(
    applicationId: string,
    documentType: string,
    fileName: string,
    mimeType: string,
    fileBuffer: Buffer,
  ) {
    const { documentId, uploadUrl } = await this.getUploadUrl(applicationId, documentType, fileName, mimeType);
    if (!uploadUrl) return { error: 'Failed to get upload URL' };

    await this.uploadToMinio(uploadUrl, fileBuffer, mimeType);

    const checksum = 'mock-checksum-' + Date.now();
    return this.confirmUpload(documentId, checksum);
  }

  async getDocuments(applicationId: string, status?: string) {
    const req = await this.request();
    const params = status ? `?status=${status}` : '';
    const response = await req.get(`/applications/${applicationId}/documents${params}`, {
      headers: this.authHeaders(),
    });
    const body = await response.json();
    return { status: response.status(), body, documents: body.content || [] };
  }

  async reviewDocument(documentId: string, action: string, remarks?: string) {
    const req = await this.request();
    const response = await req.post(`/documents/${documentId}/review`, {
      headers: this.authHeaders(),
      data: { action, remarks },
    });
    const body = await response.json();
    return { status: response.status(), body };
  }

  async createChecklist(applicationId: string, documentTypes: string[]) {
    const req = await this.request();
    const response = await req.post('/checklist', {
      headers: this.authHeaders(),
      data: { applicationId, documentTypes },
    });
    const body = await response.json();
    return { status: response.status(), body };
  }

  async getChecklist(applicationId: string) {
    const req = await this.request();
    const response = await req.get(`/applications/${applicationId}/checklist`, {
      headers: this.authHeaders(),
    });
    const body = await response.json();
    return { status: response.status(), body };
  }

  async getStats(applicationId?: string) {
    const req = await this.request();
    const params = applicationId ? `?applicationId=${applicationId}` : '';
    const response = await req.get(`/stats${params}`, {
      headers: this.authHeaders(),
    });
    const body = await response.json();
    return { status: response.status(), body };
  }
}
