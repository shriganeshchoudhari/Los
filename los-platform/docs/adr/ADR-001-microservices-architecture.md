# ADR-001: Microservices Architecture

**Status:** Accepted  
**Date:** 2024-01-15  
**Deciders:** LOS Platform Architecture Team

---

## Context

The LOS Platform must support a production-grade Loan Origination System for an Indian bank. The system needs to handle: OTP-based authentication, KYC verification (Aadhaar, PAN, DigiLocker), credit bureau pulls (CIBIL, Experian, Equifax, CRIF), credit decisioning (rules engine + ML), document management (upload, OCR, storage), sanction letters + eSign, NACH/disbursement integrations, DSA channel partner portal, and notifications (SMS, Email, Push, WhatsApp).

The bank requires strict compliance with RBI guidelines, SLA of 99.5% availability, and independent deployment of each functional area.

---

## Decision

The system is decomposed into **8 independent microservices**, each owning its own database:

| Service | DB | Primary Responsibility |
|---------|-----|----------------------|
| auth-service | los_auth | User authentication, OTP management, JWT issuance, LDAP integration |
| kyc-service | los_kyc | Aadhaar eKYC, PAN verification, face matching, DigiLocker |
| loan-service | los_loan | Loan applications, EMI calculator, PDD, sanction letters, eSign |
| decision-engine | los_decision | Credit scoring (rules + ML), override workflow, score management |
| integration-service | los_integration | Bureau pulls, CBS (Finacle), NACH/disbursement, NPCI payments |
| notification-service | los_notification | SMS (Msg91), Email (SMTP), Push (FCM), WhatsApp, OTP templates |
| document-service | los_document | MinIO storage, OCR (AwsTextract/Sarvam), watermarking, checklists |
| dsa-service | los_dsa | DSA partner registration, officer management, commission tracking |

The frontend (Next.js) acts as an API gateway, making REST calls to each service and aggregating data where needed.

---

## Consequences

### Positive
- **Independent deployment**: each service can be deployed, scaled, and monitored independently
- **Failure isolation**: a failure in bureau pull does not affect loan application submission
- **Team autonomy**: different teams can own different services
- **Scalability**: hot services (loan-service, auth-service) can scale independently
- **Compliance**: each service's data is isolated, simplifying RBI audit requirements
- **Technology flexibility**: each service can use the optimal library for its domain

### Negative
- **Distributed system complexity**: inter-service communication, distributed transactions, eventual consistency
- **Operational overhead**: 8 services to monitor, deploy, and maintain
- **Testing complexity**: E2E tests require all services running
- **Data consistency**: no distributed ACID transactions across services
- **Network latency**: REST calls between services add latency vs in-process calls

### Mitigations
- Kafka events for async communication to avoid distributed transactions
- Circuit breakers for all external API calls
- OpenTelemetry distributed tracing across service boundaries
- Shared `@los/common` package to avoid code duplication
- K8s HPA for automatic scaling
- Comprehensive Prometheus alerting

---

## Related Decisions

- ADR-003: Kafka as Event Bus
- ADR-004: JWT + OTP Authentication
- ADR-012: Circuit Breaker Pattern
- ADR-010: OpenTelemetry for Distributed Tracing
