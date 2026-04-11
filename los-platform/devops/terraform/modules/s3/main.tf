# S3 + MinIO Module — LOS Platform

variable "environment" { type = string }
variable "tags" { type = map(string) }

resource "aws_s3_bucket" "documents" {
  bucket = "los-documents-${var.environment}"

  tags = merge(var.tags, { Name = "los-documents-${var.environment}" })
}

resource "aws_s3_bucket_versioning" "documents" {
  bucket = aws_s3_bucket.documents.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "documents" {
  bucket = aws_s3_bucket.documents.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_lifecycle_configuration" "documents" {
  bucket = aws_s3_bucket.documents.id

  rule {
    id     = "archive-old-versions"
    status = "Enabled"

    noncurrent_version_transition {
      noncurrent_days = 90
      storage_class   = "GLACIER_INSTANT_RETRIEVAL"
    }

    noncurrent_version_expiration {
      noncurrent_days = 365
    }
  }
}

resource "aws_iam_role" "s3_replication_role" {
  name = "los-platform-s3-replication-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action    = "sts:AssumeRole"
      Effect    = "Allow"
      Principal = { Service = "s3.amazonaws.com" }
    }]
  })
}

resource "aws_iam_policy" "s3_replication_policy" {
  name = "los-platform-s3-replication-policy-${var.environment}"

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action   = ["s3:GetObject", "s3:GetObjectVersion", "s3:GetObjectVersionForReplication"]
        Effect   = "Allow"
        Resource = [aws_s3_bucket.documents.arn, "${aws_s3_bucket.documents.arn}/*"]
      },
      {
        Action   = ["s3:ReplicateObject", "s3:ReplicateDelete", "s3:ReplicateTags"]
        Effect   = "Allow"
        Resource = "arn:aws:s3:::los-documents-dr/*"
      }
    ]
  })
}

resource "aws_iam_role_policy_attachment" "s3_replication" {
  role       = aws_iam_role.s3_replication_role.name
  policy_arn = aws_iam_policy.s3_replication_policy.arn
}

# Cross-region replication for DR
resource "aws_s3_bucket_replication_configuration" "documents" {
  bucket = aws_s3_bucket.documents.id
  role   = aws_iam_role.s3_replication_role.arn

  rule {
    id     = "dr-replication"
    status = "Enabled"

    destination {
      bucket        = "arn:aws:s3:::los-documents-dr"
      storage_class = "STANDARD"
      encryption_configuration {
        replica_kms_key_id = aws_kms_key.documents_replication.arn
      }
    }

    filter {}
  }
}

resource "aws_kms_key" "documents_replication" {
  description             = "KMS key for S3 cross-region replication"
  deletion_window_in_days = 10
  tags                    = var.tags
}

resource "aws_s3_bucket_public_access_block" "documents" {
  bucket = aws_s3_bucket.documents.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

output "documents_bucket" { value = aws_s3_bucket.documents.bucket }
output "documents_bucket_arn" { value = aws_s3_bucket.documents.arn }
