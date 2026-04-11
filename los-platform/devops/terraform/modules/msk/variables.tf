variable "msk_subnet_ids" {
  description = "List of subnet IDs for MSK broker nodes"
  type        = list(string)
}

variable "msk_sg_id" {
  description = "Security group ID for MSK"
  type        = string
}
