'use client';
import { useEffect } from 'react';
import { getCLS, getFID, getFCP, getLCP, getTTFB, Metric } from 'web-vitals';

function reportWebVitals(onPerfEntry?: (metric: Metric) => void) {
  if (onPerfEntry && typeof onPerfEntry === 'function') {
    getCLS(onPerfEntry);
    getFID(onPerfEntry);
    getFCP(onPerfEntry);
    getLCP(onPerfEntry);
    getTTFB(onPerfEntry);
  }
}

export function useReportVitals() {
  useEffect(() => {
    reportWebVitals((metric) => {
      if (typeof window.gtag === 'function') {
        window.gtag('event', metric.name, {
          event_category: metric.name === 'CLS' ? 'Web Vitals' : 'Web Vitals',
          value: metric.value,
          event_label: metric.id,
        });
      }

      if (process.env.NODE_ENV === 'development') {
        console.log(`[Web Vitals] ${metric.name}:`, {
          value: metric.value.toFixed(3),
          id: metric.id,
          delta: metric.delta.toFixed(3),
        });
      }
    });
  }, []);
}

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
  }
}
