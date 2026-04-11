# ECR Repository Module — LOS Platform

variable "environment" { type = string }
variable "tags" { type = map(string) }

locals {
  repositories = [
    "auth-service",
    "kyc-service",
    "loan-service",
    "decision-engine",
    "integration-service",
    "notification-service",
    "dsa-service",
    "document-service",
    "frontend",
  ]
}

resource "aws_ecr_repository" "this" {
  for_each = toset(local.repositories)

  name                 = "${each.value}-${var.environment}"
  image_tag_mutability = "MUTABLE"

  image_scanning_configuration {
    scan_on_push = true
  }

  encryption_configuration {
    encryption_type = "AES256"
  }

  tags = merge(var.tags, { Name = "${each.value}-${var.environment}" })
}

resource "aws_ecr_lifecycle_policy" "this" {
  for_each = toset(local.repositories)

  repository = aws_ecr_repository.this[each.value].name

  policy = jsonencode({
    rules = [
      {
        rulePriority = 1
        description  = "Expire untagged images after 1 day"
        selection = {
          tagStatus   = "untagged"
          countType   = "sinceImagePushed"
          countNumber = 1
          countUnit   = "days"
        }
        action = {
          type = "expire"
        }
      },
      {
        rulePriority = 2
        description  = "Keep last 10 versioned images"
        selection = {
          tagStatus     = "tagged"
          tagPrefixList = ["v"]
          countType     = "imageCountMoreThan"
          countNumber   = 10
        }
        action = {
          type = "expire"
        }
      }
    ]
  })
}

output "repository_urls" {
  description = "Map of service names to their ECR repository URLs"
  value = {
    for repo in aws_ecr_repository.this :
    repo.name => repo.repository_url
  }
}

output "repository_arns" {
  description = "Map of service names to their ECR repository ARNs"
  value = {
    for repo in aws_ecr_repository.this :
    repo.name => repo.arn
  }
}
