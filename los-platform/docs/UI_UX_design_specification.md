# UI/UX Design Specification
## Loan Origination System (LOS)
**Version:** 1.0 | **Designer:** UX Team | **Date:** 2024-07-15

---

## 1. Design System

### 1.1 Brand & Color Palette

```css
/* Primary Brand Colors */
--color-primary-900: #0A2342;    /* Deep Navy — headers, trust elements */
--color-primary-700: #1A3F6F;    /* Bank Blue — primary actions */
--color-primary-500: #2563EB;    /* Action Blue — CTAs, links */
--color-primary-100: #DBEAFE;    /* Light Blue — selected states, backgrounds */

/* Semantic Colors */
--color-success-600: #16A34A;    /* Green — approved, verified badges */
--color-success-100: #DCFCE7;    /* Light Green — success backgrounds */
--color-warning-600: #D97706;    /* Amber — pending, review states */
--color-warning-100: #FEF3C7;    /* Light Amber — warning backgrounds */
--color-error-600: #DC2626;      /* Red — errors, rejected states */
--color-error-100: #FEE2E2;      /* Light Red — error backgrounds */
--color-neutral-900: #111827;    /* Text primary */
--color-neutral-600: #4B5563;    /* Text secondary */
--color-neutral-300: #D1D5DB;    /* Borders */
--color-neutral-50: #F9FAFB;     /* Page backgrounds */
--color-white: #FFFFFF;

/* Status Badge Colors */
--status-draft: #6B7280;         /* Gray */
--status-processing: #D97706;    /* Amber */
--status-approved: #16A34A;      /* Green */
--status-rejected: #DC2626;      /* Red */
--status-sanctioned: #2563EB;    /* Blue */
--status-disbursed: #7C3AED;     /* Purple */
```

### 1.2 Typography

```css
/* Font Stack */
--font-heading: 'Inter', 'Noto Sans Devanagari', sans-serif;
--font-body: 'Inter', 'Noto Sans', sans-serif;
--font-mono: 'JetBrains Mono', 'Fira Code', monospace;  /* Account numbers, codes */
--font-numeric: 'Roboto Mono', monospace;                /* Currency amounts */

/* Type Scale */
--text-xs:   0.75rem  / 1rem;      /* 12px — labels, captions */
--text-sm:   0.875rem / 1.25rem;   /* 14px — body small */
--text-base: 1rem     / 1.5rem;    /* 16px — body default */
--text-lg:   1.125rem / 1.75rem;   /* 18px — section titles */
--text-xl:   1.25rem  / 1.75rem;   /* 20px — page subtitles */
--text-2xl:  1.5rem   / 2rem;      /* 24px — page headings */
--text-3xl:  1.875rem / 2.25rem;   /* 30px — hero titles */

/* Font Weights */
--font-normal:   400;
--font-medium:   500;
--font-semibold: 600;
--font-bold:     700;
```

### 1.3 Spacing System

```css
/* 4px base grid */
--space-1: 0.25rem;   /* 4px */
--space-2: 0.5rem;    /* 8px */
--space-3: 0.75rem;   /* 12px */
--space-4: 1rem;      /* 16px */
--space-6: 1.5rem;    /* 24px */
--space-8: 2rem;      /* 32px */
--space-12: 3rem;     /* 48px */
--space-16: 4rem;     /* 64px */
```

### 1.4 Component Tokens

```css
/* Border Radius */
--radius-sm: 4px;      /* Inputs, small elements */
--radius-md: 8px;      /* Cards, buttons */
--radius-lg: 12px;     /* Modals, large cards */
--radius-xl: 16px;     /* Feature cards */
--radius-full: 9999px; /* Pills, badges */

/* Shadows */
--shadow-sm: 0 1px 2px rgba(0,0,0,0.05);
--shadow-md: 0 4px 6px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.05);
--shadow-lg: 0 10px 15px rgba(0,0,0,0.10), 0 4px 6px rgba(0,0,0,0.05);
--shadow-focus: 0 0 0 3px rgba(37,99,235,0.30);  /* Blue focus ring */

/* Touch targets (mobile) */
--touch-target-min: 44px;    /* WCAG 2.5.5 AAA */
--touch-target-spacing: 8px; /* Min between targets */
```

