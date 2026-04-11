# Production environment variables
aws_region           = "ap-south-1"
environment          = "prod"
vpc_cidr             = "10.0.0.0/16"
cluster_version      = "1.29"
db_instance_class    = "db.r6g.xlarge"
db_allocated_storage = 500
db_multi_az          = true
enable_dr            = true
db_username          = "los_user"
