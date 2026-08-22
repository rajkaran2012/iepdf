/**
 * =============================================================================
 * iePDF Validation Engine
 * =============================================================================
 *
 * File        : IValidationGateway.ts
 * Module      : Validation Gateway
 * Layer       : Application Boundary
 *
 * =============================================================================
 * Purpose
 * =============================================================================
 *
 * Defines the single application-facing contract for PDF validation.
 *
 * Application tools MUST use this gateway instead of directly accessing:
 *
 * - BoundaryValidatorRegistry
 * - SecurityValidatorRegistry
 * - DeepValidatorRegistry
 * - ValidationPipeline internals
 * - PDF parsing services
 * - Security detectors
 *
 * The gateway is intentionally technology-independent.
 *
 * =============================================================================
 * Security Principles
 * =============================================================================
 *
 * 1. Fail closed.
 * 2. Never treat absence of an exception as validation success.
 * 3. Return immutable validation results.
 * 4. Never expose internal exceptions as user-facing information.
 * 5. Never perform PDF processing.
 * 6. Never modify uploaded files.
 * 7. Keep validation separate from tool processing.
 *
 * =============================================================================
 */

import type { ToolType } from "@/lib/validationTypes";

import type {
    ValidationResult
} from "../pipeline/validationResult";

/**
 * ============================================================================
 * Gateway Result
 * ============================================================================
 *
 * This is deliberately different from the UI ValidationResult in
 * lib/validationTypes.ts.
 *
 * The engine result retains the complete security/diagnostic information.
 */
export interface ValidationGatewayResult {

    /**
     * Explicit application decision.
     *
     * TRUE  -> processing may proceed.
     * FALSE -> processing MUST NOT proceed.
     */
    readonly passed: boolean;

    /**
     * Complete immutable validation results.
     */
    readonly results: ReadonlyArray<ValidationResult>;

    /**
     * Correlation identifier for this validation execution.
     */
    readonly correlationId: string;

}

/**
 * ============================================================================
 * Validation Gateway Contract
 * ============================================================================
 */
export interface IValidationGateway {

    /**
     * Validate one or more uploaded files.
     *
     * For single-file tools:
     *
     *     files = [file]
     *     file  = file
     *
     * For multi-file tools such as Merge:
     *
     *     files = all selected files
     *     file  = current file being validated
     *
     * The implementation MUST fail closed.
     */
    validate(
        files: ReadonlyArray<File>,
        file: File,
        toolType: ToolType
    ): Promise<ValidationGatewayResult>;

}