---

## 2. Applicant Portal — Screen Specifications

### Screen 1: Login Screen

**Layout:** Centered card on gradient background
**Dimensions:** Card max-width 400px; full-width on mobile

```
┌─────────────────────────────────────────────────────────────┐
│                                                             │
│   [Bank Logo]                                               │
│   Loan Origination System                                   │
│                                                             │
│  ┌─────────────────────────────────────────────────────┐   │
│  │                                                     │   │
│  │    Apply for a loan — quick and paperless           │   │
│  │                                                     │   │
│  │    Mobile Number                                    │   │
│  │    ┌────────────────────────────────────────┐       │   │
│  │    │ +91  │  9876543210                      │       │   │
│  │    └────────────────────────────────────────┘       │   │
│  │                                                     │   │
│  │    [  Send OTP via SMS  ] [WhatsApp]                │   │
│  │                                                     │   │
│  │    ── or ──                                         │   │
│  │                                                     │   │
│  │    [Staff Login via Employee ID →]                  │   │
│  │                                                     │   │
│  └─────────────────────────────────────────────────────┘   │
│                                                             │
│  Secured by 256-bit encryption  🔒                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**OTP Entry state:**
```
│    Enter the 6-digit OTP sent to XXXXXX3210               │
│                                                            │
│    ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐ ┌──┐                        │
│    │ 4│ │ 8│ │  │ │  │ │  │ │  │    ← auto-focus next   │
│    └──┘ └──┘ └──┘ └──┘ └──┘ └──┘                        │
│                                                            │
│    ⏱ Resend OTP in 00:45                                  │
│                                                            │
│    [  Verify & Login  ]                                    │
```

**States to design:**
- Default (phone entry)
- OTP sent (OTP digits input)
- OTP incorrect (error inline)
- Account locked (red banner with timer)
- Loading (button spinner, inputs disabled)

**Accessibility:**
- Auto-focus to first OTP digit on send
- Auto-advance to next digit on input
- Paste support from clipboard (splits across boxes)
- `aria-label` on each OTP box: "Digit 1 of 6"

---

### Screen 2: Loan Product Selection

**Layout:** Grid of loan product cards, 2-col on mobile, 3-col on tablet+

```
┌─────────────────────────────────────────────────────────────────────┐
│  Hi, Ravi 👋   What kind of loan are you looking for?              │
│                                                                     │
│  ┌────────────────────────┐  ┌────────────────────────┐           │
│  │ 🏠 Home Loan            │  │ 👤 Personal Loan        │           │
│  │                        │  │                        │           │
│  │ Up to ₹5 Crore         │  │ Up to ₹25 Lakhs        │           │
│  │ 30-year tenure         │  │ Instant approval       │           │
│  │ Rates from 8.50%       │  │ Rates from 10.50%      │           │
│  │                        │  │                        │           │
│  │         [Apply →]      │  │         [Apply →]      │           │
│  └────────────────────────┘  └────────────────────────┘           │
│                                                                     │
│  ┌────────────────────────┐  ┌────────────────────────┐           │
│  │ 🚗 Vehicle Loan         │  │ 💼 MSME Business Loan  │           │
│  │ ...                    │  │ ...                    │           │
│  └────────────────────────┘  └────────────────────────┘           │
│                                                                     │
│  Already applied? [Track your application →]                        │
└─────────────────────────────────────────────────────────────────────┘
```

**Product card interactive states:** Default → Hover (slight elevation) → Selected (blue border + checkmark)

---

### Screen 3: Multi-Step Application Form

**Layout:** Sidebar progress tracker (desktop) / top step indicator (mobile)

```
Desktop:
┌──────────────────┬──────────────────────────────────────────────┐
│                  │                                              │
│   APPLICATION    │  Step 2 of 4: Employment Details             │
│   PROGRESS       │  ─────────────────────────────              │
│                  │                                              │
│  ✅ 1. Personal  │  Employment Type                             │
│     Details      │  ┌──────────────────────────────────────┐   │
│                  │  │ Salaried - Private Sector          ▾  │   │
│  ➤ 2. Employ-   │  └──────────────────────────────────────┘   │
│     ment         │                                              │
│                  │  Employer Name *                             │
│  ○ 3. Loan       │  ┌──────────────────────────────────────┐   │
│     Details      │  │ Infosys Limited                      │   │
│                  │  └──────────────────────────────────────┘   │
│  ○ 4. Review &   │                                              │
│     Submit       │  Gross Monthly Income (₹) *                  │
│                  │  ┌──────────────────────────────────────┐   │
│   Estimated      │  │ ₹ 1,20,000                           │   │
│   time: 8 min    │  └──────────────────────────────────────┘   │
│                  │                                              │
│                  │  ┌─────────────────────────────────────┐    │
│                  │  │ EMI Capacity Preview               ×  │   │
│                  │  │ Based on ₹1.2L income                │   │
│                  │  │ Max EMI you can afford: ~₹54,000     │   │
│                  │  │ Your requested EMI: ₹16,285 ✓       │   │
│                  │  └─────────────────────────────────────┘    │
│                  │                                              │
│                  │   [← Back]           [Continue →]           │
└──────────────────┴──────────────────────────────────────────────┘
```

**Form validation UX rules:**
- Validate on blur (not on keystroke)
- Error message appears below field in red
- Field border turns red on error, green on valid
- Scroll to first error on form submit
- Inline helper text for complex fields (e.g., "Enter your take-home salary after all deductions")

**Auto-fill behaviour:**
- If returning customer, pre-fill known fields with "Pre-filled from your profile" badge
- OCR pre-fill from documents: show extracted value + "Extracted from document" badge + allow edit

---

### Screen 4: KYC Flow

**Layout:** Full-screen centered wizard; progress dots at top

```
Step 1: Aadhaar Consent
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   🔒  Identity Verification (KYC)                              │
│                                                                 │
│   We'll verify your identity using Aadhaar eKYC               │
│   as mandated by RBI. This is secure and instant.             │
│                                                                 │
│   ┌─────────────────────────────────────────────────┐         │
│   │  Aadhaar Number                                 │         │
│   │  XXXX - XXXX - XXXX    (masked after entry)    │         │
│   │                                                 │         │
│   │  ☐ I consent to use Aadhaar eKYC for this      │         │
│   │    loan application. I understand that my       │         │
│   │    KYC data will be used only for this purpose. │         │
│   └─────────────────────────────────────────────────┘         │
│                                                                 │
│   [  Send OTP to Aadhaar-linked mobile  ]                      │
│                                                                 │
│   🔐 Your Aadhaar number is encrypted end-to-end               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**Face Capture Screen:**
```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│   📸  Take a Selfie                                             │
│                                                                 │
│   ┌─────────────────────────────────────────────┐             │
│   │                                             │             │
│   │      [  Camera viewfinder area  ]           │             │
│   │         ┌──────────────────┐                │             │
│   │         │  Oval face guide │                │             │
│   │         │  (animated)      │                │             │
│   │         └──────────────────┘                │             │
│   │                                             │             │
│   │   ✓ Good lighting                           │             │
│   │   ✓ Face clearly visible                    │             │
│   │   ✗ No sunglasses                           │             │
│   │                                             │             │
│   └─────────────────────────────────────────────┘             │
│                                                                 │
│   [  Take Photo  ]                [Upload Photo]               │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**KYC Completion:**
```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│           ✅  KYC Verified Successfully!                        │
│                                                                 │
│   ✓ Aadhaar eKYC verified                                      │
│   ✓ PAN verified (linked to Aadhaar)                          │
│   ✓ Face match: 91% (passed)                                   │
│                                                                 │
│   KYC valid for this application.                              │
│                                                                 │
│   [  Continue to Document Upload  ]                            │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

