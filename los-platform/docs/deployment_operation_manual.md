# Deployment & Operations Manual
## Loan Origination System (LOS)
**Version:** 1.0 | **Owner:** DevOps / SRE Team | **Date:** 2024-07-15

---

## 1. Infrastructure Overview

### 1.1 Cloud Architecture
- **Cloud Provider:** AWS (ap-south-1 — Mumbai)
- **Container Orchestration:** Amazon EKS 1.29
- **Service Mesh:** Istio 1.20
- **CI/CD:** GitHub Actions + ArgoCD (GitOps)
- **Registry:** Amazon ECR

### 1.2 Environment Summary

| Environment | Cluster | Node Type | Min Nodes | Max Nodes | Purpose |
|---|---|---|---|---|---|
| DEV | eks-los-dev | t3.large | 3 | 6 | Developer testing |
| SIT | eks-los-sit | t3.xlarge | 3 | 8 | Integration testing |
| UAT | eks-los-uat | m5.2xlarge | 5 | 15 | User acceptance |
| PERF | eks-los-perf | m5.4xlarge | 10 | 30 | Performance testing |
| PROD | eks-los-prod | m5.4xlarge | 15 | 60 | Production |
| DR | eks-los-dr | m5.2xlarge | 5 | 30 | Disaster recovery (warm standby) |

---

## 2. Dockerfiles

### 2.1 NestJS Service Dockerfile (Multi-stage)

```dockerfile
# Stage 1: Build
FROM node:20-alpine AS builder

WORKDIR /app

# Copy dependency files
COPY package*.json ./
COPY tsconfig*.json ./

# Install all dependencies (including devDependencies for build)
RUN npm ci

# Copy source
COPY src/ ./src/

# Build TypeScript
RUN npm run build

# Prune devDependencies
RUN npm ci --only=production && npm cache clean --force

# Stage 2: Runtime (minimal image)
FROM node:20-alpine AS runtime

# Security: non-root user
RUN addgroup -S appgroup && adduser -S appuser -G appgroup

WORKDIR /app

# Copy only production artifacts
COPY --from=builder --chown=appuser:appgroup /app/dist ./dist
COPY --from=builder --chown=appuser:appgroup /app/node_modules ./node_modules
COPY --from=builder --chown=appuser:appgroup /app/package.json ./

# Security hardening
RUN apk add --no-cache dumb-init \
    && rm -rf /tmp/* /var/tmp/*

USER appuser

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/health || exit 1

EXPOSE 3000

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/main.js"]
```

### 2.2 Next.js Frontend Dockerfile

```dockerfile
FROM node:20-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
RUN npm run build

FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup -S nextjs && adduser -S nextjs -G nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nextjs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nextjs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000

CMD ["node", "server.js"]
```

---

## 3. Kubernetes Manifests

### 3.1 Namespace and Resource Quotas

```yaml
# namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: los-prod
  labels:
    istio-injection: enabled
    environment: production
---
apiVersion: v1
kind: ResourceQuota
metadata:
  name: los-prod-quota
  namespace: los-prod
spec:
  hard:
    requests.cpu: "40"
    requests.memory: "80Gi"
    limits.cpu: "80"
    limits.memory: "160Gi"
    pods: "200"
```

### 3.2 Application Service Deployment

