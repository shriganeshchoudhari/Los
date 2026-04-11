output "msk_bootstrap_brokers" {
  description = "MSK broker TLS bootstrap endpoints"
  value       = aws_msk_cluster.main.bootstrap_brokers_tls
}

output "msk_arn" {
  description = "ARN of the MSK cluster"
  value       = aws_msk_cluster.main.arn
}
