# LOS Platform — Terraform Root Module
# Provisions core AWS infrastructure for all environments (dev/uat/prod/dr)
#
# Usage:
#   cd devops/terraform
#   terraform init -backend-config=backends/<env>.tfbackend
#   terraform plan -var-file=environments/<env>.tfvars
#   terraform apply -var-file=environments/<env>.tfvars

terraform {
  required_version = ">= 1.6.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.30"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "LOS-Platform"
      Environment = var.environment
      ManagedBy   = "Terraform"
      CostCenter  = "IT-Loan-Origination"
    }
  }
}

provider "aws" {
  alias  = "dr"
  region = var.enable_dr ? "ap-southeast-1" : var.aws_region
}

variable "aws_region" {
  description = "AWS region for all resources"
  type        = string
  default     = "ap-south-1"
}

variable "environment" {
  description = "Deployment environment: dev, uat, prod, dr"
  type        = string
  validation {
    condition     = contains(["dev", "uat", "prod", "dr"], var.environment)
    error_message = "Environment must be one of: dev, uat, prod, dr"
  }
}

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "AZs for the VPC"
  type        = list(string)
  default     = ["ap-south-1a", "ap-south-1b", "ap-south-1c"]
}

variable "cluster_version" {
  description = "Kubernetes version for EKS"
  type        = string
  default     = "1.29"
}

variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.r6g.large"
}

variable "db_allocated_storage" {
  description = "RDS allocated storage in GB"
  type        = number
  default     = 500
}

variable "db_multi_az" {
  description = "Enable Multi-AZ for RDS"
  type        = bool
  default     = false
}

variable "enable_dr" {
  description = "If true, provisions DR infrastructure in ap-southeast-1"
  type        = bool
  default     = false
}

variable "db_username" {
  description = "RDS master username"
  type        = string
  default     = "los_user"
}

locals {
  service_name = "los-platform"
  namespace    = "los-platform"
  cluster_name = "los-${var.environment}"

  tags = {
    Project     = local.service_name
    Environment = var.environment
  }

  eks_node_instance_types = var.environment == "prod" ? ["m5.xlarge"] : var.environment == "uat" ? ["m5.large"] : ["t3.medium"]
  spot_instance_types     = var.environment == "prod" ? ["m5.xlarge", "m5a.xlarge"] : ["t3.medium", "t3a.medium"]

  rds_node_type   = var.environment == "prod" ? "db.r6g.xlarge" : var.environment == "uat" ? "db.r5.large" : "db.t3.medium"
  redis_node_type = var.environment == "prod" ? "cache.r6g.large" : "cache.t3.medium"
  redis_shards    = var.environment == "prod" ? 3 : 1
  redis_replicas  = var.environment == "prod" ? 2 : 1
}

# ── VPC ─────────────────────────────────────────────────────────────────────────
module "vpc" {
  source = "./modules/vpc"

  environment        = var.environment
  vpc_cidr           = var.vpc_cidr
  availability_zones = var.availability_zones
  tags               = local.tags
}

# ── EKS Cluster ────────────────────────────────────────────────────────────────
module "eks" {
  source = "./modules/eks"

  cluster_name       = local.cluster_name
  cluster_version    = var.cluster_version
  vpc_id             = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnet_ids
  node_sg_id         = module.vpc.eks_node_sg_id
  tags               = local.tags

  node_instance_types = local.eks_node_instance_types
  node_desired_size   = var.environment == "prod" ? 5 : 2
  node_max_size       = var.environment == "prod" ? 15 : 6
  node_min_size       = 1

  spot_node_instance_types = local.spot_instance_types
  spot_node_desired_size   = var.environment == "prod" ? 3 : 1
  spot_node_max_size       = var.environment == "prod" ? 10 : 4
}

# ── RDS Subnet Group (required for RDS) ──────────────────────────────────────
resource "aws_db_subnet_group" "main" {
  name       = "los-platform-db-subnet-${var.environment}"
  subnet_ids = module.vpc.private_subnet_ids

  tags = { Name = "los-platform-db-subnet-${var.environment}" }
}

# ── RDS PostgreSQL (all 9 per-service databases) ──────────────────────────────
module "rds" {
  source = "./modules/rds"

  environment          = var.environment
  vpc_id               = module.vpc.vpc_id
  rds_sg_id            = module.vpc.rds_sg_id
  db_subnet_group_name = aws_db_subnet_group.main.name
  db_instance_class    = local.rds_node_type
  db_allocated_storage = var.db_allocated_storage
  db_multi_az          = var.db_multi_az
  db_username          = var.db_username
  tags                 = local.tags
}

