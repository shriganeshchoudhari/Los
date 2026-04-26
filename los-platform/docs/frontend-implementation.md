# Frontend — Implementation Reference

**Stack:** Next.js 14 (App Router) · TypeScript · React 18 · TailwindCSS · shadcn/ui · TanStack Query v5 · Axios · Zod · jose  
**Dev server:** `http://localhost:3000`  
**Backend base URL (dev):** `http://localhost:8082/api` — all Axios instances default to this  
**Build:** `npm run build` → `.next/`  
**E2E tests:** Playwright — `npm test`  
**Last verified:** April 21, 2026

---

## Project Structure

```
frontend/src/
├── app/                          Next.js App Router pages
│   ├── layout.tsx                Root layout — TanStack Query + Sonner providers
│   ├── page.tsx                  Home — product selection (12 products)
│   ├── providers.tsx             QueryClientProvider + Toaster
│   ├── error.tsx                 Global error boundary
│   ├── login/page.tsx            OTP login (applicants)
│   ├── dashboard/page.tsx        Loan officer worklist
│   ├── analyst/page.tsx          Credit analyst view
│   ├── manager/page.tsx          Branch manager sanction
│   ├── compliance/page.tsx       Audit trail viewer
│   ├── dsa/                      DSA partner portal
│   │   ├── layout.tsx
│   │   ├── login/page.tsx
│   │   ├── register/page.tsx
│   │   ├── dashboard/page.tsx
│   │   ├── applications/page.tsx, [id]/page.tsx, new/page.tsx
│   │   ├── commissions/page.tsx
│   │   ├── officers/page.tsx
│   │   └── profile/page.tsx
│   └── application/[id]/
│       ├── page.tsx              Application detail + multi-step form
│       ├── error.tsx             Application error boundary
│       ├── kyc/page.tsx          Aadhaar eKYC (7 steps)
│       ├── documents/page.tsx    Document upload + OCR
│       ├── decision/page.tsx     Decision result + SSE tracker
│       ├── sanction-letter/page.tsx  KFS + NSDL eSign (530 lines)
│       └── emi/page.tsx          Amortization table
├── components/
│   ├── ui/
│   │   ├── button.tsx, card.tsx, input.tsx
│   │   └── components.tsx        OTPDigitInput, StatusBadge, ProgressStages, MoneyInput, ApplicationCard
│   └── loan/
│       └── amortization-table.tsx
├── hooks/
│   ├── use-accessibility.tsx     Skip-link + keyboard nav
│   ├── use-application-sse.ts    SSE real-time status updates
│   └── use-report-vitals.ts
├── lib/
│   ├── api.ts                    All Axios instances + typed API methods
│   ├── use-auth.ts               JWT decode, role, route protection
│   ├── dsa-auth.tsx              DSA JWT (separate cookie namespace)
│   └── utils.ts                  formatCurrency, timeAgo, cn()
├── services/
│   └── dsa-api.ts                Thin DSA API wrapper
├── types/                        TypeScript domain types
│   ├── auth.ts, loan.ts, kyc.ts, decision.ts, bureau.ts
│   ├── documents.ts, dsa.ts, notification.ts, payments.ts, cbs.ts
│   ├── audit.ts, events.ts, config.ts, shared.ts
│   └── index.ts
└── middleware.ts                  Next.js Edge middleware — route protection
```

---

## API Layer (`src/lib/api.ts`)

Eight Axios instances all default to `http://localhost:8082/api`. Override each via environment variable if needed (e.g. to split across separate hosts in production).

| Instance | Env var | Default base |
|----------|---------|-------------|
| `authSvc` | `NEXT_PUBLIC_AUTH_SERVICE_URL` | `http://localhost:8082/api` |
| `kycSvc` | `NEXT_PUBLIC_KYC_SERVICE_URL` | `http://localhost:8082/api` |
| `loanSvc` | `NEXT_PUBLIC_LOAN_SERVICE_URL` | `http://localhost:8082/api` |
| `docSvc` | `NEXT_PUBLIC_DOCUMENT_SERVICE_URL` | `http://localhost:8082/api` |
| `decisionSvc` | `NEXT_PUBLIC_DECISION_SERVICE_URL` | `http://localhost:8082/api` |
| `integrationSvc` | `NEXT_PUBLIC_INTEGRATION_SERVICE_URL` | `http://localhost:8082/api` |
| `notificationSvc` | `NEXT_PUBLIC_NOTIFICATION_SERVICE_URL` | `http://localhost:8082/api` |
| `dsaSvc` | `NEXT_PUBLIC_DSA_SERVICE_URL` | `http://localhost:8082/api` |

