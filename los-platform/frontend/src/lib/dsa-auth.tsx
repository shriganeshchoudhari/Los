'use client';
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import Cookies from 'js-cookie';
import { toast } from 'sonner';
import { DSALoginResponse, DSARole } from '@/types/dsa';

interface DSAAuthState {
  partnerId: string | null;
  partnerCode: string | null;
  partnerName: string | null;
  role: DSARole | null;
  isAuthenticated: boolean;
  isLoading: boolean;
}

interface DSAAuthContextType extends DSAAuthState {
  login: (res: DSALoginResponse) => void;
  logout: () => void;
}

const DSAAuthContext = createContext<DSAAuthContextType | undefined>(undefined);

export function DSAAuthProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<DSAAuthState>({
    partnerId: null,
    partnerCode: null,
    partnerName: null,
    role: null,
    isAuthenticated: false,
    isLoading: true,
  });

  useEffect(() => {
    const accessToken = Cookies.get('dsa_access_token');
    const refreshToken = Cookies.get('dsa_refresh_token');
    const partnerId = Cookies.get('dsa_partner_id');
    const partnerCode = Cookies.get('dsa_partner_code');
    const partnerName = Cookies.get('dsa_partner_name');
    const role = Cookies.get('dsa_role') as DSARole | undefined;

    if (accessToken && refreshToken) {
      setState({
        partnerId,
        partnerCode,
        partnerName,
        role: role || null,
        isAuthenticated: true,
        isLoading: false,
      });
    } else {
      setState((prev) => ({ ...prev, isLoading: false }));
    }
  }, []);

  const login = useCallback((res: DSALoginResponse) => {
    const cookieOptions = { path: '/', sameSite: 'strict' as const };
    Cookies.set('dsa_access_token', res.accessToken, { ...cookieOptions, expires: 1 / 96 });
    Cookies.set('dsa_refresh_token', res.refreshToken, { ...cookieOptions, expires: 7 });
    Cookies.set('dsa_partner_id', res.partnerId, cookieOptions);
    Cookies.set('dsa_partner_code', res.partnerCode, cookieOptions);
    Cookies.set('dsa_partner_name', res.partnerName, cookieOptions);
    Cookies.set('dsa_role', res.role, cookieOptions);

    setState({
      partnerId: res.partnerId,
      partnerCode: res.partnerCode,
      partnerName: res.partnerName,
      role: res.role,
      isAuthenticated: true,
      isLoading: false,
    });
  }, []);

  const logout = useCallback(() => {
    const cookieKeys = [
      'dsa_access_token', 'dsa_refresh_token', 'dsa_partner_id',
      'dsa_partner_code', 'dsa_partner_name', 'dsa_role',
    ];
    cookieKeys.forEach((k) => Cookies.remove(k, { path: '/' }));
    setState({
      partnerId: null,
      partnerCode: null,
      partnerName: null,
      role: null,
      isAuthenticated: false,
      isLoading: false,
    });
    toast.success('Logged out successfully');
  }, []);

  return (
    <DSAAuthContext.Provider value={{ ...state, login, logout }}>
      {children}
    </DSAAuthContext.Provider>
  );
}

export function useDSAAuth() {
  const ctx = useContext(DSAAuthContext);
  if (!ctx) throw new Error('useDSAAuth must be used within DSAAuthProvider');
  return ctx;
}
