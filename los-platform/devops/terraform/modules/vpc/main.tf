# VPC Module — LOS Platform

variable "environment" { type = string }
variable "vpc_cidr" { type = string }
variable "availability_zones" { type = list(string) }
variable "tags" { type = map(string) }

resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = merge(var.tags, { Name = "los-platform-vpc-${var.environment}" })
}

# ── Internet Gateway ─────────────────────────────────────────────────────────────
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = { Name = "los-platform-igw-${var.environment}" }
}

# ── Public Subnets ──────────────────────────────────────────────────────────────
resource "aws_subnet" "public" {
  count = length(var.availability_zones)

  vpc_id                  = aws_vpc.main.id
  cidr_block              = cidrsubnet(var.vpc_cidr, 8, count.index)
  availability_zone       = var.availability_zones[count.index]
  map_public_ip_on_launch = true

  tags = merge(var.tags, {
    Name = "los-platform-public-${var.availability_zones[count.index]}"
    Tier = "Public"
  })
}

# ── Private Subnets ─────────────────────────────────────────────────────────────
resource "aws_subnet" "private" {
  count = length(var.availability_zones)

  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 8, count.index + length(var.availability_zones))
  availability_zone = var.availability_zones[count.index]

  tags = merge(var.tags, {
    Name = "los-platform-private-${var.availability_zones[count.index]}"
    Tier = "Private"
  })
}

# ── NAT Gateway ─────────────────────────────────────────────────────────────────
resource "aws_eip" "nat" {
  count  = var.environment == "prod" ? 1 : 0 # One per AZ in prod
  domain = "vpc"

  tags = { Name = "los-platform-nat-eip-${count.index}" }
}

resource "aws_nat_gateway" "main" {
  count = length(var.availability_zones) > 0 ? 1 : 0

  allocation_id = aws_eip.nat[0].id
  subnet_id     = aws_subnet.public[0].id

  tags = { Name = "los-platform-nat-${var.environment}" }
}

# ── Route Tables ────────────────────────────────────────────────────────────────
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = { Name = "los-platform-public-rt-${var.environment}" }
}

resource "aws_route_table" "private" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main[0].id
  }

  tags = { Name = "los-platform-private-rt-${var.environment}" }
}

resource "aws_route_table_association" "public" {
  count = length(var.availability_zones)

  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

resource "aws_route_table_association" "private" {
  count = length(var.availability_zones)

  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private.id
}

# ── Security Groups ──────────────────────────────────────────────────────────────
resource "aws_security_group" "eks_nodes" {
  name        = "los-platform-eks-nodes-${var.environment}"
  description = "Security group for EKS worker nodes"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = [var.vpc_cidr]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = { Name = "los-platform-eks-nodes-sg-${var.environment}" }
}

resource "aws_security_group" "rds" {
  name        = "los-platform-rds-${var.environment}"
  description = "Security group for RDS PostgreSQL"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.eks_nodes.id]
  }

  tags = { Name = "los-platform-rds-sg-${var.environment}" }
}

resource "aws_security_group" "msk" {
  name        = "los-platform-msk-${var.environment}"
  description = "Security group for MSK Kafka"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port   = 9092
    to_port     = 9092
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }

  tags = { Name = "los-platform-msk-sg-${var.environment}" }
}

resource "aws_security_group" "redis" {
  name        = "los-platform-redis-${var.environment}"
  description = "Security group for ElastiCache Redis"
  vpc_id      = aws_vpc.main.id

  ingress {
    from_port   = 6379
    to_port     = 6379
    protocol    = "tcp"
    cidr_blocks = [var.vpc_cidr]
  }

  tags = { Name = "los-platform-redis-sg-${var.environment}" }
}

output "vpc_id" { value = aws_vpc.main.id }
output "private_subnet_ids" { value = aws_subnet.private[*].id }
output "public_subnet_ids" { value = aws_subnet.public[*].id }
output "eks_node_sg_id" { value = aws_security_group.eks_nodes.id }
output "rds_sg_id" { value = aws_security_group.rds.id }
output "msk_sg_id" { value = aws_security_group.msk.id }
output "redis_sg_id" { value = aws_security_group.redis.id }