All instances share:
- `timeout: 30_000`, `withCredentials: true`
- Request interceptor: injects `X-Request-Id` + `X-Correlation-Id`
- Response interceptor: on `401` → calls `fetch('/api/auth/refresh', { method: 'POST' })` → retry once → redirect to `/login`

### Exported API objects

```typescript
authApi        // sendOtp, verifyOtp, refresh, logout, getProfile
loanApi        // list, get, create, update, submit, autosave, getStageHistory, assign, submitDecision
kycApi         // initiateAadhaarOtp, verifyAadhaarOtp, verifyPAN, faceMatch, livenessCheck, getConsent, captureConsent
documentApi    // getPresignedUrl, upload (PUT to presigned URL), list, getOcrResult, approve, reject
bureauApi      // pull, getReports
decisionApi    // trigger, get, override
disbursementApi // initiate, getStatus, list
sanctionLetterApi  // getPreview, downloadPdf
loanAgreementApi   // generate, get, initiateESign, verifyESign, cancelESign, getSignatures, downloadPdf
auditApi       // list, exportCsv
notificationApi // send, history
dsaApi         // login, register, getDashboard, listApplications, getApplication, listOfficers, getCommissions, getProfile
```

---

## Auth Layer

### `src/lib/use-auth.ts`
Reads `access_token` cookie via `jose` (client-side JWT decode). Exposes:
- `user` — decoded JWT payload
- `isAuthenticated`, `isTokenExpired`
- `hasRole(role: UserRole)`, `hasPermission(permission: string)`
- `login()`, `logout()`, `refreshAuth()`

### `src/middleware.ts` — Next.js Edge middleware
Reads `access_token` cookie, decodes JWT, checks `exp`. Protected routes redirect to login if unauthenticated:

| Route pattern | Redirect if no valid token |
|--------------|--------------------------|
| `/dashboard`, `/application/**`, `/analyst`, `/manager`, `/compliance` | → `/login` |
| `/dsa/dashboard`, `/dsa/applications/**`, `/dsa/commissions`, `/dsa/officers`, `/dsa/profile` | → `/dsa/login` |
| `/login` (when authenticated) | → `/dashboard` |

---

## Page Reference

| Route | Lines | Key APIs used | Notes |
|-------|-------|--------------|-------|
| `/` | — | — | 12 loan product cards, eligibility guide |
| `/login` | — | `authApi.sendOtp`, `verifyOtp` | 6-digit `OTPDigitInput`; on success calls `/api/auth/callback` to set httpOnly cookies |
| `/dashboard` | 236 | `authApi.getProfile`, `loanApi.list` | React Query 30 s refetch; parses `data?.data?.content` (Spring `Page<T>`) |
| `/analyst` | 287 | `loanApi`, `bureauApi`, `documentApi` | 3 tabs: Underwriting / Documents / Bureau |
| `/manager` | 235 | `loanApi.submitDecision` | Sanction queue; APPROVE/REJECT/REVISE modal |
| `/compliance` | 217 | `auditApi.list`, `exportCsv` | Category + date range filter; CSV export |
| `/application/[id]` | — | `loanApi.get` | Multi-step form: Personal → Employment → Loan → Co-applicants → Review |
| `/application/[id]/kyc` | 402 | `kycApi.*` | 7-step flow: Consent → Aadhaar OTP → Verify OTP → PAN → Face Capture → Liveness → Face Match |
| `/application/[id]/documents` | 186 | `documentApi.*` | Presigned URL upload; drag-and-drop; OCR result preview |
| `/application/[id]/decision` | 308 | `decisionApi.*`, `bureauApi` | Approval/rejection display; SSE status tracker |
| `/application/[id]/sanction-letter` | 530 | `sanctionLetterApi`, `loanAgreementApi` | KFS review → sanction preview → agreement generation → NSDL eSign (OTP flow); sessionStorage for step persistence |
| `/application/[id]/emi` | — | `loanApi.get` | `AmortizationTable` component; full/summary toggle |
| `/dsa/login` | — | `dsaApi.login` | Separate `dsa_access_token` cookie |
| `/dsa/dashboard` | — | `dsaApi.getDashboard` | Partner stats |
| `/dsa/applications` | — | `dsaApi.listApplications` | — |
| `/dsa/commissions` | — | `dsaApi.getCommissions` | Status filter |

---

## Shared Components

### `OTPDigitInput`
6 `<input>` boxes, `inputMode="numeric"`, `maxLength="1"`, auto-focus next/prev. Accessibility: `role="group"`, `aria-label`, `autoComplete="one-time-code"`, `aria-hidden` on icons.

