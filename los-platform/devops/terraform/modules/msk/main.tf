# MSK Kafka Module — LOS Platform

variable "environment" { type = string }
variable "vpc_id" { type = string }
variable "msk_subnet_ids" { type = list(string) }
variable "msk_sg_id" { type = string }
variable "tags" { type = map(string) }

resource "aws_msk_cluster" "main" {
  cluster_name = "los-platform-kafka-${var.environment}"

  kafka_version          = "3.6.0"
  number_of_broker_nodes = var.environment == "prod" ? 6 : 3

  broker_node_group_info {
    instance_type   = var.environment == "prod" ? "kafka.m5.large" : "kafka.t3.small"
    client_subnets  = var.msk_subnet_ids
    security_groups = [var.msk_sg_id]

    storage_info {
      ebs_storage_info {
        volume_size = var.environment == "prod" ? 500 : 100
      }
    }
  }

  encryption_info {
    encryption_at_rest_kms_key_arn = aws_kms_key.msk.arn
    encryption_in_transit {
      client_broker = "TLS"
      in_cluster    = true
    }
  }

  logging_info {
    broker_logs {
      cloudwatch_logs {
        enabled   = true
        log_group = aws_cloudwatch_log_group.msk.name
      }
    }
  }

  tags = var.tags
}

resource "aws_kms_key" "msk" {
  description             = "KMS key for MSK encryption at rest"
  deletion_window_in_days = 7
  tags                    = var.tags
}

resource "aws_cloudwatch_log_group" "msk" {
  name              = "/aws/msk/los-platform-${var.environment}"
  retention_in_days = 14
  tags              = var.tags
}

output "msk_bootstrap_brokers" {
  value = aws_msk_cluster.main.bootstrap_brokers_tls
}
