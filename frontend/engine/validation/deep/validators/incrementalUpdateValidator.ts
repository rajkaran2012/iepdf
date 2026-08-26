/**
 * =============================================================================
 * iePDF Validation Engine
 * =============================================================================
 *
 * File       : incrementalUpdateValidator.ts
 * Module     : Deep Validation
 * Layer      : Deep Validation Gate
 * =============================================================================
 */

import {
    BaseValidator
} from "../../common/baseValidator";

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
    IncrementalUpdateDetector
} from "../detectors/incrementalUpdateDetector";

export class IncrementalUpdateValidator
    extends BaseValidator {

    public override readonly name =
        "IncrementalUpdateValidator";

    public override readonly description =
        "Validates the structural PDF incremental-update chain.";

    public override readonly gate =
        ValidationGate.DEEP;

    public override readonly rule =
        ValidationRule.INCREMENTAL_UPDATE;

    protected override readonly priority =
        280;

    private readonly incrementalUpdateDetector =
        new IncrementalUpdateDetector();

    protected override async execute(
        context: ValidationContext,
        startedAt: Date,
        timer: number
    ): Promise<ValidationResult> {

        const result =
            await this.incrementalUpdateDetector.detect(
                context.file
            );

        if (
            !result.validIncrementalUpdate
        ) {

            return this.createFailureResult(
                startedAt,
                timer,
                ValidationErrorCode.INVALID_INCREMENTAL_UPDATE,
                result.reason ??
                    "Invalid PDF incremental-update structure."
            );

        }

        return this.createSuccessResult(
            startedAt,
            timer,
            `Valid PDF incremental-update chain (${result.revisionCount} revisions, ${result.previousRevisionCount} /Prev links).`
        );

    }

}
