import { APIRequestContext } from '@playwright/test';

export class AuthApi {
  private readonly baseUrl: string;
  private request: APIRequestContext;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
    this.request = null as any;
  }

  private async getRequest(): Promise<APIRequestContext> {
    if (!this.request) {
      this.request = await globalThis.request.newContext({
        baseURL: this.baseUrl,
      });
    }
    return this.request;
  }

  async sendOtp(mobile: string, purpose = 'LOGIN', channel = 'SMS') {
    const req = await this.getRequest();
    const response = await req.post('/auth/otp/send', {
      data: { mobile, purpose, channel },
    });
    const body = await response.json();
    return { status: response.status(), body, sessionId: body.sessionId };
  }

  async verifyOtp(mobile: string, otp: string, sessionId: string, deviceFingerprint?: string) {
    const req = await this.getRequest();
    const response = await req.post('/auth/otp/verify', {
      data: { mobile, otp, sessionId, deviceFingerprint },
    });
    const body = await response.json();
    return {
      status: response.status(),
      body,
      accessToken: body.accessToken,
      refreshToken: body.refreshToken,
    };
  }

  async otpLogin(mobile: string): Promise<{ accessToken: string; refreshToken: string; userId: string }> {
    const { sessionId } = await this.sendOtp(mobile);
    const result = await this.verifyOtp(mobile, '123456', sessionId);
    return {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      userId: result.body.user?.id || '',
    };
  }

  async ldapLogin(username: string, password: string) {
    const req = await this.getRequest();
    const response = await req.post('/auth/ldap/login', {
      data: { username, password },
    });
    const body = await response.json();
    return { status: response.status(), body, accessToken: body.accessToken };
  }

  async refreshToken(refreshToken: string) {
    const req = await this.getRequest();
    const response = await req.post('/auth/token/refresh', {
      data: { refreshToken },
    });
    const body = await response.json();
    return { status: response.status(), body };
  }

  async revokeToken(accessToken: string, reason = 'Test cleanup') {
    const req = await this.getRequest();
    await req.post('/auth/revoke', {
      data: { tokenOrJti: accessToken, reason },
    });
  }

  async logout(accessToken: string, sessionId: string) {
    const req = await this.getRequest();
    await req.post('/auth/logout', {
      headers: { Authorization: `Bearer ${accessToken}` },
      data: {},
    });
  }
}