```yaml
# application-service/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: application-service
  namespace: los-prod
  labels:
    app: application-service
    version: v1
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 0
      maxSurge: 1
  selector:
    matchLabels:
      app: application-service
  template:
    metadata:
      labels:
        app: application-service
        version: v1
      annotations:
        prometheus.io/scrape: "true"
        prometheus.io/port: "3002"
        prometheus.io/path: "/metrics"
    spec:
      serviceAccountName: application-service-sa
      securityContext:
        runAsNonRoot: true
        runAsUser: 1001
        fsGroup: 1001
      topologySpreadConstraints:
        - maxSkew: 1
          topologyKey: topology.kubernetes.io/zone
          whenUnsatisfiable: DoNotSchedule
          labelSelector:
            matchLabels:
              app: application-service
      containers:
        - name: application-service
          image: 123456789.dkr.ecr.ap-south-1.amazonaws.com/los/application-service:v1.2.3
          imagePullPolicy: Always
          ports:
            - name: http
              containerPort: 3002
            - name: metrics
              containerPort: 9090
          env:
            - name: NODE_ENV
              value: "production"
            - name: PORT
              value: "3002"
            - name: DB_HOST
              valueFrom:
                secretKeyRef:
                  name: db-credentials
                  key: host
            - name: DB_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: db-credentials
                  key: password
            - name: REDIS_URL
              valueFrom:
                secretKeyRef:
                  name: redis-credentials
                  key: url
            - name: KAFKA_BROKERS
              valueFrom:
                configMapKeyRef:
                  name: los-config
                  key: kafka_brokers
            - name: VAULT_ADDR
              value: "https://vault.los.bank.in:8200"
            - name: VAULT_ROLE
              value: "application-service"
          resources:
            requests:
              cpu: "500m"
              memory: "512Mi"
            limits:
              cpu: "2000m"
              memory: "2Gi"
          livenessProbe:
            httpGet:
              path: /health/live
              port: 3002
            initialDelaySeconds: 30
            periodSeconds: 30
            failureThreshold: 3
          readinessProbe:
            httpGet:
              path: /health/ready
              port: 3002
            initialDelaySeconds: 10
            periodSeconds: 10
            failureThreshold: 3
          lifecycle:
            preStop:
              exec:
                command: ["/bin/sh", "-c", "sleep 10"]  # Drain connections before stop
          volumeMounts:
            - name: tmp
              mountPath: /tmp
      volumes:
        - name: tmp
          emptyDir: {}
      terminationGracePeriodSeconds: 60
---
apiVersion: v1
kind: Service
metadata:
  name: application-service
  namespace: los-prod
spec:
  selector:
    app: application-service
  ports:
    - name: http
      port: 3002
      targetPort: 3002
  type: ClusterIP
---
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: application-service-hpa
  namespace: los-prod
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: application-service
  minReplicas: 3
  maxReplicas: 20
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 65
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 75
```

### 3.3 Kong API Gateway

```yaml
# kong/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: kong-gateway
  namespace: los-prod
spec:
  replicas: 3
  selector:
    matchLabels:
      app: kong-gateway
  template:
    spec:
      containers:
        - name: kong
          image: kong:3.5-alpine
          env:
            - name: KONG_DATABASE
              value: "off"              # DB-less mode with declarative config
            - name: KONG_DECLARATIVE_CONFIG
              value: /kong/declarative/kong.yml
            - name: KONG_PROXY_LISTEN
              value: "0.0.0.0:8000, 0.0.0.0:8443 ssl"
            - name: KONG_ADMIN_LISTEN
              value: "0.0.0.0:8001"
            - name: KONG_LOG_LEVEL
              value: "warn"
            - name: KONG_NGINX_WORKER_PROCESSES
              value: "auto"
          ports:
            - containerPort: 8000
            - containerPort: 8443
          resources:
            requests:
              cpu: "1000m"
              memory: "1Gi"
            limits:
              cpu: "4000m"
              memory: "4Gi"
          volumeMounts:
            - name: kong-config
              mountPath: /kong/declarative
      volumes:
        - name: kong-config
          configMap:
            name: kong-declarative-config
```

### 3.4 PostgreSQL via AWS RDS (Terraform)

