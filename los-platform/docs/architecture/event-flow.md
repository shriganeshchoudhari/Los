# LOS Platform — Kafka Event Flow

> Architecture Decision: ADR-003 (Kafka Event Bus)
> Last updated: Phase 50

---

## Overview

All inter-service communication for async workflows uses Apache Kafka (KafkaJS). Services emit domain events on topics; consumers process them independently. This decouples services and ensures reliability via consumer group offsets.

**Broker:** `kafka:9092` (Docker Compose) / AWS MSK in production
**Client Library:** KafkaJS with retry (3 attempts, exponential backoff) + DLQ dead-letter topic

---

## Topic Naming Convention

```
{service-name}.{domain}.{event-name}

Examples:
  loan.applications.created
  kyc.verification.completed
  decision.results.finalized
  integration.disbursement.initiated
```

---

## Topic Map

### `loan.applications.*`

| Topic | Producer | Consumers | Payload |
|-------|----------|-----------|---------|
| `loan.applications.created` | loan-service | kyc-service, decision-engine, notification-service | `{ applicationId, customerId, productType, loanAmount, createdAt }` |
| `loan.applications.submitted` | loan-service | kyc-service, decision-engine | `{ applicationId, submittedAt, officerId }` |
| `loan.applications.status_changed` | loan-service | notification-service | `{ applicationId, oldStatus, newStatus, changedBy, changedAt }` |
| `loan.applications.assigned` | loan-service | notification-service | `{ applicationId, officerId, branchCode }` |
| `loan.loans.sanctioned` | loan-service | integration-service, notification-service | `{ loanId, applicationId, sanctionedAmount, interestRate, tenureMonths }` |
| `loan.loans.disbursement_initiated` | integration-service | notification-service | `{ disbursementId, loanId, amount, accountNumber, ifsc }` |
| `loan.loans.disbursement_completed` | integration-service | loan-service | `{ disbursementId, loanId, utrNumber, disbursedAt }` |
| `loan.agreements.signed` | loan-service | notification-service | `{ agreementId, applicationId, signedAt, signerAadhaar }` |

### `kyc.verification.*`

| Topic | Producer | Consumers | Payload |
|-------|----------|-----------|---------|
| `kyc.verification.initiated` | loan-service | kyc-service | `{ applicationId, customerId, kycType }` |
| `kyc.verification.aadhaar_completed` | kyc-service | loan-service, decision-engine | `{ applicationId, kycRecordId, customerName, aadhaarHash, verifiedAt }` |
| `kyc.verification.pan_completed` | kyc-service | loan-service, decision-engine | `{ applicationId, panHash, verifiedAt, nameMatchScore }` |
| `kyc.verification.face_match_completed` | kyc-service | loan-service | `{ applicationId, matchScore, passed, verifiedAt }` |
| `kyc.verification.failed` | kyc-service | loan-service, notification-service | `{ applicationId, reason, kycType, failedAt }` |
| `kyc.consent.captured` | kyc-service | decision-engine | `{ applicationId, consentType, consentTimestamp, ipAddress }` |

### `decision.results.*`

| Topic | Producer | Consumers | Payload |
|-------|----------|-----------|---------|
| `decision.results.finalized` | decision-engine | loan-service, notification-service | `{ decisionId, applicationId, outcome, approvedAmount, interestRate, tenureMonths, rulesTriggered[], mlScore, policyVersion }` |
| `decision.override.applied` | decision-engine | loan-service, notification-service | `{ decisionId, applicationId, originalOutcome, overrideOutcome, overrideReason, overriddenBy }` |
| `decision.bureau.pulled` | decision-engine | loan-service | `{ applicationId, bureauType, score, DPD, totalAccounts, enquiryCount }` |

### `document.events.*`

| Topic | Producer | Consumers | Payload |
|-------|----------|-----------|---------|
| `document.uploaded` | document-service | loan-service | `{ documentId, applicationId, documentType, uploadedAt }` |
| `document.reviewed` | document-service | loan-service, notification-service | `{ documentId, applicationId, status, reviewedBy, reviewedAt }` |
| `document.ocr.completed` | document-service | loan-service | `{ documentId, applicationId, extractedData, provider }` |

### `dsa.events.*`

| Topic | Producer | Consumers | Payload |
|-------|----------|-----------|---------|
| `dsa.application.created` | dsa-service | loan-service | `{ dsaApplicationId, dsaPartnerId, customerData, createdAt }` |
| `dsa.commission.calculated` | dsa-service | notification-service | `{ commissionId, dsaPartnerId, applicationId, amount, payoutDate }` |

### `notification.*`

| Topic | Producer | Consumers | Payload |
|-------|----------|-----------|---------|
| `notification.otp.requested` | auth-service | notification-service | `{ mobile, channel, otpPurpose, requestId }` |
| `notification.email.requested` | * | notification-service | `{ templateName, recipientEmail, variables, applicationId }` |
| `notification.delivery.failed` | notification-service | — (DLQ) | `{ notificationId, channel, failureReason }` |

---

## Dead Letter Queue (DLQ)

Every consumer group uses a companion DLQ topic for failed messages:

```
{topic-name}.dlq

Example:
  loan.applications.created.dlq
```

Failed messages are retried 3 times (exponential backoff: 1s, 2s, 4s), then moved to DLQ. DLQ messages include `originalTopic`, `originalPartition`, `originalOffset`, `errorMessage`, `failedAt`.

**Monitoring:** Alert on DLQ depth > 0 (see Prometheus alert rule `kafka_consumer_lag`).

---

## Schema Registry

For future evolution, Kafka messages should include a `schemaVersion` field:

```json
{
  "schemaVersion": "1.0",
  "applicationId": "...",
  "timestamp": "..."
}
```

Schema Registry (Confluent) should be configured for production deployments to enforce compatibility.

---

## Consumer Group Convention

```
los-{service-name}

Examples:
  los-loan-service
  los-kyc-service
  los-decision-engine
  los-integration-service
  los-notification-service
```

---

## Local Development

Kafka topics are auto-created by KafkaJS (with `allowAutoTopicCreation: true`) in Docker Compose. For local without Docker, use `kafka-topics.sh` to pre-create:

```bash
# Create all topics
for topic in loan.applications.created loan.applications.submitted loan.applications.status_changed \
             loan.loans.sanctioned loan.loans.disbursement_initiated \
             kyc.verification.initiated kyc.verification.aadhaar_completed \
             decision.results.finalized \
             document.uploaded document.reviewed \
             dsa.application.created notification.otp.requested; do
  kafka-topics.sh --create --topic $topic --bootstrap-server localhost:9092 \
    --partitions 3 --replication-factor 1
done
```

---

## Grafana Dashboard

Kafka consumer lag and throughput metrics are available in the `devops/k8s/base/grafana-dashboards/` folder. Key panels:

- Consumer group lag (messages behind)
- Producer throughput (MB/s)
- Topic partition count
- DLQ message count
