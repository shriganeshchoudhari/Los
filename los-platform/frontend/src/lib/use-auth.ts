'use client';

import { useState, useEffect, useCallback } from 'react';
import Cookies from 'js-cookie';
import { useRouter, usePathname } from 'next/navigation';

export type UserRole =
  | 'LOAN_OFFICER'
  | 'BRANCH_MANAGER'
  | 'CREDIT_ANALYST'
  | 'ZONAL_CREDIT_HEAD'
  | 'COMPLIANCE_OFFICER'
  | 'SYSTEM_ADMIN'
  | 'DSA_PARTNER'
  | 'DSA_OFFICER';

export interface AuthUser {
  id: string;
  employeeId?: string;
  fullName: string;
  email?: string;
  mobile: string;
  role: UserRole;
  branchCode?: string;
  permissions: string[];
}

interface DecodedToken {
  sub: string;
  fullName: string;
  role: UserRole;
  branchCode?: string;
  permissions: string[];
  mobile?: string;
  email?: string;
  employeeId?: string;
  iat: number;
  exp: number;
}

function decodeJWT(token: string): DecodedToken | null {
  try {
    const payload = token.split('.')[1];
    const decoded = atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

function isTokenExpired(token: string): boolean {
  const decoded = decodeJWT(token);
  if (!decoded) return true;
  return decoded.exp * 1000 < Date.now();
}

function getTokenExpMs(token: string): number {
  const decoded = decodeJWT(token);
  if (!decoded) return 0;
  return decoded.exp * 1000 - Date.now();
}

const PROTECTED_ROUTES = ['/dashboard', '/application', '/analyst', '/manager', '/compliance'];
const DSA_ROUTES = ['/dsa'];

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const router = useRouter();
  const pathname = usePathname();

  const loadUserFromToken = useCallback((): AuthUser | null => {
    const token = Cookies.get('access_token');
    if (!token || isTokenExpired(token)) return null;
    const decoded = decodeJWT(token);
    if (!decoded) return null;
    return {
      id: decoded.sub,
      employeeId: decoded.employeeId,
      fullName: decoded.fullName,
      email: decoded.email,
      mobile: decoded.mobile ?? '',
      role: decoded.role,
      branchCode: decoded.branchCode,
      permissions: decoded.permissions ?? [],
    };
  }, []);

  const refreshAuth = useCallback(() => {
    const u = loadUserFromToken();
    setUser(u);
    setIsAuthenticated(!!u);
    setLoading(false);
  }, [loadUserFromToken]);

  useEffect(() => {
    refreshAuth();
  }, [refreshAuth]);

  useEffect(() => {
    const token = Cookies.get('access_token');
    if (!token || isTokenExpired(token)) {
      if (PROTECTED_ROUTES.some((r) => pathname?.startsWith(r))) {
        router.push('/login');
        return;
      }
      if (DSA_ROUTES.some((r) => pathname?.startsWith(r))) {
        router.push('/dsa/login');
        return;
      }
    }
  }, [pathname, router]);

  const login = useCallback((accessToken: string, refreshToken: string, expiresInSeconds = 900) => {
    const expHours = expiresInSeconds / 3600;
    Cookies.set('access_token', accessToken, { expires: expHours });
    Cookies.set('refresh_token', refreshToken, { expires: 7 });
    const u = loadUserFromToken();
    setUser(u);
    setIsAuthenticated(!!u);
  }, [loadUserFromToken]);

  const logout = useCallback(async () => {
    try {
      // 1. Call the backend logout (8082) if needed
      const { authApi } = await import('./api');
      await authApi.logout();
    } catch {
      // ignore network errors
    } finally {
      try {
        // 2. Call the Next.js API route to clear HttpOnly cookies
        await fetch('/api/auth/logout', { method: 'POST' });
      } catch {
        // ignore errors
      }
      
      // 3. Clear any remaining client-side cookies
      Cookies.remove('access_token');
      Cookies.remove('refresh_token');
      
      setUser(null);
      setIsAuthenticated(false);
      router.push('/login');
    }
  }, [router]);

  const hasPermission = useCallback(
    (permission: string): boolean => {
      return user?.permissions?.includes(permission) ?? false;
    },
    [user],
  );

  const hasRole = useCallback(
    (role: UserRole | UserRole[]): boolean => {
      if (!user) return false;
      const roles = Array.isArray(role) ? role : [role];
      return roles.includes(user.role);
    },
    [user],
  );

  const tokenExpMs = (() => {
    const token = Cookies.get('access_token');
    if (!token) return 0;
    return getTokenExpMs(token);
  })();

  return {
    user,
    loading,
    isAuthenticated,
    login,
    logout,
    refreshAuth,
    hasPermission,
    hasRole,
    tokenExpMs,
    isTokenExpired: tokenExpMs > 0 && tokenExpMs < 5 * 60 * 1000,
  };
}
