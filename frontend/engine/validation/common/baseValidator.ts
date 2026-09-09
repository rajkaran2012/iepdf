/**
 * =============================================================================
 * iePDF Validation Engine
 * =============================================================================
 *
 * File        : baseValidator.ts
 * Module      : Validation Framework
 * Layer       : Common
 *
 * -----------------------------------------------------------------------------
 * Purpose
 * -----------------------------------------------------------------------------
 * Enterprise base class for every validator in the iePDF Validation Engine.
 *
 * This class implements:
 *
 * ✔ Template Method Pattern
 * ✔ Browser First
 * ✔ Client First
 * ✔ SOLID
 * ✔ Fail Fast
 * ✔ Immutable Design
 * ✔ Centralized Exception Handling
 * ✔ Enterprise Lifecycle
 *
 * Child validators MUST implement only business validation logic.
 *
 * =============================================================================
 */

import type { IValidator } from "./validator";

import type { ValidationContext } from "../pipeline/validationContext";
import type { ValidationResult } from "../pipeline/validationResult";

import {
    ValidationErrorCode,
    ValidationGate,
    ValidationRule,
    ValidationSeverity,
    ValidationStatus,
} from "../pipeline/validationTypes";

import { ValidationUtils } from "./validationUtils";

export abstract class BaseValidator implements IValidator {

    // -------------------------------------------------------------------------
    // Validator Identity
    // -------------------------------------------------------------------------

    public abstract readonly name: string;

    public abstract readonly description: string;

    public abstract readonly gate: ValidationGate;

    public abstract readonly rule: ValidationRule;

    public readonly enabled: boolean = true;

    /**
     * Internal execution priority.
     * Used by ValidationPipeline.
     */
    protected readonly priority: number = 100;

    // -------------------------------------------------------------------------
    // Public Entry
    // -------------------------------------------------------------------------

    /**
     * Never override.
     *
     * All validators execute through this method.
     */
    public async validate(
        context: ValidationContext
    ): Promise<ValidationResult> {

        const startedAt = new Date();
        const timer = performance.now();

        try {

            this.ensureContext(context);

            if (!this.enabled) {

                return this.createSkippedResult(
                    startedAt,
                    timer,
                    "Validator disabled."
                );

            }

            return await this.execute(context, startedAt, timer);

        }
        catch (error) {

            return this.createExceptionResult(
                startedAt,
                timer,
                ValidationUtils.toError(error)
            );

        }

    }

    // -------------------------------------------------------------------------
    // Template Method
    // -------------------------------------------------------------------------

    /**
     * Framework execution.
     *
     * Child validators never override validate().
     * They implement execute().
     */
    protected abstract execute(
        context: ValidationContext,
        startedAt: Date,
        timer: number
    ): Promise<ValidationResult>;

    // -------------------------------------------------------------------------
    // Context Validation
    // -------------------------------------------------------------------------

    /**
     * Validates framework prerequisites.
     */
    protected ensureContext(
        context: ValidationContext
    ): void {

        if (!context) {
            throw new Error("ValidationContext is required.");
        }

        if (!context.file) {
            throw new Error("ValidationContext.file is required.");
        }

        if (context.cancelled) {
            throw new Error("Validation cancelled.");
        }

    }

/* ================= INSERT HERE ================= */

protected createResult(options: {
    startedAt: Date;
    timer: number;
    status: ValidationStatus;
    passed: boolean;
    severity: ValidationSeverity;
    errorCode: ValidationErrorCode;
    message: string;
    details?: string;
    exception?: unknown;
}): ValidationResult {

    const completedAt = new Date();

    const executionTimeMs = performance.now() - options.timer;

    return Object.freeze({
        id: crypto.randomUUID(),

        gate: this.gate,

        rule: this.rule,

        validator: this.name,

        status: options.status,

        passed: options.passed,

        severity: options.severity,

        errorCode: options.errorCode,

        message: options.message,

        details: options.details,

        exception: options.exception,

        startedAt: options.startedAt,

        completedAt,

        executionTimeMs,

        order: 0,

        metadata: Object.freeze({}),

        correlationId: undefined,
    });

}

/* ================= INSERT ENDS ================= */
// -------------------------------------------------------------------------
/**
 * Creates a successful validation result.
 */
protected createSuccessResult(
    startedAt: Date,
    timer: number,
    message: string,
    details?: string
): ValidationResult {

    return this.createResult({
        startedAt,
        timer,
        status: ValidationStatus.PASSED,
        passed: true,
        severity: ValidationSeverity.INFO,
        errorCode: ValidationErrorCode.NONE,
        message,
        details,
    });

 }

/**
 * Creates a failed validation result.
 */
protected createFailureResult(
    startedAt: Date,
    timer: number,
    errorCode: ValidationErrorCode,
    message: string,
    details?: string
): ValidationResult {

    return this.createResult({
        startedAt,
        timer,
        status: ValidationStatus.FAILED,
        passed: false,
        severity: ValidationSeverity.ERROR,
        errorCode,
        message,
        details,
    });

}






/**
 * Creates a skipped validation result.
 */
protected createSkippedResult(
    startedAt: Date,
    timer: number,
    message: string
): ValidationResult {

    return this.createResult({
        startedAt,
        timer,
        status: ValidationStatus.SKIPPED,
        passed: true,
        severity: ValidationSeverity.INFO,
        errorCode: ValidationErrorCode.NONE,
        message,
    });

}

/**
 * Creates an exception validation result.
 */
protected createExceptionResult(
    startedAt: Date,
    timer: number,
    error: Error
): ValidationResult {

    return this.createResult({
        startedAt,
        timer,
        status: ValidationStatus.FAILED,
        passed: false,
        severity: ValidationSeverity.CRITICAL,
        errorCode: ValidationErrorCode.UNKNOWN_ERROR,
        message: error.message,
        details: error.stack,
        exception: error,
    });

}

}