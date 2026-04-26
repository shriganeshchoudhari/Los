package com.los.auth.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
@JsonInclude(JsonInclude.Include.NON_NULL)
public class AuthenticatedUserDto {

    private String userId;

    /** Full display name — also exposed as fullName for backward compat */
    private String name;

    // Alias so frontend code using profile?.fullName also works
    public String getFullName() { return name; }

    private String mobile;

    private String email;

    private String role;

    private java.util.List<String> permissions;

    private java.time.LocalDateTime loginTime;

    private String sessionId;

    /** Branch name for bank staff — populated from User.branchName if present */
    private String branchName;

    /** Branch code for bank staff */
    private String branchCode;
}
