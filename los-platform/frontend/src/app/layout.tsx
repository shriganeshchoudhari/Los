import type { Metadata, Viewport } from 'next';
import './globals.css';
import { Toaster } from 'sonner';
import { Providers } from './providers';
import { LiveRegion } from '@/hooks/use-accessibility';
import { AccessibilityProvider } from '@/hooks/use-accessibility';

export const metadata: Metadata = {
  title: { default: 'LOS Bank — Loan Origination System', template: '%s | LOS Bank' },
  description: 'Apply for personal loans, home loans, vehicle loans and more — fully digital, instant decision.',
  keywords: ['loan', 'personal loan', 'home loan', 'car loan', 'banking', 'digital loan', 'India'],
  authors: [{ name: 'LOS Bank' }],
  robots: { index: false, follow: false },
  icons: { icon: [{ url: '/favicon.ico' }] },
};

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  themeColor: '#003366',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="scroll-smooth">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen bg-background font-sans antialiased">
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        <AccessibilityProvider>
          <Providers>
            {children}
            <LiveRegion />
          </Providers>
          <Toaster
            position="top-right"
            toastOptions={{
              style: { fontFamily: 'Inter, system-ui, sans-serif', fontSize: '14px' },
            }}
          />
        </AccessibilityProvider>
      </body>
    </html>
  );
}
