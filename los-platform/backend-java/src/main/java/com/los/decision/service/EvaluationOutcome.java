package com.los.decision.service;

import java.util.Collections;
import java.util.List;

/**
 * Immutable holder for the result of evaluating a collection of decision rules.
 * Captures which rule codes failed, the associated rejection reasons and whether a hard‑stop rule was encountered.
 */
public final class EvaluationOutcome {
    private final List<String> failedRuleCodes;
    private final List<String> rejectionReasons;
    private final boolean hardStopEncountered;

    public EvaluationOutcome(List<String> failedRuleCodes, List<String> rejectionReasons, boolean hardStopEncountered) {
        this.failedRuleCodes = failedRuleCodes != null ? failedRuleCodes : Collections.emptyList();
        this.rejectionReasons = rejectionReasons != null ? rejectionReasons : Collections.emptyList();
        this.hardStopEncountered = hardStopEncountered;
    }

    public List<String> failedRuleCodes() {
        return failedRuleCodes;
    }

    public List<String> rejectionReasons() {
        return rejectionReasons;
    }

    public boolean hardStopEncountered() {
        return hardStopEncountered;
    }
}
