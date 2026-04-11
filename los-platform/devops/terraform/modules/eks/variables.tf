variable "cluster_name" {
  description = "Name of the EKS cluster"
  type        = string
}

variable "cluster_version" {
  description = "Kubernetes version for the cluster"
  type        = string
  default     = "1.29"
}

variable "vpc_id" {
  description = "VPC ID where the cluster will be deployed"
  type        = string
}

variable "private_subnet_ids" {
  description = "List of private subnet IDs for the cluster"
  type        = list(string)
}

variable "node_sg_id" {
  description = "Security group ID for EKS worker nodes"
  type        = string
}

variable "tags" {
  description = "Tags to apply to all EKS resources"
  type        = map(string)
  default     = {}
}

variable "node_instance_types" {
  description = "Instance types for node groups"
  type        = list(string)
  default     = ["t3.medium"]
}

variable "node_desired_size" {
  description = "Desired number of nodes in the node group"
  type        = number
  default     = 3
}

variable "node_max_size" {
  description = "Maximum number of nodes in the node group"
  type        = number
  default     = 10
}

variable "node_min_size" {
  description = "Minimum number of nodes in the node group"
  type        = number
  default     = 2
}

variable "spot_node_instance_types" {
  description = "Instance types for Spot node groups"
  type        = list(string)
  default     = ["t3.medium", "t3a.medium", "m5.medium"]
}

variable "spot_node_desired_size" {
  description = "Desired number of Spot nodes"
  type        = number
  default     = 2
}

variable "spot_node_max_size" {
  description = "Maximum number of Spot nodes"
  type        = number
  default     = 8
}
