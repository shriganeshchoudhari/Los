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
    private final Object data;

    public LosException(String code, String message, int httpStatus, boolean retryable) {
        this(code, message, httpStatus, retryable, null, null, null, null);
    }

    public LosException(String code, String message, int httpStatus, boolean retryable, Object data) {
        this(code, message, httpStatus, retryable, null, null, null, data);
    }

    public LosException(String code, String message, int httpStatus, boolean retryable, Integer retryAfterSeconds) {
        this(code, message, httpStatus, retryable, retryAfterSeconds, null, null, null);
    }

    public LosException(String code, String message, int httpStatus, boolean retryable, 
                       Integer retryAfterSeconds, String field, String details, Object data) {
        super(message);
        this.code = code;
        this.httpStatus = httpStatus;
        this.retryable = retryable;
        this.retryAfterSeconds = retryAfterSeconds;
        this.field = field;
        this.details = details;
        this.data = data;
    }
}