---

### Screen 5: Document Upload

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│  📄  Upload Documents                    4 of 5 uploaded ████▒  │
│                                                                  │
│  Personal Loan — Salaried                                        │
│  ─────────────────────────────────────────────────────          │
│                                                                  │
│  ✅ Salary Slip — June 2024          Approved                    │
│     Extracted: Infosys Ltd | ₹1,20,000                          │
│                                                                  │
│  ✅ Salary Slip — May 2024           Approved                    │
│                                                                  │
│  ✅ Salary Slip — April 2024         Approved                    │
│                                                                  │
│  ✅ Bank Statement (3 months)        Approved                    │
│                                                                  │
│  ⏳ Form 16 (optional, <₹5L)         Not uploaded               │
│     ┌──────────────────────────────────────────────────────┐    │
│     │  📎 Drag & drop or click to upload                  │    │
│     │     PDF, JPG, PNG — max 10 MB                       │    │
│     └──────────────────────────────────────────────────────┘    │
│                                                                  │
│  [  DigiLocker Import  ]    All required documents uploaded!     │
│                                                                  │
│  [                   Proceed to Review                       ]   │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

**Upload progress states:**
1. Default (dashed box with upload icon)
2. Uploading (progress bar with %)
3. OCR Processing (spinner with "Reading document...")
4. Approved (green checkmark + extracted data summary)
5. Rejected (red X + rejection reason + re-upload button)

