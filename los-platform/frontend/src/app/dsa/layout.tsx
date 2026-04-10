'use client';
import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { useDSAAuth } from '@/lib/dsa-auth';
import {
  LayoutDashboard,
  FileText,
  CreditCard,
  Users,
  UserCircle,
  LogOut,
  ChevronRight,
  Building2,
  TrendingUp,
} from 'lucide-react';

const NAV_ITEMS = [
  { href: '/dsa/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/dsa/applications', label: 'Applications', icon: FileText },
  { href: '/dsa/commissions', label: 'Commissions', icon: CreditCard },
  { href: '/dsa/officers', label: 'Officers', icon: Users },
  { href: '/dsa/profile', label: 'Profile', icon: UserCircle },
];

function Sidebar() {
  const pathname = usePathname();
  const { logout, partnerName, partnerCode, role } = useDSAAuth();

  return (
    <aside className="w-64 min-h-screen bg-[#003366] text-white flex flex-col">
      <div className="p-6 border-b border-white/10">
        <div className="flex items-center gap-3 mb-1">
          <div className="w-9 h-9 bg-white/10 rounded-lg flex items-center justify-center">
            <Building2 className="w-5 h-5" />
          </div>
          <div>
            <h1 className="font-bold text-base leading-tight">LOS Bank</h1>
            <p className="text-blue-200 text-xs">DSA Partner Portal</p>
          </div>
        </div>
        {partnerName && (
          <div className="mt-3 p-2.5 bg-white/5 rounded-lg">
            <p className="text-xs text-blue-200 mb-0.5">Logged in as</p>
            <p className="text-sm font-semibold">{partnerName}</p>
            <p className="text-xs text-blue-300">{partnerCode} · {role === 'DSA_PARTNER' ? 'Partner' : 'Officer'}</p>
          </div>
        )}
      </div>

      <nav className="flex-1 p-4 space-y-1">
        {NAV_ITEMS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + '/');
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                active
                  ? 'bg-white/15 text-white'
                  : 'text-blue-200 hover:bg-white/10 hover:text-white'
              }`}
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {label}
              {active && <ChevronRight className="w-3 h-3 ml-auto" />}
            </Link>
          );
        })}
      </nav>

      <div className="p-4 border-t border-white/10 space-y-1">
        <Link
          href="/dsa/applications/new"
          className="flex items-center gap-2 px-3 py-2.5 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-semibold transition-colors"
        >
          <TrendingUp className="w-4 h-4" />
          New Application
        </Link>
        <button
          onClick={() => { logout(); window.location.href = '/dsa/login'; }}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-blue-200 hover:bg-white/10 hover:text-white text-sm transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Logout
        </button>
      </div>
    </aside>
  );
}

function DSAAuthGuard({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, isLoading } = useDSAAuth();
  const router = useRouter();

  React.useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      toast.error('Please login to access the DSA portal');
      router.push('/dsa/login');
    }
  }, [isAuthenticated, isLoading, router]);

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="text-center">
          <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) return null;
  return <>{children}</>;
}

export default function DSALayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isAuthPage = pathname === '/dsa/login' || pathname === '/dsa/register';

  if (isAuthPage) {
    return <>{children}</>;
  }

  return (
    <DSAAuthGuard>
      <div className="flex min-h-screen bg-gray-50">
        <Sidebar />
        <main className="flex-1 overflow-auto" id="main-content">
          {children}
        </main>
      </div>
    </DSAAuthGuard>
  );
}
