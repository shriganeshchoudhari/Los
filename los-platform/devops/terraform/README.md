# LOS Platform — Terraform Infrastructure as Code

> Provision all AWS resources for LOS Platform across dev, uat, prod, and DR environments.

## Prerequisites

- Terraform >= 1.6.0
- AWS CLI configured with appropriate credentials
- S3 backend bucket for Terraform state (per environment)

## Structure

```
devops/terraform/
├── main.tf                    # Root module — AWS provider + variables
├── environments/
│   ├── dev.tfvars             # Development (t3.medium, 100GB, single-AZ)
│   ├── prod.tfvars            # Production (r6g.xlarge, 500GB, Multi-AZ)
│   └── dr.tfvars              # DR (ap-southeast-1, r6g.xlarge)
├── modules/
│   ├── vpc/                   # VPC, subnets, NAT gateways, security groups
│   ├── eks/                   # EKS cluster, node groups, IAM roles
│   ├── rds/                   # RDS PostgreSQL instances (9 databases)
│   ├── s3/                    # S3 buckets (documents, MinIO), versioning, replication
│   └── msk/                   # Amazon MSK Kafka cluster
├── backends/
│   ├── dev.tfbackend          # S3 backend for dev state
│   ├── prod.tfbackend         # S3 backend for prod state
│   └── dr.tfbackend           # S3 backend for DR state
└── dr/
    └── route53-failover.json  # Route 53 failover record swap (for DR activation)
```

## Quick Start

### 1. Configure AWS credentials

```bash
aws configure --profile los-platform-prod
export AWS_PROFILE=los-platform-prod
```

### 2. Initialize Terraform

```bash
cd devops/terraform

# Dev environment
terraform init -backend-config=backends/dev.tfbackend
terraform plan -var-file=environments/dev.tfvars

# Production
terraform init -backend-config=backends/prod.tfbackend
terraform plan -var-file=environments/prod.tfvars
```

### 3. Apply

```bash
terraform apply -var-file=environments/prod.tfvars -auto-approve
```

## What Gets Provisioned

| Resource | Count | Notes |
|----------|-------|-------|
| VPC | 1 | 10.0.0.0/16 CIDR, 3 AZs |
| EKS Cluster | 1 | Kubernetes 1.29, Spot node groups |
| RDS PostgreSQL | 9 | 1 per service database (Multi-AZ in prod) |
| ElastiCache Redis | 1 | Cluster mode, 3 shards × 2 replicas |
| MSK Kafka | 1 | 3 AZs, TLS in-transit encryption |
| S3 Buckets | 2 | Documents (with versioning + CRR), Terraform state |
| KMS Keys | 4 | EBS, S3, MSK, documents replication |
| CloudWatch | 1 | MSK broker logs |
| Security Groups | 5 | EKS nodes, RDS, MSK, Redis, ALB |

## Security Considerations

- **RDS:** Encrypted at rest (AES-256), Multi-AZ in prod
- **S3:** Public access blocked, versioning enabled, lifecycle to Glacier
- **MSK:** TLS in-transit, encryption at rest
- **EKS:** Private API endpoint, no public access
- **All secrets:** Stored in AWS Secrets Manager, not in Terraform state
- **No hardcoded credentials** — use `aws_secretsmanager_secret_version`

## DR Setup

```bash
# Apply DR environment (ap-southeast-1)
cd devops/terraform
terraform init -backend-config=backends/dr.tfbackend
terraform plan -var-file=environments/dr.tfvars
terraform apply -var-file=environments/dr.tfvars -auto-approve

# Activate DR (see docs/dr-runbook.md)
aws route53 change-resource-record-sets \
  --hosted-zone-id <ZONE_ID> \
  --change-batch file://dr/route53-failover.json
```

## Updating Infrastructure

1. Make changes to the relevant module
2. Run `terraform plan` and review the output carefully
3. Apply changes with `terraform apply`
4. ArgoCD will automatically sync Kubernetes manifests if GitOps is configured

## Terraform State

State is stored in S3 with DynamoDB locking:
- `los-terraform-state-prod`
- `los-terraform-state-dev`
- `los-terraform-state-dr`

**Never** store Terraform state locally or commit it to Git.

## Importing Existing Resources

If migrating from existing infrastructure:

```bash
# Example: Import existing RDS instance
terraform import \
  aws_db_instance.auth \
  los-auth-prod
```

---

*Last updated: Phase 50 — Terraform skeleton created*