---

### Screen 6: Application Status Tracker

```
┌──────────────────────────────────────────────────────────────────┐
│  Application LOS-2024-MH-000342                                  │
│  Personal Loan — ₹5,00,000                                       │
│  Submitted: 15 Jul 2024, 10:35 AM                                │
│  ────────────────────────────────────────────────────────────    │
│                                                                  │
│  ●────────────●────────────●────────────◉────────────○          │
│  Application  KYC          Documents    Processing   Decision    │
│  Submitted ✅  Complete ✅   Complete ✅  In Progress  Pending     │
│                                                                  │
│  ┌──────────────────────────────────────────────────────┐       │
│  │  ⏳ Under Processing                                  │       │
│  │  Your application is being reviewed by our team.    │       │
│  │  Typical time: 30 minutes for personal loans.        │       │
│  │                                                      │       │
│  │  Assigned to: Branch, Andheri West                  │       │
│  │  Reference: LOS-2024-MH-000342                      │       │
│  └──────────────────────────────────────────────────────┘       │
│                                                                  │
│  [  View Application Details  ]   [  Contact Branch  ]          │
│                                                                  │
│  🔔 You'll be notified via SMS and this app                     │
└──────────────────────────────────────────────────────────────────┘
```

---

### Screen 7: Approval + EMI Schedule

