# LOS Platform Frontend

Next.js 14 application with TypeScript, Tailwind CSS, and shadcn/ui.

## Setup

```bash
cd frontend

# Install dependencies
npm install

# Copy environment variables
cp .env.example .env.local

# Development server
npm run dev

# Production build
npm run build

# Lint
npm run lint
```

## Environment Variables

```env
NEXT_PUBLIC_API_BASE_URL=http://localhost:3001
NEXT_PUBLIC_AUTH_SERVICE_URL=http://localhost:3001
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_DSA_API_BASE_URL=http://localhost:3008
```

> In Docker: Set to service names (e.g., `http://auth-service:3001`). See `docker-compose.yml`.

## Project Structure

```
src/
├── app/                      # Next.js App Router pages
│   ├── page.tsx              # Home — product selection + EMI calculator
│   ├── login/page.tsx         # OTP login
│   ├── dashboard/page.tsx    # Loan officer worklist dashboard
│   ├── application/[id]/
│   │   ├── page.tsx          # Multi-step application form
│   │   ├── kyc/page.tsx     # KYC flow (Aadhaar, PAN, face)
│   │   ├── documents/page.tsx # Document upload + OCR
│   │   ├── decision/page.tsx # Decision result
│   │   └── sanction-letter/  # Sanction letter + eSign
│   ├── analyst/page.tsx      # Credit analyst portal
│   ├── manager/page.tsx      # Branch manager portal
│   ├── compliance/page.tsx   # Compliance audit trail
│   └── dsa/                  # DSA partner portal
│       ├── login/page.tsx
│       ├── dashboard/page.tsx
│       ├── applications/page.tsx
│       ├── officers/page.tsx
│       ├── commissions/page.tsx
│       └── profile/page.tsx
├── components/
│   ├── ui/                   # shadcn/ui components
│   │   ├── button.tsx
│   │   ├── card.tsx
│   │   ├── input.tsx
│   │   ├── components.tsx   # Shared composite components
│   └── loan/
│       └── amortization-table.tsx
├── lib/
│   ├── api.ts                # Main API client (loanApi, kycApi, etc.)
│   ├── utils.ts             # Utility functions
│   └── dsa-auth.tsx         # DSA auth context provider
├── services/
│   └── dsa-api.ts           # DSA service API client
├── hooks/
│   └── use-application-sse.ts # SSE real-time updates
├── types/                    # TypeScript type definitions
└── providers.tsx            # React Query + Auth providers
```

## Pages & Routes

| Route | Description |
|-------|-------------|
| `/` | Home — loan product selection + EMI calculator |
| `/login` | OTP login (SMS/WhatsApp) |
| `/dashboard` | Loan officer worklist |
| `/application/[id]` | Multi-step form (Personal → Employment → Loan → Review) |
| `/application/[id]/kyc` | KYC (Consent → Aadhaar → PAN → Face) |
| `/application/[id]/documents` | Document upload with OCR |
| `/application/[id]/decision` | Credit decision result |
| `/application/[id]/sanction-letter` | Sanction review + loan agreement + eSign |
| `/analyst` | Credit analyst underwriting view |
| `/manager` | Branch manager sanction workflow |
| `/compliance` | Audit trail viewer |
| `/dsa/login` | DSA partner login |
| `/dsa/dashboard` | DSA partner dashboard |
| `/dsa/applications` | DSA application list |
| `/dsa/officers` | DSA officer management |
| `/dsa/commissions` | Commission tracking |
| `/dsa/profile` | Partner profile |

## API Clients

All API clients are in `src/lib/api.ts` and `src/services/dsa-api.ts`.

### Main API (`lib/api.ts`)

| Client | Methods |
|--------|---------|
| `authApi` | `sendOtp`, `verifyOtp`, `refresh`, `logout`, `getProfile` |
| `loanApi` | `list`, `get`, `create`, `update`, `submit`, `autosave`, `getStageHistory`, `assign` |
| `kycApi` | `initiateAadhaarOtp`, `verifyAadhaarOtp`, `verifyPAN`, `faceMatch`, `livenessCheck`, `getConsent`, `captureConsent` |
| `documentApi` | `getPresignedUrl`, `upload`, `list`, `getOcrResult`, `approve`, `reject` |
| `bureauApi` | `pull`, `getReports` |
| `decisionApi` | `trigger`, `get`, `override` |
| `sanctionLetterApi` | `getPreview`, `downloadPdf` |
| `loanAgreementApi` | `generate`, `get`, `initiateESign`, `verifyESign`, `cancelESign`, `getSignatures`, `downloadPdf` |
| `disbursementApi` | `initiate`, `getStatus`, `list` |
| `auditApi` | `list`, `exportCsv` |
| `notificationApi` | `send`, `history` |

All clients:
- Automatically attach `Authorization: Bearer {token}` from cookies
- Handle 401 → auto-refresh token → retry
- Set `X-Request-Id` and `X-Correlation-Id` headers
- Show toast errors for 409, 429, 500+

## Adding a New Page

1. Create the page in `src/app/` following the App Router structure
2. Import API clients from `@/lib/api` or `@/services/dsa-api`
3. Use `useDSAAuth()` for DSA pages (wraps cookie state)
4. Follow existing page patterns (loading states, error handling, toasts)

Example:
```tsx
'use client';
import { useQuery } from '@tanstack/react-query';
import { loanApi } from '@/lib/api';

export default function MyPage() {
  const { data, isLoading } = useQuery({
    queryKey: ['my-data'],
    queryFn: () => loanApi.list({ status: 'DRAFT' }),
  });
  // ...
}
```

## Adding a New UI Component

Use shadcn/ui:
```bash
npx shadcn@latest add button card
```

Add to `src/components/ui/` and export from `src/components/ui/components.tsx`.

## Adding API Methods

Add to the appropriate client in `src/lib/api.ts`:

```typescript
export const loanApi = {
  // existing methods...
  
  myNewMethod: (id: string, data: unknown) =>
    api.post(`/my-endpoint/${id}`, data),
};
```

## Design System

- **Colors:** Primary `#2563eb` (blue-600), configured in `tailwind.config.js`
- **Typography:** System font stack
- **Spacing:** Tailwind scale (1-96 units)
- **Components:** shadcn/ui (Radix-based, accessible)

## State Management

- **Server state:** React Query (`@tanstack/react-query`)
- **Auth state:** JWT in httpOnly cookies (managed by `api.ts` interceptors)
- **Form state:** React Hook Form + Zod validation
- **DSA auth:** `useDSAAuth()` hook + `DSAAuthProvider`

## Key Dependencies

| Package | Purpose |
|---------|---------|
| `next` | Framework |
| `react-hook-form` + `zod` | Form validation |
| `@tanstack/react-query` | Server state, caching |
| `axios` | HTTP client |
| `sonner` | Toast notifications |
| `date-fns` | Date formatting |
| `lucide-react` | Icons |
| `jose` | JWT (if needed client-side) |
| `react-intl` | Internationalization |

## Accessibility

- All interactive elements have focus states
- ARIA labels on icon-only buttons
- Keyboard navigation support
- WCAG 2.1 AA compliance target

> **Note:** Formal accessibility audit (axe-core) is tracked in TASK-717.

## Docker

```bash
# Build and run
docker build -t los-frontend .
docker run -p 3000:3000 los-frontend

# Or via docker-compose (all services)
docker compose -f devops/docker/docker-compose.yml up -d frontend
```
