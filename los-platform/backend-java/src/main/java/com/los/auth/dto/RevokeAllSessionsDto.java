package com.los.auth.dto;

import jakarta.validation.constraints.NotBlank;
import lombok.AllArgsConstructor;
import lombok.Data;
import lombok.NoArgsConstructor;

@Data
@NoArgsConstructor
@AllArgsConstructor
public class RevokeAllSessionsDto {

    @NotBlank(message = "User ID is required")
    private String userId;

    private String exceptSessionId; // Keep this session active

    private String reason;
}
