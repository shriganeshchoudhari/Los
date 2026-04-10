import { APIRequestContext } from '@playwright/test';

export class KycApi {
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

  async captureConsent(applicationId: string, consentType = 'KYC_AADHAAR_EKYC') {
    const req = await this.request();
    const response = await req.post('/kyc/consent', {
      headers: this.authHeaders(),
      data: {
        applicationId,
        consentType,
        consentText: 'I consent to Aadhaar eKYC verification',
      },
    });
    return { status: response.status(), body: await response.json() };
  }

  async initiateAadhaarKYC(applicationId: string) {
    const consent = await this.captureConsent(applicationId);
    if (consent.status !== 201) return consent;

    const req = await this.request();
    const response = await req.post('/kyc/aadhaar/init', {
      headers: this.authHeaders(),
      data: { applicationId, consentOtpSessionId: consent.body.sessionId || 'mock' },
    });
    const body = await response.json();
    return { status: response.status(), body, txnId: body.txnId, uidaiRefId: body.uidaiRefId };
  }

  async verifyAadhaarOTP(applicationId: string, txnId: string, uidaiRefId: string, otp = '123456') {
    const req = await this.request();
    const response = await req.post('/kyc/aadhaar/verify', {
      headers: this.authHeaders(),
      data: { applicationId, txnId, uidaiRefId, otp },
    });
    const body = await response.json();
    return { status: response.status(), body };
  }

  async verifyPAN(applicationId: string, pan: string, fullName: string, dob: string) {
    const req = await this.request();
    const response = await req.post('/kyc/pan/verify', {
      headers: this.authHeaders(),
      data: { applicationId, panNumber: pan, fullName, dob },
    });
    const body = await response.json();
    return { status: response.status(), body };
  }

  async performFaceMatch(applicationId: string, selfieBase64?: string) {
    const req = await this.request();
    const response = await req.post('/kyc/face/match', {
      headers: this.authHeaders(),
      data: {
        applicationId,
        selfieImageBase64: selfieBase64 || 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
      },
    });
    const body = await response.json();
    return { status: response.status(), body };
  }

  async checkKycCompletion(applicationId: string) {
    const req = await this.request();
    const response = await req.post('/kyc/check-completion', {
      headers: this.authHeaders(),
      data: { applicationId },
    });
    const body = await response.json();
    return { status: response.status(), body };
  }

  async getKycStatus(applicationId: string) {
    const req = await this.request();
    const response = await req.get(`/kyc/${applicationId}`, {
      headers: this.authHeaders(),
    });
    const body = await response.json();
    return { status: response.status(), body };
  }

  async fullKycFlow(applicationId: string, aadhaar: string, pan: string, fullName: string, dob: string) {
    const consent = await this.captureConsent(applicationId);
    if (consent.status !== 201) return { error: 'Consent failed', consent };

    const init = await this.initiateAadhaarKYC(applicationId);
    if (init.status !== 200) return { error: 'Aadhaar init failed', init };

    const verifyAadhaar = await this.verifyAadhaarOTP(applicationId, init.txnId!, init.uidaiRefId!);
    if (verifyAadhaar.status !== 200) return { error: 'Aadhaar verify failed', verifyAadhaar };

    const verifyPan = await this.verifyPAN(applicationId, pan, fullName, dob);
    if (verifyPan.status !== 200) return { error: 'PAN verify failed', verifyPan };

    const faceMatch = await this.performFaceMatch(applicationId);

    const completion = await this.checkKycCompletion(applicationId);
    return { completion, faceMatch };
  }
}
