package com.los.auth.dto;

import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class AuthenticatedUserDto {

    private String userId;

    private String name;

    private String mobile;

    private String email;

    private String role;

    private java.util.List<String> permissions;

    private java.time.LocalDateTime loginTime;

    private String sessionId;
}
