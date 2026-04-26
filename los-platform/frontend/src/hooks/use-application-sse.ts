'use client';
import { useEffect, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:3001';

export type ApplicationEventType =
  | 'APPLICATION_SUBMITTED'
  | 'KYC_INITIATED'
  | 'KYC_COMPLETED'
  | 'KYC_FAILED'
  | 'DOCUMENT_UPLOADED'
  | 'DOCUMENT_OCR_COMPLETED'
  | 'DOCUMENT_APPROVED'
  | 'BUREAU_PULL_INITIATED'
  | 'BUREAU_PULL_COMPLETED'
  | 'DECISION_GENERATED'
  | 'SANCTION_GENERATED'
  | 'DISBURSEMENT_INITIATED'
  | 'DISBURSEMENT_COMPLETED'
  | 'APPLICATION_REJECTED'
  | 'STAGE_CHANGED';

export interface ApplicationEvent {
  type: ApplicationEventType;
  applicationId: string;
  timestamp: string;
  data: Record<string, unknown>;
  actor?: string;
  metadata?: Record<string, unknown>;
}

export interface SSEConnectionState {
  connected: boolean;
  reconnecting: boolean;
  lastEventAt?: Date;
  eventCount: number;
}

interface UseApplicationSSEOptions {
  applicationId: string;
  onEvent?: (event: ApplicationEvent) => void;
  onStatusChange?: (status: string, previousStatus: string) => void;
  enabled?: boolean;
  maxRetries?: number;
  retryDelayMs?: number;
}

export function useApplicationSSE({
  applicationId,
  onEvent,
  onStatusChange,
  enabled = true,
  maxRetries = 5,
  retryDelayMs = 3000,
}: UseApplicationSSEOptions) {
  const [state, setState] = useState<SSEConnectionState>({
    connected: false,
    reconnecting: false,
    eventCount: 0,
  });
  const eventSourceRef = useRef<EventSource | null>(null);
  const retryCountRef = useRef(0);
  const previousStatusRef = useRef<string | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const connect = useCallback(() => {
    if (!applicationId || !enabled) return;
    if (typeof window === 'undefined') return;

    try {
      const token = document.cookie
        .split('; ')
        .find(row => row.startsWith('access_token='))
        ?.split('=')[1];

      const eventSource = new EventSource(
        `${API_BASE_URL}/applications/${applicationId}/events${token ? `?token=${token}` : ''}`,
        { withCredentials: true },
      );

      eventSource.onopen = () => {
        retryCountRef.current = 0;
        setState(prev => ({
          ...prev,
          connected: true,
          reconnecting: false,
          lastEventAt: new Date(),
        }));
      };

      eventSource.onmessage = (event) => {
        try {
          const data: ApplicationEvent = JSON.parse(event.data);
          setState(prev => ({
            ...prev,
            lastEventAt: new Date(),
            eventCount: prev.eventCount + 1,
          }));

          if (data.type === 'STAGE_CHANGED' && data.data?.status) {
            const newStatus = data.data.status as string;
            if (previousStatusRef.current && previousStatusRef.current !== newStatus) {
              onStatusChange?.(newStatus, previousStatusRef.current);
              toast.info(`Application status changed to: ${newStatus.replace(/_/g, ' ')}`, {
                duration: 5000,
                action: {
                  label: 'Refresh',
                  onClick: () => window.location.reload(),
                },
              });
            }
            previousStatusRef.current = newStatus;
          }

          onEvent?.(data);
        } catch {
          // malformed event data
        }
      };

      eventSource.onerror = () => {
        eventSource.close();
        setState(prev => ({ ...prev, connected: false }));

        if (retryCountRef.current < maxRetries) {
          setState(prev => ({ ...prev, reconnecting: true }));
          retryCountRef.current++;
          reconnectTimeoutRef.current = setTimeout(connect, retryDelayMs * retryCountRef.current);
        } else {
          setState(prev => ({ ...prev, reconnecting: false }));
          toast.error('Real-time updates disconnected. Please refresh the page.');
        }
      };

      eventSourceRef.current = eventSource;
    } catch {
      if (retryCountRef.current < maxRetries) {
        retryCountRef.current++;
        reconnectTimeoutRef.current = setTimeout(connect, retryDelayMs);
      }
    }
  }, [applicationId, enabled, maxRetries, retryDelayMs, onEvent, onStatusChange]);

  useEffect(() => {
    connect();
    return () => {
      if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
      eventSourceRef.current?.close();
    };
  }, [connect]);

  const disconnect = useCallback(() => {
    eventSourceRef.current?.close();
    if (reconnectTimeoutRef.current) clearTimeout(reconnectTimeoutRef.current);
    setState(prev => ({ ...prev, connected: false, reconnecting: false }));
  }, []);

  const reconnect = useCallback(() => {
    disconnect();
    retryCountRef.current = 0;
    connect();
  }, [connect, disconnect]);

  return { ...state, disconnect, reconnect };
}

// ApplicationEventFeed component is exported from 'use-application-sse.tsx'