```hcl
# rds.tf
resource "aws_db_instance" "los_postgres_primary" {
  identifier              = "los-postgres-prod"
  engine                  = "postgres"
  engine_version          = "15.4"
  instance_class          = "db.r6g.2xlarge"
  allocated_storage       = 500
  max_allocated_storage   = 2000
  storage_type            = "gp3"
  storage_encrypted       = true
  kms_key_id              = aws_kms_key.rds_key.arn
  multi_az                = true
  db_name                 = "los_core"
  username                = "los_admin"
  password                = var.db_master_password
  db_subnet_group_name    = aws_db_subnet_group.private.name
  vpc_security_group_ids  = [aws_security_group.rds.id]
  backup_retention_period = 30
  backup_window           = "02:00-03:00"
  maintenance_window      = "sun:04:00-sun:05:00"
  deletion_protection     = true
  skip_final_snapshot     = false
  final_snapshot_identifier = "los-postgres-prod-final"

  performance_insights_enabled          = true
  performance_insights_retention_period = 731  # 2 years
  monitoring_interval                   = 60
  enabled_cloudwatch_logs_exports       = ["postgresql", "upgrade"]

  parameter_group_name = aws_db_parameter_group.los_postgres15.name

  tags = {
    Environment = "production"
    Compliance  = "PCI-DSS,RBI"
  }
}

resource "aws_db_instance" "los_postgres_replica" {
  identifier          = "los-postgres-prod-replica"
  replicate_source_db = aws_db_instance.los_postgres_primary.identifier
  instance_class      = "db.r6g.xlarge"
  storage_encrypted   = true
  publicly_accessible = false
}
```

---

## 4. CI/CD Pipeline

### 4.1 GitHub Actions — Build & Test

```yaml
# .github/workflows/build-test.yml
name: Build, Test & Deploy

on:
  push:
    branches: [main, develop, release/*]
  pull_request:
    branches: [main]

env:
  AWS_REGION: ap-south-1
  ECR_REGISTRY: 123456789.dkr.ecr.ap-south-1.amazonaws.com

jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_DB: los_test
          POSTGRES_USER: los_test
          POSTGRES_PASSWORD: test_password
        ports:
          - 5432:5432
      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm run test:unit -- --coverage
      - run: npm run test:integration
      - uses: actions/upload-artifact@v4
        with:
          name: coverage
          path: coverage/

  security-scan:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Run Semgrep SAST
        uses: returntocorp/semgrep-action@v1
        with:
          config: p/owasp-top-ten p/nodejs
      - name: Run Snyk dependency scan
        uses: snyk/actions/node@master
        env:
          SNYK_TOKEN: ${{ secrets.SNYK_TOKEN }}
        with:
          args: --severity-threshold=high

  build-push:
    needs: [test, security-scan]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main' || startsWith(github.ref, 'refs/heads/release/')
    strategy:
      matrix:
        service: [auth-service, application-service, kyc-service, decision-engine,
                  integration-service, document-service, notification-service, frontend]
    steps:
      - uses: actions/checkout@v4
      - uses: aws-actions/configure-aws-credentials@v4
        with:
          aws-access-key-id: ${{ secrets.AWS_ACCESS_KEY_ID }}
          aws-secret-access-key: ${{ secrets.AWS_SECRET_ACCESS_KEY }}
          aws-region: ${{ env.AWS_REGION }}
      - uses: aws-actions/amazon-ecr-login@v2
      - name: Build and scan image
        run: |
          IMAGE_TAG=${GITHUB_SHA::8}
          docker build -t ${{ env.ECR_REGISTRY }}/los/${{ matrix.service }}:${IMAGE_TAG} \
            -f services/${{ matrix.service }}/Dockerfile .
          # Trivy container scan
          docker run --rm aquasec/trivy image \
            --exit-code 1 --severity CRITICAL \
            ${{ env.ECR_REGISTRY }}/los/${{ matrix.service }}:${IMAGE_TAG}
          docker push ${{ env.ECR_REGISTRY }}/los/${{ matrix.service }}:${IMAGE_TAG}
          docker tag ${{ env.ECR_REGISTRY }}/los/${{ matrix.service }}:${IMAGE_TAG} \
            ${{ env.ECR_REGISTRY }}/los/${{ matrix.service }}:latest
          docker push ${{ env.ECR_REGISTRY }}/los/${{ matrix.service }}:latest
      - name: Update GitOps repo
        run: |
          git clone https://x-access-token:${{ secrets.GITOPS_TOKEN }}@github.com/bank/los-gitops
          cd los-gitops
          sed -i "s|image:.*${{ matrix.service }}:.*|image: ${{ env.ECR_REGISTRY }}/los/${{ matrix.service }}:${GITHUB_SHA::8}|" \
            environments/prod/${{ matrix.service }}/deployment.yaml
          git add . && git commit -m "Deploy ${{ matrix.service }} ${GITHUB_SHA::8}" && git push

  deploy-uat:
    needs: build-push
    runs-on: ubuntu-latest
    environment: uat
    steps:
      - name: Trigger ArgoCD sync (UAT)
        run: |
          argocd app sync los-uat --server argocd.los.bank.in \
            --auth-token ${{ secrets.ARGOCD_TOKEN }} --timeout 300
      - name: Run smoke tests
        run: npm run test:smoke:uat
```

