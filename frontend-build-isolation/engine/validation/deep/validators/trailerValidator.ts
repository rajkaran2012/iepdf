/**
 * =============================================================================
 * iePDF Validation Engine
 * =============================================================================
 *
 * File       : trailerValidator.ts
 * Module     : Deep Validation
 * Layer      : Deep Validation Gate
 * =============================================================================
 */

import { BaseValidator } from "../../common/baseValidator";

import type {
    ValidationContext
} from "../../pipeline/validationContext";

import type {
    ValidationResult
} from "../../pipeline/validationResult";

import {
    ValidationErrorCode,
    ValidationGate,
    ValidationRule
} from "../../pipeline/validationTypes";

import {
    TrailerDetector
} from "../detectors/trailerDetector";

export class TrailerValidator
    extends BaseValidator {

    public override readonly name =
        "TrailerValidator";

    public override readonly description =
        "Validates the PDF trailer dictionary.";

    public override readonly gate =
        ValidationGate.DEEP;

    public override readonly rule =
        ValidationRule.TRAILER;

    protected override readonly priority =
        230;

    private readonly trailerDetector =
        new TrailerDetector();

    protected override async execute(
        context: ValidationContext,
        startedAt: Date,
        timer: number
    ): Promise<ValidationResult> {

        const result =
            await this.trailerDetector.detect(
                context.file
            );

        if (!result.validTrailer) {

            return this.createFailureResult(
                startedAt,
                timer,
                ValidationErrorCode.INVALID_TRAILER,
                result.reason ??
                    "Invalid PDF trailer structure."
            );

        }

        return this.createSuccessResult(
            startedAt,
            timer,
            `Valid PDF trailer (/Size ${result.size}, /Root ${result.rootObjectNumber} ${result.rootGenerationNumber} R).`
        );

    }

}
