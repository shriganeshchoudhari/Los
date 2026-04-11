# RDS PostgreSQL Module — LOS Platform
# Provisions all 9 per-service RDS instances with a DBSubnetGroup

variable "environment" { type = string }
variable "vpc_id" { type = string }
variable "rds_sg_id" { type = string }
variable "db_subnet_group_name" { type = string }
variable "db_instance_class" { type = string }
variable "db_allocated_storage" { type = number }
variable "db_multi_az" { type = bool }
variable "db_username" { type = string }
variable "tags" { type = map(string) }

locals {
  databases = {
    auth         = { db_name = "los_auth", description = "Auth service database" }
    loan         = { db_name = "los_loan", description = "Loan application database" }
    kyc          = { db_name = "los_kyc", description = "KYC service database" }
    decision     = { db_name = "los_decision", description = "Decision engine database" }
    integration  = { db_name = "los_integration", description = "Integration/bureau/disbursement database" }
    document     = { db_name = "los_document", description = "Document service database" }
    notification = { db_name = "los_notification", description = "Notification service database" }
    dsa          = { db_name = "los_dsa", description = "DSA portal database" }
    shared       = { db_name = "los_shared", description = "Shared audit/logs database" }
  }
}

resource "random_password" "db_password" {
  length  = 32
  special = true
}

resource "aws_secretsmanager_secret" "db_password" {
  name_prefix             = "los-platform/db-password-${var.environment}"
  recovery_window_in_days = var.environment == "prod" ? 30 : 0
  tags                    = var.tags
}

resource "aws_secretsmanager_secret_version" "db_password" {
  secret_id     = aws_secretsmanager_secret.db_password.id
  secret_string = random_password.db_password.result
}

resource "aws_db_instance" "this" {
  for_each = local.databases

  identifier             = "los-${each.key}-${var.environment}"
  engine                 = "postgres"
  engine_version         = "15.4"
  instance_class         = var.db_instance_class
  allocated_storage      = var.db_allocated_storage
  db_name                = each.value.db_name
  username               = var.db_username
  password               = random_password.db_password.result
  db_subnet_group_name   = var.db_subnet_group_name
  vpc_security_group_ids = [var.rds_sg_id]
  multi_az               = var.db_multi_az
  storage_encrypted      = true

  backup_retention_period      = var.environment == "prod" ? 35 : 7
  backup_window                = "03:00-04:00"
  maintenance_window           = "mon:04:00-mon:05:00"
  skip_final_snapshot          = var.environment != "prod"
  deletion_protection          = var.environment == "prod"
  publicly_accessible          = false
  performance_insights_enabled = var.environment == "prod"
  monitoring_interval          = var.environment == "prod" ? 60 : 0

  tags = merge(var.tags, { Name = "los-${each.key}-${var.environment}", Service = each.key })
}

output "db_endpoints" {
  description = "Map of database identifiers to their endpoints"
  value = {
    for db in aws_db_instance.this :
    db.identifier => db.endpoint
  }
}

output "db_password_secret_arn" {
  description = "ARN of the Secrets Manager secret containing the DB password"
  value       = aws_secretsmanager_secret.db_password.arn
}