### 4.2 ArgoCD Application (GitOps)

```yaml
# argocd/los-prod.yaml
apiVersion: argoproj.io/v1alpha1
kind: Application
metadata:
  name: los-prod
  namespace: argocd
spec:
  project: banking
  source:
    repoURL: https://github.com/bank/los-gitops
    targetRevision: HEAD
    path: environments/prod
  destination:
    server: https://kubernetes.default.svc
    namespace: los-prod
  syncPolicy:
    automated:
      prune: true
      selfHeal: false          # No auto-heal in prod — manual trigger
    syncOptions:
      - CreateNamespace=false
      - PrunePropagationPolicy=foreground
    retry:
      limit: 3
      backoff:
        duration: 30s
        factor: 2
        maxDuration: 5m
```

---

## 5. Deployment Procedures

### 5.1 Standard Deployment (Rolling)

```bash
# Step 1: Verify pre-deployment checklist
./scripts/pre-deploy-check.sh --env prod --service application-service

# Step 2: Confirm DB migrations (if any) run first
kubectl run migration --image=los/application-service:v1.2.3 \
  --restart=Never -n los-prod -- npm run migration:run
kubectl wait --for=condition=complete pod/migration -n los-prod --timeout=300s

# Step 3: Trigger ArgoCD sync
argocd app sync los-prod --server argocd.los.bank.in \
  --resource apps:Deployment:application-service

# Step 4: Monitor rollout
kubectl rollout status deployment/application-service -n los-prod --timeout=300s

# Step 5: Verify health
kubectl get pods -n los-prod -l app=application-service
curl https://api.los.bank.in/v1/health
```

### 5.2 Rollback Procedure

```bash
# Immediate rollback (< 2 min)
kubectl rollout undo deployment/application-service -n los-prod

# Rollback to specific revision
kubectl rollout undo deployment/application-service -n los-prod --to-revision=5

# Verify rollback
kubectl rollout status deployment/application-service -n los-prod
kubectl get pods -n los-prod -l app=application-service

# Update GitOps repo to reflect rollback
git -C /path/to/los-gitops revert HEAD~1 --no-edit
git push
```

### 5.3 Database Migration Procedure

```bash
# 1. Backup RDS before migration
aws rds create-db-snapshot \
  --db-instance-identifier los-postgres-prod \
  --db-snapshot-identifier pre-migration-$(date +%Y%m%d%H%M)

# 2. Run migration in dry-run mode
npm run migration:dry-run --env=prod

# 3. Apply migration (during low-traffic window: 2-4 AM IST)
npm run migration:run --env=prod

# 4. Verify migration success
psql -h $DB_HOST -U los_admin -d los_core -c "\dt los_core.*" | grep new_table

# 5. If migration fails:
npm run migration:revert --env=prod
# Restore from snapshot if needed
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier los-postgres-prod-restored \
  --db-snapshot-identifier pre-migration-$(date +%Y%m%d%H%M)
```

---

## 6. Observability Stack

