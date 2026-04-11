# ElastiCache Redis Module — LOS Platform

variable "environment" { type = string }
variable "vpc_id" { type = string }
variable "redis_subnet_ids" { type = list(string) }
variable "redis_sg_id" { type = string }
variable "tags" { type = map(string) }
variable "node_type" {
  type    = string
  default = "cache.t3.medium"
}
variable "num_shards" {
  type    = number
  default = 3
}
variable "replicas_per_shard" {
  type    = number
  default = 2
}

resource "aws_elasticache_subnet_group" "main" {
  name       = "los-redis-subnet-${var.environment}"
  subnet_ids = var.redis_subnet_ids
}

resource "aws_elasticache_replication_group" "main" {
  replication_group_id = "los-platform-redis-${var.environment}"
  description          = "LOS Platform Redis cluster"

  engine             = "redis"
  engine_version     = "7.0"
  node_type          = var.node_type
  num_cache_clusters = var.num_shards * (1 + var.replicas_per_shard)

  at_rest_encryption_enabled = true
  transit_encryption_mode    = "required"

  automatic_failover_enabled = true
  multi_az_enabled           = true

  security_group_ids = [var.redis_sg_id]

  snapshot_retention_limit   = var.environment == "prod" ? 7 : 1
  snapshot_window            = "03:00-04:00"
  maintenance_window         = "mon:04:00-mon:05:00"
  auto_minor_version_upgrade = true

  tags = merge(var.tags, { Name = "los-redis-${var.environment}" })
}

output "redis_endpoint" {
  description = "Redis primary endpoint"
  value       = aws_elasticache_replication_group.main.primary_endpoint_address
}

output "redis_reader_endpoint" {
  description = "Redis reader endpoint for read replicas"
  value       = aws_elasticache_replication_group.main.reader_endpoint_address
}

output "redis_port" {
  description = "Redis port"
  value       = aws_elasticache_replication_group.main.port
}

output "redis_auth_token" {
  description = "Redis AUTH token (store in Vault)"
  value       = aws_elasticache_replication_group.main.auth_token
  sensitive   = true
}