```
┌──────────────────────────────────────────────────────────────────┐
│                                                                  │
│   🎉  Congratulations! Loan Approved                            │
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐  │
│  │                  KEY FACT STATEMENT                       │  │
│  │  Loan Amount:          ₹5,00,000                         │  │
│  │  Interest Rate:        10.75% p.a. (Fixed)               │  │
│  │  Tenure:               36 months                         │  │
│  │  Monthly EMI:          ₹16,285                           │  │
│  │  Total Interest:       ₹86,260                           │  │
│  │  Processing Fee:       ₹5,000 + GST                      │  │
│  │  APR (All-in cost):    11.62% p.a.                       │  │
│  │  First EMI Date:       1 September 2024                  │  │
│  └──────────────────────────────────────────────────────────┘  │
│                                                                  │
│  EMI Schedule — First 3 months (12↓ View all)                   │
│  ┌────────┬─────────┬───────────┬──────────┬──────────────┐    │
│  │ Month  │ EMI     │ Principal │ Interest │ Balance      │    │
│  ├────────┼─────────┼───────────┼──────────┼──────────────┤    │
│  │ Sep 24 │ ₹16,285 │ ₹11,909   │ ₹4,375   │ ₹4,88,091   │    │
│  │ Oct 24 │ ₹16,285 │ ₹11,993   │ ₹4,271   │ ₹4,76,098   │    │
│  │ Nov 24 │ ₹16,285 │ ₹12,078   │ ₹4,166   │ ₹4,64,020   │    │
│  └────────┴─────────┴───────────┴──────────┴──────────────┘    │
│                                                                  │
│   [  Download Sanction Letter  ]                                 │
│   [  Accept & Sign with Aadhaar OTP  ]                          │
│                                                                  │
└──────────────────────────────────────────────────────────────────┘
```

---

## 3. Officer Portal — Screen Specifications

### Screen 8: Loan Officer Worklist

```
┌──────────────────────────────────────────────────────────────────┐
│  Worklist — Andheri Branch    🔔 3          Amit K ▾            │
│  ────────────────────────────────────────────────────────────   │
│                                                                  │
│  [All] [Personal Loan ▾] [Home Loan ▾]   [🔍 Search by name/app]│
│                                                                  │
│  Sort: Submitted Date ▾    Showing 1-20 of 47                   │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ LOS-2024-MH-000342  Ravi Sharma     Personal Loan       │    │
│  │ ₹5,00,000  •  Submitted: 15 Jul 10:35  •  ⏳ 2h 15m    │    │
│  │ CIBIL: 751  FOIR: 34%  Age: 34        [Review →]        │    │
│  └─────────────────────────────────────────────────────────┘    │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ LOS-2024-MH-000339  Priya Mehta      Home Loan          │    │
│  │ ₹45,00,000  •  Submitted: 15 Jul 09:10  •  ⏳ 3h 40m   │    │
│  │ CIBIL: 724  FOIR: 41%  Age: 38        [Review →]        │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  [< Prev]  Page 1 of 3  [Next >]                                │
└──────────────────────────────────────────────────────────────────┘
```

### Screen 9: Application Review (Officer)

```
┌──────────────────────────────────────────────────────────────────┐
│  ← Back    LOS-2024-MH-000342   Ravi Sharma   Personal Loan     │
│                                                                  │
│  [Applicant] [Employment] [Documents] [Bureau] [Decision]        │
│  ──────────────────── BUREAU REPORT ───────────────────────     │
│                                                                  │
│   ╔═══════════════════════════════════════════════════════╗     │
│   ║   CIBIL Score: 751         Experian Score: 748        ║     │
│   ║   ████████████░░░░  Good   ████████████░░░░  Good     ║     │
│   ╚═══════════════════════════════════════════════════════╝     │
│                                                                  │
│   Active Accounts: 3    |  Total Exposure: ₹8,50,000           │
│   Overdue Amount: ₹0    |  Enquiries (6M): 2                    │
│                                                                  │
│   DPD History                                                    │
│   Last 12 months: ✅ 0 DPDs   Last 24M: ✅ 0 DPDs               │
│   Worst DPD ever: 0           Fraud Flag: ✅ No                  │
│   Wilful Defaulter: ✅ No     Suit Filed: ✅ No                  │
│                                                                  │
│   ─────────────── DECISION RECOMMENDATION ─────────────────     │
│   ✅ All 47 rules passed                                         │
│   ML Score: 742/1000  Grade: A  PD: 1.2%                        │
│                                                                  │
│   Recommended: APPROVE ₹5,00,000 @ 10.75%                      │
│                                                                  │
│   [  Reject  ]    [  Send to Credit Committee  ]   [  Approve →]│
└──────────────────────────────────────────────────────────────────┘
```

