package com.los.kyc.entity;

import com.los.common.entity.BaseEntity;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "kyc_audit_logs", schema = "kyc", indexes = {
    @Index(name = "idx_kyc_audit_kyc_record_id", columnList = "kyc_record_id")
})
public class KycAuditLog extends BaseEntity {

    @Column(name = "kyc_record_id", nullable = false)
    private String kycRecordId;

    @Column(name = "action", nullable = false, length = 100)
    private String action; // INITIATED, VERIFIED, REJECTED, etc.

    @Column(name = "action_details", columnDefinition = "jsonb")
    private String actionDetails;

    @Column(name = "performed_by", length = 50)
    private String performedBy;

    @Column(name = "performed_at", nullable = false)
    private java.time.LocalDateTime performedAt;

    @Column(name = "status", length = 50)
    private String status;

    @Column(name = "remarks", columnDefinition = "text")
    private String remarks;

    @Column(name = "ip_address", length = 50)
    private String ipAddress;
}
