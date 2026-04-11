output "documents_bucket" { value = aws_s3_bucket.documents.bucket }
output "documents_bucket_arn" { value = aws_s3_bucket.documents.arn }
output "documents_bucket_regional_domain_name" { value = aws_s3_bucket.documents.bucket_domain_name }
