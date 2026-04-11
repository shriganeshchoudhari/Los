# LOS Platform Incident Response Runbook

> **Applies to:** LOS Platform production environment  
> **RTO:** 4 hours | **RPO:** 1 hour  
> **RBI MCoE contact:** compliance@bank.example.com  
> **Escalation:** CISO → CTO → CEO (per CERT-In 6-hour rule)

---

## Severity Classification

| Severity | Definition | Response Time | Examples |
|----------|------------|---------------|----------|
| **SEV-1 Critical** | Complete service outage; data breach; regulatory breach | 15 min | All services down, DB breach, fraud detected |
| **SEV-2 High** | Major feature unavailable; significant performance degradation | 30 min | KYC service down, disbursement blocked |
| **SEV-3 Medium** | Degraded performance; non-critical feature failure | 2 hours | Bureau API slow, notification failures |
| **SEV-4 Low** | Minor issue; workaround available | 1 business day | Dashboard UI bug, minor latency |

---

## Incident Response Phases

### Phase 1: Detection & Triage (0–15 min)

**Detection Channels:**
- PagerDuty alert → on-call engineer
- AWS CloudWatch alarm (service health, latency, error rate)
- Grafana "HighErrorRate" / "ServiceDown" alerts
- User complaint via support channel

**Immediate Actions:**
```
1. Acknowledge PagerDuty alert within 5 minutes
2. Join #incident-response Slack channel
3. Post initial status: "🔴 INCIDENT DETECTED — [brief description]"
4. Assign Incident Commander (IC)
5. Assess severity — assign SEV level
```

**Triage Checklist:**
- [ ] Which service(s) are affected?
- [ ] Is this user-impacting? (API errors, latency >5s, errors >1%)
- [ ] Is there a data integrity risk?
- [ ] Is there a security or compliance risk?
- [ ] Is this correlated with a recent deployment?

---

### Phase 2: Stabilization (15–60 min)

**On-Call Actions by Service:**

#### Auth Service Down
```bash
# Check pod health
kubectl get pods -n los-platform -l app=auth-service

# Check recent logs
kubectl logs -n los-platform deployment/auth-service --tail=100 --since=10m

# Restart if unresponsive
kubectl rollout restart deployment/auth-service -n los-platform

# Check Redis connectivity
kubectl exec -it -n los-platform deployment/auth-service -- nc -zv redisEndpoint 6379
```

#### Database Connection Exhaustion
```bash
# Check RDS connections
aws rds describe-db-instances \
  --db-instance-identifier los-auth-prod \
  --query 'DBInstances[0].Connections'

# Check active connections per service
psql -h $DB_HOST -U los_user -d los_auth \
  -c "SELECT count(*), usename FROM pg_stat_activity GROUP BY usename;"

# Kill idle connections > 30 min
psql -h $DB_HOST -U los_user -d los_auth \
  -c "SELECT pg_terminate_backend(pid) FROM pg_stat_activity \
      WHERE state='idle' AND query_start < NOW() - INTERVAL '30 minutes';"
```

#### Kafka Lag / Consumer Failure
```bash
# Check consumer group lag
aws kafka describe-consumer-group \
  --consumer-group-id los-loan-service \
  --cluster-arn $MSK_CLUSTER_ARN

# Restart consumer deployment
kubectl rollout restart deployment/loan-service -n los-platform

# Check DLQ messages
aws kafka describe-topic \
  --topic los-loan.application-events-dlq \
  --cluster-arn $MSK_CLUSTER_ARN
```

#### Payment/Disbursement Failure
```bash
# Block NACH/NPCI webhook to prevent duplicate processing
kubectl annotate service integration-service \
  nginx.ingress.kubernetes.io/server-snippet='
    location /integration/webhook/npci {
      return 503 "Maintenance";
    }'

# Check disbursement idempotency log
psql -h $DB_HOST -U los_user -d los_integration \
  -c "SELECT * FROM idempotency_keys \
      WHERE created_at > NOW() - INTERVAL '1 hour' \
      ORDER BY created_at DESC LIMIT 20;"
```

**Incident Commander Checklist:**
- [ ] Affected services identified and isolated if needed
- [ ] Workaround implemented (feature flag, traffic shift)
- [ ] Escalation notifications sent to stakeholders
- [ ] Draft status page update prepared
- [ ] Incident ticket created in Jira

---

### Phase 3: Communication (Ongoing)

**Stakeholder Communication Template:**

```
SUBJECT: [SEV-X] LOS Platform Incident — [Service] — [HH:MM IST]

Status: INVESTIGATING | IDENTIFIED | MONITORING | RESOLVED
Impact: [Brief description of user/business impact]
Affected Services: [list]
Started: [timestamp]
ETA: [if known]

What we know:
- [description]
- [current impact]

What we're doing:
- [action 1]
- [action 2]

Next update: [time]
Contact: [IC name] — [phone]
```

**Communication Cadence:**
| SEV | Internal | External (status page) |
|-----|---------|----------------------|
| SEV-1 | Every 15 min | Every 30 min |
| SEV-2 | Every 30 min | Every 60 min |
| SEV-3 | Hourly | Every 2 hours |
| SEV-4 | Daily | None |

**RBI Reporting (if applicable):**
- CERT-In: Within 6 hours of breach awareness (`incidents@cert-in.org.in`)
- RBI: Within 24 hours if customer data affected (`dpsscoordinatior@rbi.org.in`)
- Internal compliance: compliance@bank.example.com

