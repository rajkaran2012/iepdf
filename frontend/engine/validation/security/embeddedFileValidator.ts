/**
 * =============================================================================
 * iePDF Validation Engine
 * =============================================================================
 *
 * File       : embeddedFilesValidator.ts
 * Module     : Security Validation
 * Layer      : Security Gate
 *
 * -----------------------------------------------------------------------------
 * Purpose
 * -----------------------------------------------------------------------------
 * Validates whether a PDF document contains embedded files.
 *
 * Responsibilities
 * -----------------------------------------------------------------------------
 * • Executes the Embedded Files validation rule.
 * • Produces a ValidationResult.
 *
 * It MUST NOT:
 * • Open PDF documents
 * • Read PDF internals
 * • Detect embedded files directly
 * • Perform low-level PDF analysis
 *
 * Those responsibilities belong to dedicated detector classes.
 * =============================================================================
 */

import { BaseValidator } from "../common/baseValidator";

import type { ValidationContext } from "../pipeline/validationContext";
import type { ValidationResult } from "../pipeline/validationResult";

import {
    ValidationErrorCode,
    ValidationGate,
    ValidationRule,
} from "../pipeline/validationTypes";

import type {
    IEmbeddedFileDetector
} from "./interfaces/IEmbeddedFileDetector";

export class EmbeddedFilesValidator
extends BaseValidator {

    public override readonly name =
        "EmbeddedFilesValidator";

    public override readonly description =
        "Validates whether the PDF contains embedded files.";

    public override readonly gate =
        ValidationGate.SECURITY;

    public override readonly rule =
        ValidationRule.EMBEDDED_FILE;

    protected override readonly priority = 130;

    public constructor(

        private readonly embeddedFileDetector:
            IEmbeddedFileDetector

    ) {

        super();

    }

    protected override async execute(
        context: ValidationContext,
        startedAt: Date,
        timer: number
    ): Promise<ValidationResult> {

        const result =
            await this.embeddedFileDetector.detect(
                context.file
            );

        if (result.hasEmbeddedFiles) {

            return this.createFailureResult(
                startedAt,
                timer,
                ValidationErrorCode.EMBEDDED_FILE_DETECTED,
                "PDF contains embedded files."
            );

        }

        return this.createSuccessResult(
            startedAt,
            timer,
            "No embedded files detected."
        );

    }

}