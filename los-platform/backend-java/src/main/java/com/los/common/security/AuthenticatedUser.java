package com.los.common.security;

import com.los.common.enums.UserRole;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.util.List;

/**
 * Represents an authenticated user with their details and permissions.
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class AuthenticatedUser {
    private String id;
    private UserRole role;
    private String branchCode;
    private String sessionId;
    private List<String> scopes;
}
