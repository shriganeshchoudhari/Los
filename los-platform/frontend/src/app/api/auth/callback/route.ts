import { NextRequest, NextResponse } from 'next/server';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { accessToken, refreshToken, expiresIn } = body;

    if (!accessToken || !refreshToken) {
      return NextResponse.json(
        { success: false, error: { code: 'INVALID_PAYLOAD', message: 'Missing tokens' } },
        { status: 400 },
      );
    }

    const response = NextResponse.json({ success: true });

    // Decode JWT to get user info for the client-side cookie
    let userInfo = {};
    try {
      const payloadBase64 = accessToken.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
      const payload = JSON.parse(Buffer.from(payloadBase64, 'base64').toString('utf-8'));
      userInfo = {
        id: payload.sub,
        fullName: payload.fullName,
        role: payload.role,
        permissions: payload.permissions || [],
        exp: payload.exp,
      };
    } catch (e) {
      console.error('Failed to parse JWT for userInfo cookie', e);
    }

    response.cookies.set('access_token', accessToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: expiresIn ?? 900,
    });

    response.cookies.set('refresh_token', refreshToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 7 * 24 * 60 * 60,
    });

    // Client-side readable cookie for UI state
    response.cookies.set('user_info', JSON.stringify(userInfo), {
      httpOnly: false, // Must be false for use-auth.ts to read it
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: expiresIn ?? 900,
    });

    return response;
  } catch {
    return NextResponse.json(
      { success: false, error: { code: 'SERVER_ERROR', message: 'Internal server error' } },
      { status: 500 },
    );
  }
}
