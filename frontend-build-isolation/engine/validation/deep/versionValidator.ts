/**
 * =============================================================================
 * iePDF Validation Engine
 * =============================================================================
 *
 * File       : versionValidator.ts
 * Module     : Deep Validation
 * Layer      : Deep Validation Gate
 *
 * =============================================================================
 * Purpose
 * =============================================================================
 *
 * Validates the PDF version detected by VersionDetector.
 *
 * Detection is performed by VersionDetector.
 * This class converts the detection result into the canonical
 * ValidationResult used by the Deep Validation Gate.
 *
 * This validator:
 *
 * - Does not parse PDF structures.
 * - Does not use PDF.js.
 * - Does not use PDFium.
 * - Does not modify the source file.
 * - Does not contain UI logic.
 *
 * =============================================================================
 */

import { BaseValidator } from "../common/baseValidator";

import type {
    ValidationContext
} from "../pipeline/validationContext";

import type {
    ValidationResult
} from "../pipeline/validationResult";

import {
    ValidationErrorCode,
    ValidationGate,
    ValidationRule
} from "../pipeline/validationTypes";

import {
    VersionDetector
} from "./detectors/versionDetector";

export class VersionValidator
    extends BaseValidator {

    public override readonly name =
        "VersionValidator";

    public override readonly description =
        "Validates the PDF version.";

    public override readonly gate =
        ValidationGate.DEEP;

    public override readonly rule =
        ValidationRule.VERSION;

    protected override readonly priority =
        210;

    /**
     * Stateless browser-side detector.
     */
    private readonly versionDetector =
        new VersionDetector();

    /**
     * =========================================================================
     * Execute Version Validation
     * =========================================================================
     */
    protected override async execute(
        context: ValidationContext,
        startedAt: Date,
        timer: number
    ): Promise<ValidationResult> {

        const result =
            await this.versionDetector.detect(
                context.file
            );

        if (!result.validVersion) {

            return this.createFailureResult(
                startedAt,
                timer,
                ValidationErrorCode.INVALID_VERSION,
                result.reason ??
                    "Invalid or unsupported PDF version."
            );

        }

        return this.createSuccessResult(
            startedAt,
            timer,
            `Valid PDF version: ${result.detectedVersion}.`
        );

    }

}