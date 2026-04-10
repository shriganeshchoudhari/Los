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

interface EventFeedProps {
  applicationId: string;
  className?: string;
}

export function ApplicationEventFeed({ applicationId, className }: EventFeedProps) {
  const [events, setEvents] = useState<ApplicationEvent[]>([]);

  useApplicationSSE({
    applicationId,
    onEvent: (event) => {
      setEvents(prev => [event, ...prev].slice(0, 20));
    },
  });

  const formatTime = (ts: string) => {
    const d = new Date(ts);
    return d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  const eventLabels: Record<ApplicationEventType, { label: string; icon: string; color: string }> = {
    APPLICATION_SUBMITTED: { label: 'Application Submitted', icon: '📋', color: 'text-blue-600' },
    KYC_INITIATED: { label: 'KYC Started', icon: '🔐', color: 'text-indigo-600' },
    KYC_COMPLETED: { label: 'KYC Completed', icon: '✅', color: 'text-green-600' },
    KYC_FAILED: { label: 'KYC Failed', icon: '❌', color: 'text-red-600' },
    DOCUMENT_UPLOADED: { label: 'Document Uploaded', icon: '📄', color: 'text-purple-600' },
    DOCUMENT_OCR_COMPLETED: { label: 'OCR Completed', icon: '🔍', color: 'text-purple-600' },
    DOCUMENT_APPROVED: { label: 'Document Approved', icon: '✓', color: 'text-green-600' },
    BUREAU_PULL_INITIATED: { label: 'Bureau Pull Started', icon: '🔎', color: 'text-orange-600' },
    BUREAU_PULL_COMPLETED: { label: 'Bureau Pull Completed', icon: '📊', color: 'text-green-600' },
    DECISION_GENERATED: { label: 'Decision Generated', icon: '⚖️', color: 'text-yellow-600' },
    SANCTION_GENERATED: { label: 'Sanction Generated', icon: '🎉', color: 'text-green-600' },
    DISBURSEMENT_INITIATED: { label: 'Disbursement Started', icon: '💸', color: 'text-teal-600' },
    DISBURSEMENT_COMPLETED: { label: 'Disbursement Complete', icon: '✅', color: 'text-green-600' },
    APPLICATION_REJECTED: { label: 'Application Rejected', icon: '❌', color: 'text-red-600' },
    STAGE_CHANGED: { label: 'Stage Changed', icon: '🔄', color: 'text-blue-600' },
  };

  if (events.length === 0) return null;

  return (
    <div className={`space-y-2 ${className || ''}`}>
      <h4 className="text-sm font-semibold text-muted-foreground">Activity Feed</h4>
      <div className="space-y-2 max-h-64 overflow-y-auto">
        {events.map((event, idx) => {
          const config = eventLabels[event.type] || { label: event.type, icon: '•', color: 'text-gray-600' };
          return (
            <div key={`${event.type}-${event.timestamp}-${idx}`} className="flex items-start gap-2 text-sm animate-in">
              <span className="text-base">{config.icon}</span>
              <div className="flex-1 min-w-0">
                <p className={`font-medium ${config.color}`}>{config.label}</p>
                {event.data && Object.keys(event.data).length > 0 && (
                  <p className="text-xs text-muted-foreground">
                    {JSON.stringify(event.data).substring(0, 60)}
                    {JSON.stringify(event.data).length > 60 ? '...' : ''}
                  </p>
                )}
              </div>
              <span className="text-xs text-muted-foreground flex-shrink-0">{formatTime(event.timestamp)}</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
