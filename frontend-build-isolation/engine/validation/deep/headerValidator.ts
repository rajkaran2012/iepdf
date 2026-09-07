/**
 * =============================================================================
 * iePDF Validation Engine
 * =============================================================================
 *
 * File       : headerValidator.ts
 * Module     : Deep Validation
 * Layer      : Deep Validation Gate
 *
 * -----------------------------------------------------------------------------
 * Purpose
 * -----------------------------------------------------------------------------
 * Validates whether a PDF contains a valid PDF header.
 *
 * Responsibilities
 * -----------------------------------------------------------------------------
 * • Executes the Header validation rule.
 * • Produces a ValidationResult.
 *
 * It MUST NOT:
 * • Read PDF bytes
 * • Parse the document
 * • Detect the header directly
 *
 * Those responsibilities belong to HeaderDetector.
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
    IHeaderDetector
} from "./interfaces/IHeaderDetector";

export class HeaderValidator
extends BaseValidator {

    public override readonly name =
        "HeaderValidator";

    public override readonly description =
        "Validates the PDF header.";

    public override readonly gate =
        ValidationGate.DEEP;

    public override readonly rule =
        ValidationRule.HEADER;

    protected override readonly priority = 200;

    public constructor(

        private readonly headerDetector:
            IHeaderDetector

    ) {

        super();

    }

    protected override async execute(
        context: ValidationContext,
        startedAt: Date,
        timer: number
    ): Promise<ValidationResult> {

        const result =
            await this.headerDetector.detect(
                context.file
            );

        if (!result.validHeader) {

            return this.createFailureResult(
                startedAt,
                timer,
                ValidationErrorCode.INVALID_HEADER,
                "Invalid PDF header."
            );

        }

        return this.createSuccessResult(
            startedAt,
            timer,
            "Valid PDF header."
        );

    }

}