### `StatusBadge`
Maps loan `status` string → color badge. `aria-label="Status: {status}"`.

### `ProgressStages`
Step indicator. `role="progressbar"`, `aria-valuenow={currentStep}`, `aria-valuemax={totalSteps}`, `aria-current="step"` on active stage.

### `AmortizationTable`
Full EMI schedule: month / opening balance / principal / interest / closing balance. Toggle between full and summary view.

---

## SSE Hook (`hooks/use-application-sse.ts`)

Subscribes to `GET /api/applications/{id}/events` (Server-Sent Events). Falls back gracefully if the endpoint is absent.

**⚠️ This endpoint does not exist in Spring Boot yet.** Decision page real-time updates will not work until `SseEmitter` is added to `LoanApplicationController`.

---

## Next.js API Routes

| Route | Purpose |
|-------|---------|
| `POST /api/auth/callback` | Sets `access_token` + `refresh_token` as `httpOnly; Secure; SameSite=Strict` cookies after OTP login |
| `GET /api/auth/logout` | Clears both cookies |

**⚠️ Missing route:** The Axios 401 interceptor calls `POST /api/auth/refresh` to rotate tokens, but this Next.js API route does not exist yet. Create it: read `refresh_token` cookie → call `authApi.refresh()` → set new cookies.

---

## Known Issues

| # | Severity | Issue | Fix needed |
|---|---------|-------|-----------|
| 1 | 🔴 | SSE endpoint missing on backend | Add `SseEmitter` to `LoanApplicationController` at `GET /applications/{id}/events` |
| 2 | 🔴 | `/api/auth/refresh` Next.js route missing | Create route that reads cookie, calls backend, sets new cookies |
| 3 | 🟡 | OCR endpoint mismatch: `GET /documents/{id}/ocr` vs `POST /documents/ocr` | Add GET handler in `DocumentController` |
| 4 | 🟡 | `profile?.name` — verify Spring `AuthService.getProfile()` serializes as `name` | Confirmed: `dto.setName(...)` → Jackson serializes as `name` ✅ |
| 5 | 🟡 | Amortization data — verify `/applications/{id}` response includes EMI schedule | If not, add `GET /api/emi/calculate?applicationId=` call in `emi/page.tsx` |
| 6 | 🟢 | CORS: Spring allows `localhost:3000` only | Next.js dev runs on `:3000` — this matches. Update for production domain. |
| 7 | 🟢 | `formatCurrency` / `timeAgo` in `utils.ts` — verify they exist | Add if missing: `Intl.NumberFormat('en-IN', {style:'currency',currency:'INR'})` + `formatDistanceToNow` from `date-fns` |

---

## Environment Variables

All default to `http://localhost:8082/api`. For a monolith deployment, **none of these need to be set** in local dev.

```bash
NEXT_PUBLIC_AUTH_SERVICE_URL=http://localhost:8082/api
NEXT_PUBLIC_KYC_SERVICE_URL=http://localhost:8082/api
NEXT_PUBLIC_LOAN_SERVICE_URL=http://localhost:8082/api
NEXT_PUBLIC_DOCUMENT_SERVICE_URL=http://localhost:8082/api
NEXT_PUBLIC_DECISION_SERVICE_URL=http://localhost:8082/api
NEXT_PUBLIC_INTEGRATION_SERVICE_URL=http://localhost:8082/api
NEXT_PUBLIC_NOTIFICATION_SERVICE_URL=http://localhost:8082/api
NEXT_PUBLIC_DSA_SERVICE_URL=http://localhost:8082/api
```

---

## Running Locally

```bash
cd los-platform/frontend
cp .env.local.example .env.local   # defaults already point to :8082
npm install
npm run dev
# Opens http://localhost:3000
```

**Prerequisite:** Spring Boot backend running on `:8082` + PostgreSQL + Redis.

---

## E2E Test Files (Playwright)

Located in `frontend/tests/e2e/specs/`:

| File | Scenarios |
|------|----------|
| `auth.spec.ts` | OTP login, session persistence, logout |
| `application.spec.ts` | Create, update, submit application |
| `kyc.spec.ts` | Aadhaar flow, PAN verify, face match |
| `documents.spec.ts` | Upload, OCR, approve/reject |
| `decision.spec.ts` | Trigger, view result, override |
| `fraud-security.spec.ts` | OWASP A01–A10, 30+ test cases |

Run: `npm test` or `npm run test:ui` for interactive mode.