---

## 4. Responsive Breakpoints

| Breakpoint | Width | Layout Changes |
|---|---|---|
| Mobile | < 640px | Single column, bottom nav bar, full-width cards |
| Tablet | 640-1024px | 2-column grid, side-by-side form fields |
| Desktop | > 1024px | Sidebar navigation, 3-column grids, split views |

**Mobile-specific adaptations:**
- Sticky progress bar at top during multi-step form
- Bottom sheet (drawer) for filters instead of sidebar
- Swipe gestures for tab navigation
- Camera access for document upload (direct photo, no file picker)
- Touch-optimized OTP input (numeric keyboard auto-opens)

---

## 5. Accessibility Requirements

### WCAG 2.1 AA Compliance
- **Color contrast:** All text ≥ 4.5:1 (normal), ≥ 3:1 (large text)
- **Focus indicators:** Visible 3px blue ring on all interactive elements
- **Touch targets:** Min 44×44px with 8px spacing
- **Screen reader:** All images have `alt` text; icons have `aria-label`
- **Form labels:** All inputs have visible labels + `for`/`id` association
- **Error messages:** Associated with inputs via `aria-describedby`
- **Status updates:** Live regions (`aria-live="polite"`) for async updates
- **Skip link:** "Skip to main content" as first focusable element

### Hindi Language Support
- All UI strings in resource files (`en.json`, `hi.json`)
- Right-to-left not required (Hindi is LTR)
- Noto Sans Devanagari font loaded for Hindi
- Language toggle in header (EN | हिन्दी)

---

## 6. Loading & Empty States

### Loading States
- **Skeleton screens** (not spinners) for list/card loading
- **Button spinner** — small inline spinner, disable button during request
- **Full-page loader** — only for initial page load, not for data fetches
- **Progress indication** — for bureau pull: "Fetching credit report... (45s)"

### Error States
- **API error:** Toast notification (top-right, auto-dismiss 5s) for non-critical; full-page error for critical
- **Network offline:** Persistent banner "No internet connection. Your data is saved."
- **Session expired:** Modal with "Your session has expired. Login again." — auto-redirect after 5s

### Empty States
- **No applications:** Illustrated empty state with CTA "Apply for your first loan"
- **No documents:** Document checklist with all items in PENDING_UPLOAD state
- **Worklist empty:** "No applications in your queue. Check back later."

---

## 7. Notification Design

### In-App Notification Bell
```
🔔 3  ← Badge with count

Notification Panel:
──────────────────────────────────────
🟢 Application Approved!
   LOS-2024-MH-000342 · 2 min ago
   View Sanction Letter →

🔵 KYC Verified
   Your identity has been verified · 1h ago

🟡 Document Rejected
   Salary Slip June — please re-upload · 2h ago

[Mark all read]    [View all notifications →]
```

### Toast Notifications
- Position: Top-right (desktop), bottom-center (mobile)
- Auto-dismiss: 5s (success), 8s (warning), persistent (error)
- Colors: Success (green), Warning (amber), Error (red), Info (blue)

---

## 8. Animation & Micro-interactions

| Interaction | Animation | Duration |
|---|---|---|
| Page transition | Fade + slide up (8px) | 200ms ease |
| Modal open | Scale 0.95→1 + fade | 150ms ease-out |
| Form step advance | Slide left | 250ms ease |
| Status badge change | Scale pulse | 300ms |
| Upload success | Checkmark draw | 400ms |
| KYC verified | Confetti + checkmark | 600ms |
| Notification bell | Wiggle on new notif | 500ms |
| Button press | Scale 0.98 | 100ms |
| Card hover | Translate Y -2px + shadow | 150ms ease |

All animations: `prefers-reduced-motion: reduce` → disable all

---
*End of UI/UX Design Specification*
