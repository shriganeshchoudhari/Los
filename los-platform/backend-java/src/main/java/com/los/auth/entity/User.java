package com.los.auth.entity;

import com.los.common.entity.BaseEntity;
import com.los.common.enums.UserRole;
import com.los.common.enums.UserStatus;
import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;
import java.time.LocalDateTime;

@Data
@NoArgsConstructor
@AllArgsConstructor
@Entity
@Table(name = "users", schema = "auth", uniqueConstraints = {
    @UniqueConstraint(columnNames = "mobile", name = "uk_users_mobile"),
    @UniqueConstraint(columnNames = "email", name = "uk_users_email"),
    @UniqueConstraint(columnNames = "employee_id", name = "uk_users_employee_id")
})
public class User extends BaseEntity {

    @Column(name = "mobile", nullable = false, length = 20, unique = true)
    private String mobile;

    @Column(name = "mobile_hash", nullable = false, length = 255)
    private String mobileHash;

    @Column(name = "email", length = 255, unique = true)
    private String email;

    @Column(name = "employee_id", length = 50, unique = true)
    private String employeeId;

    @Column(name = "first_name", length = 100)
    private String firstName;

    @Column(name = "last_name", length = 100)
    private String lastName;

    @Enumerated(EnumType.STRING)
    @Column(name = "role", nullable = false, length = 50)
    private UserRole role;

    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 50)
    private UserStatus status = UserStatus.ACTIVE;

    @Column(name = "password_hash", length = 255)
    private String passwordHash;

    @Column(name = "mfa_enabled", nullable = false)
    private Boolean mfaEnabled = false;

    @Column(name = "mfa_secret", length = 255)
    private String mfaSecret;

    @Column(name = "last_login_at")
    private LocalDateTime lastLoginAt;

    @Column(name = "last_password_change_at")
    private LocalDateTime lastPasswordChangeAt;

    @Column(name = "failed_login_attempts", nullable = false)
    private Integer failedLoginAttempts = 0;

    @Column(name = "locked_until")
    private LocalDateTime lockedUntil;

    @Column(name = "metadata", columnDefinition = "jsonb")
    private String metadata;

    @Column(name = "is_deleted", nullable = false)
    private Boolean isDeleted = false;

    @Column(name = "deleted_at")
    private LocalDateTime deletedAt;
}