---

### Phase 4: Resolution & Recovery (1–4 hours)

**Post-Incident Checklist:**
- [ ] Root cause identified
- [ ] Fix applied and verified
- [ ] Service health confirmed (error rate <0.1%, p99 latency <2s)
- [ ] No data loss — verify record counts in all 9 databases
- [ ] No stale transactions — verify disbursement idempotency
- [ ] Kafka lag cleared — all consumer groups at 0 lag
- [ ] Monitoring alerts resolved (no red alerts)
- [ ] Stakeholders notified of resolution

**Rollback Procedure (if deployment caused incident):**
```bash
# Get previous image tag
git log --oneline -5
kubectl rollout undo deployment/<service> -n los-platform

# Verify rollback
kubectl rollout status deployment/<service> -n los-platform
kubectl get pods -n los-platform -l app=<service>

# If rollback fails, redeploy known-good image
kubectl set image deployment/<service> \
  <service>=$ECR_REGISTRY/<service>:<PREVIOUS_IMAGE_TAG>
```

**Database Recovery (if data corruption):**
```bash
# Point-in-time restore via AWS RDS
aws rds restore-db-instance-to-point-in-time \
  --source-db-instance-identifier los-auth-prod \
  --target-db-instance-identifier los-auth-prod-recovery \
  --restore-time 2024-01-15T10:00:00Z \
  --db-instance-class db.r6g.xlarge

# Verify data integrity before promoting
psql -h los-auth-recovery.cluster-xxx.ap-south-1.rds.amazonaws.com \
  -U los_user -d los_auth \
  -c "SELECT count(*) FROM users WHERE created_at > '2024-01-15'::timestamptz;"
```

---

### Phase 5: Post-Incident Review (PIR)

**PIR must be completed within 48 hours for SEV-1/SEV-2 incidents.**

**PIR Template:**

```markdown
## Incident: [ID] — [Title]
Date: [YYYY-MM-DD] | Duration: [X hours Y min] | SEV: [X]

### Summary
[Brief description]

### Impact
- Users affected: [count]
- Business impact: [description]
- Financial impact: [if applicable]

### Timeline (UTC)
- HH:MM — Alert triggered
- HH:MM — IC assigned
- HH:MM — Root cause identified
- HH:MM — Mitigation applied
- HH:MM — Service restored
- HH:MM — Incident resolved

### Root Cause
[Detailed technical root cause]

### Contributing Factors
[What allowed this to happen]

### Action Items
| Action | Owner | Due Date | Priority |
|--------|-------|----------|----------|
| [Action 1] | @name | YYYY-MM-DD | HIGH |
| [Action 2] | @name | YYYY-MM-DD | MEDIUM |

### Lessons Learned
[What went well / what didn't]
```

---

## Emergency Contacts

| Role | Name | Phone | Slack |
|------|------|-------|-------|
| On-Call Engineer | PagerDuty rotation | +91-XXXXXXXXXX | @oncall |
| Engineering Lead | [Name] | [Phone] | @eng-lead |
| CISO | [Name] | [Phone] | @ciso |
| DevOps Lead | [Name] | [Phone] | @devops-lead |
| AWS TAM | [Name] | [Phone] | @aws-tam |
| RBI Compliance | [Name] | [Phone] | @compliance |

---

## Common Incident Playbooks

### Playbook: KYC Service Unavailable
1. Check UIDAI AUA status — may be UIDAI-side issue
2. Fallback: Enable DigiLocker eKYC path (feature flag `ENABLE_DIGILOCKER_KYC=true`)
3. Queue KYC requests in Kafka `los-kyc.pending` topic
4. Process backlog after service recovery
5. Notify affected applicants via SMS/email

### Playbook: Bureau API Timeout
1. Check CIBIL/Experian status page
2. Enable circuit breaker (already configured — verify `CB_STATE=OPEN`)
3. Use cached bureau reports if available (check `los_integration.bureau_reports`)
4. Manual underwriting fallback: analyst reviews application without bureau score
5. Notify credit team

### Playbook: Disbursement Stuck
1. Check NPCI/UPI status
2. Verify idempotency keys not exhausted
3. Check CBS (Finacle) connectivity
4. Retry disbursement via admin API: `POST /admin/disbursement/:id/retry`
5. Escalate to CBS team if Finacle timeout
6. Block duplicate webhook processing via idempotency

### Playbook: Frontend Down
1. Check Vercel/CloudFront status
2. Verify CDN cache not serving stale/erroneous responses
3. Rollback to previous deployment if needed
4. If K8s-based: `kubectl rollout undo deployment/frontend -n los-platform`
5. Set CloudFront error page to branded maintenance page

### Playbook: Redis Unavailable
1. Check ElastiCache status in AWS console
2. All services should gracefully degrade (fallback to DB for auth tokens)
3. If cluster failed: trigger ElastiCache automatic failover
4. Verify auth tokens still valid (may need re-login after Redis restore)
5. Clear Redis connection pools: restart all pod deployments

---

## Runbook Maintenance

- **Review frequency:** Quarterly
- **Last reviewed:** [DATE]
- **Owner:** DevOps Lead
- **Next review due:** [DATE + 3 months]

For DR activation procedures, see `docs/dr-runbook.md`.
