# Frontend Implementation Guide - Los Platform v0.1

## Overview
Detailed implementation roadmap for Next.js 14 + React 18 frontend with responsive design, TypeScript, Tailwind CSS, and shadcn/ui components. All pages consume REST APIs from Spring Boot backend (port 8080). Mock data available for disconnected development.

**Technology Stack:**
- **Framework**: Next.js 14 (App Router)
- **UI Library**: React 18
- **Styling**: Tailwind CSS 3
- **Components**: shadcn/ui
- **State Management**: React Query (TanStack Query) + Zustand
- **Forms**: React Hook Form + Zod validation
- **HTTP Client**: Axios with interceptors
- **Type Safety**: TypeScript 5
- **Testing**: Vitest + React Testing Library
- **E2E**: Cypress or Playwright

---

## PHASE 5: Frontend Implementation (Weeks 5–7)

### 5a. Analyst & Manager Workflows

#### 5a.1 Analyst Worklist Page

**File: `frontend/src/app/analyst/page.tsx`**
```typescript
'use client';

import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface ApplicationListItem {
  id: string;
  applicantName: string;
  loanAmount: number;
  productId: string;
  currentState: string;
  createdAt: string;
  daysPending: number;
}

interface FilterParams {
  status: string;
  productId: string;
  ageingDays: string;
  searchTerm: string;
  sortBy: 'createdAt' | 'loanAmount' | 'daysPending';
  sortOrder: 'asc' | 'desc';
}

export default function AnalystWorklist() {
  const [filters, setFilters] = useState<FilterParams>({
    status: 'BUREAU',
    productId: 'all',
    ageingDays: 'all',
    searchTerm: '',
    sortBy: 'daysPending',
    sortOrder: 'desc',
  });

  // Build query parameters
  const queryParams = new URLSearchParams();
  if (filters.status !== 'all') queryParams.append('status', filters.status);
  if (filters.productId !== 'all') queryParams.append('productId', filters.productId);
  if (filters.ageingDays === '5') queryParams.append('minDays', '5');
  if (filters.ageingDays === '10') queryParams.append('minDays', '10');
  queryParams.append('sortBy', filters.sortBy);
  queryParams.append('sortOrder', filters.sortOrder);

  const { data, isLoading, error } = useQuery({
    queryKey: ['applications', filters],
    queryFn: async () => {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/applications?${queryParams.toString()}`,
        {
          headers: {
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
          },
        }
      );
      if (!response.ok) throw new Error('Failed to fetch applications');
      return response.json() as Promise<{ data: ApplicationListItem[] }>;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  const handleFilterChange = (key: keyof FilterParams, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const getStateColor = (state: string) => {
    const colors: Record<string, string> = {
      BUREAU: 'bg-blue-100 text-blue-800',
      DECISION: 'bg-purple-100 text-purple-800',
      KYC: 'bg-yellow-100 text-yellow-800',
      SUBMITTED: 'bg-gray-100 text-gray-800',
    };
    return colors[state] || 'bg-gray-100 text-gray-800';
  };

  return (
    <div className="p-6 space-y-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-bold">Analyst Worklist</h1>
        <p className="text-gray-600">
          {data?.data.length || 0} applications pending review
        </p>
      </div>

      {/* Filters Card */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">Filters</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            {/* Status Filter */}
            <div>
              <label className="text-sm font-medium mb-2 block">Status</label>
              <Select
                value={filters.status}
                onValueChange={(val) => handleFilterChange('status', val)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="BUREAU">Bureau</SelectItem>
                  <SelectItem value="DECISION">Decision</SelectItem>
                  <SelectItem value="KYC">KYC</SelectItem>
                  <SelectItem value="SUBMITTED">Submitted</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Product Filter */}
            <div>
              <label className="text-sm font-medium mb-2 block">Product</label>
              <Select
                value={filters.productId}
                onValueChange={(val) => handleFilterChange('productId', val)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All Products</SelectItem>
                  <SelectItem value="personal">Personal Loan</SelectItem>
                  <SelectItem value="home">Home Loan</SelectItem>
                  <SelectItem value="vehicle">Vehicle Loan</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Ageing Filter */}
            <div>
              <label className="text-sm font-medium mb-2 block">Ageing</label>
              <Select
                value={filters.ageingDays}
                onValueChange={(val) => handleFilterChange('ageingDays', val)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All</SelectItem>
                  <SelectItem value="5">&gt; 5 Days</SelectItem>
                  <SelectItem value="10">&gt; 10 Days</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Search */}
            <div>
              <label className="text-sm font-medium mb-2 block">Search</label>
              <Input
                placeholder="Applicant name or ID..."
                value={filters.searchTerm}
                onChange={(e) => handleFilterChange('searchTerm', e.target.value)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Applications Table */}
      {isLoading ? (
        <div className="text-center py-12">Loading applications...</div>
      ) : error ? (
        <div className="text-center py-12 text-red-600">Failed to load applications</div>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Applicant Name</TableHead>
                    <TableHead>Loan Amount</TableHead>
                    <TableHead>Product</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Days Pending</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {data?.data.map((app) => (
                    <TableRow key={app.id}>
                      <TableCell className="font-medium">{app.applicantName}</TableCell>
                      <TableCell>₹{(app.loanAmount / 100000).toFixed(1)}L</TableCell>
                      <TableCell>{app.productId}</TableCell>
                      <TableCell>
                        <Badge className={getStateColor(app.currentState)}>
                          {app.currentState}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <span className={app.daysPending > 10 ? 'font-bold text-red-600' : ''}>
                          {app.daysPending}
                        </span>
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="outline" size="sm">
                              Actions
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent>
                            <DropdownMenuItem asChild>
                              <a href={`/analyst/${app.id}/decision`}>View & Decide</a>
                            </DropdownMenuItem>
                            <DropdownMenuItem asChild>
                              <a href={`/app/application/${app.id}`}>View Details</a>
                            </DropdownMenuItem>
                            <DropdownMenuItem>Request More Docs</DropdownMenuItem>
                            <DropdownMenuItem>Reassign</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

#### 5a.2 Analyst Decision Dashboard

**File: `frontend/src/app/analyst/[id]/decision/page.tsx`**
```typescript
'use client';

import { useState } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { useRouter } from 'next/navigation';
import { useToast } from '@/hooks/use-toast';

interface DecisionData {
  applicationId: string;
  applicantProfile: {
    name: string;
    age: number;
    monthlyIncome: number;
    existingEmis: number;
  };
  bureauData: {
    cibilScore: number;
    experianScore: number;
    equifaxScore: number;
    crifScore: number;
    averageScore: number;
    activeAccounts: number;
    missedPayments: number;
    defaults: number;
  };
  loanDetails: {
    loanAmount: number;
    tenure: number;
    monthlyEmi: number;
  };
  recommendedDecision: 'APPROVED' | 'REJECTED' | 'MANUAL_REVIEW';
  failedRules: string[];
}

export default function DecisionPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { toast } = useToast();
  const [decision, setDecision] = useState<'APPROVED' | 'REJECTED' | 'PENDING'>('PENDING');
  const [sanctionAmount, setSanctionAmount] = useState<number>(0);
  const [remarks, setRemarks] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['decision', params.id],
    queryFn: async () => {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/applications/${params.id}/decision-data`,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` },
        }
      );
      if (!response.ok) throw new Error('Failed to fetch decision data');
      return response.json() as Promise<DecisionData>;
    },
  });

  const submitDecisionMutation = useMutation({
    mutationFn: async () => {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/applications/${params.id}/decision`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${localStorage.getItem('accessToken')}`,
          },
          body: JSON.stringify({
            decision,
            sanctionAmount: decision === 'APPROVED' ? sanctionAmount : null,
            remarks,
          }),
        }
      );
      if (!response.ok) throw new Error('Failed to submit decision');
      return response.json();
    },
    onSuccess: () => {
      toast({ title: 'Decision submitted successfully' });
      router.push('/analyst');
    },
    onError: () => {
      toast({ title: 'Error submitting decision', variant: 'destructive' });
    },
  });

  if (isLoading) return <div>Loading decision data...</div>;
  if (!data) return <div>No data available</div>;

  const foir = (data.loanDetails.monthlyEmi + data.applicantProfile.existingEmis) / data.applicantProfile.monthlyIncome;

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">Loan Decision</h1>

      {/* Applicant Profile Card */}
      <Card>
        <CardHeader>
          <CardTitle>Applicant Profile</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div>
            <p className="text-sm text-gray-600">Name</p>
            <p className="font-medium">{data.applicantProfile.name}</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Age</p>
            <p className="font-medium">{data.applicantProfile.age} years</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Monthly Income</p>
            <p className="font-medium">₹{(data.applicantProfile.monthlyIncome / 1000).toFixed(0)}K</p>
          </div>
          <div>
            <p className="text-sm text-gray-600">Existing EMIs</p>
            <p className="font-medium">₹{(data.applicantProfile.existingEmis / 1000).toFixed(0)}K</p>
          </div>
        </CardContent>
      </Card>

      {/* Bureau Data Card */}
      <Card>
        <CardHeader>
          <CardTitle>Bureau Scores</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="text-center">
            <p className="text-sm text-gray-600">CIBIL</p>
            <p className="text-2xl font-bold text-blue-600">{data.bureauData.cibilScore}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-600">Experian</p>
            <p className="text-2xl font-bold text-green-600">{data.bureauData.experianScore}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-600">Equifax</p>
            <p className="text-2xl font-bold text-purple-600">{data.bureauData.equifaxScore}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-600">CRIF</p>
            <p className="text-2xl font-bold text-orange-600">{data.bureauData.crifScore}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-600">Average</p>
            <p className="text-2xl font-bold text-gray-800">{data.bureauData.averageScore}</p>
          </div>
        </CardContent>
      </Card>

      {/* Loan & FOIR Card */}
      <Card>
        <CardHeader>
          <CardTitle>Loan & FOIR Analysis</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <p className="text-sm text-gray-600">Loan Amount</p>
              <p className="text-2xl font-bold">₹{(data.loanDetails.loanAmount / 100000).toFixed(1)}L</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Monthly EMI</p>
              <p className="text-2xl font-bold">₹{(data.loanDetails.monthlyEmi / 1000).toFixed(0)}K</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">FOIR Ratio</p>
              <p className={`text-2xl font-bold ${foir > 0.6 ? 'text-red-600' : 'text-green-600'}`}>
                {(foir * 100).toFixed(1)}%
              </p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Rules Engine Result */}
      <Card>
        <CardHeader>
          <CardTitle>Rules Engine Result</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <p className="text-sm text-gray-600">Recommendation</p>
            <p className={`text-lg font-bold ${
              data.recommendedDecision === 'APPROVED' ? 'text-green-600' : 
              data.recommendedDecision === 'REJECTED' ? 'text-red-600' : 'text-yellow-600'
            }`}>
              {data.recommendedDecision}
            </p>
          </div>
          {data.failedRules.length > 0 && (
            <div>
              <p className="text-sm font-medium mb-2">Failed Rules:</p>
              <ul className="list-disc list-inside text-sm text-red-600">
                {data.failedRules.map((rule, idx) => (
                  <li key={idx}>{rule}</li>
                ))}
              </ul>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Decision Form */}
      <Card>
        <CardHeader>
          <CardTitle>Your Decision</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          <div>
            <Label className="text-base mb-3 block">Decision</Label>
            <div className="flex gap-3">
              {['APPROVED', 'REJECTED', 'PENDING'].map((opt) => (
                <Button
                  key={opt}
                  variant={decision === opt ? 'default' : 'outline'}
                  onClick={() => setDecision(opt as typeof decision)}
                >
                  {opt}
                </Button>
              ))}
            </div>
          </div>

          {decision === 'APPROVED' && (
            <div>
              <Label htmlFor="sanction-amount">Sanction Amount (₹)</Label>
              <input
                id="sanction-amount"
                type="number"
                value={sanctionAmount}
                onChange={(e) => setSanctionAmount(parseFloat(e.target.value))}
                className="w-full mt-2 px-3 py-2 border rounded"
                placeholder="e.g., 500000"
              />
            </div>
          )}

          <div>
            <Label htmlFor="remarks">Remarks</Label>
            <Textarea
              id="remarks"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Add any remarks or notes..."
              className="mt-2"
              rows={4}
            />
          </div>

          <div className="flex gap-3">
            <Button
              onClick={() => submitDecisionMutation.mutate()}
              disabled={submitDecisionMutation.isPending}
              className="flex-1"
            >
              {submitDecisionMutation.isPending ? 'Submitting...' : 'Submit Decision'}
            </Button>
            <Button
              variant="outline"
              onClick={() => router.back()}
              className="flex-1"
            >
              Cancel
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
```

#### 5a.3 Manager Sanction Approval Page

**File: `frontend/src/app/manager/page.tsx`**
```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import Link from 'next/link';

interface SanctionPending {
  id: string;
  applicantName: string;
  loanAmount: number;
  decision: 'APPROVED';
  createdAt: string;
  requiresMakerChecker: boolean;
}

export default function ManagerPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['sanctionsPending'],
    queryFn: async () => {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/applications?currentState=DECISION&decision=APPROVED`,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` },
        }
      );
      return response.json() as Promise<{ data: SanctionPending[] }>;
    },
  });

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="text-3xl font-bold">Sanction Approvals</h1>
        <p className="text-gray-600">Loans requiring manager approval</p>
      </div>

      {isLoading ? (
        <div>Loading...</div>
      ) : (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-4">
              {data?.data.map((sanction) => (
                <div
                  key={sanction.id}
                  className="flex items-center justify-between p-4 border rounded-lg"
                >
                  <div>
                    <p className="font-medium">{sanction.applicantName}</p>
                    <p className="text-sm text-gray-600">₹{(sanction.loanAmount / 100000).toFixed(1)}L</p>
                  </div>
                  {sanction.requiresMakerChecker && (
                    <Badge className="bg-red-100 text-red-800">Requires Checker Approval</Badge>
                  )}
                  <Link href={`/manager/${sanction.id}/sanction-approval`}>
                    <Button>Review & Approve</Button>
                  </Link>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
```

---

### 5b. Compliance & Audit Dashboard

#### 5b.1 Audit Trail Page

**File: `frontend/src/app/compliance/audit-trail/page.tsx`**
```typescript
'use client';

import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';

interface AuditLog {
  id: string;
  applicationId: string;
  userId: string;
  action: string;
  timestamp: string;
  oldValue: string;
  newValue: string;
  details: string;
}

export default function AuditTrailPage() {
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['auditLogs', fromDate, toDate],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (fromDate) params.append('fromDate', fromDate);
      if (toDate) params.append('toDate', toDate);

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/compliance/audit-logs?${params.toString()}`,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` },
        }
      );
      return response.json() as Promise<{ data: AuditLog[] }>;
    },
  });

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">Audit Trail</h1>

      {/* Date Filters */}
      <Card>
        <CardContent className="pt-6 flex gap-4">
          <Input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            placeholder="From Date"
          />
          <Input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            placeholder="To Date"
          />
          <Button onClick={() => { /* trigger refetch */ }}>Filter</Button>
        </CardContent>
      </Card>

      {/* Audit Table */}
      <Card>
        <CardContent className="pt-6 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Application ID</TableHead>
                <TableHead>User</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Timestamp</TableHead>
                <TableHead>Old Value</TableHead>
                <TableHead>New Value</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data?.data.map((log) => (
                <TableRow key={log.id}>
                  <TableCell>{log.applicationId}</TableCell>
                  <TableCell>{log.userId}</TableCell>
                  <TableCell>{log.action}</TableCell>
                  <TableCell>{new Date(log.timestamp).toLocaleString()}</TableCell>
                  <TableCell className="text-xs text-gray-500">{log.oldValue}</TableCell>
                  <TableCell className="text-xs font-medium">{log.newValue}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
```

---

### 5c. DSA Commission Portal

#### 5c.1 DSA Dashboard

**File: `frontend/src/app/dsa/dashboard/page.tsx`**
```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

interface DSAMetrics {
  totalEarnings: number;
  pendingCommissions: number;
  paidCommissions: number;
  activeLoans: number;
}

export default function DSADashboard() {
  const { data } = useQuery({
    queryKey: ['dsaMetrics'],
    queryFn: async () => {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/dsa/metrics`,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` },
        }
      );
      return response.json() as Promise<DSAMetrics>;
    },
  });

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">DSA Portal</h1>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Total Earnings</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">₹{(data?.totalEarnings || 0) / 100000}L</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Pending Commissions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">₹{(data?.pendingCommissions || 0) / 100000}L</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Paid Commissions</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">₹{(data?.paidCommissions || 0) / 100000}L</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium text-gray-600">Active Loans</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-3xl font-bold">{data?.activeLoans || 0}</p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
```

---

### 5d. Bureau Report Viewer

**File: `frontend/src/app/analyst/[id]/bureau-report/page.tsx`**
```typescript
'use client';

import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';

interface BureauReport {
  cibil: {
    score: number;
    accounts: number;
    missedPayments: number;
    defaults: number;
    inquiries: number;
  };
  experian: {
    score: number;
    accounts: number;
    missedPayments: number;
  };
  equifax: {
    score: number;
    accounts: number;
  };
  crif: {
    score: number;
  };
}

export default function BureauReportPage({ params }: { params: { id: string } }) {
  const { data } = useQuery({
    queryKey: ['bureauReport', params.id],
    queryFn: async () => {
      const response = await fetch(
        `${process.env.NEXT_PUBLIC_API_URL}/api/applications/${params.id}/bureau-data`,
        {
          headers: { Authorization: `Bearer ${localStorage.getItem('accessToken')}` },
        }
      );
      return response.json() as Promise<BureauReport>;
    },
  });

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-3xl font-bold">Bureau Report</h1>

      <Tabs defaultValue="cibil">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="cibil">CIBIL</TabsTrigger>
          <TabsTrigger value="experian">Experian</TabsTrigger>
          <TabsTrigger value="equifax">Equifax</TabsTrigger>
          <TabsTrigger value="crif">CRIF</TabsTrigger>
        </TabsList>

        <TabsContent value="cibil">
          <Card>
            <CardContent className="pt-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-gray-600">CIBIL Score</p>
                  <p className="text-4xl font-bold text-blue-600">{data?.cibil.score}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Active Accounts</p>
                  <p className="text-4xl font-bold">{data?.cibil.accounts}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Missed Payments</p>
                  <p className="text-4xl font-bold text-red-600">{data?.cibil.missedPayments}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Defaults</p>
                  <p className="text-4xl font-bold text-red-700">{data?.cibil.defaults}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Similar for Experian, Equifax, CRIF */}
      </Tabs>
    </div>
  );
}
```

---

### 5e. Mobile UX Optimization

**File: `frontend/src/app/mobile/page.tsx`** (Mobile entry point for Lakshmi Devi persona)
```typescript
'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

type Step = 'personal' | 'income' | 'loan' | 'documents' | 'review';

export default function MobileApplicationFlow() {
  const [currentStep, setCurrentStep] = useState<Step>('personal');
  const [formData, setFormData] = useState({
    name: '',
    age: '',
    phone: '',
    income: '',
    loanAmount: '',
  });

  const handleNext = () => {
    const steps: Step[] = ['personal', 'income', 'loan', 'documents', 'review'];
    const currentIdx = steps.indexOf(currentStep);
    if (currentIdx < steps.length - 1) {
      setCurrentStep(steps[currentIdx + 1]);
    }
  };

  const handlePrev = () => {
    const steps: Step[] = ['personal', 'income', 'loan', 'documents', 'review'];
    const currentIdx = steps.indexOf(currentStep);
    if (currentIdx > 0) {
      setCurrentStep(steps[currentIdx - 1]);
    }
  };

  const stepNum = ['personal', 'income', 'loan', 'documents', 'review'].indexOf(currentStep) + 1;
  const totalSteps = 5;

  return (
    <div className="min-h-screen bg-gradient-to-b from-blue-50 to-white p-4">
      {/* Progress Indicator */}
      <div className="text-center mb-6">
        <p className="text-3xl font-bold text-blue-600">Step {stepNum}/5</p>
        <p className="text-sm text-gray-600 mt-2">{currentStep.toUpperCase()}</p>
      </div>

      {/* Progress Bar */}
      <div className="w-full bg-gray-200 rounded-full h-2 mb-8">
        <div
          className="bg-blue-600 h-2 rounded-full transition-all"
          style={{ width: `${(stepNum / totalSteps) * 100}%` }}
        />
      </div>

      {/* Step Content - Large, Touch-Friendly */}
      <Card className="mb-6">
        <CardContent className="pt-8">
          {currentStep === 'personal' && (
            <div className="space-y-6">
              <div>
                <label className="text-lg font-semibold block mb-3">Full Name</label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="w-full px-4 py-4 text-lg border-2 rounded-lg"
                  placeholder="Enter your name"
                />
              </div>
              <div>
                <label className="text-lg font-semibold block mb-3">Age</label>
                <input
                  type="number"
                  value={formData.age}
                  onChange={(e) => setFormData({ ...formData, age: e.target.value })}
                  className="w-full px-4 py-4 text-lg border-2 rounded-lg"
                  placeholder="Enter your age"
                />
              </div>
              <div>
                <label className="text-lg font-semibold block mb-3">Phone Number</label>
                <input
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full px-4 py-4 text-lg border-2 rounded-lg"
                  placeholder="10-digit phone"
                />
              </div>
            </div>
          )}

          {currentStep === 'income' && (
            <div>
              <label className="text-lg font-semibold block mb-3">Monthly Income</label>
              <input
                type="number"
                value={formData.income}
                onChange={(e) => setFormData({ ...formData, income: e.target.value })}
                className="w-full px-4 py-4 text-lg border-2 rounded-lg"
                placeholder="Enter monthly income (₹)"
              />
            </div>
          )}

          {currentStep === 'loan' && (
            <div>
              <label className="text-lg font-semibold block mb-3">Loan Amount Needed</label>
              <input
                type="number"
                value={formData.loanAmount}
                onChange={(e) => setFormData({ ...formData, loanAmount: e.target.value })}
                className="w-full px-4 py-4 text-lg border-2 rounded-lg"
                placeholder="Enter loan amount (₹)"
              />
            </div>
          )}

          {currentStep === 'documents' && (
            <div className="text-center space-y-4">
              <p className="text-lg font-semibold">Upload Documents</p>
              <div className="border-4 border-dashed rounded-lg p-8">
                <p className="text-gray-600 text-lg">Tap to upload:</p>
                <p className="text-2xl mt-2">📄</p>
                <p className="text-lg mt-2">Pan, Aadhar, Salary Slip</p>
              </div>
            </div>
          )}

          {currentStep === 'review' && (
            <div className="space-y-4">
              <p className="text-lg font-semibold">Review Your Details</p>
              <div className="space-y-3 text-lg">
                <p><strong>Name:</strong> {formData.name}</p>
                <p><strong>Age:</strong> {formData.age}</p>
                <p><strong>Phone:</strong> {formData.phone}</p>
                <p><strong>Income:</strong> ₹{formData.income}</p>
                <p><strong>Loan Amount:</strong> ₹{formData.loanAmount}</p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Navigation Buttons - Large, Touch-Friendly */}
      <div className="flex gap-3">
        <Button
          onClick={handlePrev}
          disabled={stepNum === 1}
          variant="outline"
          className="flex-1 h-16 text-lg font-semibold"
        >
          Back
        </Button>
        <Button
          onClick={handleNext}
          disabled={stepNum === totalSteps}
          className="flex-1 h-16 text-lg font-semibold"
        >
          {stepNum === totalSteps ? 'Submit' : 'Next'}
        </Button>
      </div>

      {/* WhatsApp Notification Link */}
      <div className="text-center mt-8">
        <p className="text-sm text-gray-600">
          Need help? <a href="https://wa.me/919999999999" className="text-green-600 font-semibold">Chat on WhatsApp</a>
        </p>
      </div>
    </div>
  );
}
```

---

## API Contracts

All frontend pages consume REST APIs with these contracts:

### Loan Applications
```
GET /api/applications?status=BUREAU&productId=personal
GET /api/applications/{id}
GET /api/applications/{id}/decision-data
GET /api/applications/{id}/bureau-data
POST /api/applications/{id}/decision
PATCH /api/applications/{id}/sanction-approval
```

### Compliance
```
GET /api/compliance/audit-logs?fromDate=...&toDate=...
GET /api/compliance/consent-trail/{applicationId}
GET /api/compliance/aadhaar-access-log
GET /api/compliance/reports/kycQuality
```

### DSA
```
GET /api/dsa/profile
GET /api/dsa/metrics
GET /api/dsa/officers
GET /api/dsa/commissions?status=PENDING
GET /api/dsa/loans?dsaPartnerId=...
```

---

## Component Library (shadcn/ui)

Pre-built components used:
- **Layout**: `Card`, `Tabs`, `Dialog`
- **Forms**: `Input`, `Button`, `Select`, `Textarea`, `Label`
- **Tables**: `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableCell`
- **Feedback**: `Badge`, `Toast`, `Alert`
- **Navigation**: `DropdownMenu`, `Breadcrumb`

To install missing components:
```bash
npx shadcn-ui@latest add card
npx shadcn-ui@latest add table
npx shadcn-ui@latest add tabs
# ... etc
```

---

## Testing Frontend

### Unit Tests
```bash
npm run test # Vitest
```

### E2E Tests
```bash
npm run test:e2e # Cypress
```

**Example Cypress test (`tests/e2e/loan-application.cy.ts`):**
```typescript
describe('Loan Application Flow', () => {
  it('should complete personal loan application', () => {
    cy.visit('/');
    cy.get('[data-testid=apply-loan]').click();
    cy.get('[data-testid=product-personal]').click();
    cy.get('[data-testid=input-name]').type('Lakshmi Devi');
    cy.get('[data-testid=input-income]').type('50000');
    cy.get('[data-testid=btn-submit]').click();
    cy.url().should('include', '/application');
  });
});
```

---

## Styling & Responsive Design

### Tailwind Breakpoints
- `sm`: 640px (tablets)
- `md`: 768px (tablets)
- `lg`: 1024px (desktops)
- `xl`: 1280px (large screens)

### Mobile-First CSS
```typescript
<div className="text-sm md:text-base lg:text-lg">
  {/* Small on mobile, larger on desktop */}
</div>
```

---

## Deployment

**Build:**
```bash
npm run build
```

**Run (local):**
```bash
npm run dev
# Opens http://localhost:3000
```

**Deploy to Vercel:**
```bash
vercel deploy
```

---

## Summary: Pages to Implement

| Page | Path | Priority | Status |
|------|------|----------|--------|
| Analyst Worklist | `/analyst` | P0 | Phase 5a |
| Analyst Decision | `/analyst/{id}/decision` | P0 | Phase 5a |
| Manager Sanctioning | `/manager` | P0 | Phase 5a |
| Maker-Checker Approval | `/manager/{id}/sanction-approval` | P0 | Phase 5a |
| Compliance Dashboard | `/compliance` | P1 | Phase 5b |
| Audit Trail | `/compliance/audit-trail` | P1 | Phase 5b |
| Consent Audit | `/compliance/consent-audit` | P1 | Phase 5b |
| DSA Dashboard | `/dsa/dashboard` | P1 | Phase 5c |
| DSA Commissions | `/dsa/commissions` | P1 | Phase 5c |
| Bureau Report | `/analyst/{id}/bureau-report` | P1 | Phase 5d |
| Mobile App | `/mobile` | P2 | Phase 5e |

---

## Completion Criteria

✅ Analyst worklist filters applications by state, product, ageing
✅ Decision dashboard shows bureau scores (CIBIL, Experian, Equifax, CRIF) + FOIR analysis
✅ Manager approval UI for loans >₹10L
✅ Compliance audit trail with timestamp & user tracking
✅ Consent audit verification (OTP, IP, device)
✅ DSA commission portal with payout tracking
✅ Bureau report tabs (CIBIL, Experian, Equifax, CRIF)
✅ Mobile-optimized multi-step form (Lakshmi Devi persona)
✅ All pages responsive (mobile, tablet, desktop)
✅ Integration tests with mock API endpoints
✅ Ready for Phase 6 E2E testing
