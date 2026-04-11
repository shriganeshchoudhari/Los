# LOS Platform — Disaster Recovery Runbook

> Owner: SRE / DevOps | Review: Monthly | Last tested: ___________

---

## Recovery Objectives

| Metric | Target | Rationale |
|--------|--------|-----------|
| RTO (Recovery Time Objective) | **4 hours** | Business can process loans manually during outage |
| RPO (Recovery Point Objective) | **1 hour** | Max 1h of loan applications / decisions lost |
| RTO for Critical Path (KYC → Decision → Disbursement) | **1 hour** | Core STP flow |

---

## Infrastructure Topology

```
Primary Region: ap-south-1 (Mumbai)
DR Region: ap-southeast-1 (Singapore)
Replication: Async (RPO 1h)
Failover: Manual via Route 53 health checks + weighted routing
```

**Multi-AZ within region:**
- RDS PostgreSQL: Multi-AZ (synchronous replica)
- ElastiCache Redis: Cluster mode (3 shards × 2 replicas)
- MSK Kafka: 3 AZs, replication factor 3
- EKS: 3 AZ node groups (auto-scaling)

---

## Backup Strategy

### RDS PostgreSQL

- **Automated backups:** Daily snapshots, retention 35 days
- **Point-in-time recovery:** Enabled, up to any second in last 35 days
- **Cross-region snapshots:** Configured via AWS Backup, replicated to `ap-southeast-1`
- **Pre-prod database:** Weekly full backup before release window

```bash
# Manual snapshot (pre-deployment)
aws rds create-db-snapshot \
  --db-instance-identifier los-platform-prod \
  --db-snapshot-identifier los-prod-pre-release-$(date +%Y%m%d%H%M)

# Restore from snapshot (DR scenario)
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier los-platform-dr \
  --db-snapshot-identifier los-platform-prod-snapshot-id \
  --db-instance-class db.r6g.xlarge \
  --no-multi-az
```

### MinIO / S3 (Documents)

- **Versioning:** Enabled on all buckets
- **Cross-region replication:** Configured to `ap-southeast-1`
- **Lifecycle policy:** Move to Glacier after 90 days
- **Retention:** Compliance mode for sanction letters (7 years)

```bash
# S3 bucket replication (configured via Terraform)
# See devops/terraform/s3.tf

# List document bucket objects
aws s3 ls s3://los-documents-prod/ --recursive | wc -l

# Verify replication status
aws s3api get-bucket-replication --bucket los-documents-prod
```

### Kafka (MSK)

- **Topic replication factor:** 3 across 3 AZs
- **Consumer group offsets:** Stored in Kafka (not DB)
- **MSK Serverless:** Used for DR region (auto-scaling, pay-per-use)
- **MirrorMaker 2:** For async replication from primary to DR

```bash
# Check MSK cluster health
aws kafka list-clusters --region ap-south-1
aws kafka describe-cluster --cluster-arn <arn> --region ap-south-1

# Verify topic configuration
kafka-topics.sh --describe --topic loan.applications.created \
  --bootstrap-server $MSK_BROKERS
```

---

## DR Activation Procedure

### Trigger Conditions

Activate DR when ANY of:
- Primary region declared unavailable by AWS (Service Health Dashboard)
- RTO exceeds 2 hours for critical path
- Data corruption detected (Ransomware / accidental DROP)
- Security incident requiring full environment rebuild

**Approval required:** CTO + Head of Operations

---

### Phase 1: Declare DR (0–15 min)

1. **Open incident ticket** in PagerDuty with severity P1
2. **Notify stakeholders:** CTO, Head of Operations, Legal/Compliance (RBI reporting)
3. **Declare DR mode:**
   ```bash
   # Update Route 53 failover record
   aws route53 change-resource-record-sets \
     --hosted-zone-id <ZONE_ID> \
     --change-batch file://dr/route53-failover.json

   # Verify DNS switched
   nslookup api.los-bank.in
   # Expected: DR region IP
   ```
4. **Enable DR feature flag** in Vault:
   ```bash
   vault kv put los-platform/config feature_dr_mode=true
   ```

---

### Phase 2: Restore Databases (15–90 min)

