package com.los.common.exception;

import lombok.extern.slf4j.Slf4j;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.context.request.WebRequest;

import com.los.common.dto.ApiResponse;

/**
 * Global exception handler for all REST endpoints.
 * Converts exceptions to standardized API responses.
 */
@Slf4j
@RestControllerAdvice
public class GlobalExceptionHandler {

    /**
     * Handle LosException
     */
    @ExceptionHandler(LosException.class)
    public ResponseEntity<ApiResponse<?>> handleLosException(LosException ex, WebRequest request) {
        log.error("LOS Exception: code={}, message={}", ex.getCode(), ex.getMessage(), ex);
        
        ApiResponse<?> response = ApiResponse.error(
                ex.getCode(),
                ex.getMessage(),
                ex.getData()
        );
        response.setTimestamp(java.time.LocalDateTime.now());
        response.setPath(request.getDescription(false).replace("uri=", ""));
        
        return new ResponseEntity<>(response, HttpStatus.valueOf(ex.getHttpStatus()));
    }

    /**
     * Handle validation errors
     */
    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<ApiResponse<?>> handleValidationException(
            MethodArgumentNotValidException ex, WebRequest request) {
        
        // Build a descriptive message listing all field errors
        String fieldErrors = ex.getBindingResult().getFieldErrors().stream()
                .map(fe -> fe.getField() + ": " + fe.getDefaultMessage())
                .collect(java.util.stream.Collectors.joining("; "));
        
        String message = fieldErrors.isEmpty() ? "Validation failed" : "Validation failed: " + fieldErrors;
        log.warn("Validation error on {}: {}", request.getDescription(false), message);
        
        ApiResponse<?> response = ApiResponse.error(
                "GEN_004",
                message
        );
        response.setTimestamp(java.time.LocalDateTime.now());
        response.setPath(request.getDescription(false).replace("uri=", ""));
        
        return new ResponseEntity<>(response, HttpStatus.BAD_REQUEST);
    }

    /**
     * Handle IllegalArgumentException
     */
    @ExceptionHandler(IllegalArgumentException.class)
    public ResponseEntity<ApiResponse<?>> handleIllegalArgumentException(
            IllegalArgumentException ex, WebRequest request) {
        log.warn("Illegal argument: {}", ex.getMessage());
        
        ApiResponse<?> response = ApiResponse.error(
                "GEN_004",
                ex.getMessage()
        );
        response.setTimestamp(java.time.LocalDateTime.now());
        response.setPath(request.getDescription(false).replace("uri=", ""));
        
        return new ResponseEntity<>(response, HttpStatus.BAD_REQUEST);
    }

    /**
     * Handle Database integrity violations
     */
    @ExceptionHandler(org.springframework.dao.DataIntegrityViolationException.class)
    public ResponseEntity<ApiResponse<?>> handleDataIntegrityViolationException(
            org.springframework.dao.DataIntegrityViolationException ex, WebRequest request) {
        log.error("Data integrity violation: {}", ex.getMessage(), ex);
        
        String message = "Database constraint violation";
        if (ex.getMessage() != null && ex.getMessage().contains("value too long")) {
            message = "Input value is too long for database column";
        }
        
        ApiResponse<?> response = ApiResponse.error("GEN_003", message);
        response.setTimestamp(java.time.LocalDateTime.now());
        response.setPath(request.getDescription(false).replace("uri=", ""));
        
        return new ResponseEntity<>(response, HttpStatus.BAD_REQUEST);
    }

    /**
     * Handle RuntimeException
     */
    @ExceptionHandler(RuntimeException.class)
    public ResponseEntity<ApiResponse<?>> handleRuntimeException(
            RuntimeException ex, WebRequest request) {
        log.error("Unexpected error: {}", ex.getMessage(), ex);
        
        ApiResponse<?> response = ApiResponse.error(
                "GEN_001",
                "An unexpected error occurred: " + ex.getMessage()
        );
        response.setTimestamp(java.time.LocalDateTime.now());
        response.setPath(request.getDescription(false).replace("uri=", ""));
        
        return new ResponseEntity<>(response, HttpStatus.INTERNAL_SERVER_ERROR);
    }

    /**
     * Handle generic Exception
     */
    @ExceptionHandler(Exception.class)
    public ResponseEntity<ApiResponse<?>> handleException(Exception ex, WebRequest request) {
        log.error("Server error: {}", ex.getMessage(), ex);
        
        ApiResponse<?> response = ApiResponse.error(
                "GEN_001",
                "An unexpected error occurred: " + ex.getMessage()
        );
        response.setTimestamp(java.time.LocalDateTime.now());
        response.setPath(request.getDescription(false).replace("uri=", ""));
        
        return new ResponseEntity<>(response, HttpStatus.INTERNAL_SERVER_ERROR);
    }
}
