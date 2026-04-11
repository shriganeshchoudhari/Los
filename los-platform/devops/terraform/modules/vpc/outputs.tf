output "vpc_id" { value = aws_vpc.main.id }
output "private_subnet_ids" { value = aws_subnet.private[*].id }
output "public_subnet_ids" { value = aws_subnet.public[*].id }
output "eks_node_sg_id" { value = aws_security_group.eks_nodes.id }
output "rds_sg_id" { value = aws_security_group.rds.id }
output "msk_sg_id" { value = aws_security_group.msk.id }
output "redis_sg_id" { value = aws_security_group.redis.id }
output "vpc_cidr" { value = aws_vpc.main.cidr_block }
