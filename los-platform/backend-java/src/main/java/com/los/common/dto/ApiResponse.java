package com.los.common.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import io.swagger.v3.oas.annotations.media.Schema;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

import java.time.LocalDateTime;

/**
 * Generic API response wrapper for all REST endpoints.
 * Wraps response data with metadata like success status, message, and error code.
 *
 * @param <T> The type of response data
 */
@Data
@NoArgsConstructor
@AllArgsConstructor
@Builder
@JsonInclude(JsonInclude.Include.NON_NULL)
@Schema(description = "Generic API Response Wrapper")
public class ApiResponse<T> {

    @Schema(description = "Success indicator", example = "true")
    private boolean success;

    @Schema(description = "Response data")
    private T data;

    @Schema(description = "Operation message", example = "Operation completed successfully")
    private String message;

    @Schema(description = "Error code if applicable", example = "AUTH_001")
    private String code;

    @Schema(description = "Response timestamp")
    private LocalDateTime timestamp;

    @Schema(description = "Request path")
    private String path;

    /**
     * Create a successful response
     */
    public static <T> ApiResponse<T> success(T data, String message) {
        return ApiResponse.<T>builder()
                .success(true)
                .data(data)
                .message(message)
                .timestamp(LocalDateTime.now())
                .build();
    }

    /**
     * Create a successful response with data only
     */
    public static <T> ApiResponse<T> success(T data) {
        return success(data, "Operation completed successfully");
    }

    /**
     * Create an error response
     */
    public static <T> ApiResponse<T> error(String code, String message, T data) {
        return ApiResponse.<T>builder()
                .success(false)
                .code(code)
                .message(message)
                .data(data)
                .timestamp(LocalDateTime.now())
                .build();
    }

    /**
     * Create an error response without data
     */
    public static <T> ApiResponse<T> error(String code, String message) {
        return error(code, message, null);
    }
}
