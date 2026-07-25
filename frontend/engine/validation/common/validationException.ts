/**
 * =============================================================================
 * iePDF Browser Engine
 * =============================================================================
 *
 * File        : validationException.ts
 * Module      : Validation Engine
 * Layer       : Common
 *
 * -----------------------------------------------------------------------------
 * Purpose
 * -----------------------------------------------------------------------------
 * Defines all Validation Engine exceptions.
 *
 * IMPORTANT
 * -----------------------------------------------------------------------------
 * Validation failures are NOT exceptions.
 *
 * Example:
 *  ✓ File too large
 *  ✓ Invalid MIME
 *  ✓ Invalid PDF Header
 *  ✓ Password Protected
 *
 * These return ValidationResult.
 *
 * Exceptions are reserved ONLY for unexpected internal failures.
 *
 * =============================================================================
 */

import {
    ValidationGate,
    ValidationRule,
} from "../pipeline/validationTypes";

/**
 * Base Validation Exception
 */
export class ValidationException extends Error {

    public readonly gate?: ValidationGate;

    public readonly rule?: ValidationRule;

    public readonly cause?: unknown;

    public readonly timestamp: Date;

    constructor(options: {
        message: string;
        gate?: ValidationGate;
        rule?: ValidationRule;
        cause?: unknown;
    }) {

        super(options.message);

        this.name = this.constructor.name;

        this.gate = options.gate;

        this.rule = options.rule;

        this.cause = options.cause;

        this.timestamp = new Date();

        Object.setPrototypeOf(this, new.target.prototype);
    }
}

/**
 * Invalid Validation Context
 */
export class ValidationContextException extends ValidationException {}

/**
 * Pipeline Failure
 */
export class ValidationPipelineException extends ValidationException {}

/**
 * Validator Registration Failure
 */
export class ValidatorRegistrationException extends ValidationException {}

/**
 * Validator Execution Failure
 */
export class ValidatorExecutionException extends ValidationException {}

/**
 * Browser Capability Failure
 */
export class BrowserCapabilityException extends ValidationException {}

/**
 * Configuration Failure
 */
export class ValidationConfigurationException extends ValidationException {}

/**
 * Internal Validation Engine Failure
 */
export class ValidationEngineException extends ValidationException {}