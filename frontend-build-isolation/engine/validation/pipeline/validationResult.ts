/**
 * =============================================================================
 * iePDF Browser Engine
 * =============================================================================
 *
 * File        : validationResult.ts
 * Module      : Validation Engine
 * Layer       : Pipeline
 *
 * -----------------------------------------------------------------------------
 * Purpose
 * -----------------------------------------------------------------------------
 * Defines the immutable result contract returned by every validator in the
 * iePDF Validation Engine.
 *
 * Every validator MUST return ValidationResult.
 *
 * This file contains NO validation logic.
 *
 * =============================================================================
 */

import {
    ValidationErrorCode,
    ValidationGate,
    ValidationRule,
    ValidationSeverity,
    ValidationStatus,
} from "./validationTypes";

/**
 * Immutable validation result.
 *
 * This contract is shared by:
 *
 * • Boundary Validators
 * • Security Validators
 * • Deep Validators
 * • Validation Pipeline
 * */
export interface ValidationResult {

    /**
     * Unique execution identifier.
     *
     * Used for diagnostics and logging.
     */
    readonly id: string;

    /**
     * Validation Gate.
     */
    readonly gate: ValidationGate;

    /**
     * Validation Rule.
     */
    readonly rule: ValidationRule;

    /**
     * Validator name.
     */
    readonly validator: string;

    /**
     * Current status.
     */
    readonly status: ValidationStatus;

    /**
     * Passed?
     */
    readonly passed: boolean;

    /**
     * Severity.
     */
    readonly severity: ValidationSeverity;

    /**
     * Error code.
     */
    readonly errorCode: ValidationErrorCode;

    /**
     * User friendly message.
     */
    readonly message: string;

    /**
     * Internal diagnostics.
     *
     * Never shown directly to end users.
     */
    readonly details?: string;

    /**
     * Optional exception.
     *
     * Development only.
     */
    readonly exception?: unknown;

    /**
     * Validation start timestamp.
     */
    readonly startedAt: Date;

    /**
     * Validation completion timestamp.
     */
    readonly completedAt: Date;

    /**
     * Execution duration.
     */
    readonly executionTimeMs: number;

    /**
     * Pipeline execution order.
     *
     * Example:
     * Boundary #1
     * Boundary #2
     */
    readonly order: number;

    /**
     * Optional metadata.
     */
    readonly metadata: Readonly<Record<string, unknown>>;

    /**
     * Future telemetry correlation.
     */
    readonly correlationId?: string;
}

/**
 * Immutable collection.
 */
export type ValidationResults =
    ReadonlyArray<ValidationResult>;