```bash
# 1. Restore all 9 PostgreSQL databases to DR region
for db in los_auth los_loan los_kyc los_decision los_integration \
          los_document los_notification los_dsa los_shared; do
  SNAPSHOT_ID=$(aws rds describe-db-snapshots \
    --query "DBSnapshots[?DBInstanceIdentifier=='los-platform-prod-$db'].DBSnapshotArn | [0]" \
    --output text)
  aws rds restore-db-instance-from-db-snapshot \
    --db-instance-identifier los-platform-dr-$db \
    --db-snapshot-identifier $SNAPSHOT_ID \
    --db-instance-class db.r6g.xlarge \
    --no-multi-az \
    --region ap-southeast-1
done

# 2. Wait for restores to complete (monitor in RDS console)
aws rds wait db-instance-available --db-instance-identifier los-platform-dr-los_auth \
  --region ap-southeast-1

# 3. Update connection strings in AWS Secrets Manager
aws secretsmanager update-secret \
  --secret-id los-platform/dr/db-connection \
  --region ap-southeast-1
```

---

### Phase 3: Restore EKS + Deploy Services (90–180 min)

```bash
# 1. Ensure EKS cluster is running in DR region
aws eks describe-cluster --name los-platform-prod --region ap-southeast-1

# 2. Update kubeconfig
aws eks update-kubeconfig --name los-platform-prod --region ap-southeast-1

# 3. Apply Kubernetes manifests from GitOps (ArgoCD)
# DR overlays reference DR region resources
kubectl apply -k devops/k8s/overlays/dr/

# 4. Wait for all services healthy
kubectl rollout status deployment/auth-service -n los-platform
kubectl rollout status deployment/loan-service -n los-platform
# ... repeat for all services

# 5. Verify health endpoints
for svc in auth kyc loan document decision integration notification dsa; do
  curl -sf "http://${svc}-service:300X/health" || echo "FAIL: $svc"
done
```

---

### Phase 4: Verify Application Integrity (180–240 min)

```bash
# 1. Run smoke test suite against DR endpoint
cd devops/k6 && \
  K6_CLOUD_OUTPUT=false \
  K6_PROMETHEUS_RW_SERVER_URL="" \
  k6 run smoke-test.ts \
  -e BASE_URL=https://dr-api.los-bank.internal

# 2. Verify data integrity — compare record counts
# Primary:
psql $PRIMARY_CONN -c "SELECT count(*) FROM los_loan.loan_applications"
# DR:
psql $DR_CONN -c "SELECT count(*) FROM los_loan.loan_applications"

# 3. Check for data corruption (checksum validation)
# Run DB integrity check
psql $DR_CONN -c "SELECT schemaname, tablename, indexname FROM pg_indexes WHERE schemaname NOT IN ('pg_catalog', 'information_schema');"

# 4. Notify UIDAI / NPCI NOC desk of DR activation (RBI requirement)
# See contacts in Vault: los-platform/emergency/regulatory-contacts
```

---

### Phase 5: Post-Failover (240+ min)

1. **RBI reporting:** If outage > 4 hours, file incident report within 24 hours (RBI Digital Lending guidelines)
2. **Customer communication:** Update status page at `status.los-bank.in`
3. **NACH/Direct debit:** Notify NPCI of any pending mandates (manual intervention may be needed)
4. **Reconnaissance:** Investigate root cause; begin primary region restoration
5. **DR test:** Schedule DR drill within 30 days of activation

---

## Failback Procedure

**Do NOT failback until primary region is fully validated.**

1. Restore primary region from DR snapshots
2. Compare record counts between DR and restored primary
3. Sync any new records created in DR back to primary (via DMS or manual)
4. Cutover Route 53 back to primary (reverse of Phase 1)
5. Disable DR feature flag
6. Close incident ticket

---

## DR Test Schedule

| Test | Frequency | Participants |
|------|-----------|--------------|
| Full DR drill | Quarterly | SRE, Backend Lead, Ops |
| Database restore verification | Monthly | SRE |
| DNS failover test | Monthly | SRE |
| RTO/RPO measurement | Quarterly | CTO + SRE |

---

## Contacts (in Vault)

```
los-platform/emergency/
├── regulatory-contacts    # UIDAI, NPCI, CIBIL NOC
├── on-call-sre            # PagerDuty escalation
├── executive-contacts     # CTO, Head of Operations
└── aws-support            # Enterprise support ARN
```

---

## Related Documents

- `devops/terraform/` — IaC for all cloud resources
- `docs/architecture/event-flow.md` — Kafka topic definitions
- `SECURITY.md` — Security incident response
- `database/README.md` — Backup/restore for PostgreSQL
