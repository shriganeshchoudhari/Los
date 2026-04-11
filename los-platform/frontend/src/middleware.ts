import { NextRequest, NextResponse } from 'next/server';

const PROTECTED_PATHS = [
  '/dashboard',
  '/application',
  '/analyst',
  '/manager',
  '/compliance',
];

const DSA_PATHS = ['/dsa'];

const AUTH_PATHS = ['/login', '/dsa/login'];

function decodeJWTPayload(token: string): Record<string, unknown> | null {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const padded = base64.padEnd(base64.length + ((4 - (base64.length % 4)) % 4), '=');
    return JSON.parse(Buffer.from(padded, 'base64').toString('utf-8'));
  } catch {
    return null;
  }
}

function isTokenExpired(expiresAt: number): boolean {
  return Date.now() >= expiresAt * 1000;
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const accessToken = request.cookies.get('access_token')?.value;
  const isDsaRequest = DSA_PATHS.some((p) => pathname.startsWith(p));
  const isProtected = PROTECTED_PATHS.some((p) => pathname.startsWith(p));
  const isAuthPage = AUTH_PATHS.some((p) => pathname.startsWith(p));

  if (accessToken) {
    const payload = decodeJWTPayload(accessToken);
    const tokenExpired = payload?.exp ? isTokenExpired(payload.exp as number) : true;

    if (!tokenExpired) {
      if (isAuthPage) {
        const redirectUrl = isDsaRequest ? '/dsa/dashboard' : '/dashboard';
        return NextResponse.redirect(new URL(redirectUrl, request.url));
      }
      return NextResponse.next();
    }
  }

  if (isProtected || (isDsaRequest && !pathname.includes('/dsa/login'))) {
    const loginUrl = isDsaRequest ? '/dsa/login' : '/login';
    const redirectUrl = new URL(loginUrl, request.url);
    redirectUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(redirectUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico|css|js|woff|woff2|ttf)).*)',
  ],
};
