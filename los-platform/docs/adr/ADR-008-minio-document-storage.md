# ADR-008: MinIO for Document Storage

**Status:** Accepted  
**Date:** 2024-01-15  
**Deciders:** LOS Platform Architecture Team

---

## Context

The LOS Platform handles loan applications that require supporting documents: PAN card, Aadhaar card, bank statements, salary slips, ITR, property documents, etc. These documents are uploaded by customers and officers, processed through OCR, stored, and must be retrieved for compliance audits. The bank requires documents to be stored durably with retention policies, and accessible via presigned URLs.

Using S3 directly would create vendor lock-in and add network latency for a bank that may have data residency requirements.

---

## Decision

**MinIO** (S3-compatible object storage) is deployed alongside PostgreSQL in the infrastructure stack:
- **docker-compose**: `minio` service on port `9000` (API) + `9001` (Console)
- **Production**: MinIO in K8s with PVC (or external S3-compatible storage like MinIO operator / Dell ECS)
- **SDK**: `minio` npm package via `MinIOService` in `loan-service`

### Storage buckets

| Bucket | Purpose | Versioning | Policy |
|--------|---------|------------|--------|
| `los-documents` | Customer-uploaded documents (PAN, Aadhaar, statements) | Enabled | Private, 7-year retention |
| `los-agreements` | Generated sanction letters, loan agreements | Enabled | Private, loan lifetime + 8 years |
| `los-esign` | Signed eSign documents | Enabled | Private, 10-year retention |
| `los-ocr` | OCR-processed output (JSON) | Disabled | Private, 3-year retention |

### Document lifecycle

1. **Upload**: `POST /documents/presigned-url` → client uploads directly to MinIO via presigned PUT URL (no server bottleneck)
2. **Confirm**: `POST /documents/confirm-upload` → MinIOService records metadata in `documents` table (path, size, type, checksum)
3. **Process**: OCR triggered asynchronously (Sarvam/AwsTextract), output stored in `los-ocr` bucket
4. **Watermark**: `POST /documents/:id/watermark` → watermarked copy generated and stored
5. **Download**: `GET /documents/:id/url` → presigned GET URL generated (15-min expiry)

---

## Consequences

### Positive
- **S3 compatibility**: easy migration to AWS S3 / Azure Blob Storage in the future
- **No server-side bandwidth**: clients upload directly via presigned URLs
- **Durability**: MinIO supports versioning and replication
- **Cost-effective**: self-hosted vs. commercial document storage
- **Compliance**: versioning enables audit of document changes
- **OCR decoupling**: OCR can process documents asynchronously without blocking upload

### Negative
- **Operational overhead**: MinIO cluster must be managed
- **No built-in encryption at rest**: requires filesystem-level encryption or MinIO server-side encryption
- **Presigned URL complexity**: must generate fresh URLs on each upload attempt
- **Multi-region**: MinIO replication across data centers requires more setup

### Mitigations
- MinIO Console exposed on internal network for ops team
- Object locks enabled for regulatory retention compliance
- Prometheus alerts if MinIO is unavailable
- Lifecycle policies auto-transition old documents to Glacier tier

---

## Related Decisions

- ADR-001: Microservices Architecture
