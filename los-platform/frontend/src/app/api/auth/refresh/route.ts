import { NextRequest, NextResponse } from 'next/server';

/**
 * Token Refresh Route
 * 
 * This route is called by the frontend Axios interceptor when an access token expires (401).
 * It uses the HttpOnly refresh_token cookie to request a new access token from the backend.
 * If successful, it updates the cookies and allows the frontend to retry the original request.
 */
export async function POST(request: NextRequest) {
  try {
    const refreshToken = request.cookies.get('refresh_token')?.value;

    if (!refreshToken) {
      console.warn('Refresh attempt without refresh_token cookie');
      return NextResponse.json(
        { success: false, error: { code: 'NO_REFRESH_TOKEN', message: 'No refresh token found' } },
        { status: 401 }
      );
    }

    // Backend URL from env or fallback
    const backendUrl = process.env.NEXT_PUBLIC_AUTH_SERVICE_URL || 'http://localhost:8082/api';
    
    logRefreshAttempt(request);

    const backendResponse = await fetch(`${backendUrl}/auth/token/refresh`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Request-Id': `refresh-${Date.now()}`,
      },
      body: JSON.stringify({
        refreshToken,
        deviceFingerprint: request.headers.get('X-Device-Fingerprint') || 'WEB_BROWSER',
      }),
    });

    if (!backendResponse.ok) {
      const errorData = await backendResponse.json().catch(() => ({}));
      console.error('Backend refresh failed:', errorData);
      
      const response = NextResponse.json(
        { success: false, error: errorData },
        { status: backendResponse.status }
      );
      
      // Clear cookies on failure to force re-login
      response.cookies.delete('access_token');
      response.cookies.delete('refresh_token');
      response.cookies.delete('user_info');
      
      return response;
    }

    const body = await backendResponse.json();
    const loginData = body.data;

    if (!loginData || !loginData.accessToken) {
      throw new Error('Invalid response from auth service: missing accessToken');
    }

    const nextResponse = NextResponse.json({ success: true });

    // Set Access Token
    nextResponse.cookies.set('access_token', loginData.accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: loginData.expiresIn || 900, // 15 mins default
    });

    // Set Refresh Token (if rotated)
    if (loginData.refreshToken) {
      nextResponse.cookies.set('refresh_token', loginData.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: 7 * 24 * 60 * 60, // 7 days
      });
    }

    // Update client-side user info if possible
    try {
      const payloadBase64 = loginData.accessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString('utf-8'));
      const userInfo = {
        id: payload.sub,
        fullName: payload.fullName,
        role: payload.role,
        permissions: payload.permissions || [],
        exp: payload.exp,
      };
      
      nextResponse.cookies.set('user_info', JSON.stringify(userInfo), {
        httpOnly: false,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        path: '/',
        maxAge: loginData.expiresIn || 900,
      });
    } catch (e) {
      console.warn('Failed to update user_info cookie during refresh', e);
    }

    return nextResponse;

  } catch (error) {
    console.error('Token refresh route error:', error);
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: 'Internal server error during refresh' } },
      { status: 500 }
    );
  }
}

function logRefreshAttempt(req: NextRequest) {
  const ip = req.headers.get('x-forwarded-for') || 'unknown';
  console.log(`[AUTH] Refresh attempt from IP: ${ip} at ${new Date().toISOString()}`);
}