# ── ElastiCache Redis ─────────────────────────────────────────────────────────
module "redis" {
  source = "./modules/redis"

  environment      = var.environment
  vpc_id           = module.vpc.vpc_id
  redis_subnet_ids = module.vpc.private_subnet_ids
  redis_sg_id      = module.vpc.redis_sg_id
  tags             = local.tags

  node_type          = local.redis_node_type
  num_shards         = local.redis_shards
  replicas_per_shard = local.redis_replicas
}

# ── MSK Kafka ─────────────────────────────────────────────────────────────────
module "msk" {
  source = "./modules/msk"

  environment    = var.environment
  vpc_id         = module.vpc.vpc_id
  msk_subnet_ids = module.vpc.private_subnet_ids
  msk_sg_id      = module.vpc.msk_sg_id
  tags           = local.tags
}

# ── S3 Buckets ────────────────────────────────────────────────────────────────
module "s3" {
  source = "./modules/s3"

  environment = var.environment
  tags        = local.tags
}

# ── ECR Repositories ──────────────────────────────────────────────────────────
module "ecr" {
  source = "./modules/ecr"

  environment = var.environment
  tags        = local.tags
}

# ── Terraform State S3 + DynamoDB (for CI/CD bootstrap) ───────────────────────
resource "aws_s3_bucket" "tf_state" {
  bucket = "los-terraform-state-${var.environment}"

  tags = { Name = "los-terraform-state-${var.environment}" }
}

resource "aws_s3_bucket_versioning" "tf_state" {
  bucket = aws_s3_bucket.tf_state.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "tf_state" {
  bucket = aws_s3_bucket.tf_state.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "tf_state" {
  bucket = aws_s3_bucket.tf_state.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_dynamodb_table" "tf_locks" {
  name         = "los-terraform-state-locks${var.environment == "dr" ? "-dr" : ""}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "LockID"

  attribute {
    name = "LockID"
    type = "S"
  }

  tags = { Name = "los-terraform-state-locks-${var.environment}" }
}

# ── DR: Cross-region resources ────────────────────────────────────────────────
module "vpc_dr" {
  count  = var.enable_dr ? 1 : 0
  source = "./modules/vpc"

  environment        = var.environment
  vpc_cidr           = "10.1.0.0/16"
  availability_zones = ["ap-southeast-1a", "ap-southeast-1b", "ap-southeast-1c"]
  tags               = merge(local.tags, { Site = "DR" })
}

module "eks_dr" {
  count  = var.enable_dr ? 1 : 0
  source = "./modules/eks"

  providers = {
    aws = aws.dr
  }

  cluster_name       = "los-dr"
  cluster_version    = var.cluster_version
  vpc_id             = module.vpc_dr[0].vpc_id
  private_subnet_ids = module.vpc_dr[0].private_subnet_ids
  node_sg_id         = module.vpc_dr[0].eks_node_sg_id
  tags               = merge(local.tags, { Site = "DR" })

  node_instance_types = ["t3.medium"]
  node_desired_size   = 2
  node_max_size       = 4
  node_min_size       = 1

  spot_node_instance_types = ["t3.medium", "t3a.medium"]
  spot_node_desired_size   = 1
  spot_node_max_size       = 3
}

# ── Outputs ───────────────────────────────────────────────────────────────────
output "vpc_id" { value = module.vpc.vpc_id }
output "eks_cluster_name" { value = module.eks.cluster_name }
output "eks_cluster_endpoint" { value = module.eks.cluster_endpoint }
output "eks_cluster_ca" { value = module.eks.cluster_ca }
output "eks_oidc_issuer" { value = module.eks.cluster_oidc_issuer }
output "eks_node_role_arn" { value = module.eks.node_role_arn }

output "db_endpoints" {
  description = "All per-service database endpoints"
  value       = module.rds.db_endpoints
}

output "redis_endpoint" { value = module.redis.redis_endpoint }
output "redis_reader_endpoint" { value = module.redis.redis_reader_endpoint }
output "redis_port" { value = module.redis.redis_port }

output "msk_bootstrap_brokers" { value = module.msk.msk_bootstrap_brokers }

output "documents_bucket" { value = module.s3.documents_bucket }
output "documents_bucket_arn" { value = module.s3.documents_bucket_arn }

output "ecr_repository_urls" {
  description = "ECR repository URLs for all services"
  value       = module.ecr.repository_urls
}

output "tf_state_bucket" { value = aws_s3_bucket.tf_state.bucket }
