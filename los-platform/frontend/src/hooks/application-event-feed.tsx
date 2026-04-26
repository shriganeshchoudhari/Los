'use client';
import { useState } from 'react';
import { useApplicationSSE, type ApplicationEvent, type ApplicationEventType } from './use-application-sse';

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
            <div key={`${event.type}-${event.timestamp}-${idx}`} className="flex items-start gap-2 text-sm">
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
