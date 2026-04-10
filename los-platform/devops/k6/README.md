# LOS Platform — k6 Load Testing

## Overview

Comprehensive k6 load testing suite for the LOS Platform microservices. Tests cover:
- **Auth**: OTP send/verify, refresh token rotation, logout
- **Loan**: application creation, retrieval, listing, status transitions
- **EMI Calculator**: calculation, amortization, prepayment, foreclosure, max eligible EMI
- **KYC + Bureau**: KYC status, bureau consent, bureau pull, reports
- **Decision + Integration**: decision trigger, disbursement, NACH mandate, penny drop, CBS
- **Documents**: presigned URLs, upload confirmation, checklist, review
- **DSA Portal**: registration, login, dashboard, applications, commissions

## Prerequisites

```bash
# Install k6
# macOS
brew install k6

# Linux
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update
sudo apt-get install k6

# Windows
choco install k6
# or download from https://github.com/grafana/k6/releases
```

## Test Types

### 1. Smoke Test
Quick sanity check — runs all key endpoints with minimal load.

```bash
k6 run stress-test.ts \
  --env ENV=dev \
  -o text
```

### 2. Stress Test
Sustained load at target VU count. Validates SLA thresholds.

```bash
# Development (low VUs)
k6 run stress-test.ts \
  --env ENV=dev \
  --env VUS=10 \
  --env DURATION=5m \
  -o text

# UAT (medium VUs)
k6 run stress-test.ts \
  --env ENV=uat \
  --env VUS=50 \
  --env DURATION=15m \
  -o json \
  --out json-report=uat-stress.json

# Production (high VUs)
k6 run stress-test.ts \
  --env ENV=prod \
  --env VUS=200 \
  --env DURATION=30m \
  -o json \
  --out json-report=prod-stress.json
```

### 3. Soak Test
Long-running test to detect memory leaks, connection pool exhaustion, and gradual degradation.

```bash
k6 run soak-test.ts \
  --env ENV=uat \
  --env VUS=20 \
  --env DURATION=60m \
  -o text
```

### 4. Spike Test
Ramping VU profile: 0→50→100→200→100→0. Validates system resilience to sudden load spikes.

```bash
k6 run spike-test.ts \
  --env ENV=uat \
  -o text
```

## Environment Configuration

```bash
ENV=dev      # Local development (default)
ENV=uat      # UAT environment
ENV=prod     # Production environment
```

### Service Base URLs by Environment

| Service | dev | uat | prod |
|---------|-----|-----|------|
| auth | http://localhost:3001 | https://los-api-uat.bank.in | https://los-api.bank.in |
| kyc | http://localhost:3002 | https://los-api-uat.bank.in | https://los-api.bank.in |
| loan | http://localhost:3003 | https://los-api-uat.bank.in | https://los-api.bank.in |
| decision | http://localhost:3004 | https://los-api-uat.bank.in | https://los-api.bank.in |
| integration | http://localhost:3005 | https://los-api-uat.bank.in | https://los-api.bank.in |
| notification | http://localhost:3006 | https://los-api-uat.bank.in | https://los-api.bank.in |
| document | http://localhost:3007 | https://los-api-uat.bank.in | https://los-api.bank.in |
| dsa | http://localhost:3008 | https://los-dsa-uat.bank.in | https://los-dsa.bank.in |

## Common k6 Options

```bash
--vus 50              # Number of virtual users
--duration 30m         # Test duration
--iterations 1000      # Total iterations across all VUs
--rps 100              # Max requests per second
--batch 10             # Max parallel batch requests
--thresholds p95<2000  # Inline threshold
--tag test=auth        # Tag for filtering metrics
--summary-export output.json  # Export summary data
```

## Key Thresholds (SLA)

| Metric | Threshold | Severity |
|--------|-----------|----------|
| HTTP p(95) | < 1500ms | SLA |
| HTTP p(99) | < 5000ms | SLA |
| Error Rate | < 0.5% | SLA |
| Auth OTP Verify p(95) | < 1000ms | Warning |
| EMI Calculate p(95) | < 500ms | OK |
| Bureau Pull p(95) | < 10000ms | Warning |
| Decision Trigger p(95) | < 5000ms | Warning |

## Custom Metrics

| Metric | Type | Description |
|--------|------|-------------|
| `auth_otp_verify_success` | Counter | Successful OTP verifications |
| `loan_application_created` | Counter | Loan applications created |
| `loan_application_duplicate` | Counter | Duplicate application attempts (409) |
| `emi_calculate_success` | Counter | Successful EMI calculations |
| `bureau_pull_success` | Counter | Successful bureau pulls |
| `decision_trigger_success` | Counter | Decision triggers |
| `disbursement_init_success` | Counter | Disbursements initiated |
| `error_rate` | Rate | HTTP errors (4xx+5xx) |
| `auth_duration` | Trend | OTP verify latency |
| `application_creation_duration` | Trend | Loan creation latency |
| `bureau_pull_duration` | Trend | Bureau pull latency |

## Grafana Integration

Export JSON metrics for Grafana ingestion:

```bash
k6 run stress-test.ts \
  --env ENV=prod \
  --env VUS=100 \
  --env DURATION=15m \
  --out influxdb=http://localhost:8086/k6
```

Or export to Prometheus format via the experimental prometheus output:

```bash
k6 run stress-test.ts \
  --env ENV=prod \
  --env VUS=100 \
  --env DURATION=15m \
  --out experimental-prometheus-counter
```

Then import `devops/k8s/base/grafana-dashboards/load-test-metrics.json` into Grafana.

## CI/CD Integration

Add to your GitHub Actions pipeline:

```yaml
- name: Run k6 Smoke Test
  run: |
    k6 run devops/k6/smoke-test.ts \
      --env ENV=${{ vars.LOS_ENV }} \
      -o text
  env:
    K6_CLOUD_TOKEN: ${{ secrets.K6_CLOUD_TOKEN }}

- name: Run k6 Stress Test
  run: |
    k6 run devops/k6/stress-test.ts \
      --env ENV=${{ vars.LOS_ENV }} \
      --env VUS=50 \
      --env DURATION=10m \
      --out json=stress-results.json
  env:
    K6_CLOUD_TOKEN: ${{ secrets.K6_CLOUD_TOKEN }}

- name: Upload Stress Test Results
  uses: actions/upload-artifact@v4
  with:
    name: k6-stress-results
    path: stress-results.json
```

## Troubleshooting

**OOM errors**: Reduce `--rps` or `--batch` values
**Connection exhaustion**: Check PostgreSQL `max_connections` and Redis `maxclients`
**High latency at scale**: Check Kafka consumer lag (`kafka-consumer-groups.sh --describe`)
**Auth failures at scale**: Check Redis rate limiting counters