### 6.1 Prometheus Alert Rules

```yaml
# alerts/los-alerts.yaml
groups:
  - name: los-availability
    rules:
      - alert: ServiceDown
        expr: up{job=~"los-.*"} == 0
        for: 1m
        labels:
          severity: critical
          team: platform
        annotations:
          summary: "{{ $labels.job }} is down"
          runbook: "https://wiki.bank.in/los/runbooks/service-down"

      - alert: HighErrorRate
        expr: rate(http_requests_total{status=~"5..", job=~"los-.*"}[5m]) / rate(http_requests_total{job=~"los-.*"}[5m]) > 0.01
        for: 5m
        labels:
          severity: critical
        annotations:
          summary: "Error rate > 1% on {{ $labels.job }}"

      - alert: P95LatencyHigh
        expr: histogram_quantile(0.95, rate(http_request_duration_seconds_bucket{job=~"los-.*"}[5m])) > 0.5
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "P95 latency > 500ms on {{ $labels.job }}"

      - alert: BureauPullTimeout
        expr: rate(los_bureau_pull_timeout_total[10m]) > 0.1
        for: 2m
        labels:
          severity: warning
        annotations:
          summary: "Bureau pull timeout rate elevated"

      - alert: KafkaConsumerLag
        expr: kafka_consumer_lag_sum{topic=~"los.*"} > 10000
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Kafka consumer lag > 10K on {{ $labels.topic }}"

      - alert: DBConnectionPoolExhausted
        expr: pg_stat_activity_count{datname="los_core"} > 180
        for: 2m
        labels:
          severity: critical
        annotations:
          summary: "DB connection pool near exhaustion (180+/200 connections)"

      - alert: DiskSpaceLow
        expr: (node_filesystem_free_bytes / node_filesystem_size_bytes) < 0.10
        for: 5m
        labels:
          severity: warning
        annotations:
          summary: "Disk space < 10% on {{ $labels.instance }}"
```

### 6.2 Grafana Dashboards

**Key dashboards to maintain:**
1. **LOS Overview** — Applications created/day, approval rate, disbursement volume (INR)
2. **API Performance** — P50/P95/P99 by endpoint, error rates
3. **Integration Health** — UIDAI, CIBIL, CBS circuit breaker states, latency
4. **Kafka Metrics** — Consumer lag per topic, message throughput
5. **Database** — Query performance, connection pool, replication lag
6. **Business Metrics** — TAT distribution, STP rate, bureau pull success rate

---

## 7. Disaster Recovery

### 7.1 DR Strategy

| Component | DR Approach | RPO | RTO |
|---|---|---|---|
| PostgreSQL | Multi-AZ RDS + Cross-region read replica | 30 min | 30 min |
| Redis | ElastiCache with Multi-AZ | 5 min | 5 min |
| Kafka | MSK Multi-AZ (3 AZ) | 0 (durable) | 5 min |
| MinIO/S3 | Cross-region replication | Near 0 | 15 min |
| EKS | Warm standby cluster in AZ-B | N/A | 15 min |
| Vault | Vault Enterprise Replication | 1 min | 10 min |

### 7.2 DR Runbook

```bash
# DR Failover Procedure (P1 incident)

# 1. Declare DR (requires CTO or backup approval)
# 2. Update Route53 to point to DR cluster
aws route53 change-resource-record-sets --hosted-zone-id Z1234 \
  --change-batch file://dr-failover-dns.json

# 3. Promote RDS read replica to primary
aws rds promote-read-replica \
  --db-instance-identifier los-postgres-dr-replica

# 4. Update EKS config maps with DR DB endpoints
kubectl set env deployment/application-service \
  -n los-prod DB_HOST=los-postgres-dr.cluster.ap-south-1.rds.amazonaws.com

# 5. Scale up DR cluster
aws eks update-nodegroup-config \
  --cluster-name eks-los-dr \
  --nodegroup-name los-nodes \
  --scaling-config minSize=15,maxSize=60,desiredSize=20

# 6. Verify all services healthy in DR
./scripts/dr-health-check.sh

# 7. Notify stakeholders + RBI (if >2 hours outage)
```

