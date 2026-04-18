package com.los.common.exception;

import lombok.Getter;

/**
 * LOS-specific exception with error codes, HTTP status, and retryability information.
 */
@Getter
public class LosException extends RuntimeException {

    private final String code;
    private final int httpStatus;
    private final boolean retryable;
    private final Integer retryAfterSeconds;
    private final String field;
    private final String details;

    public LosException(String code, String message, int httpStatus, boolean retryable) {
        super(message);
        this.code = code;
        this.httpStatus = httpStatus;
        this.retryable = retryable;
        this.retryAfterSeconds = null;
        this.field = null;
        this.details = null;
    }

    public LosException(String code, String message, int httpStatus, boolean retryable, Integer retryAfterSeconds) {
        super(message);
        this.code = code;
        this.httpStatus = httpStatus;
        this.retryable = retryable;
        this.retryAfterSeconds = retryAfterSeconds;
        this.field = null;
        this.details = null;
    }

    public LosException(String code, String message, int httpStatus, boolean retryable, 
                       Integer retryAfterSeconds, String field, String details) {
        super(message);
        this.code = code;
        this.httpStatus = httpStatus;
        this.retryable = retryable;
        this.retryAfterSeconds = retryAfterSeconds;
        this.field = field;
        this.details = details;
    }
}
