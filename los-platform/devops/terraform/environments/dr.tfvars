# DR environment variables (ap-southeast-1)
aws_region           = "ap-southeast-1"
environment          = "dr"
vpc_cidr             = "10.1.0.0/16"
cluster_version      = "1.29"
db_instance_class    = "db.r6g.xlarge"
db_allocated_storage = 500
db_multi_az          = false # Single AZ for DR — promoted to Multi-AZ on failover
enable_dr            = false
db_username          = "los_user"
