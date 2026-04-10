'use client';
import { useEffect } from 'react';
import { usePathname } from 'next/navigation';
import { useReportVitals } from '@/hooks/use-report-vitals';

export function AccessibilityProvider({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export function useAccessibility() {
  useReportVitals();

  useEffect(() => {
    if (typeof window === 'undefined') return;

    const html = document.documentElement;
    html.style.scrollBehavior = 'smooth';

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Tab') {
        document.body.classList.add('keyboard-nav');
      }
    };

    const handleMouseDown = () => {
      document.body.classList.remove('keyboard-nav');
    };

    document.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleMouseDown);

    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleMouseDown);
    };
  }, []);
}

export function LiveRegion() {
  const [announcement, setAnnouncement] = React.useState('');

  useEffect(() => {
    (window as unknown as { announce: (msg: string) => void }).announce = (msg: string) => {
      setAnnouncement(msg);
      setTimeout(() => setAnnouncement(''), 1000);
    };
  }, []);

  return (
    <div
      role="status"
      aria-live="polite"
      aria-atomic="true"
      className="sr-only"
    >
      {announcement}
    </div>
  );
}

import React from 'react';
