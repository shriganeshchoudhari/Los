# ADR-013: PDD (Post Disbursement Documentation) Workflow

**Status:** Accepted  
**Date:** 2024-01-15  
**Deciders:** LOS Platform Architecture Team

---

## Context

After a loan is disbursed, the bank requires physical/post-disbursement documentation to be completed and verified. This includes: original property documents (for LAP), NACH mandate registration, post-dated cheques (historically), insurance policies, and other collateral documentation. These items have due dates tracked by the operations team, and breaches (overdue > 30 days) require escalation to the collections/recovery team.

The challenge: tracking checklist items across customers, branches, and loan types; sending automated reminders; escalating overdue items; and providing visibility to branch managers.

---

## Decision

`loan-service` manages the PDD lifecycle via `PddService`, `PddController`, and `PddSchedulerService`.

### Checklist initialization

On `los.agreement.signed` Kafka event:
1. `EsignEventListener` receives the event
2. `PddService.initiatePdd(applicationId)` is called
3. `PddChecklist` created with due date (typically disbursement date + 30 days)
4. Checklist items created based on loan type:

| Loan Type | Items |
|-----------|-------|
| Home Loan (HL) | Original Title Deeds, Encumbrance Certificate, Property Insurance, NACH Mandate |
| LAP | Original Property Documents, Board Resolution, NACH Mandate |
| Personal Loan | NACH Mandate (auto-generated) |
| Vehicle Loan | RC Book Copy, Insurance, NACH Mandate |
| Gold Loan | Hallmark Certificate, Storage Receipt |
| Education Loan | Admission Letter, Course Completion Bond |

### Checklist item states

`PENDING` → `SUBMITTED` → `VERIFIED` | `REJECTED`

- **PENDING**: item created, not yet submitted by customer
- **SUBMITTED**: customer has submitted the document
- **VERIFIED**: officer has verified the document, item complete
- **REJECTED**: officer rejected the submitted document

### Scheduled checks

`PddSchedulerService` (NestJS `@ScheduleModule` cron jobs):

| Job | Schedule | Action |
|-----|---------|--------|
| `pdd-overdue-check` | Daily 9 AM Mon-Sat | Checks PENDING items past due date → marks `OVERDUE`, calculates days past due |
| `pdd-reminder-check` | Daily 9 AM Mon-Sat | Sends reminders for items due in 7/3/1 days via Kafka events |

### Breaches

- **Overdue (1-30 days)**: `OVERDUE` status → notifications to customer + branch manager
- **Breached (> 30 days)**: `BREACHED` status → `los.pdd.breached` Kafka event → triggers recovery workflow
- Kafka events: `PDD_OVERDUE`, `PDD_BREACHED`, `PDD_REMINDER`, `PDD_COMPLETED`

---

## Consequences

### Positive
- **Automated lifecycle**: no manual tracking — system creates checklist, sends reminders, escalates automatically
- **Loan-type aware**: different loan products have different checklist requirements
- **Due date enforcement**: system tracks actual due dates, not just creation dates
- **Recovery integration**: breach events trigger the collections workflow
- **Visibility**: branch managers see overdue items via dashboard

### Negative
- **Complexity**: Kafka consumers must handle `agreement.signed` reliably
- **Scheduler reliability**: `@nestjs/schedule` cron jobs run in each pod; need leader election in K8s
- **Reminder spam**: too many reminder events could annoy customers
- **Manual override**: operations may need to extend due dates manually

### Mitigations
- Kafka consumer idempotency prevents duplicate checklist creation
- K8s leader election for scheduler (only one pod runs each cron job)
- Reminder deduplication via Redis cache
- Override endpoint for branch managers to extend due dates

---

## Related Decisions

- ADR-001: Microservices Architecture
- ADR-003: Kafka as Event Bus
