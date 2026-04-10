# ADR-014: GitHub Actions for CI/CD

**Status:** Accepted  
**Date:** 2024-01-15  
**Deciders:** LOS Platform Architecture Team

---

## Context

The LOS Platform needs automated: linting/type checking, unit testing, Docker image building, image pushing to ECR, and Kubernetes deployment for dev/uat/prod environments. The bank requires: no manual deployments, audit trail of all deployments, and separate promotion pipelines for dev → uat → prod.

---

## Decision

**GitHub Actions** handles all CI/CD pipelines.

### Pipeline: `ci.yml`

| Job | Trigger | Steps |
|-----|---------|-------|
| `lint-and-typecheck` | Every PR + push | Build common → ESLint + tsc for all 8 services |
| `backend-tests` | Every PR + push | Jest matrix (8 services) with coverage |
| `frontend-build` | Every PR + push | Next.js build |
| `docker-build` | Every push to `develop`/`main` | Build all 8 service images + frontend, push to ECR |
| `deploy-dev` | Push to `develop` | `kubectl apply -k devops/k8s/overlays/dev/` |
| `deploy-uat` | Push to `main` | `kubectl apply -k devops/k8s/overlays/uat/` |

### Production deploy: `deploy-prod.yml`

Triggered manually via `workflow_dispatch` with `image_tag` input:
1. Pulls all 9 images from ECR by tag
2. `kubectl set image deployment/...` for all 8 services
3. Waits 300s for rollout completion

### K8s deployment strategy

**Kustomize** (`devops/k8s/`):
```
base/           # Common: ConfigMap, ServiceAccount, HPA, NetworkPolicy
overlays/dev/   # Dev: 1 replica, dev image tag, 256Mi/512Mi limits
overlays/uat/   # UAT: 2 replicas, uat image tag, 512Mi/1Gi limits
overlays/prod/  # Prod: 3 replicas, prod image tag, 1Gi/2Gi limits
```

**Docker build**: single `Dockerfile.backend` with `SERVICE_NAME` build arg for all 8 services (context `backend/`). Multi-stage build: builder stage compiles TypeScript, production stage copies `dist/` + `node_modules`.

### docker-compose

For local development: all 8 services + postgres + redis + kafka + zookeeper + minio. Kafka waits for zookeeper health, backend services wait for postgres + redis + kafka healthy.

---

## Consequences

### Positive
- **No manual deployments**: production deployment requires only image tag input
- **Audit trail**: every deployment is a GitHub Actions run with full logs
- **Consistent**: same pipeline for dev/uat/prod, only image tags differ
- **Fast feedback**: PR checks run in ~5 minutes (parallel jobs)
- **Docker efficiency**: single Dockerfile per service = fast incremental builds

### Negative
- **Secrets management**: GitHub Secrets required; secrets in env vars visible in pod specs
- **Build time**: 8 Docker builds per commit takes ~10 minutes
- **K8s cluster access**: GHA needs `KUBECONFIG` credentials in repo secrets
- **Image tags**: SHA-based tags prevent rollbacks to arbitrary versions

### Mitigations
- OIDC-based AWS role for ECR (no long-lived AWS keys in GHA)
- K8s secrets for sensitive env vars (not ConfigMap)
- GitHub Environments (dev/uat/prod) with required reviewers for prod
- Image tags: `${GITHUB_SHA}` (immutable) + `latest` + semantic version

---

## Related Decisions

- ADR-001: Microservices Architecture
