'use client';
import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { formatDateTime, timeAgo } from '@/lib/utils';
import { auditApi } from '@/lib/api';

type AuditCategory = 'ALL' | 'KYC' | 'CONSENT' | 'DATA_ACCESS' | 'DECISION' | 'DISBURSEMENT';

const CATEGORY_COLORS: Record<AuditCategory, string> = {
  ALL: 'bg-gray-100',
  KYC: 'bg-purple-100 text-purple-800',
  CONSENT: 'bg-blue-100 text-blue-800',
  DATA_ACCESS: 'bg-orange-100 text-orange-800',
  DECISION: 'bg-yellow-100 text-yellow-800',
  DISBURSEMENT: 'bg-green-100 text-green-800',
};

const CATEGORY_ICONS: Record<AuditCategory, string> = {
  ALL: '📋',
  KYC: '🔐',
  CONSENT: '📝',
  DATA_ACCESS: '👁️',
  DECISION: '⚖️',
  DISBURSEMENT: '💸',
};

const CATEGORY_LABELS: Record<AuditCategory, string> = {
  ALL: 'All Events',
  KYC: 'KYC',
  CONSENT: 'Consent',
  DATA_ACCESS: 'Data Access',
  DECISION: 'Decision',
  DISBURSEMENT: 'Disbursement',
};

interface AuditEvent {
  id: string;
  timestamp: string;
  eventCategory: string;
  eventType: string;
  actorId: string;
  actorRole: string;
  applicationId: string | null;
  entityType: string;
  entityId: string;
  actorIp: string | null;
  serviceOrigin: string | null;
  metadata: Record<string, any> | null;
}

export default function CompliancePage() {
  const [activeCategory, setActiveCategory] = useState<AuditCategory>('ALL');
  const [search, setSearch] = useState('');
  const [dateRange, setDateRange] = useState('7d');
  const [events, setEvents] = useState<AuditEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [total, setTotal] = useState(0);

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { dateRange };
      if (activeCategory !== 'ALL') params.category = activeCategory;
      if (search) params.actorId = search;
      const res = await auditApi.list(params);
      setEvents(res.data.data || []);
      setTotal(res.data.pagination?.total || 0);
    } catch {
      setEvents([]);
      setTotal(0);
    } finally {
      setLoading(false);
    }
  }, [activeCategory, dateRange, search]);

  useEffect(() => { fetchLogs(); }, [fetchLogs]);

  const categoryCounts: Record<string, number> = { ALL: total };
  for (const event of events) {
    const cat = event.eventCategory || 'ALL';
    categoryCounts[cat] = (categoryCounts[cat] || 0) + 1;
  }

  const filteredEvents = events.filter(event => {
    if (search && !event.actorId?.toLowerCase().includes(search.toLowerCase()) &&
        !event.applicationId?.toLowerCase().includes(search.toLowerCase()) &&
        !event.eventType?.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b sticky top-0 z-20">
        <div className="container py-4 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <div className="w-9 h-9 bg-primary rounded-lg flex items-center justify-center text-white font-bold">₹</div>
              <div>
                <h1 className="font-bold leading-none">LOS Bank</h1>
                <p className="text-xs text-muted-foreground">Compliance Portal</p>
              </div>
            </div>
          </div>
        </div>
      </header>

      <main id="main-content" className="container py-6 space-y-6">
        <div>
          <h2 className="text-xl font-bold">Audit Trail</h2>
          <p className="text-sm text-muted-foreground">Read-only access to all system events. Data retained for 10 years as per RBI guidelines.</p>
        </div>

        <div className="grid grid-cols-3 sm:grid-cols-6 md:grid-cols-5 gap-3">
          {(Object.keys(CATEGORY_COLORS) as AuditCategory[]).map(cat => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`p-3 rounded-lg text-center transition-all ${activeCategory === cat ? 'ring-2 ring-primary' : 'hover:shadow-sm'} ${CATEGORY_COLORS[cat]}`}
            >
              <span className="text-xl">{CATEGORY_ICONS[cat]}</span>
              <p className="text-xs font-semibold mt-1">{CATEGORY_LABELS[cat]}</p>
              <p className="text-lg font-bold">{categoryCounts[cat] || 0}</p>
            </button>
          ))}
        </div>

        <Card>
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between gap-4">
              <CardTitle className="text-base">
                Audit Log — Last {dateRange === '24h' ? '24 Hours' : dateRange === '7d' ? '7 Days' : '30 Days'}
                {loading && <span className="ml-2 text-xs text-muted-foreground animate-pulse">Loading...</span>}
              </CardTitle>
              <div className="flex gap-2 flex-wrap">
                <Input
                  placeholder="Search..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="w-28 sm:w-64"
                />
                <select
                  value={dateRange}
                  onChange={(e) => setDateRange(e.target.value)}
                  className="input text-sm"
                  aria-label="Date range filter"
                >
                  <option value="24h">Last 24 hours</option>
                  <option value="7d">Last 7 days</option>
                  <option value="30d">Last 30 days</option>
                </select>
                <button
                  className="btn btn-secondary text-sm"
                  onClick={async () => {
                    try {
                      const res = await auditApi.exportCsv({ category: activeCategory !== 'ALL' ? activeCategory : undefined, dateRange });
                      const blob = new Blob([res.data.csv], { type: 'text/csv' });
                      const url = URL.createObjectURL(blob);
                      const a = document.createElement('a');
                      a.href = url;
                      a.download = `audit-logs-${dateRange}.csv`;
                      a.click();
                      URL.revokeObjectURL(url);
                    } catch { /* error handled */ }
                  }}
                >
                  Export CSV
                </button>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <div className="space-y-1">
              {filteredEvents.length === 0 && !loading && (
                <p className="text-center text-sm text-muted-foreground py-8">No audit events found.</p>
              )}
              {filteredEvents.map((event) => (
                <div
                  key={event.id}
                  className="flex items-start gap-3 p-3 rounded-lg hover:bg-muted/30 transition-colors"
                >
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0 mt-0.5 ${CATEGORY_COLORS[event.eventCategory as AuditCategory] || 'bg-gray-100'}`}>
                    {CATEGORY_ICONS[event.eventCategory as AuditCategory] || '•'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-medium text-sm">{event.actorId || 'System'}</span>
                      <span className="text-xs text-muted-foreground">({event.actorRole || 'N/A'})</span>
                      <span className="text-xs bg-muted px-1.5 py-0.5 rounded">{event.eventType}</span>
                      <span className="text-xs text-muted-foreground">{event.entityType}</span>
                      {event.applicationId && (
                        <span className="text-xs font-mono bg-blue-50 text-blue-700 px-1.5 py-0.5 rounded">{event.applicationId}</span>
                      )}
                    </div>
                    {event.metadata && (
                      <p className="text-sm text-muted-foreground mt-0.5">
                        {event.metadata.details || JSON.stringify(event.metadata)}
                      </p>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-xs text-muted-foreground">{event.timestamp ? timeAgo(event.timestamp) : '—'}</p>
                    <p className="text-xs text-muted-foreground">{event.actorIp || '—'}</p>
                  </div>
                </div>
              ))}
            </div>

            <div className="mt-4 pt-4 border-t flex items-center justify-between text-xs text-muted-foreground">
              <p>Showing {filteredEvents.length} of {total} events</p>
              <p>Logs are immutable and cryptographically signed.</p>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}
