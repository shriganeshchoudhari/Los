package com.los.integration.entity;

public enum BureauPullStatus {
    PENDING,
    CONSENT_PENDING,
    IN_PROGRESS,
    SUCCESS,
    PARTIAL_SUCCESS,
    FAILED,
    TIMEOUT,
    DUPLICATE_LOCKED
}