### 7.3 DR Drill Schedule
- **Quarterly:** Full DR failover drill (3-hour maintenance window)
- **Monthly:** Backup restoration test (separate environment)
- **Weekly:** Health check of DR components

---

## 8. Runbooks

### 8.1 High CPU on Application Service

```bash
# 1. Check current pod CPU
kubectl top pods -n los-prod -l app=application-service

# 2. Check for slow queries
psql -h $DB_HOST -c "SELECT query, mean_exec_time FROM pg_stat_statements ORDER BY mean_exec_time DESC LIMIT 10;"

# 3. Check Kafka consumer lag (stalled consumers cause backpressure)
kafka-consumer-groups.sh --bootstrap-server $KAFKA_BROKERS \
  --describe --group application-service-consumer

# 4. Temporary: Scale up manually
kubectl scale deployment application-service --replicas=10 -n los-prod

# 5. Capture thread dump
kubectl exec -it $(kubectl get pod -n los-prod -l app=application-service -o name | head -1) \
  -n los-prod -- kill -3 1 && kubectl logs -n los-prod $(pod)
```

### 8.2 UIDAI Circuit Breaker Open

```bash
# Check circuit breaker state
redis-cli -h $REDIS_HOST GET circuit:UIDAI:state

# Check error log for root cause
kubectl logs -n los-prod -l app=integration-service --since=30m | grep UIDAI | grep ERROR

# If UIDAI confirms outage: update application status page
./scripts/update-status-page.sh --service AADHAAR_KYC --status degraded \
  --message "Aadhaar eKYC temporarily unavailable. Offline KYC available."

# Re-enable circuit after UIDAI recovery
redis-cli -h $REDIS_HOST DEL circuit:UIDAI:state
# Circuit will auto-test after next request (half-open)
```

### 8.3 Failed Disbursement Recovery

```bash
# 1. Identify stuck disbursements
psql -h $DB_HOST -c "
SELECT id, loan_id, amount, mode, status, initiated_at, retry_count
FROM disbursements
WHERE status = 'PROCESSING'
  AND initiated_at < NOW() - INTERVAL '2 hours'
ORDER BY initiated_at;"

# 2. Check NPCI status (via integration team)
# 3. If payment confirmed by NPCI: manually update + trigger webhook
curl -X POST https://api.los.bank.in/internal/webhooks/payment/manual-reconcile \
  -H "X-Internal-Key: $INTERNAL_KEY" \
  -d '{"disbursementId":"uuid","utrNumber":"UTIB...","status":"SUCCESS"}'

# 4. If payment failed: reset to PENDING for retry
psql -h $DB_HOST -c "
UPDATE disbursements SET status = 'PENDING', retry_count = 0
WHERE id = 'uuid' AND status = 'PROCESSING';"
```

---

## 9. Capacity Planning

### 9.1 Current Capacity Assumptions (v1.0 GA)

| Resource | Current | Threshold (80%) | Action Needed |
|---|---|---|---|
| API pods | 3-20 (HPA) | CPU > 65% sustained | Increase HPA max |
| DB connections | 200 max | 160 | Increase max_connections or add PgBouncer |
| DB storage | 500 GB | 400 GB | Expand via autoscaling (configured) |
| Kafka partitions | 12 per topic | N/A | Add partitions if lag increases |
| Redis memory | 50 GB | 40 GB | Scale Redis instance |

### 9.2 Growth Projections

| Month | Applications/Day | Peak RPS | DB Size |
|---|---|---|---|
| M1 | 5,000 | 500 | 50 GB |
| M6 | 20,000 | 2,000 | 300 GB |
| M12 | 50,000 | 5,000 | 800 GB |
| M18 | 100,000 | 10,000 | 1.5 TB |

---
*End of Deployment & Operations Manual*
